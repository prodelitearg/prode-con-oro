-- Hacer request_credit_purchase seguro: ignorar valores del cliente y usar tabla de paquetes hardcoded
-- Paquetes oficiales: 1 cr retirable = 50 ARS

CREATE OR REPLACE FUNCTION public.request_credit_purchase(
  _package_id text,
  _package_name text,
  _credits integer,
  _bonus integer,
  _amount_ars integer,
  _receipt_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_admin uuid;
  v_id uuid;
  v_pkg_name text;
  v_pkg_credits int;
  v_pkg_bonus int;
  v_pkg_ars int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF coalesce(trim(_receipt_url),'') = '' THEN RAISE EXCEPTION 'Comprobante requerido'; END IF;

  -- Catálogo oficial de paquetes (ignoramos valores del cliente)
  CASE lower(coalesce(_package_id, ''))
    WHEN 'starter' THEN v_pkg_name := 'Starter'; v_pkg_credits := 100;  v_pkg_bonus := 0;   v_pkg_ars := 5000;
    WHEN 'plus'    THEN v_pkg_name := 'Plus';    v_pkg_credits := 270;  v_pkg_bonus := 30;  v_pkg_ars := 13500;
    WHEN 'pro'     THEN v_pkg_name := 'Pro';     v_pkg_credits := 420;  v_pkg_bonus := 80;  v_pkg_ars := 21000;
    WHEN 'full'    THEN v_pkg_name := 'Full';    v_pkg_credits := 800;  v_pkg_bonus := 200; v_pkg_ars := 40000;
    ELSE RAISE EXCEPTION 'Paquete inválido';
  END CASE;

  -- Validar invariante: 1 cr retirable = 50 ARS
  IF v_pkg_credits * 50 <> v_pkg_ars THEN
    RAISE EXCEPTION 'Configuración de paquete inconsistente';
  END IF;

  SELECT admin_id INTO v_admin FROM public.profiles WHERE user_id = v_user;

  INSERT INTO public.credit_purchase_requests
    (user_id, admin_id, package_id, package_name, credits, bonus, amount_ars, receipt_url)
  VALUES (v_user, v_admin, lower(_package_id), v_pkg_name, v_pkg_credits, v_pkg_bonus, v_pkg_ars, _receipt_url)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END; $function$;

-- Corregir solicitudes PENDING existentes con valores incorrectos para evitar fraude
UPDATE public.credit_purchase_requests
SET credits = 270, bonus = 30, amount_ars = 13500, package_name = 'Plus'
WHERE status = 'pending' AND lower(coalesce(package_id,'')) = 'plus';

UPDATE public.credit_purchase_requests
SET credits = 420, bonus = 80, amount_ars = 21000, package_name = 'Pro'
WHERE status = 'pending' AND lower(coalesce(package_id,'')) = 'pro';

UPDATE public.credit_purchase_requests
SET credits = 800, bonus = 200, amount_ars = 40000, package_name = 'Full'
WHERE status = 'pending' AND lower(coalesce(package_id,'')) = 'full';

UPDATE public.credit_purchase_requests
SET credits = 100, bonus = 0, amount_ars = 5000, package_name = 'Starter'
WHERE status = 'pending' AND lower(coalesce(package_id,'')) = 'starter';

-- Habilitar realtime en credit_purchase_requests para notificaciones a admin/superadmin
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_purchase_requests;
ALTER TABLE public.credit_purchase_requests REPLICA IDENTITY FULL;