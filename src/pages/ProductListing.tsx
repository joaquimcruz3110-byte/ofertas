"use client";

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSession } from '@/components/SessionContextProvider';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom'; // Importar Link

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  category: string | null;
  photo_url: string | null;
  discount: number | null;
  shopkeeper_id: string;
  created_at: string;
}

const ProductListing = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isBuying, setIsBuying] = useState<string | null>(null); // Para controlar o estado de compra de um produto específico

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .gt('quantity', 0); // Apenas produtos com quantidade maior que 0

    if (error) {
      showError('Erro ao carregar produtos: ' + error.message);
      console.error('Erro ao carregar produtos:', error.message);
      setProducts([]);
    } else {
      setProducts(data as Product[]);
    }
    setIsLoadingProducts(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'comprador') {
      fetchProducts();
    }
  }, [session, isSessionLoading, userRole]);

  const handleBuyNow = async (productId: string) => {
    if (!session?.user?.id) {
      showError('Você precisa estar logado para comprar produtos.');
      return;
    }

    setIsBuying(productId);
    const toastId = showLoading('Processando sua compra...');

    try {
      const { data, error } = await supabase.functions.invoke('purchase-product', {
        body: { productId },
      });

      dismissToast(toastId);

      if (error) {
        showError('Erro ao finalizar a compra: ' + error.message);
        console.error('Erro ao finalizar a compra:', error.message);
      } else if (data && data.error) {
        showError('Erro ao finalizar a compra: ' + data.error);
        console.error('Erro da Edge Function:', data.error);
      } else {
        showSuccess('Compra realizada com sucesso!');
        fetchProducts(); // Recarrega a lista de produtos para refletir a nova quantidade
      }
    } catch (error: any) {
      dismissToast(toastId);
      showError('Ocorreu um erro inesperado: ' + error.message);
      console.error('Erro inesperado ao invocar Edge Function:', error);
    } finally {
      setIsBuying(null);
    }
  };

  if (isSessionLoading || isLoadingProducts) {
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
          <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
            <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Explorar Produtos</h1>
            <p className="text-lg text-gray-600 mb-8">
              Confira os produtos disponíveis para compra na plataforma.
            </p>

            {products.length === 0 ? (
              <p className="text-center text-gray-500">Nenhum produto encontrado no momento.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <Card key={product.id} className="flex flex-col justify-between">
                    <Link to={`/product/${product.id}`} className="block"> {/* Link para a página de detalhes */}
                      <CardHeader>
                        {product.photo_url && (
                          <img
                            src={product.photo_url}
                            alt={product.name}
                            className="w-full h-48 object-cover rounded-md mb-4"
                          />
                        )}
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <CardDescription className="text-sm text-gray-500">
                          {product.category || 'Geral'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl font-bold text-dyad-vibrant-orange mb-2">
                          R$ {product.price.toFixed(2)}
                          {product.discount && product.discount > 0 && (
                            <span className="ml-2 text-sm text-gray-500 line-through">
                              R$ {(product.price / (1 - product.discount / 100)).toFixed(2)}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">{product.description?.substring(0, 70)}{product.description && product.description.length > 70 ? '...' : ''}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          Disponível: {product.quantity} unidades
                        </p>
                      </CardContent>
                    </Link>
                    <CardFooter>
                      <Button
                        className="w-full bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white"
                        onClick={() => handleBuyNow(product.id)}
                        disabled={isBuying === product.id || product.quantity <= 0}
                      >
                        {isBuying === product.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShoppingCart className="mr-2 h-4 w-4" />
                        )}
                        {product.quantity <= 0 ? 'Esgotado' : 'Comprar Agora'}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default ProductListing;