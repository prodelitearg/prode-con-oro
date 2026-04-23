-- Actualizar handle_new_user para procesar código de referido
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ref TEXT;
  v_ref_input TEXT;
  v_referrer_id UUID;
  v_referrer_is_admin BOOLEAN := false;
  v_admin_id UUID;
BEGIN
  v_ref := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)), '[^a-z0-9]', '', 'g')) || substr(NEW.id::text, 1, 6);

  -- Procesar código de referido si se envió
  v_ref_input := nullif(trim(NEW.raw_user_meta_data->>'ref'), '');
  IF v_ref_input IS NOT NULL THEN
    SELECT user_id INTO v_referrer_id
    FROM public.profiles
    WHERE lower(ref_code) = lower(v_ref_input)
    LIMIT 1;

    IF v_referrer_id IS NOT NULL THEN
      -- Si el referidor es admin, queda como admin afiliador del nuevo usuario
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_referrer_id AND role IN ('admin','superadmin')
      ) INTO v_referrer_is_admin;

      IF v_referrer_is_admin THEN
        v_admin_id := v_referrer_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.profiles (
    user_id, nombre, apellido, dni, telefono, email, provincia, localidad, ref_code, referred_by, admin_id
  ) VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'nombre', ''),
    coalesce(NEW.raw_user_meta_data->>'apellido', ''),
    NEW.raw_user_meta_data->>'dni',
    NEW.raw_user_meta_data->>'telefono',
    NEW.email,
    NEW.raw_user_meta_data->>'provincia',
    NEW.raw_user_meta_data->>'localidad',
    v_ref,
    v_referrer_id,
    v_admin_id
  );

  -- 100 créditos bonus de bienvenida
  INSERT INTO public.user_credits (user_id, retirables, bonus) VALUES (NEW.id, 0, 100);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  RETURN NEW;
END; $function$;