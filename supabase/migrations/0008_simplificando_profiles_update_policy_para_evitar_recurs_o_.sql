DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);