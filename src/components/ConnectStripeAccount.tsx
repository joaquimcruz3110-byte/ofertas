"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, CreditCard } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';

interface ConnectStripeAccountProps {
  onAccountConnected: (stripeAccountId: string) => void;
  currentStripeAccountId?: string | null;
}

const ConnectStripeAccount = ({ onAccountConnected, currentStripeAccountId }: ConnectStripeAccountProps) => {
  const { session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectStripe = async () => {
    if (!session?.user?.id) {
      showError('Você precisa estar logado para conectar sua conta Stripe.');
      return;
    }

    setIsLoading(true);
    const toastId = showLoading('Redirecionando para o Stripe...');

    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-onboarding-link', {
        body: {
          shopkeeperId: session.user.id,
          returnUrl: window.location.origin + '/meus-pagamentos?success=true', // URL de retorno após o onboarding
          refreshUrl: window.location.origin + '/meus-pagamentos?refresh=true', // URL de refresh se o link expirar
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data && data.url) {
        dismissToast(toastId);
        setIsConnecting(true);
        window.location.href = data.url; // Redireciona para o Stripe
      } else {
        throw new Error('Não foi possível obter o link de onboarding do Stripe.');
      }

    } catch (error: any) {
      dismissToast(toastId);
      showError('Erro ao conectar com o Stripe: ' + error.message);
      console.error('Erro ao conectar com o Stripe:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Verifica se o Stripe retornou com sucesso após o onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true' && session?.user?.id) {
      // Limpa os parâmetros da URL
      navigateWithoutParams();
      
      const checkStripeAccount = async () => {
        const toastId = showLoading('Verificando conexão com o Stripe...');
        try {
          const { data, error } = await supabase
            .from('shopkeeper_payout_details')
            .select('stripe_account_id')
            .eq('shopkeeper_id', session.user.id)
            .single();

          if (error || !data) {
            throw new Error('Não foi possível verificar a conta Stripe conectada.');
          }
          showSuccess('Conta Stripe conectada com sucesso!');
          onAccountConnected(data.stripe_account_id);
        } catch (error: any) {
          showError('Erro ao verificar a conexão Stripe: ' + error.message);
          console.error('Erro ao verificar a conexão Stripe:', error.message);
        } finally {
          dismissToast(toastId);
        }
      };
      checkStripeAccount();
    }
  }, [session, onAccountConnected]);

  const navigateWithoutParams = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('success');
    url.searchParams.delete('refresh');
    window.history.replaceState({}, document.title, url.pathname);
  };

  if (currentStripeAccountId) {
    return (
      <div className="flex items-center justify-center p-4 border rounded-md bg-green-50 text-green-700">
        <CreditCard className="h-5 w-5 mr-2" />
        <span>Conta Stripe conectada! ID: {currentStripeAccountId.substring(0, 10)}...</span>
      </div>
    );
  }

  return (
    <Button
      onClick={handleConnectStripe}
      disabled={isLoading || isConnecting}
      className="w-full bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white py-3 text-lg"
    >
      {isLoading || isConnecting ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : (
        <CreditCard className="mr-2 h-5 w-5" />
      )}
      {isConnecting ? 'Conectando...' : 'Conectar Conta Stripe para Receber Pagamentos'}
    </Button>
  );
};

export default ConnectStripeAccount;