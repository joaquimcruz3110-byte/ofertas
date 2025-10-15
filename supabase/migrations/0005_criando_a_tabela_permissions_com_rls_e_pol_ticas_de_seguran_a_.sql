-- Create permissions table
CREATE TABLE public.permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  permission_type TEXT NOT NULL, -- e.g., 'gerenciar_taxas', 'gerenciar_usuarios'
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (REQUIRED)
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Policies: Only admins can manage permissions
CREATE POLICY "Admins can view permissions" ON public.permissions
FOR SELECT TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'administrador');

CREATE POLICY "Admins can insert permissions" ON public.permissions
FOR INSERT TO authenticated WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'administrador');

CREATE POLICY "Admins can update permissions" ON public.permissions
FOR UPDATE TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'administrador');

CREATE POLICY "Admins can delete permissions" ON public.permissions
FOR DELETE TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'administrador');