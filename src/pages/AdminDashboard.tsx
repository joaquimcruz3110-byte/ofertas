"use client";

import { useEffect, useState, useRef } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { showError } from '@/utils/toast';
import { DollarSign, ShoppingBag, Percent, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToPdf } from '@/utils/pdfGenerator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RevenueOverTimeChart from '@/components/RevenueOverTimeChart';
import { DatePickerWithRange } from '@/components/DatePickerWithRange'; // Importar o novo componente
import { DateRange } from 'react-day-picker';
import { addDays } from 'date-fns';

interface SaleDetail {
  id: string;
  product_id: string;
  buyer_id: string;
  quantity: number;
  total_price: number;
  commission_rate: number;
  sale_date: string;
  product_name: string;
  product_price: number;
  buyer_name: string;
}

const AdminDashboard = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [detailedSales, setDetailedSales] = useState<SaleDetail[]>([]);
  const [revenueChartData, setRevenueChartData] = useState<Array<{ date: string; totalRevenue: number }>>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30), // Últimos 30 dias como padrão
    to: new Date(),
  });

  const fetchDashboardData = async (startDate?: Date, endDate?: Date) => {
    setIsLoadingData(true);
    if (!session?.user?.id) {
      setTotalSalesCount(0);
      setTotalRevenue(0);
      setTotalCommission(0);
      setDetailedSales([]);
      setRevenueChartData([]);
      setIsLoadingData(false);
      return;
    }

    let salesQuery = supabase.from('sales').select(`
      id,
      product_id,
      buyer_id,
      quantity,
      total_price,
      commission_rate,
      sale_date
    `, { count: 'exact' });

    if (startDate) {
      salesQuery = salesQuery.gte('sale_date', startDate.toISOString());
    }
    if (endDate) {
      salesQuery = salesQuery.lte('sale_date', endDate.toISOString());
    }

    salesQuery = salesQuery.order('sale_date', { ascending: false });

    const { data: salesRawData, error: salesError, count: salesCount } = await salesQuery;

    if (salesError) {
      showError('Erro ao carregar dados de vendas: ' + salesError.message);
      console.error('Erro ao carregar dados de vendas:', salesError.message);
      setTotalSalesCount(0);
      setTotalRevenue(0);
      setTotalCommission(0);
      setDetailedSales([]);
      setRevenueChartData([]);
      setIsLoadingData(false);
      return;
    }

    setTotalSalesCount(salesCount || 0);

    const revenue = salesRawData ? salesRawData.reduce((sum, sale) => sum + (sale.total_price || 0), 0) : 0;
    const commission = salesRawData ? salesRawData.reduce((sum, sale) => sum + ((sale.total_price || 0) * (sale.commission_rate / 100)), 0) : 0;
    setTotalRevenue(revenue);
    setTotalCommission(commission);

    const revenueByDateMap = new Map<string, number>();
    salesRawData.forEach(sale => {
      const saleDate = new Date(sale.sale_date).toISOString().split('T')[0];
      const currentRevenue = revenueByDateMap.get(saleDate) || 0;
      revenueByDateMap.set(saleDate, currentRevenue + sale.total_price);
    });

    const sortedRevenueData = Array.from(revenueByDateMap.entries())
      .map(([date, totalRevenue]) => ({ date, totalRevenue }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    setRevenueChartData(sortedRevenueData);

    const uniqueProductIds = [...new Set(salesRawData.map(sale => sale.product_id))];
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, name, price')
      .in('id', uniqueProductIds);

    if (productsError) {
      console.error('Erro ao carregar detalhes dos produtos:', productsError.message);
    }
    const productDetailsMap = new Map(productsData?.map(p => [p.id, { name: p.name, price: p.price }]));

    const buyerIds = [...new Set(salesRawData.map(sale => sale.buyer_id))];
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', buyerIds);

    if (profilesError) {
      console.error('Erro ao carregar perfis dos compradores:', profilesError.message);
    }
    const profileMap = new Map(profilesData?.map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Comprador Desconhecido']));

    const formattedSales: SaleDetail[] = salesRawData.map(sale => ({
      ...sale,
      product_name: productDetailsMap.get(sale.product_id)?.name || 'Produto Desconhecido',
      product_price: productDetailsMap.get(sale.product_id)?.price || 0,
      buyer_name: profileMap.get(sale.buyer_id) || 'Comprador Desconhecido',
    }));
    setDetailedSales(formattedSales);

    setIsLoadingData(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'administrador') {
      fetchDashboardData(dateRange?.from, dateRange?.to);
    }
  }, [session, isSessionLoading, userRole, dateRange]); // Adicionar dateRange como dependência

  const handleExportPdf = () => {
    if (reportRef.current) {
      exportToPdf(reportRef.current, 'relatorio_administrador.pdf');
    } else {
      showError('Conteúdo do relatório não encontrado para exportação.');
    }
  };

  if (isSessionLoading || isLoadingData) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session || userRole !== 'administrador') {
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
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-dyad-dark-blue">Painel do Administrador</h1>
        <div className="flex items-center space-x-4">
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          <Button onClick={handleExportPdf} className="bg-dyad-vibrant-orange hover:bg-dyad-dark-blue text-dyad-white">
            <FileText className="mr-2 h-4 w-4" /> Exportar PDF
          </Button>
        </div>
      </div>
      <p className="text-lg text-gray-600 mb-8">
        Visão geral das atividades da plataforma.
      </p>

      <div ref={reportRef} className="p-4">
        <h2 className="text-2xl font-bold mb-4 text-dyad-dark-blue">Resumo Geral</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSalesCount}</div>
              <p className="text-xs text-muted-foreground">
                Vendas realizadas na plataforma
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
                Receita bruta de todas as vendas
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissão Total</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalCommission.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Comissão total gerada para a plataforma
              </p>
            </CardContent>
          </Card>
        </div>

        <h2 className="text-2xl font-bold mb-4 text-dyad-dark-blue mt-8">Receita ao Longo do Tempo</h2>
        <div className="mb-8">
          <RevenueOverTimeChart data={revenueChartData} />
        </div>

        <h2 className="text-2xl font-bold mb-4 text-dyad-dark-blue mt-8">Detalhes das Vendas e Comissões</h2>
        {detailedSales.length === 0 ? (
          <p className="text-center text-gray-500">Nenhuma venda detalhada encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Preço Unitário</TableHead>
                  <TableHead>Preço Total</TableHead>
                  <TableHead>Comissão (%)</TableHead>
                  <TableHead>Comissão Paga</TableHead>
                  <TableHead>Data da Venda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailedSales.map((sale) => {
                  const productName = sale.product_name;
                  const productPrice = sale.product_price;
                  const commissionAmount = sale.total_price * (sale.commission_rate / 100);

                  return (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{productName}</TableCell>
                      <TableCell>{sale.buyer_name}</TableCell>
                      <TableCell>{sale.quantity}</TableCell>
                      <TableCell>R$ {productPrice.toFixed(2)}</TableCell>
                      <TableCell>R$ {sale.total_price.toFixed(2)}</TableCell>
                      <TableCell>{sale.commission_rate.toFixed(2)}%</TableCell>
                      <TableCell>R$ {commissionAmount.toFixed(2)}</TableCell>
                      <TableCell>{new Date(sale.sale_date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;