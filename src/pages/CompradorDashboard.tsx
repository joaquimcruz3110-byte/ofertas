"use client";

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSession } from '@/components/SessionContextProvider';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { showError } from '@/utils/toast';
import { ShoppingBag, DollarSign, Package } from 'lucide-react';

const CompradorDashboard = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalItemsPurchased, setTotalItemsPurchased] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const fetchDashboardData = async () => {
    setIsLoadingData(true);
    if (!session?.user?.id) {
      setTotalOrders(0);
      setTotalItemsPurchased(0);
      setTotalSpent(0);
      setIsLoadingData(false);
      return;
    }

    const buyerId = session.user.id;

    // Fetch sales data for the buyer
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('id, quantity, total_price')
      .eq('buyer_id', buyerId);

    if (salesError) {
      showError('Erro ao carregar dados do painel: ' + salesError.message);
      console.error('Erro ao carregar dados do painel:', salesError.message);
    } else {
      const ordersCount = salesData ? salesData.length : 0;
      const itemsCount = salesData ? salesData.reduce((sum, sale) => sum + sale.quantity, 0) : 0;
      const spentAmount = salesData ? salesData.reduce((sum, sale) => sum + sale.total_price, 0) : 0;
      
      setTotalOrders(ordersCount);
      setTotalItemsPurchased(itemsCount);
      setTotalSpent(spentAmount);
    }

    setIsLoadingData(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'comprador') {
      fetchDashboardData();
    }
  }, [session, isSessionLoading, userRole]);

  if (isSessionLoading || isLoadingData) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session || userRole !== 'comprador') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray">
        <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
          <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Acesso Negado</h1>
          <p className="text-xl text-gray-600">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex-grow p-4 bg-dyad-light-gray">
          <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
            <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Painel do Comprador</h1>
            <p className="text-lg text-gray-600 mb-8">
              Visão geral das suas compras na plataforma.
            </p>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    Pedidos realizados
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Itens Comprados</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalItemsPurchased}</div>
                  <p className="text-xs text-muted-foreground">
                    Total de produtos em seus pedidos
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Gasto</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R$ {totalSpent.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    Valor total em suas compras
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default CompradorDashboard;