CREATE TABLE public.payment_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  preference_id TEXT NOT NULL UNIQUE, -- ID da preferência gerado pelo Mercado Pago
  buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  external_reference TEXT UNIQUE, -- Referência externa para vincular a vendas
  cart_items_snapshot JSONB, -- Snapshot dos itens do carrinho no momento da criação
  status TEXT DEFAULT 'created' NOT NULL, -- Status da preferência (e.g., 'created', 'approved', 'pending', 'failed', 'fulfilled')
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (OBRIGATÓRIO para segurança)
ALTER TABLE public.payment_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para compradores
CREATE POLICY "Buyers can view their own payment preferences" ON public.payment_preferences
FOR SELECT TO authenticated USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can insert their own payment preferences" ON public.payment_preferences
FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);

-- Políticas de RLS para administradores (para gerenciamento)
CREATE POLICY "Admins can view all payment preferences" ON public.payment_preferences
FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can update payment preferences" ON public.payment_preferences
FOR UPDATE TO authenticated USING (public.is_admin());