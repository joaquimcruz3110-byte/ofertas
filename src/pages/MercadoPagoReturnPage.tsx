"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, ArrowLeft, ShoppingCart as ShoppingCartIcon } from 'lucide-react'; // Corrigido: Adicionado ShoppingCartIcon
import { Button } from '@/components/ui/button';
import { useCart } from '@/components/CartProvider';
import { showSuccess, showError } from '@/utils/toast';

const MercadoPagoReturnPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [status, setStatus] = useState<'success' | 'failure' | 'pending' | 'unknown'>('unknown');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const paymentStatus = searchParams.get('status');
    const paymentId = searchParams.get('payment_id');
    const preferenceId = searchParams.get('preference_id');
    const collectionStatus = searchParams.get('collection_status'); // Para o webhook

    if (paymentStatus === 'approved' || collectionStatus === 'approved') {
      setStatus('success');
      setMessage('Seu pagamento foi aprovado com sucesso! Obrigado pela sua compra.');
      showSuccess('Pagamento aprovado!');
      clearCart(); // Limpa o carrinho após o sucesso
    } else if (paymentStatus === 'rejected' || collectionStatus === 'rejected') {
      setStatus('failure');
      setMessage('Seu pagamento foi rejeitado. Por favor, tente novamente ou use outro método de pagamento.');
      showError('Pagamento rejeitado.');
    } else if (paymentStatus === 'pending' || collectionStatus === 'pending') {
      setStatus('pending');
      setMessage('Seu pagamento está pendente. Aguardando confirmação do Mercado Pago.');
      showError('Pagamento pendente.');
    } else {
      setStatus('unknown');
      setMessage('Status do pagamento desconhecido. Verifique seus pedidos para mais detalhes.');
      showError('Status de pagamento desconhecido.');
    }

    console.log('Mercado Pago Return Params:', { paymentStatus, paymentId, preferenceId, collectionStatus });

  }, [searchParams, clearCart]);

  const renderContent = () => {
    switch (status) {
      case 'success':
        return (
          <>
            <CheckCircle className="mx-auto h-24 w-24 text-green-500 mb-4" />
            <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Pagamento Aprovado!</h1>
          </>
        );
      case 'failure':
        return (
          <>
            <XCircle className="mx-auto h-24 w-24 text-red-500 mb-4" />
            <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Pagamento Rejeitado</h1>
          </>
        );
      case 'pending':
        return (
          <>
            <Clock className="mx-auto h-24 w-24 text-yellow-500 mb-4" />
            <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Pagamento Pendente</h1>
          </>
        );
      default:
        return (
          <>
            <ShoppingCartIcon className="mx-auto h-24 w-24 text-gray-400 mb-4" />
            <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Status Desconhecido</h1>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray p-4">
      <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-md w-full">
        {renderContent()}
        <p className="text-xl text-gray-600 mb-6">{message}</p>
        <Button onClick={() => navigate('/meus-pedidos')} className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white mr-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Ver Meus Pedidos
        </Button>
        <Button variant="outline" onClick={() => navigate('/explorar-produtos')} className="border-dyad-dark-blue text-dyad-dark-blue hover:bg-dyad-light-gray">
          Continuar Comprando
        </Button>
      </div>
    </div>
  );
};

export default MercadoPagoReturnPage;