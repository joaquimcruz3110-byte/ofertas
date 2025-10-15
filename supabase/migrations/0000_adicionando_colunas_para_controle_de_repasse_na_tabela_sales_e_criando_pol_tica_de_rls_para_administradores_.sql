-- Adiciona colunas para controle de repasse na tabela 'sales'
ALTER TABLE public.sales
ADD COLUMN is_paid_out BOOLEAN DEFAULT FALSE,
ADD COLUMN payout_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN payout_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Adiciona uma política de RLS para permitir que administradores atualizem o status de repasse das vendas
CREATE POLICY "Admins can update sales payout status" ON public.sales
FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());