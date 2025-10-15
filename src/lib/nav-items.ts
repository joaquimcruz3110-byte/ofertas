import { Home, ShoppingBag, Store, Users, Settings, Package, DollarSign, LayoutGrid, LayoutDashboard, User, ShoppingCart, ReceiptText } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: string[]; // Papéis que podem ver este item
}

export const navItems: NavItem[] = [
  { name: 'Início', href: '/', icon: Home, roles: ['comprador', 'lojista', 'administrador'] },
  { name: 'Meu Perfil', href: '/profile', icon: User, roles: ['comprador', 'lojista', 'administrador'] },
  { name: 'Painel', href: '/comprador-dashboard', icon: LayoutDashboard, roles: ['comprador'] },
  { name: 'Painel', href: '/lojista-dashboard', icon: LayoutDashboard, roles: ['lojista'] },
  { name: 'Configurar Loja', href: '/shop-setup', icon: Store, roles: ['lojista'] },
  { name: 'Painel do Administrador', href: '/admin-dashboard', icon: LayoutDashboard, roles: ['administrador'] },
  { name: 'Explorar Produtos', href: '/explorar-produtos', icon: LayoutGrid, roles: ['comprador'] },
  { name: 'Meus Pedidos', href: '/meus-pedidos', icon: ShoppingBag, roles: ['comprador'] },
  { name: 'Meu Carrinho', href: '/cart', icon: ShoppingCart, roles: ['comprador'] }, // Adicionado o carrinho para compradores
  { name: 'Meus Produtos', href: '/meus-produtos', icon: Package, roles: ['lojista'] },
  { name: 'Minhas Vendas', href: '/minhas-vendas', icon: DollarSign, roles: ['lojista'] },
  { name: 'Gerenciar Usuários', href: '/gerenciar-usuarios', icon: Users, roles: ['administrador'] },
  { name: 'Gerenciar Produtos', href: '/gerenciar-produtos', icon: Store, roles: ['administrador'] },
  { name: 'Gerenciar Comissões', href: '/gerenciar-comissoes', icon: Settings, roles: ['administrador'] },
  { name: 'Gerenciar Vendas', href: '/admin-sales', icon: ReceiptText, roles: ['administrador'] }, // Novo item para AdminSales
];