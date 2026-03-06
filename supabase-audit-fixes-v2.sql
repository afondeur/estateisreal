-- ═══════════════════════════════════════════════════════════
-- ESTATEisREAL — Audit Fixes v2
-- H7: Columnas faltantes + H8: Trigger con ON CONFLICT
-- ═══════════════════════════════════════════════════════════

-- H7: Columnas faltantes en el schema
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS pregunta_3 TEXT;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- H8: Trigger handle_new_user con ON CONFLICT para evitar race conditions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
