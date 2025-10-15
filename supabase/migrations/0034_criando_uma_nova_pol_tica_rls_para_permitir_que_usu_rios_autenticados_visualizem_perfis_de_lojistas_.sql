CREATE POLICY "Authenticated users can view shopkeeper profiles" ON public.profiles
FOR SELECT TO authenticated
USING (role = 'lojista');