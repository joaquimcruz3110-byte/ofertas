"use client";

import Header from './Header';
import Sidebar from './Sidebar';
import { MadeWithDyad } from './made-with-dyad';
import { Outlet } from 'react-router-dom';

const MainLayout = () => {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex-grow p-4 bg-dyad-light-gray">
          <Outlet /> {/* Renderiza o conteúdo específico da rota aqui */}
        </main>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default MainLayout;