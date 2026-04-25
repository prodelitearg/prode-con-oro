CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role public.app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target_is_super boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.has_role(v_actor, 'superadmin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo superadmin puede cambiar roles';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario inválido';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'superadmin'::public.app_role
  ) INTO v_target_is_super;

  IF v_target_is_super THEN
    RAISE EXCEPTION 'No se puede modificar un superadmin';
  END IF;

  IF _role = 'admin'::public.app_role THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN jsonb_build_object('ok', true, 'message', 'Usuario promovido a admin', 'role', 'admin');
  ELSIF _role = 'user'::public.app_role THEN
    DELETE FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'::public.app_role;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN jsonb_build_object('ok', true, 'message', 'Rol admin removido', 'role', 'user');
  ELSE
    RAISE EXCEPTION 'Rol no permitido para esta acción';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated;

DROP POLICY IF EXISTS roles_super_update_explicit ON public.user_roles;
CREATE POLICY roles_super_update_explicit
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::public.app_role));

DROP POLICY IF EXISTS roles_super_insert_explicit ON public.user_roles;
CREATE POLICY roles_super_insert_explicit
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::public.app_role));

DROP POLICY IF EXISTS roles_super_delete_explicit ON public.user_roles;
CREATE POLICY roles_super_delete_explicit
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::public.app_role));