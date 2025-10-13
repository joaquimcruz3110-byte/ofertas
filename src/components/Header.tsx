"use client";

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, ShoppingCart, Menu } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { useCart } from './CartProvider';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/SessionContextProvider';
import { navItems } from '@/lib/nav-items';

const Header = () => {
  const navigate = useNavigate();
  const { totalItems } = useCart();
  const { userRole, session } = useSession(); // Obter userRole e session

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

  const renderNavLinks = () => (
    <nav className="flex flex-col space-y-1 p-4">
      {userRole && navItems.filter(item => item.roles.includes(userRole)).map((item) => (
        <Link
          key={item.name + item.href}
          to={item.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-dyad-dark-blue transition-all hover:bg-dyad-vibrant-orange hover:text-dyad-white",
            // Adicione classes para o item ativo se necessário, por exemplo, usando useLocation
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.name}
        </Link>
      ))}
    </nav>
  );

  return (
    <header className="flex justify-between items-center p-4 bg-dyad-dark-blue text-dyad-white shadow-md">
      <div className="flex items-center">
        {/* Botão do menu para mobile */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden text-dyad-white mr-2">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col bg-dyad-white p-0">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 bg-dyad-dark-blue text-dyad-white">
              <Link to="/" className="flex items-center gap-2 font-semibold">
                <span className="text-lg">Ponta de Estoque</span>
              </Link>
            </div>
            <div className="flex-1 overflow-auto py-2">
              {renderNavLinks()}
            </div>
          </SheetContent>
        </Sheet>
        <h1 className="text-2xl font-bold">Ponta de Estoque</h1>
      </div>
      <div className="flex items-center space-x-4">
        {userRole === 'comprador' && (
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
        )}
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="text-dyad-white hover:bg-dyad-vibrant-orange hover:text-dyad-white"
          disabled={!session} // Desabilita o botão se não houver sessão
        >
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </header>
  );
};

export default Header;