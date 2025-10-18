"use client";

import React, { useEffect, useState, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils'; // Importar cn para utilitários de classe

interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  cta_text: string | null;
  cta_link: string | null;
  is_active: boolean;
  order_index: number;
}

// Componente de botão de ponto para navegação do carrossel
type DotButtonProps = {
  selected: boolean;
  onClick: () => void;
};

const DotButton: React.FC<DotButtonProps> = (props) => {
  const { selected, onClick } = props;
  return (
    <button
      className={cn(
        "h-2 w-2 rounded-full transition-colors duration-300",
        selected ? "bg-dyad-vibrant-orange" : "bg-gray-400 hover:bg-gray-300"
      )}
      type="button"
      onClick={onClick}
    />
  );
};

const AUTOPLAY_INTERVAL = 5000; // 5 segundos

const HeroBanner = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const fetchActiveBanners = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (error) {
      showError('Erro ao carregar banners: ' + error.message);
      console.error('Erro ao carregar banners:', error.message);
      setBanners([]);
    } else {
      setBanners(data as Banner[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchActiveBanners();
  }, [fetchActiveBanners]);

  // Embla Carousel logic for autoplay and dot navigation
  const onSelect = useCallback((emblaApi: any) => {
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, []);

  const onInit = useCallback((emblaApi: any) => {
    setScrollSnaps(emblaApi.scrollSnapList());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    onInit(emblaApi);
    onSelect(emblaApi);
    emblaApi.on('reInit', onInit);
    emblaApi.on('reInit', onSelect);
    emblaApi.on('select', onSelect);

    const autoplay = () => {
      if (emblaApi.canScrollNext()) {
        emblaApi.scrollNext();
      } else {
        emblaApi.scrollTo(0);
      }
    };

    const interval = setInterval(autoplay, AUTOPLAY_INTERVAL);
    return () => {
      clearInterval(interval);
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onInit);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onInit, onSelect]);

  if (isLoading) {
    return (
      <section className="w-full h-[300px] md:h-[600px] bg-dyad-dark-blue text-dyad-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-3">Carregando banners...</span>
      </section>
    );
  }

  if (banners.length === 0) {
    return (
      <section className="w-full h-[300px] md:h-[600px] bg-dyad-dark-blue text-dyad-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-2">
            Bem-vindo ao <span className="text-dyad-vibrant-orange">Olímpia Ofertas</span>
          </h2>
          <p className="text-md md:text-lg">
            Descubra as melhores ofertas e produtos!
          </p>
          <Link to="/explorar-produtos" className="mt-4 inline-block">
            <button className="bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white py-2 px-6 rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
              Explorar Produtos
            </button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full relative overflow-hidden">
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container flex h-[300px] md:h-[600px]">
          {banners.map((banner) => (
            <div key={banner.id} className="embla__slide flex-[0_0_100%] min-w-0 relative">
              {banner.cta_link ? (
                <Link to={banner.cta_link} className="block w-full h-full">
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                  />
                </Link>
              ) : (
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
          {scrollSnaps.map((_, index) => (
            <DotButton
              key={index}
              selected={index === selectedIndex}
              onClick={() => emblaApi && emblaApi.scrollTo(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default HeroBanner;