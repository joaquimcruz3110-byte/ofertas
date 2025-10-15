"use client";

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { useCart } from '@/components/CartProvider';

const MercadoPagoReturnPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'rejected' | 'error'>('pending');
  const [paymentMessage, setPaymentMessage] = useState('Processando seu pagamento...');

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const status = queryParams.get('status');
    const paymentId = queryParams.get('payment_id');
    const externalReference = queryParams.get('external_reference');

    if (status) {
      switch (status) {
        case 'approved':
          setPaymentStatus('approved');
          setPaymentMessage('Seu pagamento foi aprovado com sucesso! Obrigado pela sua compra.');
          showSuccess('Pagamento aprovado!');
          clearCart(); // Limpa o carrinho após o sucesso
          break;
        case 'pending':
          setPaymentStatus('pending');
          setPaymentMessage('Seu pagamento está pendente. Aguardando confirmação do Mercado Pago.');
          showError('Pagamento pendente.');
          break;
        case 'rejected':
          setPaymentStatus('rejected');
          setPaymentMessage('Seu pagamento foi rejeitado. Por favor, tente novamente ou use outro método de pagamento.');
          showError('Pagamento rejeitado.');
          break;
        default:
          setPaymentStatus('error');
          setPaymentMessage('Ocorreu um erro desconhecido no processamento do pagamento.');
          showError('Erro no pagamento.');
          break;
      }
    } else {
      setPaymentStatus('error');
      setPaymentMessage('Nenhuma informação de status de pagamento encontrada.');
      showError('Nenhuma informação de status.');
    }

    console.log('Mercado Pago Return:', { status, paymentId, externalReference });
  }, [location.search, clearCart]);

  const getIcon = () => {
    switch (paymentStatus) {
      case 'approved':
        return <CheckCircle className="h-24 w-24 text-green-500 mx-auto mb-4" />;
      case 'rejected':
      case 'error':
        return <XCircle className="h-24 w-24 text-red-500 mx-auto mb-4" />;
      case 'pending':
      default:
        return <Loader2 className="h-24 w-24 text-blue-500 mx-auto mb-4 animate-spin" />;
    }
  };

  const getTitle = () => {
    switch (paymentStatus) {
      case 'approved':
        return 'Pagamento Aprovado!';
      case 'pending':
        return 'Pagamento Pendente';
      case 'rejected':
        return 'Pagamento Rejeitado';
      case 'error':
      default:
        return 'Erro no Pagamento';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray p-4">
      <Card className="w-full max-w-md text-center p-6 rounded-dyad-rounded-lg shadow-dyad-soft">
        <CardHeader>
          {getIcon()}
          <CardTitle className="text-3xl font-bold text-dyad-dark-blue mb-2">{getTitle()}</CardTitle>
          <CardDescription className="text-lg text-gray-600">{paymentMessage}</CardDescription>
        </CardHeader>
        <CardContent className="mt-6">
          <Button
            onClick={() => navigate('/')}
            className="w-full bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white py-3 text-lg"
          >
            Voltar para o Início
          </Button>
          {paymentStatus !== 'approved' && (
            <Button
              variant="outline"
              onClick={() => navigate('/cart')}
              className="w-full mt-4 border-dyad-dark-blue text-dyad-dark-blue hover:bg-dyad-light-gray"
            >
              Tentar Novamente no Carrinho
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MercadoPagoReturnPage;