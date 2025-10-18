"use client";

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';

const AuthenticatedHomeRedirect = () => {
  const { session, isLoading, userRole, hasShopDetails } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && session) {
      if (userRole === 'comprador') {
        navigate('/comprador-dashboard', { replace: true });
      } else if (userRole === 'lojista') {
        if (!hasShopDetails) {
          navigate('/shop-setup', { replace: true });
        } else {
          navigate('/lojista-dashboard', { replace: true });
        }
      } else if (userRole === 'administrador') {
        navigate('/admin-dashboard', { replace: true });
      } else {
        // Fallback para qualquer outro papel ou caso não definido
        navigate('/explorar-produtos', { replace: true });
      }
    } else if (!isLoading && !session) {
      // Se não houver sessão, redireciona para a landing page (já coberto pelo ProtectedRoute)
      navigate('/landing', { replace: true });
    }
  }, [isLoading, session, userRole, hasShopDetails, navigate]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  return null; // Não renderiza nada enquanto redireciona
};

export default AuthenticatedHomeRedirect;