"use client";

import Header from './Header';
import { MadeWithDyad } from './made-with-dyad';
import { Outlet } from 'react-router-dom';
import GlobalSearchBar from './GlobalSearchBar'; // Importar o novo componente

const MainLayout = () => {
  return (
    <div className="flex flex-col min-h-screen w-full">
      <Header />
      <GlobalSearchBar /> {/* Adicionado o GlobalSearchBar aqui */}
      <main className="flex-grow p-4 bg-dyad-light-gray">
        <Outlet /> {/* Renderiza o conteúdo específico da rota aqui */}
      </main>
      <MadeWithDyad />
    </div>
  );
};

export default MainLayout;