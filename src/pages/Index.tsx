"use client";

import { MadeWithDyad } from "@/components/made-with-dyad";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { useSession } from "@/components/SessionContextProvider";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CompradorHomeSummary from "@/components/CompradorHomeSummary";
import LojistaHomeSummary from "@/components/LojistaHomeSummary";
import AdminHomeSummary from "@/components/AdminHomeSummary";

const Index = () => {
  const { session, isLoading, userRole } = useSession();
  const navigate = useNavigate();

  // Se não estiver carregando e não houver sessão, redireciona para o login.
  // Isso é uma redundância com ProtectedRoute, mas garante que a lógica de renderização abaixo só ocorra com sessão.
  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/login');
    }
  }, [isLoading, session, navigate]);

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
        return <LojistaHomeSummary />;
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
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center p-4 bg-dyad-light-gray">
          {renderHomeContent()}
        </main>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;