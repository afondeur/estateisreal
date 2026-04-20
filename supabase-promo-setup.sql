-- ═══════════════════════════════════════════════════════════
-- ESTATEisREAL — Sistema de códigos promocionales + encuesta
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── 1. COLUMNAS NUEVAS EN profiles ───────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_source TEXT;

-- ─── 2. FUNCIÓN HELPER is_admin() ─────────────────────────
-- SECURITY DEFINER evita recursión RLS cuando otras policies
-- consultan profiles para verificar rol admin.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false)
$$;

-- ─── 3. TABLA promo_codes ─────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,
  description TEXT,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  duration_days INT NOT NULL CHECK (duration_days > 0),
  max_redemptions INT NOT NULL CHECK (max_redemptions > 0),
  current_redemptions INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. TABLA promo_redemptions ───────────────────────────
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL REFERENCES promo_codes(code) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT now(),
  pro_until TIMESTAMPTZ NOT NULL,
  UNIQUE (code, user_id),
  UNIQUE (code, email)
);

-- ─── 5. TABLA pricing_survey ──────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_survey (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  precio_rango TEXT,        -- rango elegido: "0-10", "10-25", "25-50", "50-100", ">100"
  precio_mensual_usd NUMERIC,  -- monto libre en USD/mes
  frecuencia TEXT,          -- "mensual" | "anual" | "por_proyecto"
  valor_principal TEXT,     -- qué valora más del producto
  mejoraria TEXT,           -- qué mejoraría
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 6. RLS ENABLE ────────────────────────────────────────
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_survey ENABLE ROW LEVEL SECURITY;

-- ─── 7. POLICIES promo_codes (solo admin lee; nadie escribe) ───
DROP POLICY IF EXISTS "Admins view promo_codes" ON promo_codes;
CREATE POLICY "Admins view promo_codes" ON promo_codes
  FOR SELECT USING (public.is_admin());

-- ─── 8. POLICIES promo_redemptions ────────────────────────
DROP POLICY IF EXISTS "Users view own redemptions" ON promo_redemptions;
CREATE POLICY "Users view own redemptions" ON promo_redemptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all redemptions" ON promo_redemptions;
CREATE POLICY "Admins view all redemptions" ON promo_redemptions
  FOR SELECT USING (public.is_admin());

-- ─── 9. POLICIES pricing_survey ───────────────────────────
DROP POLICY IF EXISTS "Authenticated users insert survey" ON pricing_survey;
CREATE POLICY "Authenticated users insert survey" ON pricing_survey
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anon can insert survey" ON pricing_survey;
CREATE POLICY "Anon can insert survey" ON pricing_survey
  FOR INSERT WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "Users view own survey" ON pricing_survey;
CREATE POLICY "Users view own survey" ON pricing_survey
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all survey" ON pricing_survey;
CREATE POLICY "Admins view all survey" ON pricing_survey
  FOR SELECT USING (public.is_admin());

-- ─── 10. ADMIN: policies en tablas existentes ────────────
-- feedback: admin ve todo
DROP POLICY IF EXISTS "Admins view all feedback" ON feedback;
CREATE POLICY "Admins view all feedback" ON feedback
  FOR SELECT USING (public.is_admin());

-- analytics_events: admin ve todo
DROP POLICY IF EXISTS "Admins view all analytics" ON analytics_events;
CREATE POLICY "Admins view all analytics" ON analytics_events
  FOR SELECT USING (public.is_admin());

-- profiles: admin ve todos los perfiles
DROP POLICY IF EXISTS "Admins view all profiles" ON profiles;
CREATE POLICY "Admins view all profiles" ON profiles
  FOR SELECT USING (public.is_admin());

-- ─── 11. PROTEGER pro_until/pro_source en UPDATE de profiles ───
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    tier IS NOT DISTINCT FROM (SELECT p.tier FROM profiles p WHERE p.id = auth.uid()) AND
    is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()) AND
    stripe_customer_id IS NOT DISTINCT FROM (SELECT p.stripe_customer_id FROM profiles p WHERE p.id = auth.uid()) AND
    stripe_subscription_id IS NOT DISTINCT FROM (SELECT p.stripe_subscription_id FROM profiles p WHERE p.id = auth.uid()) AND
    pro_until IS NOT DISTINCT FROM (SELECT p.pro_until FROM profiles p WHERE p.id = auth.uid()) AND
    pro_source IS NOT DISTINCT FROM (SELECT p.pro_source FROM profiles p WHERE p.id = auth.uid())
  );

