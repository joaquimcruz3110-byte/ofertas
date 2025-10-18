"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Quote } from 'lucide-react';

const testimonials = [
  {
    quote: "O Olímpia Ofertas transformou a forma como faço minhas compras. Encontro tudo o que preciso com preços incríveis!",
    author: "Ana Paula S.",
    role: "Compradora Fiel",
  },
  {
    quote: "Como lojista, a plataforma me deu a visibilidade que eu precisava. Minhas vendas aumentaram significativamente!",
    author: "Carlos M.",
    role: "Lojista Parceiro",
  },
  {
    quote: "Interface intuitiva e suporte excelente. Recomendo a todos que querem comprar ou vender online com segurança.",
    author: "Mariana L.",
    role: "Usuária Satisfeita",
  },
];

const TestimonialsSection = () => {
  return (
    <section className="w-full py-16 bg-gradient-to-br from-dyad-dark-blue to-blue-900 text-dyad-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl font-bold mb-6">O Que Nossos Usuários Dizem</h2>
        <p className="text-lg mb-10 max-w-2xl mx-auto text-gray-200">
          A satisfação dos nossos usuários é a nossa maior recompensa.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="p-6 flex flex-col items-center text-center bg-dyad-white text-dyad-dark-blue shadow-lg">
              <CardHeader className="p-0 mb-4">
                <Quote className="h-10 w-10 text-dyad-vibrant-orange" />
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-lg italic mb-4">"{testimonial.quote}"</p>
                <CardTitle className="text-xl font-semibold">{testimonial.author}</CardTitle>
                <p className="text-sm text-gray-600">{testimonial.role}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;