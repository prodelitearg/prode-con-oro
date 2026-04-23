-- 1) Tabla de solicitudes de compra de créditos
CREATE TABLE public.credit_purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  admin_id uuid,
  package_id text NOT NULL,
  package_name text NOT NULL,
  credits int NOT NULL,
  bonus int NOT NULL DEFAULT 0,
  amount_ars int NOT NULL,
  receipt_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cpr_user ON public.credit_purchase_requests(user_id);
CREATE INDEX idx_cpr_admin ON public.credit_purchase_requests(admin_id);
CREATE INDEX idx_cpr_status ON public.credit_purchase_requests(status);

ALTER TABLE public.credit_purchase_requests ENABLE ROW LEVEL SECURITY;

-- Validación de status
CREATE OR REPLACE FUNCTION public.validate_cpr_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Status inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_cpr_status
BEFORE INSERT OR UPDATE ON public.credit_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_cpr_status();

-- Policies
CREATE POLICY cpr_self_select ON public.credit_purchase_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY cpr_self_insert ON public.credit_purchase_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY cpr_admin_select ON public.credit_purchase_requests
  FOR SELECT USING (has_role(auth.uid(),'admin'::app_role) AND auth.uid() = admin_id);

CREATE POLICY cpr_admin_update ON public.credit_purchase_requests
  FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role) AND auth.uid() = admin_id);

CREATE POLICY cpr_super_all ON public.credit_purchase_requests
  FOR ALL USING (has_role(auth.uid(),'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(),'superadmin'::app_role));

-- 2) Bucket de comprobantes (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('credit-receipts','credit-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: cada usuario sube/lee sus propios archivos en /<uid>/...
CREATE POLICY "cpr_receipts_user_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'credit-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "cpr_receipts_user_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'credit-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "cpr_receipts_admin_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'credit-receipts'
    AND (
      has_role(auth.uid(),'superadmin'::app_role)
      OR (
        has_role(auth.uid(),'admin'::app_role)
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id::text = (storage.foldername(name))[1]
            AND p.admin_id = auth.uid()
        )
      )
    )
  );

-- 3) Función para crear solicitud
CREATE OR REPLACE FUNCTION public.request_credit_purchase(
  _package_id text,
  _package_name text,
  _credits int,
  _bonus int,
  _amount_ars int,
  _receipt_url text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_admin uuid;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _credits <= 0 OR _amount_ars <= 0 THEN RAISE EXCEPTION 'Datos inválidos'; END IF;
  IF coalesce(trim(_receipt_url),'') = '' THEN RAISE EXCEPTION 'Comprobante requerido'; END IF;

  SELECT admin_id INTO v_admin FROM public.profiles WHERE user_id = v_user;

  INSERT INTO public.credit_purchase_requests
    (user_id, admin_id, package_id, package_name, credits, bonus, amount_ars, receipt_url)
  VALUES (v_user, v_admin, _package_id, _package_name, _credits, _bonus, _amount_ars, _receipt_url)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END; $$;

-- 4) Función para resolver solicitud
CREATE OR REPLACE FUNCTION public.resolve_credit_purchase(
  _request_id uuid,
  _approve boolean,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_r record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_r FROM public.credit_purchase_requests WHERE id = _request_id FOR UPDATE;
  IF v_r IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_r.status <> 'pending' THEN RAISE EXCEPTION 'La solicitud ya fue procesada'; END IF;

  IF NOT (
    has_role(v_actor,'superadmin'::app_role)
    OR (has_role(v_actor,'admin'::app_role) AND v_r.admin_id = v_actor)
  ) THEN
    RAISE EXCEPTION 'Sin permisos para resolver esta solicitud';
  END IF;

  IF _approve THEN
    INSERT INTO public.user_credits (user_id, retirables, bonus)
    VALUES (v_r.user_id, v_r.credits, v_r.bonus)
    ON CONFLICT (user_id) DO UPDATE
      SET retirables = user_credits.retirables + v_r.credits,
          bonus      = user_credits.bonus + v_r.bonus,
          updated_at = now();

    UPDATE public.credit_purchase_requests
      SET status='approved', processed_at=now(), processed_by=v_actor, notes=_notes
      WHERE id = _request_id;
  ELSE
    UPDATE public.credit_purchase_requests
      SET status='rejected', processed_at=now(), processed_by=v_actor, notes=_notes
      WHERE id = _request_id;
  END IF;

  RETURN jsonb_build_object('id', _request_id, 'status', CASE WHEN _approve THEN 'approved' ELSE 'rejected' END);
END; $$;

-- 5) Bonus de bienvenida: actualizar handle_new_user a 100 cr bonus
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- 100 créditos bonus de bienvenida
  INSERT INTO public.user_credits (user_id, retirables, bonus) VALUES (NEW.id, 0, 100);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  RETURN NEW;
END; $$;
