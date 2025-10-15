"use client";

import { useSession } from '@/components/SessionContextProvider';
import { useCart } from '@/components/CartProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, MinusCircle, PlusCircle, ShoppingCart as ShoppingCartIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { showError, showSuccess } from '@/utils/toast';
import { useState } from 'react';
import { formatCurrency } from '@/utils/formatters';
import { supabase } from '@/integrations/supabase/client';

const CartPage = () => {
  const { session, isLoading: isSessionLoading, userRole, mercadopagoCredentials } = useSession();
  const { cartItems, removeItem, updateQuantity, clearCart, totalPrice } = useCart();
  const navigate = useNavigate();

  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

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

    setIsProcessingCheckout(true);

    try {
      // Agrupar itens por lojista para criar uma preferência de pagamento por lojista
      const itemsByShopkeeper = cartItems.reduce((acc, item) => {
        if (!acc[item.shopkeeper_id]) {
          acc[item.shopkeeper_id] = [];
        }
        acc[item.shopkeeper_id].push(item);
        return acc;
      }, {} as Record<string, typeof cartItems>);

      // Para simplificar, vamos processar apenas o primeiro lojista no carrinho.
      // Em uma aplicação real, você precisaria de um fluxo para múltiplos lojistas (ex: múltiplos pagamentos ou um carrinho unificado com split de pagamentos).
      const firstShopkeeperId = Object.keys(itemsByShopkeeper)[0];
      const itemsForFirstShopkeeper = itemsByShopkeeper[firstShopkeeperId];

      if (!firstShopkeeperId || !itemsForFirstShopkeeper) {
        showError('Não foi possível identificar o lojista para o checkout.');
        setIsProcessingCheckout(false);
        return;
      }

      // Buscar a taxa de comissão ativa
      const { data: commissionRateData, error: commissionRateError } = await supabase
        .from('commission_rates')
        .select('rate')
        .eq('active', true)
        .order('set_date', { ascending: false })
        .limit(1)
        .single();

      if (commissionRateError || !commissionRateData) {
        showError('Erro ao buscar a taxa de comissão. Por favor, tente novamente mais tarde.');
        console.error('Erro ao buscar taxa de comissão:', commissionRateError?.message);
        setIsProcessingCheckout(false);
        return;
      }

      const commission_rate = commissionRateData.rate;

      const { data, error } = await supabase.functions.invoke('create-mercadopago-payment', {
        body: {
          items: itemsForFirstShopkeeper.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          buyer_id: session.user.id,
          shopkeeper_id: firstShopkeeperId,
          commission_rate: commission_rate,
          app_url: import.meta.env.VITE_APP_URL, // Passa a URL da aplicação para a Edge Function
        },
      });

      if (error) {
        showError('Erro ao iniciar o pagamento: ' + error.message);
        console.error('Erro ao invocar Edge Function create-mercadopago-payment:', error);
      } else if (data && data.init_point) {
        showSuccess('Redirecionando para o Mercado Pago...');
        window.location.href = data.init_point;
      } else {
        showError('Resposta inesperada da função de pagamento.');
      }
    } catch (error: any) {
      showError('Erro inesperado durante o checkout: ' + error.message);
      console.error('Erro inesperado durante o checkout:', error);
    } finally {
      setIsProcessingCheckout(false);
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
              Finalizar Compra
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;