-- ═══════════════════════════════════════════════════════════
-- ESTATEisREAL — Tanda 3: Inteligencia de Mercado
-- Ejecutar en Supabase Dashboard → SQL Editor
-- Captura snapshots anónimos de cada análisis para benchmarks
-- ═══════════════════════════════════════════════════════════

-- ─── TABLA market_intelligence ────────────────────────────
-- Snapshots 100% anónimos. NO contiene user_id, email, ni
-- nombre de proyecto — solo campos agregables para benchmarks.
CREATE TABLE IF NOT EXISTS market_intelligence (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Categorización (nuevos inputs del form)
  ciudad TEXT,
  sector TEXT,
  sistema_constructivo TEXT,
  tipo_proyecto TEXT,

  -- Métricas de terreno
  area_terreno NUMERIC,           -- m²
  precio_terreno NUMERIC,         -- USD total
  precio_terreno_m2 NUMERIC,      -- USD/m² (calculado)

  -- Métricas de construcción
  costo_construccion_m2 NUMERIC,  -- USD/m²
  area_construida NUMERIC,        -- m² (suma del mix)

  -- Métricas de venta
  precio_venta_m2_promedio NUMERIC,  -- USD/m² (calculado del mix)
  ingresos_totales NUMERIC,          -- USD

  -- Unidades
  unidades_total INT,

  -- Timing
  meses_predev INT,
  meses_construccion INT,
  meses_postventa INT,

  -- Financiamiento
  tasa_interes NUMERIC,           -- 0.11 = 11%
  draw_factor NUMERIC,
  preventa_pct NUMERIC,
  cobro_pct NUMERIC,

  -- Costos indirectos
  soft_costs_pct NUMERIC,
  comision_venta_pct NUMERIC,
  marketing_pct NUMERIC,
  contingencias_pct NUMERIC,

  -- Resultados (calculados por el motor)
  margen_pct NUMERIC,
  roi_pct NUMERIC,
  tir_pct NUMERIC,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS: usuarios autenticados INSERT, solo admin SELECT ──
ALTER TABLE market_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users insert market_intelligence" ON market_intelligence;
CREATE POLICY "Authenticated users insert market_intelligence" ON market_intelligence
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins view all market_intelligence" ON market_intelligence;
CREATE POLICY "Admins view all market_intelligence" ON market_intelligence
  FOR SELECT USING (public.is_admin());

-- ─── INDEXES para queries rápidas de agregación ───────────
CREATE INDEX IF NOT EXISTS idx_mi_ciudad ON market_intelligence(ciudad);
CREATE INDEX IF NOT EXISTS idx_mi_sistema ON market_intelligence(sistema_constructivo);
CREATE INDEX IF NOT EXISTS idx_mi_tipo ON market_intelligence(tipo_proyecto);
CREATE INDEX IF NOT EXISTS idx_mi_created ON market_intelligence(created_at DESC);

-- ─── Verificación ─────────────────────────────────────────
SELECT COUNT(*) AS tabla_creada FROM information_schema.tables
WHERE table_name = 'market_intelligence';
