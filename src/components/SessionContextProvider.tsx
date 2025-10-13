"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
  userName: string | null;
  userRole: string | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Erro ao buscar perfil do usuário:', error.message);
        setUserName("Usuário");
        setUserRole("comprador"); // Fallback
      } else if (data) {
        setUserName(data.first_name || data.last_name || "Usuário");
        setUserRole(data.role || "comprador"); // Fallback
      }
    };

    const getInitialSession = async () => {
      setIsLoading(true);
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      setSession(initialSession);
      if (initialSession?.user) {
        await fetchUserProfile(initialSession.user.id);
      } else {
        setUserName(null);
        setUserRole(null);
      }
      setIsLoading(false);
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        fetchUserProfile(currentSession.user.id);
      } else {
        setUserName(null);
        setUserRole(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []); // Dependências vazias para rodar apenas uma vez na montagem

  return (
    <SessionContext.Provider value={{ session, isLoading, userName, userRole }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};