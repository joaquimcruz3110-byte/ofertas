"use client";

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { showError } from '@/utils/toast';
import { ShoppingCart, ArrowLeft, Store as StoreIcon, Image as ImageIcon } from 'lucide-react';
import { useCart } from '@/components/CartProvider';
import { formatCurrency } from '@/utils/formatters';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  category: string | null;
  photo_urls: string[] | null;
  discount: number | null;
  shopkeeper_id: string;
  created_at: string;
  shop_details: {
    shop_name: string;
    shop_logo_url: string | null;
  } | null;
}

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [mainImage, setMainImage] = useState<string | null>(null); // Estado para a imagem principal

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
        .select('*, shop_details(shop_name, shop_logo_url)')
        .eq('id', id)
        .single();

      if (error) {
        showError('Erro ao carregar detalhes do produto: ' + error.message);
        console.error('Erro ao carregar detalhes do produto:', error.message);
        setProduct(null);
        navigate('/explorar-produtos');
      } else {
        setProduct(data as Product);
        // Define a primeira imagem como principal ao carregar o produto
        if (data?.photo_urls && data.photo_urls.length > 0) {
          setMainImage(data.photo_urls[0]);
        } else {
          setMainImage(null);
        }
      }
      setIsLoadingProduct(false);
    };

    fetchProduct();
  }, [id, navigate]);

  const handleAddToCart = () => {
    if (!session) {
      showError('Você precisa estar logado para adicionar produtos ao carrinho.');
      navigate('/login');
      return;
    }

    if (!product) {
      showError('Produto não disponível para adicionar ao carrinho.');
      return;
    }
    const finalPrice = product.discount
      ? product.price * (1 - product.discount / 100)
      : product.price;

    addItem({
      id: product.id,
      name: product.name,
      price: finalPrice,
      photo_url: product.photo_urls && product.photo_urls.length > 0 ? product.photo_urls[0] : null,
      shopkeeper_id: product.shopkeeper_id,
    });
  };

  if (isLoadingProduct) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
          <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Produto Não Encontrado</h1>
          <p className="text-xl text-gray-600 mb-4">O produto que você está procurando não existe ou não está disponível.</p>
          <Button onClick={() => navigate('/explorar-produtos')} className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Explorar Produtos
          </Button>
        </div>
      </div>
    );
  }

  const finalPrice = product.discount
    ? product.price * (1 - product.discount / 100)
    : product.price;

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-4xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => navigate('/explorar-produtos')}
        className="mb-6 text-dyad-dark-blue hover:bg-dyad-light-gray"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Explorar Produtos
      </Button>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="relative mb-4">
            {mainImage ? (
              <img
                src={mainImage}
                alt={`${product.name} - Imagem principal`}
                className="w-full max-h-96 object-contain rounded-md shadow-sm"
              />
            ) : (
              <div className="w-full h-96 bg-gray-200 flex items-center justify-center rounded-md text-gray-500">
                <ImageIcon className="h-12 w-12" /> Sem Imagem
              </div>
            )}
          </div>
          {product.photo_urls && product.photo_urls.length > 1 && (
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {product.photo_urls.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`${product.name} - Miniatura ${index + 1}`}
                  className={`w-20 h-20 object-cover rounded-md cursor-pointer border-2 ${
                    url === mainImage ? 'border-dyad-vibrant-orange' : 'border-transparent'
                  }`}
                  onClick={() => setMainImage(url)}
                />
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-4xl font-bold mb-2 text-dyad-dark-blue">{product.name}</h1>
          <p className="text-lg text-gray-600 mb-2 flex items-center gap-2">
            {product.shop_details?.shop_logo_url ? (
              <img
                src={product.shop_details.shop_logo_url}
                alt={`${product.shop_details.shop_name} logo`}
                className="w-6 h-6 object-contain rounded-full"
              />
            ) : (
              <StoreIcon className="h-5 w-5 text-gray-500" />
            )}
            {product.shop_details?.shop_name || 'Loja Desconhecida'}
          </p>
          <p className="text-lg text-gray-600 mb-4">{product.category || 'Geral'}</p>
          <p className="text-2xl font-bold text-dyad-vibrant-orange mb-4">
            {formatCurrency(finalPrice)}
            {product.discount && product.discount > 0 && (
              <span className="ml-3 text-lg text-gray-500 line-through">
                {formatCurrency(product.price)}
              </span>
            )}
          </p>
          <p className="text-gray-700 mb-6">{product.description || 'Nenhuma descrição disponível.'}</p>
          <p className="text-md text-gray-500 mb-6">
            Disponível: <span className="font-semibold">{product.quantity}</span> unidades
          </p>

          <Button
            className="w-full bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white py-3 text-lg"
            onClick={handleAddToCart}
            disabled={product.quantity <= 0}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            {product.quantity <= 0 ? 'Esgotado' : 'Adicionar ao Carrinho'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;