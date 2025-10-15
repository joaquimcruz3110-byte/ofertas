import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { SessionContextProvider, useSession } from "./components/SessionContextProvider";
import { CartProvider } from "./components/CartProvider";
import React, { useEffect } from "react"; // Importar useEffect

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
import MercadoPagoReturnPage from "./pages/MercadoPagoReturnPage"; // Importar a página de retorno do Mercado Pago
import AdminSales from "./pages/AdminSales"; // Importar a página AdminSales

const queryClient = new QueryClient();

// Componente de rota protegida
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading, userRole, hasShopDetails } = useSession();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando autenticação...</div>;
  }

  if (!session) {
    return <Navigate to="/landing" replace />; // Redireciona para a landing page se não autenticado
  }

  // Redireciona lojistas para a página de configuração da loja se não tiverem detalhes
  if (userRole === 'lojista' && !hasShopDetails && window.location.pathname !== '/shop-setup') {
    return <Navigate to="/shop-setup" replace />;
  }

  return <>{children}</>;
};

const App = () => {
  useEffect(() => {
    console.log("App loaded. Current URL:", window.location.href);
    console.log("App loaded. URL Hash:", window.location.hash);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SessionContextProvider>
            <CartProvider>
              <Routes>
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/mercadopago-return" element={<MercadoPagoReturnPage />} /> {/* Nova rota */}

                {/* Todas as rotas protegidas agora usam o MainLayout */}
                <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                  <Route path="/" element={<Index />} />
                  <Route path="/profile" element={<UserProfile />} />
                  <Route path="/comprador-dashboard" element={<CompradorDashboard />} />
                  <Route path="/explorar-produtos" element={<ProductListing />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/meus-pedidos" element={<MeusPedidos />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/lojista-dashboard" element={<LojistaDashboard />} />
                  <Route path="/meus-produtos" element={<MeusProdutos />} />
                  <Route path="/minhas-vendas" element={<MinhasVendas />} />
                  <Route path="/shop-setup" element={<ShopSetupPage />} /> {/* Nova rota para configuração da loja */}
                  <Route path="/admin-dashboard" element={<AdminDashboard />} />
                  <Route path="/gerenciar-usuarios" element={<GerenciarUsuarios />} />
                  <Route path="/gerenciar-produtos" element={<GerenciarProdutos />} />
                  <Route path="/gerenciar-comissoes" element={<GerenciarComissoes />} />
                  <Route path="/admin-sales" element={<AdminSales />} /> {/* Nova rota para AdminSales */}
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
};

export default App;