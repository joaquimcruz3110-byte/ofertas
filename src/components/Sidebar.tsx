"use client";

import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/SessionContextProvider';
import { navItems } from '@/lib/nav-items'; // Importar navItems

const Sidebar = () => {
  const { userRole } = useSession();

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
    <div className="hidden md:flex flex-col h-full border-r bg-dyad-white shadow-md w-64">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 bg-dyad-dark-blue text-dyad-white">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">Olímpia Ofertas</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-2">
        {renderNavLinks()}
      </div>
    </div>
  );
};

export default Sidebar;