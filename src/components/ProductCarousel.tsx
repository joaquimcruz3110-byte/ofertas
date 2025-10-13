"use client";

import { useEffect, useState, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Image as ImageIcon, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  price: number;
  photo_url: string | null;
}

const AUTOPLAY_INTERVAL = 3000; // 3 segundos

const ProductCarousel = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, photo_url')
      .gt('quantity', 0) // Apenas produtos em estoque
      .limit(10); // Limitar a 10 produtos para o carrossel

    if (error) {
      showError('Erro ao carregar produtos para o carrossel: ' + error.message);
      console.error('Erro ao carregar produtos para o carrossel:', error.message);
      setProducts([]);
    } else {
      setProducts(data as Product[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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

  const handleProductClick = () => {
    navigate('/login'); // Redireciona para a página de login/cadastro
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-dyad-white">
        Carregando produtos...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-dyad-white">
        Nenhum produto disponível para exibir no momento.
      </div>
    );
  }

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="embla overflow-hidden w-full max-w-5xl mx-auto mt-12">
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container flex -ml-4">
          {products.map((product) => (
            <div key={product.id} className="embla__slide flex-[0_0_50%] min-w-0 md:flex-[0_0_33.33%] lg:flex-[0_0_25%] pl-4">
              <Card className="h-full flex flex-col cursor-pointer hover:shadow-lg transition-shadow duration-300" onClick={handleProductClick}>
                <CardContent className="p-0 flex-grow">
                  {product.photo_url ? (
                    <img src={product.photo_url} alt={product.name} className="w-full h-48 object-cover rounded-t-md" />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center rounded-t-md text-gray-500">
                      <ImageIcon className="h-12 w-12" />
                    </div>
                  )}
                </CardContent>
                <CardHeader className="p-4">
                  <CardTitle className="text-lg font-semibold text-dyad-dark-blue truncate">{product.name}</CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    {currencyFormatter.format(product.price)}
                  </CardDescription>
                </CardHeader>
                <div className="p-4 pt-0">
                  <Button className="w-full bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white">
                    Ver Detalhes <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductCarousel;