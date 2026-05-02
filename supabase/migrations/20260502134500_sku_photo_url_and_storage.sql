-- SKU product photo URL + public storage bucket for compressed images

ALTER TABLE public.skus ADD COLUMN IF NOT EXISTS photo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('sku-photos', 'sku-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read so Image can load getPublicUrl URLs without auth headers
DROP POLICY IF EXISTS "sku_photos_select_public" ON storage.objects;
CREATE POLICY "sku_photos_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'sku-photos');

DROP POLICY IF EXISTS "sku_photos_insert_own" ON storage.objects;
CREATE POLICY "sku_photos_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sku-photos'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "sku_photos_update_own" ON storage.objects;
CREATE POLICY "sku_photos_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'sku-photos'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'sku-photos'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "sku_photos_delete_own" ON storage.objects;
CREATE POLICY "sku_photos_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'sku-photos'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
