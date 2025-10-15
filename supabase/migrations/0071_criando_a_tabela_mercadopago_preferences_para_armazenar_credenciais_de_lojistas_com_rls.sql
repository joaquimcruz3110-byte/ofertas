-- Create mercadopago_preferences table
CREATE TABLE public.mercadopago_preferences (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  public_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.mercadopago_preferences ENABLE ROW LEVEL SECURITY;

-- Policies for mercadopago_preferences
-- Shopkeepers can view their own Mercado Pago preferences
CREATE POLICY "Shopkeepers can view their own Mercado Pago preferences" ON public.mercadopago_preferences
FOR SELECT TO authenticated USING (auth.uid() = id);

-- Shopkeepers can insert their own Mercado Pago preferences
CREATE POLICY "Shopkeepers can insert their own Mercado Pago preferences" ON public.mercadopago_preferences
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Shopkeepers can update their own Mercado Pago preferences
CREATE POLICY "Shopkeepers can update their own Mercado Pago preferences" ON public.mercadopago_preferences
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Shopkeepers can delete their own Mercado Pago preferences
CREATE POLICY "Shopkeepers can delete their own Mercado Pago preferences" ON public.mercadopago_preferences
FOR DELETE TO authenticated USING (auth.uid() = id);

-- Admins can manage all Mercado Pago preferences (optional, but good for oversight)
CREATE POLICY "Admins can manage all Mercado Pago preferences" ON public.mercadopago_preferences
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());