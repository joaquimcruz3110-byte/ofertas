"use client";

import { useSession } from '@/components/SessionContextProvider';
import { useCart } from '@/components/CartProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, MinusCircle, PlusCircle, ShoppingCart as ShoppingCartIcon, Copy, Check, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { useState, useEffect } from 'react';
import { formatCurrency } from '@/utils/formatters';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

interface PixPaymentDetails {
  qr_code: string;
  qr_code_base64: string;
  ticket_url: string;
  payment_id: string;
  payment_status: string;
  external_reference: string;
}

const CartPage = () => {
  const { session, isLoading: isSessionLoading, userRole, userProfile } = useSession();
  const { cartItems, removeItem, updateQuantity, clearCart, totalPrice } = useCart();
  const navigate = useNavigate();

  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [isPixDialogOpen, setIsPixDialogOpen] = useState(false);
  const [pixPaymentDetails, setPixPaymentDetails] = useState<PixPaymentDetails | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [paymentCheckInterval, setPaymentCheckInterval] = useState<number | null>(null);

  useEffect(() => {
    if (paymentCheckInterval) {
      // Clear interval if dialog is closed or payment is approved/rejected
      if (!isPixDialogOpen || pixPaymentDetails?.payment_status === 'approved' || pixPaymentDetails?.payment_status === 'rejected') {
        clearInterval(paymentCheckInterval);
        setPaymentCheckInterval(null);
      }
    }
  }, [isPixDialogOpen, pixPaymentDetails?.payment_status, paymentCheckInterval]);

  const handleCheckout = async () => {
    if (!session?.user?.id) {
      showError('Você precisa estar logado para finalizar a compra.');
      navigate('/login');
      return;
    }

    if (cartItems.length === 0) {
      showError('Seu carrinho está vazio.');
      return;
    }

    // Basic validation for buyer profile details required by Mercado Pago
    const requiredProfileFields = ['first_name', 'last_name', 'cpf', 'phone_number', 'address_street', 'address_number', 'address_postal_code', 'address_city', 'address_state'];
    const missingFields = requiredProfileFields.filter(field => !userProfile?.[field]);

    if (missingFields.length > 0) {
      showError(`Por favor, complete seu perfil com as seguintes informações: ${missingFields.join(', ')}.`);
      navigate('/profile');
      return;
    }

    setIsProcessingCheckout(true);
    const toastId = showLoading('Iniciando checkout com Mercado Pago...');

    try {
      // Determine shopkeeperId
      const shopkeeperIds = [...new Set(cartItems.map(item => item.shopkeeper_id))];
      if (shopkeeperIds.length === 0) {
        dismissToast(toastId);
        showError('Não foi possível identificar o lojista para os itens no carrinho.');
        setIsProcessingCheckout(false);
        return;
      }
      if (shopkeeperIds.length > 1) {
        dismissToast(toastId);
        showError('Atualmente, só é possível comprar produtos de um único lojista por vez. Por favor, esvazie o carrinho e compre de um lojista por vez.');
        setIsProcessingCheckout(false);
        return;
      }
      const shopkeeperId = shopkeeperIds[0];

      if (!shopkeeperId) {
        dismissToast(toastId);
        showError('Erro interno: ID do lojista não encontrado para os itens no carrinho.');
        setIsProcessingCheckout(false);
        return;
      }

      // Validate total amount
      if (isNaN(totalPrice) || totalPrice <= 0) {
        dismissToast(toastId);
        showError('O valor total da compra é inválido. Por favor, verifique os itens do carrinho.');
        setIsProcessingCheckout(false);
        return;
      }

      const payload = {
        cartItems: cartItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        buyerId: session.user.id,
        totalAmount: totalPrice,
        shopkeeperId: shopkeeperId,
      };

      console.log('Sending payload to create-mercadopago-payment:', payload); // Debug log

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-mercadopago-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao criar pagamento no Mercado Pago.');
      }

      const data: PixPaymentDetails = await response.json();
      setPixPaymentDetails(data);
      setIsPixDialogOpen(true);
      showSuccess('Pagamento Pix gerado com sucesso!');

      // Start polling for payment status
      const interval = setInterval(async () => {
        const { data: paymentStatusData, error } = await supabase
          .from('sales')
          .select('payment_gateway_status')
          .eq('payment_gateway_id', data.payment_id)
          .single();

        if (error) {
          console.error('Error polling payment status:', error.message);
          return;
        }

        if (paymentStatusData?.payment_gateway_status === 'approved') {
          showSuccess('Pagamento aprovado! Redirecionando...');
          clearInterval(interval);
          setPaymentCheckInterval(null);
          clearCart();
          navigate('/meus-pedidos');
        } else if (paymentStatusData?.payment_gateway_status === 'rejected') {
          showError('Pagamento rejeitado. Por favor, tente novamente.');
          clearInterval(interval);
          setPaymentCheckInterval(null);
          setIsPixDialogOpen(false);
        }
      }, 5000); // Poll every 5 seconds
      setPaymentCheckInterval(interval as unknown as number); // Store interval ID

    } catch (error: any) {
      showError('Erro ao finalizar compra: ' + error.message);
      console.error('Erro ao finalizar compra:', error);
    } finally {
      dismissToast(toastId);
      setIsProcessingCheckout(false);
    }
  };

  const handleCopyPixCode = () => {
    if (pixPaymentDetails?.qr_code) {
      navigator.clipboard.writeText(pixPaymentDetails.qr_code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      showSuccess('Código Pix copiado!');
    }
  };

  if (isSessionLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session || userRole !== 'comprador') {
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
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Meu Carrinho</h1>
      <p className="text-lg text-gray-600 mb-8">
        Revise os itens no seu carrinho antes de finalizar a compra.
      </p>

      {cartItems.length === 0 ? (
        <div className="text-center py-10">
          <ShoppingCartIcon className="mx-auto h-24 w-24 text-gray-400 mb-4" />
          <p className="text-xl text-gray-500 mb-4">Seu carrinho está vazio.</p>
          <Link to="/explorar-produtos">
            <Button className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
              Começar a Comprar
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {cartItems.map((item) => (
            <div key={item.id} className="flex items-center border-b pb-4 last:border-b-0 last:pb-0">
              {item.photo_url && (
                <img
                  src={item.photo_url}
                  alt={item.name}
                  className="w-20 h-20 object-cover rounded-md mr-4"
                />
              )}
              <div className="flex-grow">
                <h2 className="text-lg font-semibold text-dyad-dark-blue">{item.name}</h2>
                <p className="text-gray-600">{formatCurrency(item.price)}</p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  disabled={item.quantity <= 1 || isProcessingCheckout}
                >
                  <MinusCircle className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                  className="w-16 text-center"
                  min="1"
                  disabled={isProcessingCheckout}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  disabled={isProcessingCheckout}
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => removeItem(item.id)}
                  className="ml-4"
                  disabled={isProcessingCheckout}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex justify-between items-center pt-6 border-t mt-6">
            <h3 className="text-xl font-bold text-dyad-dark-blue">Total:</h3>
            <span className="text-2xl font-bold text-dyad-vibrant-orange">{formatCurrency(totalPrice)}</span>
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <Button
              variant="outline"
              onClick={clearCart}
              disabled={cartItems.length === 0 || isProcessingCheckout}
            >
              Limpar Carrinho
            </Button>
            <Button
              onClick={handleCheckout}
              className="bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white"
              disabled={cartItems.length === 0 || isProcessingCheckout}
            >
              {isProcessingCheckout && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Finalizar Compra com Mercado Pago
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isPixDialogOpen} onOpenChange={setIsPixDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Pagamento via Pix (Mercado Pago)</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code ou copie o código Pix para finalizar seu pagamento.
            </DialogDescription>
          </DialogHeader>
          {pixPaymentDetails ? (
            <div className="grid gap-4 py-4 text-center">
              <img
                src={`data:image/png;base64,${pixPaymentDetails.qr_code_base64}`}
                alt="QR Code Pix"
                className="mx-auto w-48 h-48 object-contain border rounded-md p-2"
              />
              <div className="space-y-2">
                <Label htmlFor="pix-code" className="text-left">Código Pix (Copia e Cola)</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="pix-code"
                    value={pixPaymentDetails.qr_code}
                    readOnly
                    className="flex-grow"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopyPixCode}
                    className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white"
                  >
                    {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span className="sr-only">{isCopied ? 'Copiado' : 'Copiar'}</span>
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Aguardando a confirmação do pagamento. Esta janela fechará automaticamente após a aprovação.
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-dyad-dark-blue" />
              <p className="mt-4 text-gray-600">Gerando QR Code...</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPixDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CartPage;