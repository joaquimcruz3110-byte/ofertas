"use client";

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '@/components/CartProvider';
import { showSuccess, showError } from '@/utils/toast';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/components/SessionContextProvider';

const MercadoPagoReturnPage = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  const externalReference = searchParams.get('external_reference');
  const paymentId = searchParams.get('payment_id'); // Pode ser útil para depuração
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { session } = useSession();
  const [pageStatus, setPageStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading');
  const [message, setMessage] = useState('Processando seu pedido...');

  useEffect(() => {
    if (!session) {
      setMessage('Erro: Sessão de usuário ausente.');
      setPageStatus('error');
      showError('Erro ao processar o pedido: informações de sessão incompletas.');
      return;
    }

    if (status === 'success') {
      setPageStatus('success');
      setMessage('Seu pedido foi realizado com sucesso!');
      showSuccess('Compra finalizada com sucesso!');
      clearCart(); // Limpa o carrinho após o sucesso
    } else if (status === 'pending') {
      setPageStatus('pending');
      setMessage('Seu pagamento está pendente. Aguardando confirmação do Mercado Pago.');
      // Não limpar o carrinho aqui, pois o pagamento ainda não foi confirmado
    } else if (status === 'failure') {
      setPageStatus('error');
      setMessage('Ocorreu um erro ao processar seu pagamento. Por favor, tente novamente.');
      showError('Erro no pagamento: ' + (externalReference || ''));
    } else {
      setPageStatus('error');
      setMessage('Status de pagamento desconhecido ou informações incompletas.');
      showError('Erro: Status de pagamento desconhecido.');
    }
  }, [status, externalReference, paymentId, session, clearCart]);

  const renderContent = () => {
    switch (pageStatus) {
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
      case 'pending':
        return (
          <>
            <Clock className="mx-auto h-24 w-24 text-yellow-500 mb-4" />
            <h1 className="text-3xl font-bold mb-4 text-dyad-dark-blue">{message}</h1>
            <p className="text-lg text-gray-600 mb-6">Você será notificado quando o pagamento for confirmado.</p>
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

export default MercadoPagoReturnPage;