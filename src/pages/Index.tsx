"use client";

import { MadeWithDyad } from "@/components/made-with-dyad";
import { useSupabase } from "@/components/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { session, supabase } = useSupabase();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-800 dark:text-gray-100">Bem-vindo ao seu App!</h1>
        {session ? (
          <>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">
              Você está logado como: {session.user?.email}
            </p>
            <Button onClick={handleLogout} className="mt-4">Sair</Button>
          </>
        ) : (
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Você não está logado.
          </p>
        )}
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;