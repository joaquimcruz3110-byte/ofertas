"use client";

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ProductCarousel from '@/components/ProductCarousel';
import { ArrowRight } from 'lucide-react';

const FeaturedOffersSection = () => {
  return (
    <section className="w-full py-16 bg-dyad-dark-blue text-dyad-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl font-bold mb-6">Ofertas em Destaque</h2>
        <p className="text-lg mb-10 max-w-2xl mx-auto">
          Não perca as melhores promoções e produtos exclusivos.
        </p>
        <ProductCarousel />
        <div className="mt-12">
          <Link to="/explorar-produtos">
            <Button className="bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white py-3 px-8 text-lg rounded-dyad-rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
              Explorar Todas as Ofertas <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturedOffersSection;