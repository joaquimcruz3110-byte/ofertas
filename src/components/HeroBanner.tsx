"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Truck, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

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

const HeroBanner = () => {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchActiveBanner = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
        .limit(1) // Por enquanto, pegamos apenas o primeiro banner ativo
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
        showError('Erro ao carregar banner: ' + error.message);
        console.error('Erro ao carregar banner:', error.message);
        setBanner(null);
      } else if (data) {
        setBanner(data as Banner);
      } else {
        setBanner(null);
      }
      setIsLoading(false);
    };

    fetchActiveBanner();
  }, []);

  if (isLoading) {
    return (
      <section className="w-full bg-dyad-dark-blue text-dyad-white py-16 md:py-24 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-3">Carregando banner...</span>
      </section>
    );
  }

  // Se não houver banner ativo, exibe um banner padrão ou nada
  if (!banner) {
    return (
      <section className="w-full bg-dyad-dark-blue text-dyad-white py-16 md:py-24 relative overflow-hidden">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between relative z-10">
          <div className="text-center md:text-left md:w-1/2 mb-10 md:mb-0">
            <h2 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
              Bem-vindo ao <br /><span className="text-dyad-vibrant-orange">Olímpia Ofertas</span>
            </h2>
            <p className="text-xl md:text-2xl mb-8">
              Descubra as melhores ofertas e produtos!
            </p>
            <Link to="/explorar-produtos">
              <Button className="bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white py-4 px-10 text-xl rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
                Explorar Produtos
              </Button>
            </Link>
          </div>
          <div className="md:w-1/2 flex justify-center md:justify-end">
            <img
              src="/placeholder.svg"
              alt="Oferta de Utilidades"
              className="max-w-full h-auto md:max-w-lg object-contain"
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full bg-dyad-dark-blue text-dyad-white py-16 md:py-24 relative overflow-hidden">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between relative z-10">
        <div className="text-center md:text-left md:w-1/2 mb-10 md:mb-0">
          <h2 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
            {banner.title.split('<br />').map((line, index) => (
              <React.Fragment key={index}>
                {line}
                {index < banner.title.split('<br />').length - 1 && <br />}
              </React.Fragment>
            ))}
          </h2>
          {banner.description && <p className="text-xl md:text-2xl mb-4">{banner.description}</p>}
          <div className="flex items-center justify-center md:justify-start mb-6">
            <Truck className="h-8 w-8 text-green-400 mr-3" />
            <span className="text-2xl font-semibold text-green-400">FRETE GRÁTIS</span>
          </div>
          {banner.cta_link && (
            <Link to={banner.cta_link}>
              <Button className="bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white py-4 px-10 text-xl rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
                {banner.cta_text || 'Ver Oferta'}
              </Button>
            </Link>
          )}
        </div>

        <div className="md:w-1/2 flex justify-center md:justify-end">
          <img
            src={banner.image_url}
            alt={banner.title}
            className="max-w-full h-auto md:max-w-lg object-contain"
          />
        </div>
      </div>
      {/* Indicadores de Carrossel (estáticos por enquanto, mas podem ser dinâmicos com múltiplos banners) */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
        <span className="h-2 w-2 bg-dyad-vibrant-orange rounded-full"></span>
        <span className="h-2 w-2 bg-gray-400 rounded-full"></span>
        <span className="h-2 w-2 bg-gray-400 rounded-full"></span>
        <span className="h-2 w-2 bg-gray-400 rounded-full"></span>
      </div>
    </section>
  );
};

export default HeroBanner;