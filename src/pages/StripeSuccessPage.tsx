"use client";

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '@/components/CartProvider';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/components/SessionContextProvider';

const StripeSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { session } = useSession();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processando seu pedido...');

  useEffect(() => {
    const fulfillOrder = async () => {
      if (!sessionId || !session?.access_token) {
        setMessage('Erro: ID da sessão ou token de autenticação ausente.');
        setStatus('error');
        showError('Erro ao processar o pedido: informações incompletas.');
        return;
      }

      const toastId = showLoading('Finalizando seu pedido...');

      try {
        const response = await fetch('https://vnlwxosrkcpwypiqywnr.supabase.co/functions/v1/fulfill-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
          setStatus('error');
          setMessage(data.error || 'Ocorreu um erro ao finalizar seu pedido.');
          showError(data.error || 'Erro ao finalizar o pedido.');
          return;
        }

        setStatus('success');
        setMessage('Seu pedido foi realizado com sucesso!');
        showSuccess('Compra finalizada com sucesso!');
        clearCart(); // Limpa o carrinho após o sucesso
      } catch (error: any) {
        console.error('Erro ao processar o pedido:', error);
        setStatus('error');
        setMessage('Ocorreu um erro inesperado ao processar seu pedido.');
        showError('Erro inesperado ao processar o pedido: ' + error.message);
      } finally {
        dismissToast(toastId);
      }
    };

    if (session) { // Garante que a sessão está carregada antes de tentar cumprir o pedido
      fulfillOrder();
    }
  }, [sessionId, session, clearCart, navigate]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="mx-auto h-24 w-24 text-dyad-dark-blue animate-spin mb-4" />
            <h1 className="text-3xl font-bold mb-4 text-dyad-dark-blue">{message}</h1>
            <p className="text-lg text-gray-600">Por favor, não feche esta página.</p>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="mx-auto h-24 w-24 text-green-500 mb-4" />
            <h1 className="text-3xl font-bold mb-4 text-dyad-dark-blue">{message}</h1>
            <p className="text-lg text-gray-600 mb-6">Agradecemos a sua compra!</p>
            <Button onClick={() => navigate('/meus-pedidos')} className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
              Ver Meus Pedidos
            </Button>
          </>
        );
      case 'error':
        return (
          <>
            <XCircle className="mx-auto h-24 w-24 text-red-500 mb-4" />
            <h1 className="text-3xl font-bold mb-4 text-dyad-dark-blue">Erro no Pedido</h1>
            <p className="text-lg text-gray-600 mb-6">{message}</p>
            <Button onClick={() => navigate('/cart')} className="bg-dyad-vibrant-orange hover:bg-dyad-dark-blue text-dyad-white">
              Voltar para o Carrinho
            </Button>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray p-4">
      <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-md w-full">
        {renderContent()}
      </div>
    </div>
  );
};

export default StripeSuccessPage;