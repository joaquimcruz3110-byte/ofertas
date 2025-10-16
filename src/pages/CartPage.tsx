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
import { supabase } from '@/integrations/supabase/client'; // Importar supabase

const CartPage = () => {
  const { session, isLoading: isSessionLoading, userProfile } = useSession(); // Obter userProfile
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

    // Verificar se o CPF está disponível no perfil do usuário
    if (!userProfile?.cpf) {
      showError('Seu CPF é necessário para finalizar a compra. Por favor, complete seu perfil.');
      navigate('/profile'); // Redirecionar para a página de perfil
      return;
    }

    setIsProcessingCheckout(true);
    console.log('Iniciando checkout...'); // Log 1

    try {
      // Explicitamente refrescar a sessão antes de invocar a função
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshedSession) {
        showError('Sua sessão expirou ou é inválida. Por favor, faça login novamente.');
        console.error('Erro ao refrescar sessão:', refreshError?.message);
        navigate('/login');
        setIsProcessingCheckout(false);
        return;
      }
      console.log('Sessão refrescada com sucesso. User ID:', refreshedSession.user.id); // Log 2

      // Get unique shopkeeper IDs from cart items, filtering out null/undefined values
      const uniqueShopkeeperIds = Array.from(new Set(cartItems.map(item => item.shopkeeper_id))).filter(id => id !== null && id !== undefined) as string[];

      // If there are no valid shopkeeper IDs after filtering, it means all items are problematic
      if (uniqueShopkeeperIds.length === 0 && cartItems.length > 0) {
        showError('Não foi possível identificar os lojistas para os produtos no seu carrinho. Por favor, remova os itens e tente novamente.');
        setIsProcessingCheckout(false);
        return;
      }
      console.log('Lojistas únicos no carrinho:', uniqueShopkeeperIds); // Log 3

      // Fetch Pagar.me recipient IDs for all involved shopkeepers
      const { data: shopDetails, error: shopError } = await supabase
        .from('shop_details')
        .select('id, pagarme_recipient_id') // Agora buscamos o pagarme_recipient_id
        .in('id', uniqueShopkeeperIds);

      if (shopError) {
        showError('Erro ao verificar contas de lojistas: ' + shopError.message);
        console.error('Erro ao verificar contas de lojistas:', shopError.message);
        setIsProcessingCheckout(false);
        return;
      }

      const shopkeeperPagarmeRecipients = new Map(shopDetails.map(s => [s.id, s.pagarme_recipient_id]));

      // Check if all shopkeepers have a Pagar.me recipient ID configured
      const missingPagarmeRecipients = uniqueShopkeeperIds.filter(id => !shopkeeperPagarmeRecipients.get(id));
      if (missingPagarmeRecipients.length > 0) {
        showError('Um ou mais lojistas no seu carrinho não configuraram suas contas Pagar.me. Não é possível prosseguir com a compra.');
        setIsProcessingCheckout(false);
        return;
      }
      console.log('Todos os lojistas têm ID de recebedor Pagar.me.'); // Log 4

      // Fetch the active commission rate
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
      console.log('Taxa de comissão ativa:', commission_rate); // Log 5

      // Invocar a Edge Function do Pagar.me
      console.log('Invocando Edge Function create-pagarme-payment...'); // Log 6
      const { data, error } = await supabase.functions.invoke('create-pagarme-payment', {
        body: {
          cartItems: cartItems.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            shopkeeper_id: item.shopkeeper_id,
          })),
          buyer_id: refreshedSession.user.id,
          customer_cpf: userProfile.cpf, // ENVIANDO O CPF AQUI
          commission_rate: commission_rate,
          app_url: import.meta.env.VITE_APP_URL,
        },
      });

      console.log('Resposta da invocação da Edge Function - data:', data); // Log 7
      console.log('Resposta da invocação da Edge Function - error:', error); // Log 8

      if (error) {
        // Exibir a mensagem de erro da função Edge
        showError('Erro ao iniciar o pagamento: ' + error.message);
        console.error('Erro ao invocar Edge Function create-pagarme-payment:', error);
      } else if (data && data.checkout_url) {
        showSuccess('Redirecionando para o Pagar.me...');
        window.location.href = data.checkout_url;
      } else {
        showError('Resposta inesperada da função de pagamento Pagar.me.');
      }
    } catch (error: any) {
      showError('Erro inesperado durante o checkout: ' + error.message);
      console.error('Erro inesperado durante o checkout:', error);
    } finally {
      setIsProcessingCheckout(false);
      console.log('Processo de checkout finalizado.'); // Log 9
    }
  };

  if (isSessionLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray">
        <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
          <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Acesso Negado</h1>
          <p className="text-xl text-gray-600">Você precisa estar logado para acessar esta página.</p>
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
              Finalizar Compra (Pagar.me)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;