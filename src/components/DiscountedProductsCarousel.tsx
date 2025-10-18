"use client";

import { useEffect, useState, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Image as ImageIcon, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/utils/formatters';

interface Product {
  id: string;
  name: string;
  price: number;
  photo_urls: string[] | null;
  discount: number | null;
  shop_details: Array<{ // Alterado para Array
    shop_name: string;
  }> | null;
}

const AUTOPLAY_INTERVAL = 3700; // 3.7 segundos

const DiscountedProductsCarousel = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDiscountedProducts = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, photo_urls, discount, shop_details(shop_name)')
      .gt('quantity', 0) // Apenas produtos em estoque
      .gt('discount', 0) // Apenas produtos com desconto
      .order('discount', { ascending: false }) // Ordenar pelos maiores descontos
      .limit(10); // Limitar a 10 produtos

    if (error) {
      showError('Erro ao carregar produtos com desconto: ' + error.message);
      console.error('Erro ao carregar produtos com desconto:', error.message);
      setProducts([]);
    } else {
      setProducts((data as Product[]) || []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchDiscountedProducts();
  }, [fetchDiscountedProducts]);

  // Autoplay functionality
  useEffect(() => {
    if (!emblaApi) return;

    const autoplay = () => {
      if (emblaApi.canScrollNext()) {
        emblaApi.scrollNext();
      } else {
        emblaApi.scrollTo(0);
      }
    };

    const interval = setInterval(autoplay, AUTOPLAY_INTERVAL);
    return () => clearInterval(interval);
  }, [emblaApi]);

  const handleProductClick = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-dyad-dark-blue">
        Carregando descontos imperdíveis...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Nenhum produto com desconto disponível no momento.
      </div>
    );
  }

  return (
    <div className="embla overflow-hidden w-full max-w-5xl mx-auto mt-6">
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container flex -ml-4">
          {products.map((product) => {
            const originalPrice = Number(product.price);
            const finalPrice = product.discount
              ? originalPrice * (1 - Number(product.discount) / 100)
              : originalPrice;

            return (
              <div key={product.id} className="embla__slide flex-[0_0_50%] min-w-0 md:flex-[0_0_33.33%] lg:flex-[0_0_25%] pl-4">
                <Card className="h-full flex flex-col cursor-pointer hover:shadow-lg transition-shadow duration-300" onClick={() => handleProductClick(product.id)}>
                  <CardContent className="p-0 flex-grow flex items-center justify-center aspect-square bg-gray-100 rounded-t-md">
                    {product.photo_urls && product.photo_urls.length > 0 ? (
                      <img src={product.photo_urls[0]} alt={product.name} className="w-full h-full object-cover rounded-t-md" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-t-md text-gray-500">
                        <ImageIcon className="h-12 w-12" />
                      </div>
                    )}
                  </CardContent>
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg font-semibold text-dyad-dark-blue truncate">{product.name}</CardTitle>
                    <CardDescription className="text-sm text-gray-600">
                      {product.shop_details?.[0]?.shop_name || 'Loja Desconhecida'} {/* Acessando o primeiro item do array */}
                    </CardDescription>
                    <p className="text-md font-bold text-dyad-vibrant-orange">
                      {formatCurrency(finalPrice)}
                      {product.discount && product.discount > 0 && (
                        <span className="ml-2 text-sm text-gray-500 line-through">
                          {formatCurrency(originalPrice)}
                        </span>
                      )}
                    </p>
                  </CardHeader>
                  <div className="p-4 pt-0">
                    <Button className="w-full bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white">
                      Ver Detalhes <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DiscountedProductsCarousel;