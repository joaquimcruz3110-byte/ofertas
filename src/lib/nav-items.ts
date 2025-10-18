import { Home, ShoppingBag, Store, Users, Settings, Package, DollarSign, LayoutGrid, LayoutDashboard, User, ReceiptText, Tag, HelpCircle, Mail } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: string[]; // Papéis que podem ver este item
}

export const navItems: NavItem[] = [
  { name: 'Início', href: '/home-redirect', icon: Home, roles: ['comprador', 'lojista', 'administrador'] }, // Aponta para o redirecionamento
  { name: 'Ofertas do Dia', href: '/explorar-produtos?category=Ofertas do Dia', icon: Tag, roles: ['comprador', 'lojista', 'administrador', 'unauthenticated'] },
  { name: 'Vender', href: '/shop-setup', icon: Store, roles: ['lojista', 'unauthenticated'] },
  { name: 'Ajuda', href: '/help', icon: HelpCircle, roles: ['comprador', 'lojista', 'administrador', 'unauthenticated'] },
  { name: 'Contato', href: '/contact', icon: Mail, roles: ['comprador', 'lojista', 'administrador', 'unauthenticated'] },
  { name: 'Meu Perfil', href: '/profile', icon: User, roles: ['lojista', 'administrador', 'comprador'] },
  { name: 'Painel', href: '/comprador-dashboard', icon: LayoutDashboard, roles: ['comprador'] },
  { name: 'Painel', href: '/lojista-dashboard', icon: LayoutDashboard, roles: ['lojista'] },
  { name: 'Configurar Loja', href: '/shop-setup', icon: Store, roles: ['lojista'] },
  { name: 'Painel do Administrador', href: '/admin-dashboard', icon: LayoutDashboard, roles: ['administrador'] },
  { name: 'Explorar Produtos', href: '/explorar-produtos', icon: LayoutGrid, roles: ['comprador', 'lojista', 'administrador', 'unauthenticated'] }, // Agora acessível a todos
  { name: 'Meus Pedidos', href: '/meus-pedidos', icon: ShoppingBag, roles: ['lojista', 'administrador', 'comprador'] },
  { name: 'Meus Produtos', href: '/meus-produtos', icon: Package, roles: ['lojista'] },
  { name: 'Minhas Vendas', href: '/minhas-vendas', icon: DollarSign, roles: ['lojista'] },
  { name: 'Gerenciar Usuários', href: '/gerenciar-usuarios', icon: Users, roles: ['administrador'] },
  { name: 'Gerenciar Produtos', href: '/gerenciar-produtos', icon: Store, roles: ['administrador'] },
  { name: 'Gerenciar Comissões', href: '/gerenciar-comissoes', icon: Settings, roles: ['administrador'] },
  { name: 'Gerenciar Vendas', href: '/admin-sales', icon: ReceiptText, roles: ['administrador'] },
];