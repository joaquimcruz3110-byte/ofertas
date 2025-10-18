"use client";

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import RoleSelectionDialog from '@/components/RoleSelectionDialog';
import FeaturedOffersSection from '@/components/landing/FeaturedOffersSection';
import ProductCategoriesSection from '@/components/landing/ProductCategoriesSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import NewArrivalsCarousel from '@/components/NewArrivalsCarousel';
import BestSellersCarousel from '@/components/BestSellersCarousel';
import HeroBanner from '@/components/HeroBanner';
import { useState } from 'react';

const LandingPageContent = () => {
  const [isRoleSelectionOpen, setIsRoleSelectionOpen] = useState(false);

  return (
    <div className="flex flex-col items-center bg-gradient-to-br from-dyad-dark-blue to-blue-900 text-dyad-white">
      {/* Hero Section */}
      <HeroBanner />

      {/* Product Categories Section (agora um carrossel) */}
      <ProductCategoriesSection />

      {/* Featured Offers Section */}
      <FeaturedOffersSection />

      {/* New Arrivals Section */}
      <section className="w-full py-16 bg-dyad-light-gray text-dyad-dark-blue">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Novidades</h2>
          <p className="text-lg mb-10 max-w-2xl mx-auto text-gray-700">
            Confira os produtos mais recentes adicionados à nossa plataforma.
          </p>
          <NewArrivalsCarousel />
          <div className="mt-12">
            <Link to="/explorar-produtos?sort=newest">
              <Button className="bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white py-3 px-8 text-lg rounded-dyad-rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
                Ver Todas as Novidades <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Best Sellers Section */}
      <section className="w-full py-16 bg-dyad-white text-dyad-dark-blue">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Mais Vendidos</h2>
          <p className="text-lg mb-10 max-w-2xl mx-auto text-gray-700">
            Descubra os produtos que estão fazendo mais sucesso entre nossos clientes.
          </p>
          <BestSellersCarousel />
          <div className="mt-12">
            <Link to="/explorar-produtos?sort=bestsellers">
              <Button className="bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white py-3 px-8 text-lg rounded-dyad-rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
                Ver Todos os Mais Vendidos <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Testimonials Section */}
      <TestimonialsSection />

      <footer className="w-full py-8 text-sm text-gray-300 bg-dyad-dark-blue text-center">
        <p>&copy; {new Date().getFullYear()} Olímpia Ofertas. Todos os direitos reservados.</p>
      </footer>

      <RoleSelectionDialog
        isOpen={isRoleSelectionOpen}
        onClose={() => setIsRoleSelectionOpen(false)}
      />
    </div>
  );
};

export default LandingPageContent;