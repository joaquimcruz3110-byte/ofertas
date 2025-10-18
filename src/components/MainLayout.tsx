"use client";

import Header from './Header';
import { MadeWithDyad } from './made-with-dyad';
import { Outlet } from 'react-router-dom';

const MainLayout = () => {
  return (
    <div className="flex flex-col min-h-screen w-full"> {/* Removido o grid layout */}
      <Header />
      <main className="flex-grow p-4 bg-dyad-light-gray">
        <Outlet /> {/* Renderiza o conteúdo específico da rota aqui */}
      </main>
      <MadeWithDyad />
    </div>
  );
};

export default MainLayout;