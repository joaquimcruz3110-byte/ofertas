"use client";

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ShoppingCart, Menu, Search } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { useCart } from './CartProvider';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/SessionContextProvider';
import { navItems } from '@/lib/nav-items';
import { Input } from '@/components/ui/input';
import { useState } from 'react'; // Adicionado o import de useState

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();
  const { userRole, session } = useSession();
  const [searchTerm, setSearchTerm] = useState(''); // Estado para a barra de busca

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/explorar-produtos?search=${encodeURIComponent(searchTerm.trim())}`);
      setSearchTerm('');
    }
  };

  const renderNavLinks = (isMobile: boolean) => (
    <nav className={`flex ${isMobile ? 'flex-col space-y-1 p-4' : 'space-x-4'}`}>
      {navItems
        .filter(item => item.roles.includes(userRole || 'unauthenticated'))
        .map((item) => {
          let itemHref = item.href;
          if (item.name === 'Vender' && userRole === 'unauthenticated') {
            itemHref = '/login';
          }

          return (
            <Link
              key={item.name + item.href}
              to={itemHref}
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

      <div className="hidden md:flex items-center space-x-4 mx-auto">
        {renderNavLinks(false)}
      </div>

      <div className="flex items-center space-x-4 mt-4 md:mt-0 w-full md:w-auto justify-end">
        <form onSubmit={handleSearch} className="relative flex items-center">
          <Input
            type="text"
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-2 py-1 rounded-md text-dyad-dark-gray bg-dyad-white border-dyad-light-gray focus:ring-2 focus:ring-dyad-vibrant-orange"
          />
          <Search className="absolute left-2 h-4 w-4 text-gray-500" />
          <Button type="submit" size="sm" className="ml-2 bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white">
            Buscar
          </Button>
        </form>

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