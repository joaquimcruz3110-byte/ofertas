"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, ShoppingBag, DollarSign, CheckCircle } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    title: '1. Crie sua Conta',
    description: 'Cadastre-se como comprador para explorar produtos ou como lojista para começar a vender.',
  },
  {
    icon: ShoppingBag,
    title: '2. Explore ou Liste Produtos',
    description: 'Compradores podem navegar por milhares de ofertas. Lojistas podem listar seus produtos facilmente.',
  },
  {
    icon: DollarSign,
    title: '3. Compre ou Venda',
    description: 'Compradores realizam compras seguras. Lojistas recebem pagamentos e gerenciam suas vendas.',
  },
  {
    icon: CheckCircle,
    title: '4. Desfrute!',
    description: 'Compradores recebem seus produtos. Lojistas expandem seus negócios e alcançam novos clientes.',
  },
];

const HowItWorksSection = () => {
  return (
    <section className="w-full py-16 bg-dyad-white text-dyad-dark-blue">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl font-bold mb-6">Como Funciona</h2>
        <p className="text-lg mb-10 max-w-2xl mx-auto text-gray-700">
          É simples e rápido começar a usar o Olímpia Ofertas.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <Card key={index} className="p-6 flex flex-col items-center text-center shadow-dyad-soft">
              <CardHeader className="p-0 mb-4">
                <step.icon className="h-12 w-12 text-dyad-vibrant-orange" />
              </CardHeader>
              <CardContent className="p-0">
                <CardTitle className="text-xl font-semibold mb-2">{step.title}</CardTitle>
                <p className="text-gray-600">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;