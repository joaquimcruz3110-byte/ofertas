"use client";

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Laptop, Shirt, Home, Book, Gamepad, UtensilsCrossed } from 'lucide-react'; // 'Toy' substituído por 'Gamepad'

const categories = [
  { name: 'Eletrônicos', icon: Laptop, href: '/explorar-produtos?category=Eletrônicos' },
  { name: 'Roupas', icon: Shirt, href: '/explorar-produtos?category=Roupas Femininas' },
  { name: 'Casa e Decoração', icon: Home, href: '/explorar-produtos?category=Casa e Decoração' },
  { name: 'Livros', icon: Book, href: '/explorar-produtos?category=Livros' },
  { name: 'Brinquedos', icon: Gamepad, href: '/explorar-produtos?category=Brinquedos' }, // Usando Gamepad
  { name: 'Alimentos', icon: UtensilsCrossed, href: '/explorar-produtos?category=Alimentos' },
];

const ProductCategoriesSection = () => {
  return (
    <section className="w-full py-16 bg-dyad-light-gray text-dyad-dark-blue">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl font-bold mb-6">Navegue por Categorias</h2>
        <p className="text-lg mb-10 max-w-2xl mx-auto text-gray-700">
          Encontre exatamente o que você procura em nossas diversas categorias de produtos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Link to={category.href} key={category.name}>
              <Card className="flex flex-col items-center justify-center p-6 h-48 hover:shadow-lg transition-shadow duration-300 cursor-pointer bg-dyad-white">
                <CardHeader className="p-0 mb-4">
                  <category.icon className="h-12 w-12 text-dyad-vibrant-orange" />
                </CardHeader>
                <CardContent className="p-0">
                  <CardTitle className="text-xl font-semibold">{category.name}</CardTitle>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductCategoriesSection;