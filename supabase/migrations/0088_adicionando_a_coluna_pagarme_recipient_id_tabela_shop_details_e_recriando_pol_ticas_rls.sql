ALTER TABLE public.shop_details
ADD COLUMN IF NOT EXISTS pagarme_recipient_id TEXT;

-- Apagar políticas se existirem antes de criar
DROP POLICY IF EXISTS "Shopkeepers can view their own pagarme_recipient_id" ON public.shop_details;
DROP POLICY IF EXISTS "Shopkeepers can update their own pagarme_recipient_id" ON public.shop_details;
DROP POLICY IF EXISTS "Admins can manage all shop details including pagarme_recipient_" ON public.shop_details;

-- Política para lojistas visualizarem seu próprio pagarme_recipient_id
CREATE POLICY "Shopkeepers can view their own pagarme_recipient_id" ON public.shop_details
FOR SELECT TO authenticated USING (auth.uid() = id);

-- Política para lojistas atualizarem seu próprio pagarme_recipient_id
CREATE POLICY "Shopkeepers can update their own pagarme_recipient_id" ON public.shop_details
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Política para administradores gerenciarem todos os detalhes da loja, incluindo pagarme_recipient_id
CREATE POLICY "Admins can manage all shop details including pagarme_recipient_" ON public.shop_details
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());