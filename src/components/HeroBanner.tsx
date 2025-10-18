"use client";

import { Button } from '@/components/ui/button';
import { Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

const HeroBanner = () => {
  return (
    <section className="w-full bg-dyad-dark-blue text-dyad-white py-16 md:py-24 relative overflow-hidden">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between relative z-10">
        {/* Conteúdo do Banner */}
        <div className="text-center md:text-left md:w-1/2 mb-10 md:mb-0">
          <h2 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
            PREÇOS DO BRÁS <br /><span className="text-dyad-vibrant-orange">UTILIDADES</span>
          </h2>
          <p className="text-xl md:text-2xl mb-4">A partir de:</p>
          <p className="text-5xl md:text-7xl font-extrabold text-dyad-white mb-6">
            R$ <span className="text-dyad-vibrant-orange">4,99</span>
          </p>
          <div className="flex items-center justify-center md:justify-start mb-6">
            <Truck className="h-8 w-8 text-green-400 mr-3" />
            <span className="text-2xl font-semibold text-green-400">FRETE GRÁTIS</span>
          </div>
          <Link to="/explorar-produtos">
            <Button className="bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white py-4 px-10 text-xl rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
              COMPRAR AGORA
            </Button>
          </Link>
        </div>

        {/* Imagem do Banner (ajustada para ser mais genérica ou um placeholder) */}
        <div className="md:w-1/2 flex justify-center md:justify-end">
          <img
            src="/placeholder.svg" // Usando um placeholder genérico
            alt="Oferta de Utilidades"
            className="max-w-full h-auto md:max-w-lg object-contain"
          />
        </div>
      </div>
      {/* Indicadores de Carrossel (estáticos por enquanto) */}
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