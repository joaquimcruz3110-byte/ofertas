CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (true);