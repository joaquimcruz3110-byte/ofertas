"use client";

import { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import ConnectStripeAccount from '@/components/ConnectStripeAccount';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from 'lucide-react';

const ShopkeeperPayouts = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [isLoadingPayoutDetails, setIsLoadingPayoutDetails] = useState(true);

  const fetchPayoutDetails = async () => {
    setIsLoadingPayoutDetails(true);
    if (!session?.user?.id) {
      setStripeAccountId(null);
      setIsLoadingPayoutDetails(false);
      return;
    }

    const { data, error } = await supabase
      .from('shopkeeper_payout_details')
      .select('stripe_account_id')
      .eq('shopkeeper_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
      showError('Erro ao carregar detalhes de pagamento: ' + error.message);
      console.error('Erro ao carregar detalhes de pagamento:', error.message);
      setStripeAccountId(null);
    } else if (data) {
      setStripeAccountId(data.stripe_account_id);
    } else {
      setStripeAccountId(null);
    }
    setIsLoadingPayoutDetails(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'lojista') {
      fetchPayoutDetails();
    }
  }, [session, isSessionLoading, userRole]);

  const handleAccountConnected = (accountId: string) => {
    setStripeAccountId(accountId);
    fetchPayoutDetails(); // Re-fetch para garantir que o estado está atualizado
  };

  if (isSessionLoading || isLoadingPayoutDetails) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session || userRole !== 'lojista') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray">
        <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
          <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Acesso Negado</h1>
          <p className="text-xl text-gray-600">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Meus Pagamentos</h1>
      <p className="text-lg text-gray-600 mb-8">
        Conecte sua conta Stripe para receber pagamentos pelas suas vendas.
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="mr-2 h-5 w-5" /> Status da Conexão Stripe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ConnectStripeAccount
            onAccountConnected={handleAccountConnected}
            currentStripeAccountId={stripeAccountId}
          />
          {!stripeAccountId && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              Você precisa conectar uma conta Stripe para receber os valores das suas vendas.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Aqui você pode adicionar mais seções para histórico de pagamentos, etc. */}
      <h2 className="text-2xl font-bold mb-4 text-dyad-dark-blue mt-8">Histórico de Pagamentos (Em Breve)</h2>
      <p className="text-gray-600">
        Esta seção mostrará seus pagamentos futuros e passados.
      </p>
    </div>
  );
};

export default ShopkeeperPayouts;