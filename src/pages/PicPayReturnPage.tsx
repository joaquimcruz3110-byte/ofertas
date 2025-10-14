"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const PicPayReturnPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failure'>('loading');
  const [message, setMessage] = useState('Verificando o status do seu pagamento...');

  useEffect(() => {
    const processPaymentStatus = async () => {
      const referenceId = searchParams.get('referenceId');
      const buyerId = searchParams.get('buyer_id');
      const cartItemsEncoded = searchParams.get('cart_items');

      if (!referenceId || !buyerId || !cartItemsEncoded) {
        setStatus('failure');
        setMessage('Erro: Informações de pagamento incompletas.');
        showError('Erro: Informações de pagamento incompletas.');
        return;
      }

      const toastId = showLoading('Verificando pagamento PicPay...');

      try {
        // Em um cenário real, você faria uma chamada à API do PicPay para verificar o status
        // usando o referenceId. Por simplicidade, vamos consultar nosso próprio banco de dados.
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select('payment_gateway_status')
          .eq('payment_gateway_id', referenceId)
          .eq('buyer_id', buyerId)
          .limit(1)
          .single();

        if (salesError || !salesData) {
          throw new Error('Não foi possível verificar o status da venda no banco de dados.');
        }

        dismissToast(toastId);

        if (salesData.payment_gateway_status === 'completed') {
          setStatus('success');
          setMessage('Sua compra foi realizada com sucesso! Redirecionando para seus pedidos...');
          showSuccess('Compra realizada com sucesso!');
          setTimeout(() => navigate('/meus-pedidos'), 3000);
        } else if (salesData.payment_gateway_status === 'pending') {
          setStatus('loading'); // Ainda pendente, aguardando webhook
          setMessage('Pagamento pendente. Aguardando confirmação do PicPay. Você será redirecionado(a) quando for confirmado.');
          // Poderíamos implementar um polling aqui, mas o webhook é mais robusto.
          // Por enquanto, o usuário pode esperar ou voltar para o carrinho.
        } else {
          setStatus('failure');
          setMessage(`O pagamento não foi concluído. Status: ${salesData.payment_gateway_status}. Por favor, tente novamente.`);
          showError('Pagamento não concluído.');
        }

      } catch (error: any) {
        dismissToast(toastId);
        setStatus('failure');
        setMessage('Ocorreu um erro ao verificar o pagamento: ' + error.message);
        showError('Erro na verificação do pagamento: ' + error.message);
        console.error('Erro ao verificar pagamento PicPay:', error);
      }
    };

    processPaymentStatus();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray p-4">
      <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-md w-full">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto h-16 w-16 text-dyad-dark-blue animate-spin mb-4" />
            <h1 className="text-2xl font-bold mb-2 text-dyad-dark-blue">Verificando Pagamento</h1>
            <p className="text-gray-600">{message}</p>
            <Button onClick={() => navigate('/cart')} className="mt-6 bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
              Voltar ao Carrinho
            </Button>
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

export default PicPayReturnPage;