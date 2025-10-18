"use client";

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import LandingPageContent from '@/pages/LandingPageContent'; // Importar o novo componente

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
    }
  }, [isLoading, session, userRole, hasShopDetails, navigate]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session) {
    // Renderiza o conteúdo da landing page se não estiver autenticado
    return <LandingPageContent />;
  }

  return null; // Se autenticado, ele será redirecionado, então não renderiza nada aqui.
};

export default AuthenticatedHomeRedirect;