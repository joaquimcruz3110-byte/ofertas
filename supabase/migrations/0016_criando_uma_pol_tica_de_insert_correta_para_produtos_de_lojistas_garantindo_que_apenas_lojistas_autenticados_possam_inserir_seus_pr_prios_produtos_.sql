CREATE POLICY "Shopkeepers can insert their own products" ON public.products
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = shopkeeper_id);