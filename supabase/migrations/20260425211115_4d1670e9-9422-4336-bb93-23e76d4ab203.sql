
-- Tabla de entradas pagadas por fecha
CREATE TABLE public.matchday_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  matchday_id uuid NOT NULL,
  paid_credits integer NOT NULL DEFAULT 0,
  paid_bonus integer NOT NULL DEFAULT 0,
  paid_retirables integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, matchday_id)
);

ALTER TABLE public.matchday_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entries_self_select"
  ON public.matchday_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "entries_super_all"
  ON public.matchday_entries FOR ALL
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

CREATE INDEX idx_matchday_entries_user ON public.matchday_entries(user_id);
CREATE INDEX idx_matchday_entries_md ON public.matchday_entries(matchday_id);

-- Tabla de movimientos de créditos (historial)
CREATE TABLE public.credit_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  description text NOT NULL,
  amount integer NOT NULL,
  bonus_delta integer NOT NULL DEFAULT 0,
  retirables_delta integer NOT NULL DEFAULT 0,
  matchday_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movements_self_select"
  ON public.credit_movements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "movements_super_all"
  ON public.credit_movements FOR ALL
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

CREATE INDEX idx_credit_movements_user ON public.credit_movements(user_id, created_at DESC);

-- RPC para pagar entrada
CREATE OR REPLACE FUNCTION public.pay_matchday_entry(_matchday_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_md record;
  v_tournament_name text;
  v_credits record;
  v_already public.matchday_entries%ROWTYPE;
  v_cost int;
  v_bonus_use int;
  v_ret_use int;
  v_first_kickoff timestamptz;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_md FROM public.matchdays WHERE id = _matchday_id;
  IF v_md IS NULL THEN RAISE EXCEPTION 'Fecha no encontrada'; END IF;
  IF v_md.closed_at IS NOT NULL THEN RAISE EXCEPTION 'La fecha ya fue cerrada'; END IF;

  -- ¿Ya pagó?
  SELECT * INTO v_already FROM public.matchday_entries
    WHERE user_id = v_user AND matchday_id = _matchday_id;
  IF v_already.id IS NOT NULL THEN
    RETURN jsonb_build_object('already_paid', true, 'paid_credits', v_already.paid_credits);
  END IF;

  -- Verificar que el primer partido no haya empezado
  SELECT min(kickoff) INTO v_first_kickoff FROM public.matches WHERE matchday_id = _matchday_id;
  IF v_first_kickoff IS NOT NULL AND v_first_kickoff <= now() THEN
    RAISE EXCEPTION 'La fecha ya comenzó, no se puede pagar entrada';
  END IF;

  v_cost := v_md.entry_cost;
  IF v_cost <= 0 THEN
    -- Entrada gratis: registrar igual
    INSERT INTO public.matchday_entries (user_id, matchday_id, paid_credits, paid_bonus, paid_retirables)
    VALUES (v_user, _matchday_id, 0, 0, 0);
    RETURN jsonb_build_object('paid_credits', 0, 'bonus_used', 0, 'retirables_used', 0);
  END IF;

  SELECT * INTO v_credits FROM public.user_credits WHERE user_id = v_user FOR UPDATE;
  IF v_credits IS NULL THEN
    INSERT INTO public.user_credits (user_id, retirables, bonus) VALUES (v_user, 0, 0)
    RETURNING * INTO v_credits;
  END IF;

  IF (v_credits.bonus + v_credits.retirables) < v_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  -- Primero bonus, luego retirables
  v_bonus_use := LEAST(v_credits.bonus, v_cost);
  v_ret_use   := v_cost - v_bonus_use;

  UPDATE public.user_credits
    SET bonus = bonus - v_bonus_use,
        retirables = retirables - v_ret_use,
        updated_at = now()
    WHERE user_id = v_user;

  INSERT INTO public.matchday_entries (user_id, matchday_id, paid_credits, paid_bonus, paid_retirables)
  VALUES (v_user, _matchday_id, v_cost, v_bonus_use, v_ret_use);

  -- Acumular pozo
  UPDATE public.matchdays
    SET prize_pool = prize_pool + v_cost
    WHERE id = _matchday_id;

  -- Movimiento
  SELECT t.name INTO v_tournament_name FROM public.tournaments t WHERE t.id = v_md.tournament_id;
  INSERT INTO public.credit_movements (user_id, kind, description, amount, bonus_delta, retirables_delta, matchday_id)
  VALUES (
    v_user,
    'entrada',
    'Entrada Fecha ' || v_md.number::text || ' · ' || coalesce(v_tournament_name, 'Liga'),
    -v_cost,
    -v_bonus_use,
    -v_ret_use,
    _matchday_id
  );

  RETURN jsonb_build_object(
    'paid_credits', v_cost,
    'bonus_used', v_bonus_use,
    'retirables_used', v_ret_use
  );
END;
$$;
