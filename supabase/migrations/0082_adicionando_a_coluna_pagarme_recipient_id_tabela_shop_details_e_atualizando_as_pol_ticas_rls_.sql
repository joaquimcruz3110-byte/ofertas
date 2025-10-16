ALTER TABLE public.shop_details
ADD COLUMN pagarme_recipient_id TEXT;

-- Adicionar ou atualizar política para lojistas atualizarem seu próprio pagarme_recipient_id
CREATE POLICY "Shopkeepers can update their own pagarme_recipient_id" ON public.shop_details
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Adicionar ou atualizar política para lojistas visualizarem seu próprio pagarme_recipient_id
CREATE POLICY "Shopkeepers can view their own pagarme_recipient_id" ON public.shop_details
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Adicionar ou atualizar política para administradores gerenciarem pagarme_recipient_id
CREATE POLICY "Admins can manage all shop details including pagarme_recipient_id" ON public.shop_details
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());