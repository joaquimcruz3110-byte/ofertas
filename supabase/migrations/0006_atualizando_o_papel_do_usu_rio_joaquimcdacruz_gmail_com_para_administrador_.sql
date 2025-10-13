UPDATE public.profiles
SET role = 'administrador'
WHERE id = (SELECT id FROM auth.users WHERE email = 'joaquimcdacruz@gmail.com');