-- Enum de roles
CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'superadmin');

-- Función para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  apellido TEXT NOT NULL DEFAULT '',
  dni TEXT,
  telefono TEXT,
  email TEXT,
  provincia TEXT,
  localidad TEXT,
  ref_code TEXT UNIQUE,
  referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Función security definer para evitar recursión RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ============ USER CREDITS ============
CREATE TABLE public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  retirables INTEGER NOT NULL DEFAULT 0 CHECK (retirables >= 0),
  bonus INTEGER NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_credits_updated
BEFORE UPDATE ON public.user_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TOURNAMENTS ============
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- ============ MATCHDAYS ============
CREATE TABLE public.matchdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  entry_cost INTEGER NOT NULL DEFAULT 30,
  prize_pool INTEGER NOT NULL DEFAULT 0,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, number)
);

ALTER TABLE public.matchdays ENABLE ROW LEVEL SECURITY;

-- ============ MATCHES ============
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matchday_id UUID NOT NULL REFERENCES public.matchdays(id) ON DELETE CASCADE,
  home_team TEXT NOT NULL,
  home_short TEXT NOT NULL,
  home_color TEXT NOT NULL DEFAULT '#1e293b',
  away_team TEXT NOT NULL,
  away_short TEXT NOT NULL,
  away_color TEXT NOT NULL DEFAULT '#1e293b',
  kickoff TIMESTAMPTZ NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | live | finished
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- ============ PREDICTIONS ============
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL CHECK (home_score >= 0 AND home_score <= 99),
  away_score INTEGER NOT NULL CHECK (away_score >= 0 AND away_score <= 99),
  points INTEGER NOT NULL DEFAULT 0,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_predictions_updated
BEFORE UPDATE ON public.predictions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS POLICIES ============

-- profiles: el usuario ve y edita su propio perfil. Admins ven sus afiliados. Superadmin ve todo.
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_self_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_admin_select" ON public.profiles
  FOR SELECT USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_super_all" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- user_roles: el usuario solo puede leer sus propios roles. Solo superadmin puede modificar.
CREATE POLICY "roles_self_select" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "roles_super_all" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- user_credits: el usuario solo lee sus créditos. Solo admin/superadmin pueden modificar (vía función o panel).
CREATE POLICY "credits_self_select" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "credits_admin_select" ON public.user_credits
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = user_credits.user_id AND p.admin_id = auth.uid()
    )
  );
CREATE POLICY "credits_super_all" ON public.user_credits
  FOR ALL USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- tournaments / matchdays / matches: lectura pública para usuarios autenticados, escritura solo superadmin
CREATE POLICY "tournaments_auth_select" ON public.tournaments
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tournaments_super_all" ON public.tournaments
  FOR ALL USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "matchdays_auth_select" ON public.matchdays
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "matchdays_super_all" ON public.matchdays
  FOR ALL USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "matches_auth_select" ON public.matches
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "matches_super_all" ON public.matches
  FOR ALL USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- predictions: solo el dueño puede CRUD. Cualquier autenticado puede ver puntos agregados (para el ranking, pero por ahora restringimos).
CREATE POLICY "predictions_self_all" ON public.predictions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "predictions_super_select" ON public.predictions
  FOR SELECT USING (public.has_role(auth.uid(), 'superadmin'));

-- ============ TRIGGER DE SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref TEXT;
BEGIN
  v_ref := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)), '[^a-z0-9]', '', 'g')) || substr(NEW.id::text, 1, 6);

  INSERT INTO public.profiles (
    user_id, nombre, apellido, dni, telefono, email, provincia, localidad, ref_code
  ) VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'nombre', ''),
    coalesce(NEW.raw_user_meta_data->>'apellido', ''),
    NEW.raw_user_meta_data->>'dni',
    NEW.raw_user_meta_data->>'telefono',
    NEW.email,
    NEW.raw_user_meta_data->>'provincia',
    NEW.raw_user_meta_data->>'localidad',
    v_ref
  );

  INSERT INTO public.user_credits (user_id, retirables, bonus) VALUES (NEW.id, 0, 0);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SEED DEMO ============
INSERT INTO public.tournaments (id, name, country) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Liga Profesional Argentina', 'Argentina'),
  ('22222222-2222-2222-2222-222222222222', 'Champions League', 'Europa');

INSERT INTO public.matchdays (id, tournament_id, number, starts_at, entry_cost, prize_pool) VALUES
  ('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 14, now() + interval '2 days', 30, 4200),
  ('aaaa1111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 15, now() + interval '9 days', 30, 0),
  ('bbbb2222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 6, now() + interval '5 days', 50, 4860);

INSERT INTO public.matches (matchday_id, home_team, home_short, home_color, away_team, away_short, away_color, kickoff) VALUES
  ('aaaa1111-0000-0000-0000-000000000001', 'River Plate', 'RI', '#e0001a', 'Boca Juniors', 'BO', '#003087', now() + interval '2 days'),
  ('aaaa1111-0000-0000-0000-000000000001', 'Racing', 'RA', '#7ec8e3', 'Independiente', 'IN', '#c8102e', now() + interval '2 days 2 hours'),
  ('aaaa1111-0000-0000-0000-000000000001', 'San Lorenzo', 'SL', '#1e3a8a', 'Huracán', 'HU', '#dc2626', now() + interval '2 days 4 hours'),
  ('aaaa1111-0000-0000-0000-000000000001', 'Estudiantes', 'ES', '#dc2626', 'Gimnasia', 'GI', '#1e40af', now() + interval '3 days'),
  ('bbbb2222-0000-0000-0000-000000000001', 'Real Madrid', 'RM', '#D4AF37', 'Barcelona', 'FC', '#004D98', now() + interval '5 days'),
  ('bbbb2222-0000-0000-0000-000000000001', 'Man. City', 'MC', '#6CABDD', 'Liverpool', 'LF', '#C8102E', now() + interval '5 days 2 hours'),
  ('bbbb2222-0000-0000-0000-000000000001', 'Bayern Munich', 'BM', '#DC052D', 'Dortmund', 'BV', '#FDE100', now() + interval '6 days'),
  ('bbbb2222-0000-0000-0000-000000000001', 'PSG', 'PS', '#004170', 'Marsella', 'OM', '#2CBFEB', now() + interval '6 days 2 hours');