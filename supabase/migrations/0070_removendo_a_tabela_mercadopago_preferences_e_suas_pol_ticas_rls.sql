DROP POLICY IF EXISTS "Admins can manage all Mercado Pago preferences" ON public.mercadopago_preferences;
DROP POLICY IF EXISTS "Shopkeepers can view their own Mercado Pago preferences" ON public.mercadopago_preferences;
DROP POLICY IF EXISTS "Shopkeepers can insert their own Mercado Pago preferences" ON public.mercadopago_preferences;
DROP POLICY IF EXISTS "Shopkeepers can update their own Mercado Pago preferences" ON public.mercadopago_preferences;
DROP POLICY IF EXISTS "Shopkeepers can delete their own Mercado Pago preferences" ON public.mercadopago_preferences;
DROP TABLE IF EXISTS public.mercadopago_preferences;