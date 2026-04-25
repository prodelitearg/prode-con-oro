-- Tabla de banners publicitarios
CREATE TABLE public.ads_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  link_url TEXT,
  title TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ads_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_banners_auth_select_active"
ON public.ads_banners FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "ads_banners_super_all"
ON public.ads_banners FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::public.app_role));

CREATE TRIGGER update_ads_banners_updated_at
BEFORE UPDATE ON public.ads_banners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket público para banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para banners
CREATE POLICY "banners_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

CREATE POLICY "banners_super_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banners' AND public.has_role(auth.uid(), 'superadmin'::public.app_role));

CREATE POLICY "banners_super_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'superadmin'::public.app_role));

CREATE POLICY "banners_super_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'superadmin'::public.app_role));