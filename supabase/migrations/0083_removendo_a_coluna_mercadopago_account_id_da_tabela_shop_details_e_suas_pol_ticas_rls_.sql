-- Remover políticas RLS relacionadas a mercadopago_account_id
DROP POLICY IF EXISTS "Shopkeepers can update their own mercadopago_account_id" ON public.shop_details;
DROP POLICY IF EXISTS "Authenticated users can view shopkeeper mercadopago_account_id" ON public.shop_details;

-- Remover a coluna mercadopago_account_id da tabela shop_details
ALTER TABLE public.shop_details
DROP COLUMN mercadopago_account_id;