"use client";

import { MadeWithDyad } from "@/components/made-with-dyad";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar"; // Importando o novo Sidebar
import { useSession } from "@/components/SessionContextProvider";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { session, isLoading } = useSession();
  const [userName, setUserName] = useState("Usuário");
  const [userRole, setUserRole] = useState("comprador"); // Definindo um papel padrão

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (session?.user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, role')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error('Erro ao buscar perfil do usuário:', error.message);
        } else if (data) {
          setUserName(data.first_name || data.last_name || "Usuário");
          setUserRole(data.role || "comprador"); // Definindo o papel do usuário, com fallback para 'comprador'
        }
      }
    };

    if (!isLoading && session) {
      fetchUserProfile();
    }
  }, [session, isLoading]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar userRole={userRole} /> {/* Passando o papel do usuário para o Sidebar */}
      <div className="flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center p-4 bg-dyad-light-gray">
          <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
            <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Bem-vindo(a), {userName}!</h1>
            <p className="text-xl text-gray-600 mb-2">
              Seu papel: <span className="font-semibold capitalize">{userRole}</span>
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