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
import MainLayout from "./components/MainLayout";
import ShopSetupPage from "./pages/ShopSetupPage";
import PagarmeReturnPage from "./pages/PagarmeReturnPage";
import AdminSales from "./pages/AdminSales";
import AuthenticatedHomeRedirect from "./components/AuthenticatedHomeRedirect";
import HelpPage from "./pages/Help";
import ContactPage from "./pages/Contact";
import AdminBanners from "./pages/AdminBanners";
import LandingPageContent from "./pages/LandingPageContent"; // Importar o novo componente

const queryClient = new QueryClient();

// Componente de rota protegida
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading, userRole, hasShopDetails } = useSession();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando autenticação...</div>;
  }

  if (!session) {
    return <Navigate to="/" replace />; // Redireciona para a raiz (que agora lida com a landing page)
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
              <Route path="/login" element={<Login />} />
              <Route path="/pagarme-return" element={<PagarmeReturnPage />} />

              {/* Rotas públicas que usam o MainLayout */}
              <Route element={<MainLayout />}>
                <Route path="/" element={<AuthenticatedHomeRedirect />} /> {/* A raiz agora renderiza o redirecionamento/landing */}
                <Route path="/explorar-produtos" element={<ProductListing />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/contact" element={<ContactPage />} />
              </Route>

              {/* Rotas protegidas */}
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
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
                <Route path="/admin-banners" element={<AdminBanners />} />
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