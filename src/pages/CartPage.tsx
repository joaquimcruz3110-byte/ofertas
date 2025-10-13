"use client";

import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSession } from '@/components/SessionContextProvider';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useCart } from '@/components/CartProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, MinusCircle, PlusCircle, ShoppingCart as ShoppingCartIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const CartPage = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const { cartItems, removeItem, updateQuantity, clearCart, totalPrice } = useCart();

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
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex-grow p-4 bg-dyad-light-gray">
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
                      <p className="text-gray-600">R$ {item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        <MinusCircle className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                        className="w-16 text-center"
                        min="1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        className="ml-4"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-6 border-t mt-6">
                  <h3 className="text-xl font-bold text-dyad-dark-blue">Total:</h3>
                  <span className="text-2xl font-bold text-dyad-vibrant-orange">R$ {totalPrice.toFixed(2)}</span>
                </div>

                <div className="flex justify-end space-x-4 mt-6">
                  <Button
                    variant="outline"
                    onClick={clearCart}
                    disabled={cartItems.length === 0}
                  >
                    Limpar Carrinho
                  </Button>
                  <Button
                    className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white"
                    disabled={cartItems.length === 0}
                  >
                    Finalizar Compra
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default CartPage;