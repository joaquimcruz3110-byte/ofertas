"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
  userName: string | null;
  userRole: string | null;
  hasShopDetails: boolean; // Novo campo para verificar se o lojista tem detalhes da loja
  userProfile: any; // Adicionado para armazenar o perfil completo
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasShopDetails, setHasShopDetails] = useState(false); // Estado para detalhes da loja
  const [userProfile, setUserProfile] = useState<any>(null); // Estado para o perfil completo

  // Memoize fetchUserProfile to ensure it's stable across renders
  const fetchUserProfile = useCallback(async (userId: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, role, cpf, phone_number, address_street, address_number, address_complement, address_district, address_postal_code, address_city, address_state')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Erro ao buscar perfil do usuário:', profileError.message);
      setUserName("Usuário");
      setUserRole("comprador"); // Fallback
      setHasShopDetails(false);
      setUserProfile(null);
    } else if (profileData) {
      setUserName(profileData.first_name || profileData.last_name || "Usuário");
      setUserRole(profileData.role || "comprador"); // Fallback
      setUserProfile(profileData);

      // Check for shop details if the user is a shopkeeper
      if (profileData.role === 'lojista') {
        const { data: shopData, error: shopError } = await supabase
          .from('shop_details')
          .select('id, pagarme_recipient_id') // Agora buscamos o pagarme_recipient_id
          .eq('id', userId)
          .single();
        
        if (shopError && shopError.code !== 'PGRST116') { // PGRST116 means "no rows found"
          console.error('Erro ao buscar detalhes da loja:', shopError.message);
          setHasShopDetails(false);
        } else if (shopData) {
          setHasShopDetails(true); // True if data exists
        } else {
          setHasShopDetails(false);
        }

      } else {
        setHasShopDetails(false); // Not a shopkeeper, so no shop details
      }
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      setIsLoading(false);

      if (event === 'SIGNED_IN' && currentSession?.user) {
        const pendingRole = localStorage.getItem('pendingRole');
        if (pendingRole && pendingRole !== 'comprador') { // Se um papel diferente de comprador foi selecionado
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentSession.user.id)
            .single();

          if (!profileError && profileData?.role === 'comprador') { // Se o papel atual é comprador e precisa ser atualizado
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ role: pendingRole })
              .eq('id', currentSession.user.id);

            if (updateError) {
              showError('Erro ao atualizar papel do usuário: ' + updateError.message);
              console.error('Erro ao atualizar papel do usuário:', updateError.message);
            } else {
              showSuccess(`Seu papel foi atualizado para ${pendingRole}!`);
              // Re-fetch profile to update context with new role
              fetchUserProfile(currentSession.user.id);
            }
          }
        }
        localStorage.removeItem('pendingRole'); // Limpar o papel pendente
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]); // Depend on fetchUserProfile

  // Effect to react to changes in the 'session' state and fetch profile
  useEffect(() => {
    if (session?.user) {
      fetchUserProfile(session.user.id);
    } else {
      setUserName(null);
      setUserRole(null);
      setHasShopDetails(false);
      setUserProfile(null);
    }
  }, [session, fetchUserProfile]); // Depend on session and the stable fetchUserProfile

  return (
    <SessionContext.Provider value={{ session, isLoading, userName, userRole, hasShopDetails, userProfile }}>
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