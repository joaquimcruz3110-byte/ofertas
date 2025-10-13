"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ShoppingBag, Store, Users, Settings, Package, DollarSign, Menu, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSession } from '@/components/SessionContextProvider'; // Importar useSession

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: string[]; // Papéis que podem ver este item
}

const navItems: NavItem[] = [
  { name: 'Início', href: '/', icon: Home, roles: ['comprador', 'lojista', 'administrador'] },
  { name: 'Explorar Produtos', href: '/explorar-produtos', icon: LayoutGrid, roles: ['comprador'] }, // Novo item
  { name: 'Meus Pedidos', href: '/meus-pedidos', icon: ShoppingBag, roles: ['comprador'] },
  { name: 'Meus Produtos', href: '/meus-produtos', icon: Package, roles: ['lojista'] },
  { name: 'Minhas Vendas', href: '/minhas-vendas', icon: DollarSign, roles: ['lojista'] },
  { name: 'Gerenciar Usuários', href: '/gerenciar-usuarios', icon: Users, roles: ['administrador'] },
  { name: 'Gerenciar Produtos', href: '/gerenciar-produtos', icon: Store, roles: ['administrador'] },
  { name: 'Gerenciar Comissões', href: '/gerenciar-comissoes', icon: Settings, roles: ['administrador'] },
];

const Sidebar = () => { // Removido userRole da prop
  const isMobile = useIsMobile();
  const { userRole } = useSession(); // Obtendo userRole do contexto

  const renderNavLinks = () => (
    <nav className="flex flex-col space-y-1 p-4">
      {userRole && navItems.filter(item => item.roles.includes(userRole)).map((item) => (
        <Link
          key={item.name}
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

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden text-dyad-white">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col bg-dyad-white p-0">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 bg-dyad-dark-blue text-dyad-white">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <span className="text-lg">Meu App</span>
            </Link>
          </div>
          {renderNavLinks()}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="hidden md:flex flex-col h-full border-r bg-dyad-white shadow-md w-64">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 bg-dyad-dark-blue text-dyad-white">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">Meu App</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-2">
        {renderNavLinks()}
      </div>
    </div>
  );
};

export default Sidebar;