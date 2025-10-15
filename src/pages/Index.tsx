"use client";

import { useSession } from "@/components/SessionContextProvider";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CompradorHomeSummary from "@/components/CompradorHomeSummary";
import LojistaHomeSummary from "@/components/LojistaHomeSummary";
import AdminHomeSummary from "@/components/AdminHomeSummary";

const Index = () => {
  const { session, isLoading, userRole, hasShopDetails } = useSession();
  const navigate = useNavigate();

  // Se não estiver carregando e não houver sessão, redireciona para o login.
  // Isso é uma redundância com ProtectedRoute, mas garante que a lógica de renderização abaixo só ocorra com sessão.
  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/login');
    } else if (!isLoading && session && userRole === 'lojista' && !hasShopDetails) {
      // Redireciona lojistas para a página de configuração da loja se não tiverem detalhes
      navigate('/shop-setup');
    }
  }, [isLoading, session, navigate, userRole, hasShopDetails]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session) {
    return null; // Já redirecionado pelo useEffect acima
  }

  const renderHomeContent = () => {
    switch (userRole) {
      case 'comprador':
        return <CompradorHomeSummary />;
      case 'lojista':
        // Se for lojista mas não tem detalhes da loja, não renderiza o summary aqui,
        // pois o useEffect já redirecionou para /shop-setup
        return hasShopDetails ? <LojistaHomeSummary /> : null;
      case 'administrador':
        return <AdminHomeSummary />;
      default:
        return (
          <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
            <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Bem-vindo(a)!</h1>
            <p className="text-xl text-gray-600 mb-2">
              Seu papel: <span className="font-semibold capitalize">{userRole || "Não Definido"}</span>
            </p>
            <p className="text-lg text-gray-500">
              Use a barra lateral para navegar pelas funcionalidades disponíveis para você.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex items-center justify-center">
      {renderHomeContent()}
    </div>
  );
};

export default Index;