CREATE POLICY "Authenticated users can view shop details" ON public.shop_details
FOR SELECT TO authenticated USING (true);