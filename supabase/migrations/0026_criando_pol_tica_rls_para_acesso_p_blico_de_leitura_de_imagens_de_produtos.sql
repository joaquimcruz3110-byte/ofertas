CREATE POLICY "Public access to product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product_images');