CREATE TABLE public.mercadopago_preferences (
  shopkeeper_id UUID NOT NULL REFERENCES public.shop_details(id) ON DELETE CASCADE PRIMARY KEY,
  access_token TEXT NOT NULL,
  public_key TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.mercadopago_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shopkeepers can view their own Mercado Pago preferences" ON public.mercadopago_preferences
FOR SELECT TO authenticated USING (auth.uid() = shopkeeper_id);

CREATE POLICY "Shopkeepers can insert their own Mercado Pago preferences" ON public.mercadopago_preferences
FOR INSERT TO authenticated WITH CHECK (auth.uid() = shopkeeper_id);

CREATE POLICY "Shopkeepers can update their own Mercado Pago preferences" ON public.mercadopago_preferences
FOR UPDATE TO authenticated USING (auth.uid() = shopkeeper_id);

CREATE POLICY "Shopkeepers can delete their own Mercado Pago preferences" ON public.mercadopago_preferences
FOR DELETE TO authenticated USING (auth.uid() = shopkeeper_id);

CREATE POLICY "Admins can manage all Mercado Pago preferences" ON public.mercadopago_preferences
FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());