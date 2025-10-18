"use client";

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { ShoppingBag, LogIn, UserPlus, ArrowRight } from 'lucide-react';
import RoleSelectionDialog from '@/components/RoleSelectionDialog';
import FeaturedOffersSection from '@/components/landing/FeaturedOffersSection';
import ProductCategoriesSection from '@/components/landing/ProductCategoriesSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import NewArrivalsCarousel from './NewArrivalsCarousel'; // Importar o novo carrossel de novidades
import BestSellersCarousel from './BestSellersCarousel'; // Importar o novo carrossel de mais vendidos

const AuthenticatedHomeRedirect = () => {
  const { session, isLoading, userRole, hasShopDetails } = useSession();
  const navigate = useNavigate();
  const [isRoleSelectionOpen, setIsRoleSelectionOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && session) {
      if (userRole === 'comprador') {
        navigate('/comprador-dashboard', { replace: true });
      } else if (userRole === 'lojista') {
        if (!hasShopDetails) {
          navigate('/shop-setup', { replace: true });
        } else {
          navigate('/lojista-dashboard', { replace: true });
        }
      } else if (userRole === 'administrador') {
        navigate('/admin-dashboard', { replace: true });
      } else {
        // Fallback para qualquer outro papel ou caso não definido
        navigate('/explorar-produtos', { replace: true });
      }
    }
  }, [isLoading, session, userRole, hasShopDetails, navigate]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session) {
    // Render the landing page content if not authenticated
    return (
      <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-dyad-dark-blue to-blue-900 text-dyad-white">
        {/* Hero Section */}
        <section className="w-full py-20 md:py-32 flex flex-col items-center justify-center text-center px-4">
          <ShoppingBag className="mx-auto h-24 w-24 text-dyad-vibrant-orange mb-6" />
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Bem-vindo(a) ao <span className="text-dyad-vibrant-orange">Olímpia Ofertas</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl">
            Olímpia Ofertas: compre mais, gaste menos! Descubra uma nova forma de comprar e vender produtos online.
            Conecte-se com lojistas e encontre tudo o que você precisa, ou comece a vender seus próprios produtos hoje mesmo!
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/explorar-produtos">
              <Button className="w-full sm:w-auto bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white py-3 px-6 text-lg rounded-dyad-rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
                Explorar Ofertas <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button
              className="w-full sm:w-auto bg-dyad-dark-blue text-dyad-white hover:bg-dyad-vibrant-orange py-3 px-6 text-lg rounded-dyad-rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105"
              onClick={() => setIsRoleSelectionOpen(true)}
            >
              <UserPlus className="mr-2 h-5 w-5" /> Criar Conta Grátis
            </Button>
            <Link to="/login">
              <Button variant="outline" className="w-full sm:w-auto border-dyad-vibrant-orange text-dyad-vibrant-orange hover:bg-dyad-light-gray hover:text-dyad-dark-blue py-3 px-6 text-lg rounded-dyad-rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
                <LogIn className="mr-2 h-5 w-5" /> Entrar
              </Button>
            </Link>
          </div>
        </section>

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

        {/* Product Categories Section */}
        <ProductCategoriesSection />

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
  }

  return null; // If authenticated, it will redirect, so render nothing here.
};

export default AuthenticatedHomeRedirect;