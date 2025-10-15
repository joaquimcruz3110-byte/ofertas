-- Update policies for shop_logos bucket to use 'owner' column
-- Shopkeepers can upload their own shop logos
DROP POLICY IF EXISTS "Shopkeepers can upload their own shop logos" ON storage.objects;
CREATE POLICY "Shopkeepers can upload their own shop logos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shop_logos' AND owner = auth.uid());

-- Shopkeepers can update their own shop logos
DROP POLICY IF EXISTS "Shopkeepers can update their own shop logos" ON storage.objects;
CREATE POLICY "Shopkeepers can update their own shop logos" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'shop_logos' AND owner = auth.uid());

-- Shopkeepers can delete their own shop logos
DROP POLICY IF EXISTS "Shopkeepers can delete their own shop logos" ON storage.objects;
CREATE POLICY "Shopkeepers can delete their own shop logos" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'shop_logos' AND owner = auth.uid());