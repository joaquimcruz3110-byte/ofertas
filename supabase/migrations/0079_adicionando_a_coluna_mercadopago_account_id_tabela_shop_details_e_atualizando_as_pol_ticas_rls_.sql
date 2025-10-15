-- Adicionar a coluna mercadopago_account_id à tabela shop_details
ALTER TABLE public.shop_details
ADD COLUMN mercadopago_account_id TEXT;

-- Criar política RLS para lojistas atualizarem seu próprio mercadopago_account_id
CREATE POLICY "Shopkeepers can update their own mercadopago_account_id" ON public.shop_details
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Criar política RLS para usuários autenticados visualizarem o mercadopago_account_id de lojistas (se necessário para a plataforma)
-- Esta política permite que a plataforma (via RLS) ou outros lojistas/admins vejam o ID.
-- Para compradores, pode ser necessário uma política mais restritiva ou uma view.
CREATE POLICY "Authenticated users can view shopkeeper mercadopago_account_id" ON public.shop_details
FOR SELECT TO authenticated
USING (true);