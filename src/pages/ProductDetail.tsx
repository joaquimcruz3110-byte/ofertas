"use client";

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSession } from '@/components/SessionContextProvider';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, ShoppingCart, ArrowLeft } from 'lucide-react';

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

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [isBuying, setIsBuying] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      setIsLoadingProduct(true);
      if (!id) {
        showError('ID do produto não fornecido.');
        navigate('/explorar-produtos');
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        showError('Erro ao carregar detalhes do produto: ' + error.message);
        console.error('Erro ao carregar detalhes do produto:', error.message);
        setProduct(null);
        navigate('/explorar-produtos'); // Redireciona se o produto não for encontrado
      } else {
        setProduct(data as Product);
      }
      setIsLoadingProduct(false);
    };

    if (!isSessionLoading && session && userRole === 'comprador') {
      fetchProduct();
    }
  }, [id, session, isSessionLoading, userRole, navigate]);

  const handleBuyNow = async () => {
    if (!session?.user?.id || !product?.id) {
      showError('Você precisa estar logado para comprar produtos ou o produto não está disponível.');
      return;
    }

    setIsBuying(true);
    const toastId = showLoading('Processando sua compra...');

    try {
      const { data, error } = await supabase.functions.invoke('purchase-product', {
        body: { productId: product.id },
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
        // Atualiza a quantidade do produto localmente
        setProduct(prevProduct => prevProduct ? { ...prevProduct, quantity: prevProduct.quantity - 1 } : null);
      }
    } catch (error: any) {
      dismissToast(toastId);
      showError('Ocorreu um erro inesperado: ' + error.message);
      console.error('Erro inesperado ao invocar Edge Function:', error);
    } finally {
      setIsBuying(false);
    }
  };

  if (isSessionLoading || isLoadingProduct) {
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

  if (!product) {
    return (
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <Sidebar />
        <div className="flex flex-col">
          <Header />
          <main className="flex-grow p-4 bg-dyad-light-gray flex items-center justify-center">
            <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
              <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Produto Não Encontrado</h1>
              <p className="text-xl text-gray-600 mb-4">O produto que você está procurando não existe ou não está disponível.</p>
              <Button onClick={() => navigate('/explorar-produtos')} className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Explorar Produtos
              </Button>
            </div>
          </main>
          <MadeWithDyad />
        </div>
      </div>
    );
  }

  const finalPrice = product.discount
    ? product.price * (1 - product.discount / 100)
    : product.price;

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex-grow p-4 bg-dyad-light-gray">
          <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-4xl mx-auto">
            <Button
              variant="ghost"
              onClick={() => navigate('/explorar-produtos')}
              className="mb-6 text-dyad-dark-blue hover:bg-dyad-light-gray"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Explorar Produtos
            </Button>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex justify-center items-center">
                {product.photo_url ? (
                  <img
                    src={product.photo_url}
                    alt={product.name}
                    className="w-full max-h-96 object-contain rounded-md shadow-sm"
                  />
                ) : (
                  <div className="w-full h-96 bg-gray-200 flex items-center justify-center rounded-md text-gray-500">
                    Sem Imagem
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2 text-dyad-dark-blue">{product.name}</h1>
                <p className="text-lg text-gray-600 mb-4">{product.category || 'Geral'}</p>
                <p className="text-2xl font-bold text-dyad-vibrant-orange mb-4">
                  R$ {finalPrice.toFixed(2)}
                  {product.discount && product.discount > 0 && (
                    <span className="ml-3 text-lg text-gray-500 line-through">
                      R$ {product.price.toFixed(2)}
                    </span>
                  )}
                </p>
                <p className="text-gray-700 mb-6">{product.description || 'Nenhuma descrição disponível.'}</p>
                <p className="text-md text-gray-500 mb-6">
                  Disponível: <span className="font-semibold">{product.quantity}</span> unidades
                </p>

                <Button
                  className="w-full bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white py-3 text-lg"
                  onClick={handleBuyNow}
                  disabled={isBuying || product.quantity <= 0}
                >
                  {isBuying ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <ShoppingCart className="mr-2 h-5 w-5" />
                  )}
                  {product.quantity <= 0 ? 'Esgotado' : 'Comprar Agora'}
                </Button>
              </div>
            </div>
          </div>
        </main>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default ProductDetail;