-- ═══════════════════════════════════════════════════════════
-- ESTATEisREAL — Tanda 1: NPS + campo país ya no requerido
-- Ejecutar en Supabase Dashboard → SQL Editor
-- Incremental sobre supabase-promo-setup.sql
-- ═══════════════════════════════════════════════════════════

-- ─── NPS en pricing_survey ────────────────────────────────
-- Pregunta: "¿Qué tan probable es que recomiendes ESTATEisREAL
-- a un colega?" (0-10). Mejor predictor cross-industry
-- de retención (Bain & Company, 2020).
ALTER TABLE pricing_survey
  ADD COLUMN IF NOT EXISTS nps SMALLINT CHECK (nps IS NULL OR (nps >= 0 AND nps <= 10));

-- ─── Verificación ─────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pricing_survey'
ORDER BY ordinal_position;
