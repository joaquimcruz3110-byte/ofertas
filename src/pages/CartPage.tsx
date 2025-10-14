"use client";

import { useSession } from '@/components/SessionContextProvider';
import { useCart } from '@/components/CartProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, MinusCircle, PlusCircle, ShoppingCart as ShoppingCartIcon, CreditCard, Loader2, Copy } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { showError, showLoading, dismissToast, showSuccess } from '@/utils/toast';
import { useState } from 'react';
import { formatCurrency } from '@/utils/formatters';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label"; // Importação adicionada

const CartPage = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const { cartItems, removeItem, updateQuantity, clearCart, totalPrice } = useCart();
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [isPixDialogOpen, setIsPixDialogOpen] = useState(false);
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState<string | null>(null);
  const [pixQrCodeText, setPixQrCodeText] = useState<string | null>(null);
  // const [pixReferenceId, setPixReferenceId] = useState<string | null>(null); // Removido
  const navigate = useNavigate();

  const handlePagSeguroCheckout = async () => {
    if (!session?.user?.id) {
      showError('Você precisa estar logado para finalizar a compra.');
      return;
    }
    if (cartItems.length === 0) {
      showError('Seu carrinho está vazio.');
      return;
    }

    setIsProcessingCheckout(true);
    const toastId = showLoading('Gerando pagamento Pix com PagSeguro...');

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-pagseguro-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ cartItems }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao criar pagamento Pix no PagSeguro.');
      }

      dismissToast(toastId);
      showSuccess('Pagamento Pix gerado com sucesso!');
      
      setPixQrCodeBase64(data.qrCodeBase64);
      setPixQrCodeText(data.qrCodeText);
      // setPixReferenceId(data.referenceId); // Removido
      setIsPixDialogOpen(true);
      clearCart(); // Limpa o carrinho após gerar o Pix
      
    } catch (error: any) {
      dismissToast(toastId);
      showError('Erro ao gerar pagamento Pix com PagSeguro: ' + error.message);
      console.error('Erro ao gerar pagamento Pix com PagSeguro:', error);
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const handleCopyPixCode = () => {
    if (pixQrCodeText) {
      navigator.clipboard.writeText(pixQrCodeText);
      showSuccess('Código Pix copiado para a área de transferência!');
    }
  };

  const handleClosePixDialog = () => {
    setIsPixDialogOpen(false);
    setPixQrCodeBase64(null);
    setPixQrCodeText(null);
    // setPixReferenceId(null); // Removido
    navigate('/meus-pedidos'); // Redireciona para meus pedidos após fechar o Pix
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
              className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white"
              onClick={handlePagSeguroCheckout}
              disabled={cartItems.length === 0 || isProcessingCheckout}
            >
              {isProcessingCheckout ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Pagar com Pix (PagSeguro)
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isPixDialogOpen} onOpenChange={setIsPixDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Pagar com Pix</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code ou copie o código Pix para finalizar seu pagamento.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-center">
            {pixQrCodeBase64 && (
              <img src={pixQrCodeBase64} alt="QR Code Pix" className="mx-auto w-48 h-48 object-contain border p-2 rounded-md" />
            )}
            {pixQrCodeText && (
              <div className="flex flex-col items-center space-y-2">
                <Label htmlFor="pix-code" className="text-sm font-medium">Código Pix (Copia e Cola)</Label>
                <div className="flex w-full max-w-xs items-center space-x-2">
                  <Input id="pix-code" value={pixQrCodeText} readOnly className="flex-grow" />
                  <Button type="button" size="sm" onClick={handleCopyPixCode}>
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copiar</span>
                  </Button>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Após o pagamento, o status do seu pedido será atualizado automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClosePixDialog}>
              Entendi, Ver Meus Pedidos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CartPage;