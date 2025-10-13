CREATE POLICY "Admins can update profiles" ON public.profiles
FOR UPDATE TO authenticated USING (public.is_admin());