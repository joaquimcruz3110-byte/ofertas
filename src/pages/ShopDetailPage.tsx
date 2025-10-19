"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { showError } from '@/utils/toast';
import { ArrowLeft, Store as StoreIcon, Image as ImageIcon, ShoppingCart, Truck } from 'lucide-react'; // Adicionado Truck
import { formatCurrency } from '@/utils/formatters';
import { useCart } from '@/components/CartProvider';
import { useSession } from '@/components/SessionContextProvider';

interface ShopDetails {
  id: string;
  shop_name: string;
  shop_description: string | null;
  shop_logo_url: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  category: string | null;
  photo_urls: string[] | null;
  discount: number | null;
  shipping_cost: number; // Adicionado
  shopkeeper_id: string;
  created_at: string;
}

const ShopDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const { addItem } = useCart();
  const [shopDetails, setShopDetails] = useState<ShopDetails | null>(null);
  const [shopProducts, setShopProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchShopData = useCallback(async () => {
    setIsLoading(true);
    if (!id) {
      showError('ID da loja não fornecido.');
      navigate('/explorar-produtos');
      return;
    }

    // Fetch shop details
    const { data: shopData, error: shopError } = await supabase
      .from('shop_details')
      .select('*')
      .eq('id', id)
      .single();

    if (shopError && shopError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      showError('Erro ao carregar detalhes da loja: ' + shopError.message);
      console.error('Erro ao carregar detalhes da loja:', shopError.message);
      setShopDetails(null);
      setShopProducts([]);
      navigate('/explorar-produtos');
      return;
    } else if (shopData) {
      setShopDetails(shopData as ShopDetails);

      // Fetch products for this shop
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('shopkeeper_id', id)
        .gt('quantity', 0) // Apenas produtos em estoque
        .order('created_at', { ascending: false });

      if (productsError) {
        showError('Erro ao carregar produtos da loja: ' + productsError.message);
        console.error('Erro ao carregar produtos da loja:', productsError.message);
        setShopProducts([]);
      } else {
        setShopProducts(productsData as Product[]);
      }
    } else {
      setShopDetails(null);
      setShopProducts([]);
    }
    setIsLoading(false);
  }, [id, navigate]);

  useEffect(() => {
    fetchShopData();
  }, [fetchShopData]);

  const handleAddToCart = (product: Product) => {
    if (!session) {
      showError('Você precisa estar logado para adicionar produtos ao carrinho.');
      navigate('/login');
      return;
    }

    const originalPrice = Number(product.price);
    const finalPrice = product.discount
      ? originalPrice * (1 - Number(product.discount) / 100)
      : originalPrice;

    addItem({
      id: product.id,
      name: product.name,
      price: finalPrice,
      photo_url: product.photo_urls && product.photo_urls.length > 0 ? product.photo_urls[0] : null,
      shopkeeper_id: product.shopkeeper_id,
      shipping_cost: product.shipping_cost, // Adicionado
    });
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando detalhes da loja...</div>;
  }

  if (!shopDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dyad-light-gray">
        <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
          <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Loja Não Encontrada</h1>
          <p className="text-xl text-gray-600 mb-4">A loja que você está procurando não existe ou não está disponível.</p>
          <Button onClick={() => navigate('/explorar-produtos')} className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Explorar Produtos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-6xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)} // Volta para a página anterior
        className="mb-6 text-dyad-dark-blue hover:bg-dyad-light-gray"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-10 border-b pb-8">
        <Avatar className="w-32 h-32 border-2 border-dyad-dark-blue">
          <AvatarImage src={shopDetails.shop_logo_url || undefined} alt={`Logo da ${shopDetails.shop_name}`} />
          <AvatarFallback className="bg-dyad-vibrant-orange text-dyad-white text-4xl font-bold">
            <StoreIcon className="w-16 h-16" />
          </AvatarFallback>
        </Avatar>
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold mb-2 text-dyad-dark-blue">{shopDetails.shop_name}</h1>
          <p className="text-lg text-gray-600 mb-4">
            {shopDetails.shop_description || 'Nenhuma descrição disponível para esta loja.'}
          </p>
        </div>
      </div>

      <h2 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Produtos de {shopDetails.shop_name}</h2>
      {shopProducts.length === 0 ? (
        <p className="text-center text-gray-500">Esta loja não possui produtos disponíveis no momento.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {shopProducts.map((product) => {
            const originalPrice = Number(product.price);
            const finalPrice = product.discount
              ? originalPrice * (1 - Number(product.discount) / 100)
              : originalPrice;

            return (
              <Card key={product.id} className="flex flex-col justify-between">
                <Link to={`/product/${product.id}`} className="block">
                  <CardHeader>
                    {product.photo_urls && product.photo_urls.length > 0 ? (
                      <div className="w-full aspect-square flex items-center justify-center rounded-md mb-4 bg-gray-100">
                        <img
                          src={product.photo_urls[0]}
                          alt={product.name}
                          className="w-full h-full object-cover rounded-md"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-square bg-gray-200 flex items-center justify-center rounded-md text-gray-500">
                        <ImageIcon className="h-12 w-12" />
                      </div>
                    )}
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <CardDescription className="text-sm text-gray-500">
                      {product.category || 'Geral'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-dyad-vibrant-orange mb-2">
                      {formatCurrency(finalPrice)}
                      {product.discount && product.discount > 0 && (
                        <span className="ml-2 text-sm text-gray-500 line-through">
                          {formatCurrency(originalPrice)}
                        </span>
                      )}
                    </p>
                    {product.shipping_cost > 0 && ( // Adicionado
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Truck className="h-4 w-4 text-gray-500" /> Frete: {formatCurrency(product.shipping_cost)}
                      </p>
                    )}
                    <p className="text-sm text-gray-600">{product.description?.substring(0, 70)}{product.description && product.description.length > 70 ? '...' : ''}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Disponível: {product.quantity} unidades
                    </p>
                  </CardContent>
                </Link>
                <CardFooter>
                  <Button
                    className="w-full bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white"
                    onClick={() => handleAddToCart(product)}
                    disabled={product.quantity <= 0}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {product.quantity <= 0 ? 'Esgotado' : 'Adicionar ao Carrinho'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShopDetailPage;