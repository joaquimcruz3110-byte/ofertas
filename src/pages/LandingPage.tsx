"use client";

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShoppingBag, LogIn, UserPlus } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-dyad-dark-blue to-blue-900 text-dyad-white p-4">
      <div className="text-center max-w-3xl">
        <ShoppingBag className="mx-auto h-24 w-24 text-dyad-vibrant-orange mb-6" />
        <h1 className="text-5xl font-bold mb-6 leading-tight">
          Bem-vindo(a) ao <span className="text-dyad-vibrant-orange">Ponta de Estoque</span>
        </h1>
        <p className="text-xl mb-8">
          Descubra uma nova forma de comprar e vender produtos online.
          Conecte-se com lojistas e encontre tudo o que você precisa, ou comece a vender seus próprios produtos hoje mesmo!
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link to="/login">
            <Button className="w-full sm:w-auto bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white py-3 px-6 text-lg rounded-dyad-rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
              <LogIn className="mr-2 h-5 w-5" /> Entrar
            </Button>
          </Link>
          <Link to="/login"> {/* Supabase Auth UI lida com o cadastro na mesma tela de login */}
            <Button className="w-full sm:w-auto bg-dyad-dark-blue text-dyad-white hover:bg-dyad-vibrant-orange py-3 px-6 text-lg rounded-dyad-rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
              <UserPlus className="mr-2 h-5 w-5" /> Cadastrar
            </Button>
          </Link>
        </div>
      </div>
      <footer className="mt-12 text-sm text-gray-300">
        <p>&copy; {new Date().getFullYear()} Ponta de Estoque. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default LandingPage;