"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  // Memoize fetchUserProfile to ensure it's stable across renders
  const fetchUserProfile = useCallback(async (userId: string) => {
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
  }, []); // No dependencies, as it only uses supabase client and setters

  // Effect to handle initial session and auth state changes
  useEffect(() => {
    const getInitialSession = async () => {
      setIsLoading(true);
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      setSession(initialSession);
      setIsLoading(false);
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, currentSession) => { // 'event' renomeado para '_'
      setSession(currentSession); // Update session state
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []); // Empty dependency array for the auth listener setup

  // Effect to react to changes in the 'session' state and fetch profile
  useEffect(() => {
    if (session?.user) {
      fetchUserProfile(session.user.id);
    } else {
      setUserName(null);
      setUserRole(null);
    }
  }, [session, fetchUserProfile]); // Depend on session and the stable fetchUserProfile

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