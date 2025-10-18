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
  total_quantity_sold?: number; // Adicionado para armazenar a quantidade vendida
}

const AUTOPLAY_INTERVAL = 4000; // 4 segundos

const BestSellersCarousel = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchBestSellers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Passo 1: Obter os IDs dos produtos mais vendidos e suas quantidades totais
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('product_id, quantity')
        .limit(1000); // Limitar o número de vendas para evitar sobrecarga

      if (salesError) {
        throw new Error('Erro ao carregar dados de vendas: ' + salesError.message);
      }

      // Agrupar vendas por product_id e somar as quantidades
      const productSalesMap = new Map<string, number>();
      salesData.forEach(sale => {
        if (sale.product_id) {
          const currentQuantity = productSalesMap.get(sale.product_id) || 0;
          productSalesMap.set(sale.product_id, currentQuantity + sale.quantity);
        }
      });

      // Converter para array, ordenar e pegar os top N
      const sortedProductIds = Array.from(productSalesMap.entries())
        .sort(([, quantityA], [, quantityB]) => quantityB - quantityA)
        .slice(0, 10) // Top 10 produtos mais vendidos
        .map(([productId]) => productId);

      if (sortedProductIds.length === 0) {
        setProducts([]);
        setIsLoading(false);
        return;
      }

      // Passo 2: Buscar os detalhes completos dos produtos mais vendidos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, photo_urls')
        .in('id', sortedProductIds)
        .gt('quantity', 0); // Apenas produtos em estoque

      if (productsError) {
        throw new Error('Erro ao carregar detalhes dos produtos mais vendidos: ' + productsError.message);
      }

      // Adicionar a quantidade vendida aos detalhes do produto para ordenação final
      const bestSellersWithQuantity = (productsData as Product[]).map(product => ({
        ...product,
        total_quantity_sold: productSalesMap.get(product.id) || 0,
      })).sort((a, b) => (b.total_quantity_sold || 0) - (a.total_quantity_sold || 0)); // Ordenar novamente

      setProducts(bestSellersWithQuantity);

    } catch (error: any) {
      showError('Erro ao carregar produtos mais vendidos: ' + error.message);
      console.error('Erro ao carregar produtos mais vendidos:', error.message);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBestSellers();
  }, [fetchBestSellers]);

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
      <div className="flex items-center justify-center h-64 text-dyad-white">
        Carregando produtos mais vendidos...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-dyad-white">
        Nenhum produto mais vendido disponível no momento.
      </div>
    );
  }

  return (
    <div className="embla overflow-hidden w-full max-w-5xl mx-auto mt-12">
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container flex -ml-4">
          {products.map((product) => (
            <div key={product.id} className="embla__slide flex-[0_0_50%] min-w-0 md:flex-[0_0_33.33%] lg:flex-[0_0_25%] pl-4">
              <Card className="h-full flex flex-col cursor-pointer hover:shadow-lg transition-shadow duration-300" onClick={() => handleProductClick(product.id)}>
                <CardContent className="p-0 flex-grow flex items-center justify-center h-48 bg-gray-100 rounded-t-md">
                  {product.photo_urls && product.photo_urls.length > 0 ? (
                    <img src={product.photo_urls[0]} alt={product.name} className="max-w-full max-h-full object-contain rounded-t-md" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-t-md text-gray-500">
                      <ImageIcon className="h-12 w-12" />
                    </div>
                  )}
                </CardContent>
                <CardHeader className="p-4">
                  <CardTitle className="text-lg font-semibold text-dyad-dark-blue truncate">{product.name}</CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    {formatCurrency(product.price)}
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

export default BestSellersCarousel;