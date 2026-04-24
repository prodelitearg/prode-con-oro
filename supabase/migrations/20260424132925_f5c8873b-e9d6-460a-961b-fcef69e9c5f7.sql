CREATE TABLE IF NOT EXISTS public.match_prediction_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  prediction_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  credits integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.match_prediction_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mpp_self_select ON public.match_prediction_payouts;
CREATE POLICY mpp_self_select
ON public.match_prediction_payouts
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS mpp_super_all ON public.match_prediction_payouts;
CREATE POLICY mpp_super_all
ON public.match_prediction_payouts
FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE INDEX IF NOT EXISTS idx_mpp_match_id ON public.match_prediction_payouts(match_id);
CREATE INDEX IF NOT EXISTS idx_mpp_user_id ON public.match_prediction_payouts(user_id);

CREATE OR REPLACE FUNCTION public.confirm_match_result(_match_id uuid, _home_score integer, _away_score integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_match record;
  r record;
  v_points int;
  v_credits int;
  v_players int := 0;
  v_awarded int := 0;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT has_role(v_actor, 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'Solo superadmin puede confirmar resultados';
  END IF;
  IF _home_score IS NULL OR _away_score IS NULL OR _home_score < 0 OR _away_score < 0 OR _home_score > 99 OR _away_score > 99 THEN
    RAISE EXCEPTION 'Resultado inválido';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF v_match IS NULL THEN RAISE EXCEPTION 'Partido no encontrado'; END IF;
  IF v_match.status = 'finished' THEN RAISE EXCEPTION 'El resultado ya está confirmado'; END IF;

  UPDATE public.matches
  SET home_score = _home_score, away_score = _away_score, status = 'finished'
  WHERE id = _match_id;

  FOR r IN SELECT * FROM public.predictions WHERE match_id = _match_id FOR UPDATE LOOP
    v_points := public.calculate_prediction_points(r.home_score, r.away_score, _home_score, _away_score);
    v_credits := CASE WHEN v_points = 3 THEN 3 WHEN v_points = 1 THEN 1 ELSE 0 END;

    UPDATE public.predictions
    SET points = v_points, locked = true, updated_at = now()
    WHERE id = r.id;

    v_players := v_players + 1;

    IF v_credits > 0 THEN
      INSERT INTO public.match_prediction_payouts (match_id, prediction_id, user_id, credits)
      VALUES (_match_id, r.id, r.user_id, v_credits)
      ON CONFLICT (prediction_id) DO NOTHING;

      IF FOUND THEN
        INSERT INTO public.user_credits (user_id, retirables, bonus)
        VALUES (r.user_id, v_credits, 0)
        ON CONFLICT (user_id) DO UPDATE
          SET retirables = user_credits.retirables + v_credits,
              updated_at = now();
        v_awarded := v_awarded + v_credits;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('match_id', _match_id, 'players', v_players, 'awarded', v_awarded);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reopen_match_result(_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_match record;
  r record;
  v_reversed int := 0;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT has_role(v_actor, 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'Solo superadmin puede editar resultados';
  END IF;

  SELECT m.*, md.closed_at INTO v_match
  FROM public.matches m
  JOIN public.matchdays md ON md.id = m.matchday_id
  WHERE m.id = _match_id
  FOR UPDATE;
  IF v_match IS NULL THEN RAISE EXCEPTION 'Partido no encontrado'; END IF;
  IF v_match.closed_at IS NOT NULL THEN RAISE EXCEPTION 'No se puede editar una fecha cerrada'; END IF;

  FOR r IN SELECT * FROM public.match_prediction_payouts WHERE match_id = _match_id FOR UPDATE LOOP
    UPDATE public.user_credits
    SET retirables = GREATEST(0, retirables - r.credits), updated_at = now()
    WHERE user_id = r.user_id;
    v_reversed := v_reversed + r.credits;
  END LOOP;

  DELETE FROM public.match_prediction_payouts WHERE match_id = _match_id;

  UPDATE public.predictions
  SET points = 0, locked = false, updated_at = now()
  WHERE match_id = _match_id;

  UPDATE public.matches
  SET home_score = NULL, away_score = NULL, status = 'scheduled'
  WHERE id = _match_id;

  RETURN jsonb_build_object('match_id', _match_id, 'reversed', v_reversed);
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_matchday(_matchday_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_admin_assigned int := 0;
  v_rank int;
  v_share numeric;
  v_amount int;
BEGIN
  IF NOT has_role(auth.uid(), 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'Solo superadmin puede cerrar fechas';
  END IF;

  SELECT * INTO v_md FROM public.matchdays WHERE id = _matchday_id FOR UPDATE;
  IF v_md IS NULL THEN RAISE EXCEPTION 'Fecha no encontrada'; END IF;
  IF v_md.closed_at IS NOT NULL THEN RAISE EXCEPTION 'La fecha ya está cerrada'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.matches WHERE matchday_id = _matchday_id
      AND (home_score IS NULL OR away_score IS NULL OR status <> 'finished')
  ) THEN
    RAISE EXCEPTION 'Hay partidos sin resultado confirmado';
  END IF;

  SELECT count(DISTINCT p.user_id) INTO v_players
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  WHERE m.matchday_id = _matchday_id;

  SELECT coalesce(sum(mpp.credits), 0)::int INTO v_base_assigned
  FROM public.match_prediction_payouts mpp
  JOIN public.matches m ON m.id = mpp.match_id
  WHERE m.matchday_id = _matchday_id;

  v_total := v_players * v_md.entry_cost;
  v_carry_in := coalesce(v_md.pot_carry, 0);
  v_super := floor(v_total * 0.30)::int;
  v_admin_pool := floor(v_total * 0.10)::int;
  v_base_pool := floor(v_total * 0.10)::int;
  v_top_pool := v_total - v_super - v_admin_pool - v_base_pool;
  v_top_total := v_top_pool + v_carry_in;

  IF v_players < 3 THEN
    SELECT id INTO v_next_md FROM public.matchdays
      WHERE tournament_id = v_md.tournament_id AND number > v_md.number
      ORDER BY number ASC LIMIT 1;

    IF v_next_md IS NOT NULL THEN
      UPDATE public.matchdays SET pot_carry = pot_carry + v_top_total WHERE id = v_next_md;
    END IF;

    v_top_total := 0;
  END IF;

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

  INSERT INTO public.matchday_commissions (matchday_id, recipient_user_id, kind, amount)
  VALUES (_matchday_id, NULL, 'super', v_super);

  FOR r IN
    SELECT pr.admin_id AS admin_id,
      floor(v_admin_pool * (count(DISTINCT p.user_id)::numeric /
        NULLIF((SELECT count(DISTINCT pp.user_id) FROM public.predictions pp
                JOIN public.matches mm ON mm.id = pp.match_id
                WHERE mm.matchday_id = _matchday_id), 0)))::int AS amount
    FROM public.predictions p
    JOIN public.matches m ON m.id = p.match_id
    JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE m.matchday_id = _matchday_id AND pr.admin_id IS NOT NULL
    GROUP BY pr.admin_id
  LOOP
    IF r.amount > 0 THEN
      INSERT INTO public.matchday_commissions (matchday_id, recipient_user_id, kind, amount)
      VALUES (_matchday_id, r.admin_id, 'admin', r.amount);

      INSERT INTO public.user_credits (user_id, retirables, bonus)
      VALUES (r.admin_id, r.amount, 0)
      ON CONFLICT (user_id) DO UPDATE
        SET retirables = user_credits.retirables + r.amount, updated_at = now();

      v_admin_assigned := v_admin_assigned + r.amount;
    END IF;
  END LOOP;

  UPDATE public.matchdays
  SET closed_at = now(), is_open = false, pot_carry = 0
  WHERE id = _matchday_id;

  UPDATE public.matchdays SET prize_pool = v_top_total WHERE id = _matchday_id;

  RETURN jsonb_build_object(
    'players', v_players,
    'total_collected', v_total,
    'super_commission', v_super,
    'admin_pool', v_admin_pool,
    'admin_assigned', v_admin_assigned,
    'base_pool_theoretical', v_base_pool,
    'base_assigned', v_base_assigned,
    'top_pool', v_top_pool,
    'carry_in', v_carry_in,
    'top_total_distributed', v_rank_assigned,
    'carried_to_next', CASE WHEN v_players < 3 THEN v_top_pool + v_carry_in ELSE 0 END
  );
END;
$function$;