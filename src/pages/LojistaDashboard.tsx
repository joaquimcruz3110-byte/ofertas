"use client";

import { useEffect, useState, useRef } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSession } from '@/components/SessionContextProvider';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { showError } from '@/utils/toast';
import { Package, DollarSign, ShoppingBag, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToPdf } from '@/utils/pdfGenerator'; // Importar a função de exportação de PDF

const LojistaDashboard = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null); // Ref para o conteúdo do relatório

  const fetchDashboardData = async () => {
    setIsLoadingData(true);
    if (!session?.user?.id) {
      setTotalProducts(0);
      setTotalSalesCount(0);
      setTotalRevenue(0);
      setIsLoadingData(false);
      return;
    }

    const shopkeeperId = session.user.id;

    // Fetch total products
    const { count: productsCount, error: productsError } = await supabase
      .from('products')
      .select('id', { count: 'exact' })
      .eq('shopkeeper_id', shopkeeperId);

    if (productsError) {
      showError('Erro ao carregar total de produtos: ' + productsError.message);
      console.error('Erro ao carregar total de produtos:', productsError.message);
    } else {
      setTotalProducts(productsCount || 0);
    }

    // Fetch sales data
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select(`
        quantity,
        total_price,
        products!inner (
          shopkeeper_id
        )
      `)
      .eq('products.shopkeeper_id', shopkeeperId);

    if (salesError) {
      showError('Erro ao carregar dados de vendas: ' + salesError.message);
      console.error('Erro ao carregar dados de vendas:', salesError.message);
    } else {
      const salesCount = salesData ? salesData.length : 0;
      const revenue = salesData ? salesData.reduce((sum, sale) => sum + sale.total_price, 0) : 0;
      setTotalSalesCount(salesCount);
      setTotalRevenue(revenue);
    }

    setIsLoadingData(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'lojista') {
      fetchDashboardData();
    }
  }, [session, isSessionLoading, userRole]);

  const handleExportPdf = () => {
    if (reportRef.current) {
      exportToPdf(reportRef.current, 'relatorio_lojista.pdf');
    } else {
      showError('Conteúdo do relatório não encontrado para exportação.');
    }
  };

  if (isSessionLoading || isLoadingData) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session || userRole !== 'lojista') {
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
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-dyad-dark-blue">Painel do Lojista</h1>
              <Button onClick={handleExportPdf} className="bg-dyad-vibrant-orange hover:bg-dyad-dark-blue text-dyad-white">
                <FileText className="mr-2 h-4 w-4" /> Exportar PDF
              </Button>
            </div>
            <p className="text-lg text-gray-600 mb-8">
              Visão geral das suas atividades na plataforma.
            </p>

            <div ref={reportRef} className="p-4"> {/* Conteúdo a ser exportado */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalProducts}</div>
                    <p className="text-xs text-muted-foreground">
                      Produtos listados por você
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalSalesCount}</div>
                    <p className="text-xs text-muted-foreground">
                      Vendas realizadas dos seus produtos
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">R$ {totalRevenue.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                      Receita bruta dos seus produtos
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default LojistaDashboard;