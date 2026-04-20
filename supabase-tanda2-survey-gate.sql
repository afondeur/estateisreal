-- ═══════════════════════════════════════════════════════════
-- ESTATEisREAL — Tanda 2: Gate de encuesta obligatoria
-- Ejecutar en Supabase Dashboard → SQL Editor
-- Incremental sobre tandas previas
-- ═══════════════════════════════════════════════════════════

-- Marca si el usuario ya completó la encuesta de valor.
-- Se setea server-side desde /api/mark-survey-completed (service_role).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS survey_completed_at TIMESTAMPTZ;

-- Proteger survey_completed_at del UPDATE directo por usuarios.
-- Solo service_role (API route) puede setearlo.
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    tier IS NOT DISTINCT FROM (SELECT p.tier FROM profiles p WHERE p.id = auth.uid()) AND
    is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()) AND
    stripe_customer_id IS NOT DISTINCT FROM (SELECT p.stripe_customer_id FROM profiles p WHERE p.id = auth.uid()) AND
    stripe_subscription_id IS NOT DISTINCT FROM (SELECT p.stripe_subscription_id FROM profiles p WHERE p.id = auth.uid()) AND
    pro_until IS NOT DISTINCT FROM (SELECT p.pro_until FROM profiles p WHERE p.id = auth.uid()) AND
    pro_source IS NOT DISTINCT FROM (SELECT p.pro_source FROM profiles p WHERE p.id = auth.uid()) AND
    survey_completed_at IS NOT DISTINCT FROM (SELECT p.survey_completed_at FROM profiles p WHERE p.id = auth.uid())
  );

-- Verificación
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'survey_completed_at';
