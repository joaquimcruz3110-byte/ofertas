-- Create storage bucket for shop logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop_logos', 'shop_logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for shop_logos bucket
-- Public read access for shop logos
CREATE POLICY "Public read access for shop logos" ON storage.objects
FOR SELECT USING (bucket_id = 'shop_logos');

-- Shopkeepers can upload their own shop logos
CREATE POLICY "Shopkeepers can upload their own shop logos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shop_logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Shopkeepers can update their own shop logos
CREATE POLICY "Shopkeepers can update their own shop logos" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'shop_logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Shopkeepers can delete their own shop logos
CREATE POLICY "Shopkeepers can delete their own shop logos" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'shop_logos' AND auth.uid()::text = (storage.foldername(name))[1]);