"use client";

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, ShoppingCart } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { useCart } from './CartProvider'; // Importar useCart

const Header = () => {
  const navigate = useNavigate();
  const { totalItems } = useCart(); // Usar o hook useCart para obter o total de itens

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError('Erro ao fazer logout: ' + error.message);
      console.error('Erro ao fazer logout:', error.message);
    } else {
      showSuccess('Você foi desconectado com sucesso!');
      navigate('/login');
    }
  };

  return (
    <header className="flex justify-between items-center p-4 bg-dyad-dark-blue text-dyad-white shadow-md">
      <h1 className="text-2xl font-bold">Ponta de Estoque</h1>
      <div className="flex items-center space-x-4">
        <Link to="/cart" className="relative">
          <Button variant="ghost" className="text-dyad-white hover:bg-dyad-vibrant-orange hover:text-dyad-white">
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Button>
        </Link>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="text-dyad-white hover:bg-dyad-vibrant-orange hover:text-dyad-white"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </header>
  );
};

export default Header;