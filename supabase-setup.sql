-- ═══════════════════════════════════════════════
-- ESTATEisREAL — Tablas de Supabase
-- Ejecutar en SQL Editor de Supabase
-- ═══════════════════════════════════════════════

-- 1. Perfiles de usuario (se crea automáticamente al registrarse)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  nombre TEXT,
  empresa TEXT,
  pais TEXT DEFAULT 'RD',
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  trial_start TIMESTAMPTZ,
  trial_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Feedback de usuarios (del modal antes de imprimir)
CREATE TABLE IF NOT EXISTS feedback (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  proyecto TEXT,
  pregunta_1 TEXT,
  pregunta_2 TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Eventos de analytics (tracking de uso)
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Proyectos guardados (para futuro)
CREATE TABLE IF NOT EXISTS proyectos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  supuestos JSONB NOT NULL,
  mix JSONB NOT NULL,
  thresholds JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ SEGURIDAD (Row Level Security) ═══

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;

-- Profiles: cada usuario solo ve/edita su propio perfil
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Feedback: cualquier usuario autenticado puede insertar, solo ve los suyos
CREATE POLICY "Users can insert feedback" ON feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own feedback" ON feedback FOR SELECT USING (auth.uid() = user_id);
-- Permitir feedback anónimo (sin login)
CREATE POLICY "Anon can insert feedback" ON feedback FOR INSERT WITH CHECK (user_id IS NULL);

-- Analytics: cualquier usuario puede insertar eventos
CREATE POLICY "Users can insert events" ON analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own events" ON analytics_events FOR SELECT USING (auth.uid() = user_id);

-- Proyectos: cada usuario solo accede a los suyos
CREATE POLICY "Users can CRUD own projects" ON proyectos FOR ALL USING (auth.uid() = user_id);

-- ═══ TRIGGER: Crear perfil automáticamente al registrarse ═══

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existe y recrear
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
