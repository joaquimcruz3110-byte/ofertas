import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { SessionContextProvider, useSession } from "./components/SessionContextProvider";
import { CartProvider } from "./components/CartProvider";
import React from "react";

// Importar as novas páginas e o MainLayout
import MeusPedidos from "./pages/MeusPedidos";
import MeusProdutos from "./pages/MeusProdutos";
import MinhasVendas from "./pages/MinhasVendas";
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import GerenciarProdutos from "./pages/GerenciarProdutos";
import GerenciarComissoes from "./pages/GerenciarComissoes";
import ProductListing from "./pages/ProductListing";
import ProductDetail from "./pages/ProductDetail";
import LojistaDashboard from "./pages/LojistaDashboard";
import CompradorDashboard from "./pages/CompradorDashboard";
import UserProfile from "./pages/UserProfile";
import CartPage from "./pages/CartPage";
import AdminDashboard from "./pages/AdminDashboard";
import LandingPage from "./pages/LandingPage";
import MainLayout from "./components/MainLayout"; // Importar MainLayout
import ShopSetupPage from "./pages/ShopSetupPage"; // Importar a nova página de configuração da loja
import PagarmeReturnPage from "./pages/PagarmeReturnPage"; // Importar a nova página de retorno do Pagar.me
import AdminSales from "./pages/AdminSales"; // Importar a página AdminSales
import AuthenticatedHomeRedirect from "./components/AuthenticatedHomeRedirect"; // Importar o novo componente de redirecionamento
import HelpPage from "./pages/Help"; // Importar a nova página de ajuda
import ContactPage from "./pages/Contact"; // Importar a nova página de contato

const queryClient = new QueryClient();

// Componente de rota protegida
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading, userRole, hasShopDetails } = useSession();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando autenticação...</div>;
  }

  if (!session) {
    return <Navigate to="/landing" replace />; // Redireciona para a LandingPage se não autenticado
  }

  // Redireciona lojistas para a página de configuração da loja se não tiverem detalhes
  if (userRole === 'lojista' && !hasShopDetails && window.location.pathname !== '/shop-setup') {
    return <Navigate to="/shop-setup" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SessionContextProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<AuthenticatedHomeRedirect />} /> {/* A raiz agora é o redirecionador */}
              <Route path="/landing" element={<LandingPage />} /> {/* Landing page movida */}
              <Route path="/login" element={<Login />} />
              <Route path="/pagarme-return" element={<PagarmeReturnPage />} />

              {/* Rotas públicas que usam o MainLayout */}
              <Route element={<MainLayout />}>
                <Route path="/explorar-produtos" element={<ProductListing />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/help" element={<HelpPage />} /> {/* Nova rota de ajuda */}
                <Route path="/contact" element={<ContactPage />} /> {/* Nova rota de contato */}
              </Route>

              {/* Rotas protegidas */}
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                {/* A rota /home-redirect foi removida, pois AuthenticatedHomeRedirect agora está na raiz */}
                <Route path="/profile" element={<UserProfile />} />
                <Route path="/comprador-dashboard" element={<CompradorDashboard />} />
                <Route path="/meus-pedidos" element={<MeusPedidos />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/lojista-dashboard" element={<LojistaDashboard />} />
                <Route path="/meus-produtos" element={<MeusProdutos />} />
                <Route path="/minhas-vendas" element={<MinhasVendas />} />
                <Route path="/shop-setup" element={<ShopSetupPage />} />
                <Route path="/admin-dashboard" element={<AdminDashboard />} />
                <Route path="/gerenciar-usuarios" element={<GerenciarUsuarios />} />
                <Route path="/gerenciar-produtos" element={<GerenciarProdutos />} />
                <Route path="/gerenciar-comissoes" element={<GerenciarComissoes />} />
                <Route path="/admin-sales" element={<AdminSales />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CartProvider>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;