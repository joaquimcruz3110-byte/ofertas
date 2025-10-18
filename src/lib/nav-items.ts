import { Home, ShoppingBag, Store, Users, Settings, Package, DollarSign, LayoutGrid, User, ReceiptText, Tag, HelpCircle, Mail, Image } from 'lucide-react'; // Importar o ícone Image

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: string[]; // Papéis que podem ver este item
}

export const navItems: NavItem[] = [
  // Itens comuns a todos (autenticados ou não)
  { name: 'Início', href: '/', icon: Home, roles: ['comprador', 'lojista', 'administrador', 'unauthenticated'] },
  { name: 'Ofertas do Dia', href: '/explorar-produtos?category=Ofertas do Dia', icon: Tag, roles: ['comprador', 'lojista', 'administrador', 'unauthenticated'] },
  { name: 'Explorar Produtos', href: '/explorar-produtos', icon: LayoutGrid, roles: ['comprador', 'lojista', 'administrador', 'unauthenticated'] },
  { name: 'Ajuda', href: '/help', icon: HelpCircle, roles: ['comprador', 'lojista', 'administrador', 'unauthenticated'] },
  { name: 'Contato', href: '/contact', icon: Mail, roles: ['comprador', 'lojista', 'administrador', 'unauthenticated'] },

  // Item para usuários não autenticados que querem vender
  { name: 'Vender', href: '/login', icon: Store, roles: ['unauthenticated'] },

  // Itens para usuários autenticados (comprador, lojista, administrador)
  { name: 'Meu Perfil', href: '/profile', icon: User, roles: ['comprador', 'lojista', 'administrador'] },

  // Itens específicos para Comprador
  { name: 'Meus Pedidos', href: '/meus-pedidos', icon: ShoppingBag, roles: ['comprador'] },

  // Itens específicos para Lojista
  { name: 'Meus Produtos', href: '/meus-produtos', icon: Package, roles: ['lojista'] },
  { name: 'Minhas Vendas', href: '/minhas-vendas', icon: DollarSign, roles: ['lojista'] },
  { name: 'Configurar Loja', href: '/shop-setup', icon: Store, roles: ['lojista'] },

  // Itens específicos para Administrador
  { name: 'Gerenciar Usuários', href: '/gerenciar-usuarios', icon: Users, roles: ['administrador'] },
  { name: 'Gerenciar Produtos', href: '/gerenciar-produtos', icon: Package, roles: ['administrador'] },
  { name: 'Gerenciar Comissões', href: '/gerenciar-comissoes', icon: Settings, roles: ['administrador'] },
  { name: 'Gerenciar Vendas', href: '/admin-sales', icon: ReceiptText, roles: ['administrador'] },
  { name: 'Gerenciar Banners', href: '/admin-banners', icon: Image, roles: ['administrador'] }, // Novo item
];