"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const HelpPage = () => {
  const navigate = useNavigate();

  const faqItems = [
    {
      question: "Como faço para criar uma conta?",
      answer: "Você pode criar uma conta clicando em 'Criar Conta Grátis' na página inicial ou na página de login. Você terá a opção de se cadastrar como Comprador ou Lojista."
    },
    {
      question: "Como posso vender meus produtos?",
      answer: "Se você se cadastrou como Lojista, acesse o 'Painel do Lojista' e, em seguida, 'Configurar Loja' para preencher os detalhes da sua loja. Depois, você poderá gerenciar seus produtos em 'Meus Produtos'."
    },
    {
      question: "Como adiciono produtos ao meu carrinho?",
      answer: "Navegue pela seção 'Explorar Produtos'. Ao encontrar um item que deseja comprar, clique no botão 'Adicionar ao Carrinho' na página do produto. Você precisa estar logado para adicionar itens."
    },
    {
      question: "Quais métodos de pagamento são aceitos?",
      answer: "Atualmente, aceitamos pagamentos via Pix. Após finalizar a compra, um QR Code e um código 'copia e cola' serão gerados para você."
    },
    {
      question: "Como vejo o status dos meus pedidos?",
      answer: "Após fazer login como Comprador, você pode acessar 'Meus Pedidos' no menu de navegação para ver o histórico e o status de todas as suas compras."
    },
    {
      question: "Esqueci minha senha, o que devo fazer?",
      answer: "Na página de login, clique em 'Esqueceu sua senha?'. Digite seu e-mail e siga as instruções que serão enviadas para redefinir sua senha."
    },
  ];

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-4xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)} // Volta para a página anterior
        className="mb-6 text-dyad-dark-blue hover:bg-dyad-light-gray"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Central de Ajuda</h1>
      <p className="text-lg text-gray-600 mb-8">
        Encontre respostas para as perguntas mais frequentes sobre como usar o Olímpia Ofertas.
      </p>

      <Accordion type="single" collapsible className="w-full">
        {faqItems.map((item, index) => (
          <AccordionItem key={index} value={`item-${index + 1}`}>
            <AccordionTrigger className="text-left text-dyad-dark-blue hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-gray-700">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default HelpPage;