"use client";

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '@/components/CartProvider';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

const MercadoPagoReturnPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useCart();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const status = queryParams.get('status');
    // const paymentId = queryParams.get('payment_id'); // ID do pagamento no Mercado Pago // Removido

    if (status === 'success') {
      showSuccess('Pagamento aprovado! Seu pedido foi realizado com sucesso.');
      clearCart(); // Limpa o carrinho após o sucesso
    } else if (status === 'pending') {
      showError('Pagamento pendente. Aguardando confirmação do Mercado Pago.');
    } else if (status === 'failure') {
      showError('Pagamento falhou. Por favor, tente novamente.');
    } else {
      showError('Status de pagamento desconhecido ou erro na transação.');
    }
  }, [location.search, navigate, clearCart]);

  const queryParams = new URLSearchParams(location.search);
  const status = queryParams.get('status');

  let title = '';
  let message = '';
  let icon = null;
  let iconColor = '';

  switch (status) {
    case 'success':
      title = 'Pagamento Aprovado!';
      message = 'Seu pedido foi realizado com sucesso. Agradecemos a sua compra!';
      icon = <CheckCircle className="h-24 w-24 text-green-500 mb-4" />;
      iconColor = 'text-green-500';
      break;
    case 'pending':
      title = 'Pagamento Pendente';
      message = 'Seu pagamento está aguardando confirmação. Você será notificado quando for processado.';
      icon = <Clock className="h-24 w-24 text-yellow-500 mb-4" />;
      iconColor = 'text-yellow-500';
      break;
    case 'failure':
      title = 'Pagamento Recusado';
      message = 'Houve um problema com o seu pagamento. Por favor, tente novamente ou utilize outro método.';
      icon = <XCircle className="h-24 w-24 text-red-500 mb-4" />;
      iconColor = 'text-red-500';
      break;
    default:
      title = 'Status de Pagamento Desconhecido';
      message = 'Não foi possível determinar o status do seu pagamento. Por favor, verifique seus pedidos ou entre em contato.';
      icon = <XCircle className="h-24 w-24 text-gray-500 mb-4" />;
      iconColor = 'text-gray-500';
      break;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray p-4">
      <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-md w-full">
        {icon}
        <h1 className={`text-4xl font-bold mb-4 ${iconColor}`}>{title}</h1>
        <p className="text-xl text-gray-600 mb-6">{message}</p>
        <Button onClick={() => navigate('/')} className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
          Voltar para a Página Inicial
        </Button>
      </div>
    </div>
  );
};

export default MercadoPagoReturnPage;