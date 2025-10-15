"use client";

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSupabase } from './SessionContextProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { session } = useSupabase();

  if (!session) {
    // Redireciona para a página de login se não houver sessão
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;