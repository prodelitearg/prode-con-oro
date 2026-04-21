-- 1) Agregar columnas external_id
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS external_id INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS external_provider TEXT;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS external_id BIGINT UNIQUE;

ALTER TABLE public.matchdays
  ADD COLUMN IF NOT EXISTS external_league_id INTEGER,
  ADD COLUMN IF NOT EXISTS external_season INTEGER;

-- 2) Insertar/actualizar ligas que se sincronizan desde API-Football
-- IDs oficiales de API-Football v3
INSERT INTO public.tournaments (name, country, is_active, external_id, external_provider)
VALUES
  ('Liga Profesional Argentina', 'Argentina', true, 128, 'api-football'),
  ('Primera Nacional', 'Argentina', true, 129, 'api-football'),
  ('Copa Libertadores', 'Conmebol', true, 13, 'api-football'),
  ('Copa Sudamericana', 'Conmebol', true, 11, 'api-football'),
  ('UEFA Champions League', 'Europa', true, 2, 'api-football')
ON CONFLICT (external_id) DO UPDATE
  SET name = EXCLUDED.name,
      country = EXCLUDED.country,
      is_active = EXCLUDED.is_active,
      external_provider = EXCLUDED.external_provider;