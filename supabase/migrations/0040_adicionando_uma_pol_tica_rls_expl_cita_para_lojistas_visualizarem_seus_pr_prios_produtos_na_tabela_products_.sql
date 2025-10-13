-- Add policy for shopkeepers to view their own products
CREATE POLICY "Shopkeepers can view their own products" ON public.products
FOR SELECT TO authenticated USING (auth.uid() = shopkeeper_id);