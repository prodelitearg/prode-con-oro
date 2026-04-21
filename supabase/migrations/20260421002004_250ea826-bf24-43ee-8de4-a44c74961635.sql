-- Tabla de solicitudes de retiro
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  admin_id uuid,
  amount integer NOT NULL CHECK (amount >= 500),
  alias text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid
);

-- Validación de status mediante trigger (no CHECK para flexibilidad)
CREATE OR REPLACE FUNCTION public.validate_withdrawal_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Status inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_withdrawal_status
  BEFORE INSERT OR UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal_status();

-- Habilitar RLS
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Usuario puede ver y crear sus propias solicitudes
CREATE POLICY withdrawals_self_select ON public.withdrawals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY withdrawals_self_insert ON public.withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admin afiliador puede ver y actualizar las solicitudes de sus afiliados
CREATE POLICY withdrawals_admin_select ON public.withdrawals
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = admin_id
  );

CREATE POLICY withdrawals_admin_update ON public.withdrawals
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = admin_id
  );

-- Superadmin acceso total
CREATE POLICY withdrawals_super_all ON public.withdrawals
  FOR ALL USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Función para crear solicitud: descuenta créditos retirables y asigna admin_id automáticamente
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount integer, _alias text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_retirables int;
  v_admin uuid;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _amount < 500 THEN RAISE EXCEPTION 'Mínimo 500 créditos'; END IF;
  IF coalesce(trim(_alias), '') = '' THEN RAISE EXCEPTION 'Alias requerido'; END IF;

  SELECT retirables INTO v_retirables FROM public.user_credits WHERE user_id = v_user FOR UPDATE;
  IF v_retirables IS NULL OR v_retirables < _amount THEN
    RAISE EXCEPTION 'Créditos retirables insuficientes';
  END IF;

  SELECT admin_id INTO v_admin FROM public.profiles WHERE user_id = v_user;

  -- Descontar créditos al instante (quedan reservados para el retiro)
  UPDATE public.user_credits
    SET retirables = retirables - _amount, updated_at = now()
    WHERE user_id = v_user;

  INSERT INTO public.withdrawals (user_id, admin_id, amount, alias, status)
  VALUES (v_user, v_admin, _amount, trim(_alias), 'pending')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'amount', _amount);
END;
$$;

-- Función para que admin/superadmin resuelva la solicitud
CREATE OR REPLACE FUNCTION public.resolve_withdrawal(_withdrawal_id uuid, _approve boolean, _notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_w record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_w FROM public.withdrawals WHERE id = _withdrawal_id FOR UPDATE;
  IF v_w IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_w.status <> 'pending' THEN RAISE EXCEPTION 'La solicitud ya fue procesada'; END IF;

  -- Permisos: superadmin siempre, admin solo si es el admin afiliador
  IF NOT (
    has_role(v_actor, 'superadmin'::app_role) OR
    (has_role(v_actor, 'admin'::app_role) AND v_w.admin_id = v_actor)
  ) THEN
    RAISE EXCEPTION 'Sin permisos para resolver esta solicitud';
  END IF;

  IF _approve THEN
    UPDATE public.withdrawals
      SET status = 'approved', processed_at = now(), processed_by = v_actor, notes = _notes
      WHERE id = _withdrawal_id;
  ELSE
    -- Rechazado: devolver los créditos al usuario
    UPDATE public.user_credits
      SET retirables = retirables + v_w.amount, updated_at = now()
      WHERE user_id = v_w.user_id;

    UPDATE public.withdrawals
      SET status = 'rejected', processed_at = now(), processed_by = v_actor, notes = _notes
      WHERE id = _withdrawal_id;
  END IF;

  RETURN jsonb_build_object('id', _withdrawal_id, 'status', CASE WHEN _approve THEN 'approved' ELSE 'rejected' END);
END;
$$;