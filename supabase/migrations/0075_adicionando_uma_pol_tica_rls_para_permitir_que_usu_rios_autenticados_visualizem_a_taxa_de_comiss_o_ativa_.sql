CREATE POLICY "Authenticated users can view active commission rates" ON public.commission_rates
FOR SELECT TO authenticated
USING (active = true);