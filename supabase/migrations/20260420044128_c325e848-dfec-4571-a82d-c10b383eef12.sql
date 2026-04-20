-- Tracking de cierre y pozo acumulado
ALTER TABLE public.matchdays
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pot_carry integer NOT NULL DEFAULT 0;

-- Tabla de payouts por usuario por fecha
CREATE TABLE IF NOT EXISTS public.matchday_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matchday_id uuid NOT NULL REFERENCES public.matchdays(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  base_prize integer NOT NULL DEFAULT 0,
  ranking_prize integer NOT NULL DEFAULT 0,
  rank_position integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (matchday_id, user_id)
);

ALTER TABLE public.matchday_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payouts_self_select" ON public.matchday_payouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "payouts_super_all" ON public.matchday_payouts
  FOR ALL USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Tabla de comisiones (super y admin afiliador)
CREATE TABLE IF NOT EXISTS public.matchday_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matchday_id uuid NOT NULL REFERENCES public.matchdays(id) ON DELETE CASCADE,
  recipient_user_id uuid,
  kind text NOT NULL, -- 'super' | 'admin'
  amount integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.matchday_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commissions_super_all" ON public.matchday_commissions
  FOR ALL USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "commissions_recipient_select" ON public.matchday_commissions
  FOR SELECT USING (auth.uid() = recipient_user_id);

