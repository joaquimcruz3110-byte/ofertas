"use client";

import { MadeWithDyad } from "@/components/made-with-dyad";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { useSession } from "@/components/SessionContextProvider";
import { useEffect } from "react"; // Removido useState para userName e userRole

const Index = () => {
  const { session, isLoading, userName, userRole } = useSession(); // Obtendo do contexto

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  // Redirecionar para login se não houver sessão (já tratado pelo ProtectedRoute, mas bom ter aqui também)
  if (!session) {
    return null; // Ou um spinner, mas ProtectedRoute já lida com isso
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar /> {/* Sidebar agora obtém o papel do contexto */}
      <div className="flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center p-4 bg-dyad-light-gray">
          <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
            <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Bem-vindo(a), {userName || "Usuário"}!</h1>
            <p className="text-xl text-gray-600 mb-2">
              Seu papel: <span className="font-semibold capitalize">{userRole || "comprador"}</span>
            </p>
            <p className="text-lg text-gray-500">
              Use a barra lateral para navegar pelas funcionalidades disponíveis para você.
            </p>
          </div>
        </main>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;