"use client";

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ShoppingCart, Menu } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { useCart } from './CartProvider';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/SessionContextProvider';
import { navItems } from '@/lib/nav-items';
// Removido o import de Input e Search, e o estado searchTerm

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();
  const { userRole, session } = useSession();
  // Removido o estado searchTerm

  const handleLogout = async () => {
    if (session) { // Só tenta fazer logout se houver uma sessão ativa
      const { error } = await supabase.auth.signOut();
      if (error) {
        showError('Erro ao fazer logout: ' + error.message);
        console.error('Erro ao fazer logout:', error.message);
      } else {
        showSuccess('Você foi desconectado com sucesso!');
        navigate('/login');
      }
    } else {
      // Se não há sessão, o usuário já está efetivamente desconectado.
      showSuccess('Você já está desconectado.');
      navigate('/login');
    }
  };

  // Removido o handleSearch

  const renderNavLinks = (isMobile: boolean) => (
    <nav className={`flex ${isMobile ? 'flex-col space-y-1 p-4' : 'flex-wrap gap-x-4 gap-y-2'}`}>
      {navItems
        .filter(item => item.roles.includes(userRole || 'unauthenticated'))
        .map((item) => {
          // A lógica condicional para itemHref foi removida, pois navItems agora define o href correto
          return (
            <Link
              key={item.name + item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-dyad-white transition-all hover:bg-dyad-vibrant-orange hover:text-dyad-white",
                isMobile ? 'text-dyad-dark-blue hover:bg-dyad-light-gray' : '',
                location.pathname === item.href ? (isMobile ? 'bg-dyad-light-gray' : 'bg-dyad-vibrant-orange') : ''
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
    </nav>
  );

  return (
    <header className="flex flex-wrap justify-between items-center p-4 bg-dyad-dark-blue text-dyad-white shadow-md">
      <div className="flex items-center">
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
                <span className="text-lg">Olímpia Ofertas</span>
              </Link>
            </div>
            <div className="flex-1 overflow-auto py-2">
              {renderNavLinks(true)}
            </div>
          </SheetContent>
        </Sheet>
        <h1 className="text-2xl font-bold">Olímpia Ofertas</h1>
      </div>

      <div className="hidden md:flex flex-1 items-center justify-center">
        {renderNavLinks(false)}
      </div>

      <div className="flex items-center space-x-4 mt-4 md:mt-0 w-full md:w-auto justify-end">
        {/* Removido o formulário de busca daqui */}

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
        {session && (
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-dyad-white hover:bg-dyad-vibrant-orange hover:text-dyad-white"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;