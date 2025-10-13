"use client";

import { MadeWithDyad } from "@/components/made-with-dyad";
import Header from "@/components/Header";
import { useSession } from "@/components/SessionContextProvider";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { session, isLoading } = useSession();
  const [userName, setUserName] = useState("Usuário");
  const [userRole, setUserRole] = useState("desconhecido");

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (session?.user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, role') // Adicionando 'role' à seleção
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error('Erro ao buscar perfil do usuário:', error.message);
        } else if (data) {
          setUserName(data.first_name || data.last_name || "Usuário");
          setUserRole(data.role || "desconhecido"); // Definindo o papel do usuário
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
    <div className="min-h-screen flex flex-col bg-dyad-light-gray">
      <Header />
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
          <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Bem-vindo(a), {userName}!</h1>
          <p className="text-xl text-gray-600 mb-2">
            Seu papel: <span className="font-semibold capitalize">{userRole}</span>
          </p>
          <p className="text-lg text-gray-500">
            Este é o seu painel principal. Comece a explorar!
          </p>
        </div>
      </main>
      <MadeWithDyad />
    </div>
  );
};

export default Index;