ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS payment_gateway_id TEXT,
ADD COLUMN IF NOT EXISTS payment_gateway_status TEXT;

-- Apagar política se existir antes de criar
DROP POLICY IF EXISTS "Admins can update sales payout status" ON public.sales;

-- Política para administradores atualizarem o status de repasse de vendas
CREATE POLICY "Admins can update sales payout status" ON public.sales
FOR UPDATE TO authenticated USING (public.is_admin());