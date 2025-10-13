-- Create commission_rates table
CREATE TABLE public.commission_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rate DECIMAL(5, 2) NOT NULL, -- e.g., 5.00 for 5%
  set_by_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  set_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE NOT NULL
);

-- Enable RLS (REQUIRED)
ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

-- Policies: Only admins can manage commission rates
CREATE POLICY "Admins can view commission rates" ON public.commission_rates
FOR SELECT TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'administrador');

CREATE POLICY "Admins can insert commission rates" ON public.commission_rates
FOR INSERT TO authenticated WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'administrador');

CREATE POLICY "Admins can update commission rates" ON public.commission_rates
FOR UPDATE TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'administrador');

CREATE POLICY "Admins can delete commission rates" ON public.commission_rates
FOR DELETE TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'administrador');