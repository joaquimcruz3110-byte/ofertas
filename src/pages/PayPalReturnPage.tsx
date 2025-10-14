"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const PayPalReturnPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failure'>('loading');
  const [message, setMessage] = useState('Processando seu pagamento...');

  useEffect(() => {
    const processPayment = async () => {
      const token = searchParams.get('token'); // PayPal order ID
      const payerId = searchParams.get('PayerID');
      const buyerId = searchParams.get('buyer_id');
      const cartItemsEncoded = searchParams.get('cart_items');

      if (!token || !buyerId || !cartItemsEncoded) {
        setStatus('failure');
        setMessage('Erro: Informações de pagamento incompletas.');
        showError('Erro: Informações de pagamento incompletas.');
        return;
      }

      const toastId = showLoading('Finalizando sua compra...');

      try {
        const cartItems = JSON.parse(decodeURIComponent(cartItemsEncoded));

        // Chamar uma Edge Function para capturar o pagamento no PayPal
        // e registrar a venda no Supabase.
        // Por simplicidade, vamos simular a captura e registro aqui.
        // Em um cenário real, você chamaria uma Edge Function para isso.

        // Simulação de chamada a uma Edge Function para capturar e registrar
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture-paypal-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`,
          },
          body: JSON.stringify({
            orderID: token,
            payerID: payerId,
            buyer_id: buyerId,
            cart_items: cartItems,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Falha ao capturar pagamento PayPal.');
        }

        dismissToast(toastId);
        setStatus('success');
        setMessage('Sua compra foi realizada com sucesso! Redirecionando para seus pedidos...');
        showSuccess('Compra realizada com sucesso!');
        setTimeout(() => navigate('/meus-pedidos'), 3000);

      } catch (error: any) {
        dismissToast(toastId);
        setStatus('failure');
        setMessage('Ocorreu um erro ao finalizar sua compra: ' + error.message);
        showError('Erro na compra: ' + error.message);
        console.error('Erro ao processar pagamento PayPal:', error);
      }
    };

    // Verificar se o usuário cancelou o pagamento
    const paymentStatus = searchParams.get('payment_status');
    if (paymentStatus === 'cancelled') {
      setStatus('failure');
      setMessage('Você cancelou o pagamento. Por favor, tente novamente.');
      showError('Pagamento cancelado.');
      setTimeout(() => navigate('/cart'), 3000);
      return;
    }

    processPayment();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray p-4">
      <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-md w-full">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto h-16 w-16 text-dyad-dark-blue animate-spin mb-4" />
            <h1 className="text-2xl font-bold mb-2 text-dyad-dark-blue">Processando Pagamento</h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2 text-green-700">Sucesso!</h1>
            <p className="text-gray-600">{message}</p>
            <Button onClick={() => navigate('/meus-pedidos')} className="mt-6 bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
              Ver Meus Pedidos
            </Button>
          </>
        )}
        {status === 'failure' && (
          <>
            <XCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2 text-red-700">Erro no Pagamento</h1>
            <p className="text-gray-600">{message}</p>
            <Button onClick={() => navigate('/cart')} className="mt-6 bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
              Voltar ao Carrinho
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default PayPalReturnPage;