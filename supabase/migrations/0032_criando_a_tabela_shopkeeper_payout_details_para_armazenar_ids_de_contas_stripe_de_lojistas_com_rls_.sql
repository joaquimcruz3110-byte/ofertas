-- Tabela para armazenar os detalhes de pagamento dos lojistas (ex: Stripe Account ID)
CREATE TABLE public.shopkeeper_payout_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopkeeper_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE, -- ID da conta do lojista no Stripe Connect
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita RLS (OBRIGATÓRIO)
ALTER TABLE public.shopkeeper_payout_details ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS:
-- Lojistas podem ver e atualizar seus próprios detalhes de pagamento
CREATE POLICY "Shopkeepers can view their own payout details" ON public.shopkeeper_payout_details
FOR SELECT TO authenticated
USING (auth.uid() = shopkeeper_id);

CREATE POLICY "Shopkeepers can insert their own payout details" ON public.shopkeeper_payout_details
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = shopkeeper_id);

CREATE POLICY "Shopkeepers can update their own payout details" ON public.shopkeeper_payout_details
FOR UPDATE TO authenticated
USING (auth.uid() = shopkeeper_id);

-- Administradores podem ver todos os detalhes de pagamento (para fins de auditoria/suporte)
CREATE POLICY "Admins can view all payout details" ON public.shopkeeper_payout_details
FOR SELECT TO authenticated
USING (public.is_admin());