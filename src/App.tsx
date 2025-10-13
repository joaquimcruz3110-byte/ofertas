import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { SessionContextProvider, useSession } from "./components/SessionContextProvider";
import React from "react";

// Importar as novas páginas
import MeusPedidos from "./pages/MeusPedidos";
import MeusProdutos from "./pages/MeusProdutos";
import MinhasVendas from "./pages/MinhasVendas";
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import GerenciarProdutos from "./pages/GerenciarProdutos";
import GerenciarComissoes from "./pages/GerenciarComissoes";
import ProductListing from "./pages/ProductListing"; // Importar a nova página

const queryClient = new QueryClient();

// Componente de rota protegida
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando autenticação...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            {/* Rotas para Comprador */}
            <Route
              path="/explorar-produtos" // Nova rota
              element={
                <ProtectedRoute>
                  <ProductListing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meus-pedidos"
              element={
                <ProtectedRoute>
                  <MeusPedidos />
                </ProtectedRoute>
              }
            />
            {/* Rotas para Lojista */}
            <Route
              path="/meus-produtos"
              element={
                <ProtectedRoute>
                  <MeusProdutos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/minhas-vendas"
              element={
                <ProtectedRoute>
                  <MinhasVendas />
                </ProtectedRoute>
              }
            />
            {/* Rotas para Administrador */}
            <Route
              path="/gerenciar-usuarios"
              element={
                <ProtectedRoute>
                  <GerenciarUsuarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gerenciar-produtos"
              element={
                <ProtectedRoute>
                  <GerenciarProdutos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gerenciar-comissoes"
              element={
                <ProtectedRoute>
                  <GerenciarComissoes />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;