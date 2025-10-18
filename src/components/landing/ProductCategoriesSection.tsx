"use client";

import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card'; // 'CardContent' removido
import { Laptop, Shirt, Home, Book, Gamepad, UtensilsCrossed, Tag, Gift, Sparkles, ShoppingBag, Wallet, Thermometer, Waves, Heart, Baby, Flag, Car, MoreHorizontal } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { useEffect } from 'react';

const categories = [
  { name: 'Ofertas do Dia', icon: Tag, href: '/explorar-produtos?category=Ofertas do Dia' },
  { name: 'Brinquedos', icon: Gamepad, href: '/explorar-produtos?category=Brinquedos' },
  { name: 'Papelaria', icon: Book, href: '/explorar-produtos?category=Papelaria' },
  { name: 'Halloween', icon: Sparkles, href: '/explorar-produtos?category=Halloween' },
  { name: 'Enfeites de Natal', icon: Gift, href: '/explorar-produtos?category=Enfeites de Natal' },
  { name: 'Casa e Decoração', icon: Home, href: '/explorar-produtos?category=Casa e Decoração' },
  { name: 'Malas e Mochilas', icon: ShoppingBag, href: '/explorar-produtos?category=Malas e Mochilas' },
  { name: 'Eletrônicos', icon: Laptop, href: '/explorar-produtos?category=Eletrônicos' },
  { name: 'Bolsas no Atacado', icon: Wallet, href: '/explorar-produtos?category=Bolsas no Atacado' },
  { name: 'Carteiras Femininas', icon: Wallet, href: '/explorar-produtos?category=Carteiras Femininas' },
  { name: 'Necessaire e Térmica', icon: Thermometer, href: '/explorar-produtos?category=Necessaire e Térmica' },
  { name: 'Infláveis e Piscinas', icon: Waves, href: '/explorar-produtos?category=Infláveis e Piscinas' },
  { name: 'Roupas Femininas', icon: Shirt, href: '/explorar-produtos?category=Roupas Femininas' },
  { name: 'Infantil', icon: Baby, href: '/explorar-produtos?category=Infantil' },
  { name: 'Masculinos', icon: Shirt, href: '/explorar-produtos?category=Masculinos' },
  { name: 'Beleza e Cuidado Pessoal', icon: Heart, href: '/explorar-produtos?category=Beleza e Cuidado Pessoal' },
  { name: 'Bandeiras, Cornetas +', icon: Flag, href: '/explorar-produtos?category=Bandeiras, Cornetas +' },
  { name: 'Mais Vendidos', icon: Tag, href: '/explorar-produtos?category=Mais Vendidos' },
  { name: 'Ofertas', icon: Tag, href: '/explorar-produtos?category=Ofertas' },
  { name: 'Alimentos', icon: UtensilsCrossed, href: '/explorar-produtos?category=Alimentos' },
  { name: 'Livros', icon: Book, href: '/explorar-produtos?category=Livros' },
  { name: 'Esportes', icon: Gamepad, href: '/explorar-produtos?category=Esportes' },
  { name: 'Automotivo', icon: Car, href: '/explorar-produtos?category=Automotivo' },
  { name: 'Outros', icon: MoreHorizontal, href: '/explorar-produtos?category=Outros' },
];

const AUTOPLAY_INTERVAL = 2500; // 2.5 segundos

const ProductCategoriesSection = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });

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

  return (
    <section className="w-full py-8 bg-dyad-white text-dyad-dark-blue border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="embla overflow-hidden">
          <div className="embla__viewport" ref={emblaRef}>
            <div className="embla__container flex -ml-4">
              {categories.map((category) => (
                <div key={category.name} className="embla__slide flex-[0_0_25%] sm:flex-[0_0_16.66%] md:flex-[0_0_12.5%] lg:flex-[0_0_8.33%] pl-4">
                  <Link to={category.href} className="block">
                    <Card className="flex flex-col items-center justify-center p-2 h-28 w-full text-center hover:shadow-md transition-shadow duration-300 cursor-pointer bg-dyad-white border-none">
                      <category.icon className="h-8 w-8 text-dyad-vibrant-orange mb-2" />
                      <p className="text-xs font-medium text-gray-700 leading-tight">{category.name}</p>
                    </Card>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductCategoriesSection;