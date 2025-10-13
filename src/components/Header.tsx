"use client";

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

const Header = () => {
  const navigate = useNavigate();

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
      <h1 className="text-2xl font-bold">Meu Aplicativo</h1>
      <Button
        variant="ghost"
        onClick={handleLogout}
        className="text-dyad-white hover:bg-dyad-vibrant-orange hover:text-dyad-white"
      >
        <LogOut className="mr-2 h-4 w-4" /> Sair
      </Button>
    </header>
  );
};

export default Header;