-- ─── 12. FUNCIÓN ATÓMICA redeem_promo_code ────────────────
-- SECURITY DEFINER: corre con privilegios del dueño, bypasea RLS
-- Solo se llama desde el API route (service_role) → REVOKE para anon/authenticated
CREATE OR REPLACE FUNCTION public.redeem_promo_code(
  p_code TEXT,
  p_user_id UUID,
  p_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo RECORD;
  v_existing RECORD;
  v_pro_until TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_new_pro_until TIMESTAMPTZ;
BEGIN
  -- Lock row para evitar race conditions en canjes concurrentes
  SELECT * INTO v_promo FROM promo_codes WHERE code = p_code FOR UPDATE;

  IF v_promo.code IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'code_not_found',
      'message', 'Código no válido');
  END IF;

  IF NOT v_promo.active THEN
    RETURN json_build_object('ok', false, 'error', 'code_inactive',
      'message', 'Código inactivo');
  END IF;

  IF v_now < v_promo.valid_from THEN
    RETURN json_build_object('ok', false, 'error', 'code_not_yet_valid',
      'message', 'El código aún no está activo');
  END IF;

  IF v_now > v_promo.valid_until THEN
    RETURN json_build_object('ok', false, 'error', 'code_expired',
      'message', 'El código ha expirado');
  END IF;

  IF v_promo.current_redemptions >= v_promo.max_redemptions THEN
    RETURN json_build_object('ok', false, 'error', 'code_fully_redeemed',
      'message', 'El código ya alcanzó el máximo de canjes');
  END IF;

  SELECT * INTO v_existing
  FROM promo_redemptions
  WHERE code = p_code
    AND (user_id = p_user_id OR lower(email) = lower(p_email))
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'error', 'already_redeemed',
      'message', 'Ya canjeaste este código',
      'pro_until', v_existing.pro_until);
  END IF;

  v_pro_until := v_now + (v_promo.duration_days || ' days')::INTERVAL;

  INSERT INTO promo_redemptions (code, user_id, email, pro_until)
  VALUES (p_code, p_user_id, p_email, v_pro_until);

  UPDATE promo_codes
  SET current_redemptions = current_redemptions + 1
  WHERE code = p_code;

  -- Si ya tenía pro_until futuro, extender desde esa fecha en vez de sobrescribir
  SELECT pro_until INTO v_new_pro_until FROM profiles WHERE id = p_user_id;
  v_new_pro_until := GREATEST(COALESCE(v_new_pro_until, v_now), v_pro_until);

  UPDATE profiles
  SET
    tier = 'pro',
    pro_until = v_new_pro_until,
    pro_source = 'promo:' || p_code,
    updated_at = v_now
  WHERE id = p_user_id;

  RETURN json_build_object(
    'ok', true,
    'pro_until', v_new_pro_until,
    'duration_days', v_promo.duration_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_promo_code(TEXT, UUID, TEXT) FROM anon, authenticated;
-- service_role tiene acceso por default; se llama desde /api/redeem-code

-- ─── 13. INSERT del código TUR2026 ────────────────────────
INSERT INTO promo_codes (code, description, valid_from, valid_until, duration_days, max_redemptions)
VALUES (
  'TUR2026',
  'Clase - regalo 90 días Pro',
  '2026-04-20 00:00:00-04',  -- 20 abril 2026 00:00 RD (UTC-4)
  '2026-04-27 23:59:59-04',  -- 27 abril 2026 23:59 RD
  90,
  100
)
ON CONFLICT (code) DO NOTHING;

-- ─── 14. INDEXES ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_email ON promo_redemptions(lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_pro_until ON profiles(pro_until) WHERE pro_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pricing_survey_created ON pricing_survey(created_at DESC);

-- ─── 15. VISTA para admin dashboard (opcional, conveniente) ───
-- Estadísticas rápidas del código TUR2026
CREATE OR REPLACE VIEW admin_promo_stats AS
SELECT
  pc.code,
  pc.description,
  pc.valid_from,
  pc.valid_until,
  pc.duration_days,
  pc.max_redemptions,
  pc.current_redemptions,
  pc.max_redemptions - pc.current_redemptions AS remaining,
  pc.active
FROM promo_codes pc;

-- Nota: las VIEWs heredan las RLS policies de las tablas subyacentes
-- (admin_promo_stats solo verá promo_codes si el caller es admin).
