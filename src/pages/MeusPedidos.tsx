"use client";

import React from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSession } from '@/components/SessionContextProvider';
import { MadeWithDyad } from '@/components/made-with-dyad';

const MeusPedidos = () => {
  const { session, isLoading } = useSession();
  const userRole = "comprador"; // Este papel será determinado dinamicamente no Index, mas para esta página, assumimos 'comprador'

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar userRole={userRole} />
      <div className="flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center p-4 bg-dyad-light-gray">
          <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
            <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Meus Pedidos</h1>
            <p className="text-xl text-gray-600">Aqui você verá seus pedidos como comprador.</p>
          </div>
        </main>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default MeusPedidos;