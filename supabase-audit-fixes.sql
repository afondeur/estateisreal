-- ============================================================
-- ESTATEisREAL — Security Audit Fixes
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1a. Restringir UPDATE en profiles: impedir que usuarios modifiquen tier/is_admin/stripe_*
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    tier IS NOT DISTINCT FROM (SELECT p.tier FROM profiles p WHERE p.id = auth.uid()) AND
    is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()) AND
    stripe_customer_id IS NOT DISTINCT FROM (SELECT p.stripe_customer_id FROM profiles p WHERE p.id = auth.uid()) AND
    stripe_subscription_id IS NOT DISTINCT FROM (SELECT p.stripe_subscription_id FROM profiles p WHERE p.id = auth.uid())
  );

-- 1b. Restringir analytics_events INSERT para que solo puedan insertar con su propio user_id
DROP POLICY IF EXISTS "Users can insert events" ON analytics_events;
CREATE POLICY "Authenticated users insert own events" ON analytics_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anon can insert events without user_id" ON analytics_events
  FOR INSERT WITH CHECK (user_id IS NULL);

-- 1c. Indexes para performance
CREATE INDEX IF NOT EXISTS idx_analytics_user_type_date ON analytics_events (user_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_proyectos_user_id ON proyectos (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_cid ON profiles (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