-- Función de cierre de fecha: aplica distribución oficial
CREATE OR REPLACE FUNCTION public.close_matchday(_matchday_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_md record;
  v_players int;
  v_total int;
  v_super int;
  v_admin_pool int;
  v_base_pool int;
  v_top_pool int;
  v_carry_in int;
  v_top_total int;
  v_next_md uuid;
  r record;
  v_base_assigned int := 0;
  v_rank_assigned int := 0;
  v_rank int;
  v_share numeric;
  v_amount int;
BEGIN
  -- Solo superadmin
  IF NOT has_role(auth.uid(), 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'Solo superadmin puede cerrar fechas';
  END IF;

  SELECT * INTO v_md FROM public.matchdays WHERE id = _matchday_id FOR UPDATE;
  IF v_md IS NULL THEN RAISE EXCEPTION 'Fecha no encontrada'; END IF;
  IF v_md.closed_at IS NOT NULL THEN RAISE EXCEPTION 'La fecha ya está cerrada'; END IF;

  -- Validar que todos los partidos tengan resultado
  IF EXISTS (
    SELECT 1 FROM public.matches WHERE matchday_id = _matchday_id
      AND (home_score IS NULL OR away_score IS NULL)
  ) THEN
    RAISE EXCEPTION 'Hay partidos sin resultado cargado';
  END IF;

  -- Jugadores únicos que pronosticaron al menos 1 partido de la fecha
  SELECT count(DISTINCT p.user_id) INTO v_players
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  WHERE m.matchday_id = _matchday_id;

  v_total := v_players * v_md.entry_cost;
  v_carry_in := coalesce(v_md.pot_carry, 0);

  -- Distribución oficial sobre lo recaudado en la fecha
  v_super := floor(v_total * 0.30)::int;
  v_admin_pool := floor(v_total * 0.10)::int;
  v_base_pool := floor(v_total * 0.10)::int;
  v_top_pool := v_total - v_super - v_admin_pool - v_base_pool; -- ~50%
  v_top_total := v_top_pool + v_carry_in;

  -- Si no hay 3 jugadores mínimos, acumular pozo a la siguiente fecha y NO repartir top5
  IF v_players < 3 THEN
    SELECT id INTO v_next_md FROM public.matchdays
      WHERE tournament_id = v_md.tournament_id AND number > v_md.number
      ORDER BY number ASC LIMIT 1;

    IF v_next_md IS NOT NULL THEN
      UPDATE public.matchdays SET pot_carry = pot_carry + v_top_total WHERE id = v_next_md;
    END IF;

    -- Aún así pagamos premios base por aciertos y comisiones
    v_top_total := 0;
  END IF;

  -- Premio base por aciertos: 3 créditos exactos / 1 crédito ganador (retirables)
  FOR r IN
    SELECT p.user_id,
           sum(CASE WHEN p.points = 3 THEN 3 WHEN p.points = 1 THEN 1 ELSE 0 END)::int AS base
    FROM public.predictions p
    JOIN public.matches m ON m.id = p.match_id
    WHERE m.matchday_id = _matchday_id AND p.points > 0
    GROUP BY p.user_id
  LOOP
    INSERT INTO public.matchday_payouts (matchday_id, user_id, base_prize)
    VALUES (_matchday_id, r.user_id, r.base)
    ON CONFLICT (matchday_id, user_id) DO UPDATE SET base_prize = EXCLUDED.base_prize;

    INSERT INTO public.user_credits (user_id, retirables, bonus)
    VALUES (r.user_id, r.base, 0)
    ON CONFLICT (user_id) DO UPDATE
      SET retirables = user_credits.retirables + r.base, updated_at = now();

    v_base_assigned := v_base_assigned + r.base;
  END LOOP;

  -- Reparto top 5 (si hay pozo a repartir)
  IF v_top_total > 0 THEN
    v_rank := 0;
    FOR r IN
      SELECT user_id, total_points, exact_hits
      FROM public.tournament_leaderboard(v_md.tournament_id)
      LIMIT 5
    LOOP
      v_rank := v_rank + 1;
      v_share := CASE v_rank
        WHEN 1 THEN 0.40
        WHEN 2 THEN 0.25
        WHEN 3 THEN 0.15
        WHEN 4 THEN 0.12
        WHEN 5 THEN 0.08
      END;
      v_amount := floor(v_top_total * v_share)::int;

      INSERT INTO public.matchday_payouts (matchday_id, user_id, ranking_prize, rank_position)
      VALUES (_matchday_id, r.user_id, v_amount, v_rank)
      ON CONFLICT (matchday_id, user_id) DO UPDATE
        SET ranking_prize = EXCLUDED.ranking_prize, rank_position = EXCLUDED.rank_position;

      INSERT INTO public.user_credits (user_id, retirables, bonus)
      VALUES (r.user_id, v_amount, 0)
      ON CONFLICT (user_id) DO UPDATE
        SET retirables = user_credits.retirables + v_amount, updated_at = now();

      v_rank_assigned := v_rank_assigned + v_amount;
    END LOOP;
  END IF;

  -- Comisión superadmin
  INSERT INTO public.matchday_commissions (matchday_id, recipient_user_id, kind, amount)
  VALUES (_matchday_id, NULL, 'super', v_super);

  -- Comisión admin afiliador: 10% del total se reparte proporcional a los jugadores afiliados a cada admin
  INSERT INTO public.matchday_commissions (matchday_id, recipient_user_id, kind, amount)
  SELECT _matchday_id, pr.admin_id, 'admin',
    floor(v_admin_pool * (count(DISTINCT p.user_id)::numeric /
      NULLIF((SELECT count(DISTINCT pp.user_id) FROM public.predictions pp
              JOIN public.matches mm ON mm.id = pp.match_id
              WHERE mm.matchday_id = _matchday_id), 0)))::int
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE m.matchday_id = _matchday_id AND pr.admin_id IS NOT NULL
  GROUP BY pr.admin_id;

  -- Marcar fecha como cerrada y consumir el carry
  UPDATE public.matchdays
  SET closed_at = now(), is_open = false, pot_carry = 0
  WHERE id = _matchday_id;

  -- Actualizar prize_pool para que quede registrado lo que era el pozo top5
  UPDATE public.matchdays SET prize_pool = v_top_total WHERE id = _matchday_id;

  RETURN jsonb_build_object(
    'players', v_players,
    'total_collected', v_total,
    'super_commission', v_super,
    'admin_pool', v_admin_pool,
    'base_pool_theoretical', v_base_pool,
    'base_assigned', v_base_assigned,
    'top_pool', v_top_pool,
    'carry_in', v_carry_in,
    'top_total_distributed', v_rank_assigned,
    'carried_to_next', CASE WHEN v_players < 3 THEN v_top_pool + v_carry_in ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_matchday(uuid) TO authenticated;