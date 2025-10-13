"use client";

import { useEffect, useState, useRef } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { showError } from '@/utils/toast';
import { Package, DollarSign, ShoppingBag, FileText } from 'lucide-react';
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
import SalesByProductChart from '@/components/SalesByProductChart';
import { DatePickerWithRange } from '@/components/DatePickerWithRange'; // Importar o componente DatePickerWithRange
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
  product_name: string; // Adicionado para armazenar o nome do produto
  product_price: number; // Adicionado para armazenar o preço unitário do produto
}

const LojistaDashboard = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [detailedSales, setDetailedSales] = useState<SaleDetail[]>([]);
  const [salesByProductData, setSalesByProductData] = useState<Array<{ name: string; totalQuantity: number }>>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30), // Últimos 30 dias como padrão
    to: new Date(),
  });

  const fetchDashboardData = async (startDate?: Date, endDate?: Date) => {
    setIsLoadingData(true);
    if (!session?.user?.id) {
      setTotalProducts(0);
      setTotalSalesCount(0);
      setTotalRevenue(0);
      setDetailedSales([]);
      setSalesByProductData([]);
      setIsLoadingData(false);
      return;
    }

    const shopkeeperId = session.user.id;

    // Passo 1: Obter os IDs dos produtos que pertencem ao lojista atual, e seus nomes/preços
    const { data: shopkeeperProducts, error: productsIdError } = await supabase
      .from('products')
      .select('id, name, price')
      .eq('shopkeeper_id', shopkeeperId);

    if (productsIdError) {
      showError('Erro ao carregar produtos do lojista: ' + productsIdError.message);
      console.error('Erro ao carregar produtos do lojista:', productsIdError.message);
      setTotalProducts(0);
      setTotalSalesCount(0);
      setTotalRevenue(0);
      setDetailedSales([]);
      setSalesByProductData([]);
      setIsLoadingData(false);
      return;
    }

    const productIds = shopkeeperProducts.map(p => p.id);
    const productDetailsMap = new Map(shopkeeperProducts.map(p => [p.id, { name: p.name, price: p.price }]));

    setTotalProducts(shopkeeperProducts.length);

    if (productIds.length === 0) {
      setTotalSalesCount(0);
      setTotalRevenue(0);
      setDetailedSales([]);
      setSalesByProductData([]);
      setIsLoadingData(false);
      return;
    }

    // Passo 2: Buscar as vendas usando os IDs dos produtos obtidos, aplicando o filtro de data
    let salesQuery = supabase
      .from('sales')
      .select(`
        id,
        product_id,
        buyer_id,
        quantity,
        total_price,
        commission_rate,
        sale_date
      `)
      .in('product_id', productIds);

    if (startDate) {
      salesQuery = salesQuery.gte('sale_date', startDate.toISOString());
    }
    if (endDate) {
      salesQuery = salesQuery.lte('sale_date', endDate.toISOString());
    }

    salesQuery = salesQuery.order('sale_date', { ascending: false });

    const { data: salesData, error: salesError } = await salesQuery;

    if (salesError) {
      showError('Erro ao carregar vendas: ' + salesError.message);
      console.error('Erro ao carregar vendas:', salesError.message);
      setTotalSalesCount(0);
      setTotalRevenue(0);
      setDetailedSales([]);
      setSalesByProductData([]);
    } else {
      const salesCount = salesData ? salesData.length : 0;
      const revenue = salesData ? salesData.reduce((sum, sale) => sum + sale.total_price, 0) : 0;
      setTotalSalesCount(salesCount);
      setTotalRevenue(revenue);

      const formattedSales: SaleDetail[] = salesData.map(sale => ({
        ...sale,
        product_name: productDetailsMap.get(sale.product_id)?.name || 'Produto Desconhecido',
        product_price: productDetailsMap.get(sale.product_id)?.price || 0,
      }));
      setDetailedSales(formattedSales);

      // Processar dados para o gráfico
      const salesByProductMap = new Map<string, { name: string; totalQuantity: number }>();
      formattedSales.forEach(sale => {
        const productName = sale.product_name;
        if (salesByProductMap.has(productName)) {
          salesByProductMap.get(productName)!.totalQuantity += sale.quantity;
        } else {
          salesByProductMap.set(productName, { name: productName, totalQuantity: sale.quantity });
        }
      });
      setSalesByProductData(Array.from(salesByProductMap.values()));
    }

    setIsLoadingData(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'lojista') {
      fetchDashboardData(dateRange?.from, dateRange?.to); // Passar o dateRange para a função de busca
    }
  }, [session, isSessionLoading, userRole, dateRange]); // Adicionar dateRange como dependência

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
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-dyad-dark-blue">Painel do Lojista</h1>
        <div className="flex items-center space-x-4">
          <DatePickerWithRange date={dateRange} setDate={setDateRange} /> {/* Adicionar o seletor de data */}
          <Button onClick={handleExportPdf} className="bg-dyad-vibrant-orange hover:bg-dyad-dark-blue text-dyad-white">
            <FileText className="mr-2 h-4 w-4" /> Exportar PDF
          </Button>
        </div>
      </div>
      <p className="text-lg text-gray-600 mb-8">
        Visão geral das suas atividades na plataforma.
      </p>

      <div ref={reportRef} className="p-4">
        <h2 className="text-2xl font-bold mb-4 text-dyad-dark-blue">Resumo Geral</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
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

        <h2 className="text-2xl font-bold mb-4 text-dyad-dark-blue mt-8">Vendas por Produto</h2>
        <div className="mb-8">
          <SalesByProductChart data={salesByProductData} />
        </div>

        <h2 className="text-2xl font-bold mb-4 text-dyad-dark-blue mt-8">Detalhes das Vendas</h2>
        {detailedSales.length === 0 ? (
          <p className="text-center text-gray-500">Nenhuma venda detalhada encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Preço Unitário</TableHead>
                  <TableHead>Preço Total</TableHead>
                  <TableHead>Comissão (%)</TableHead>
                  <TableHead>Comissão Paga</TableHead>
                  <TableHead>Valor a Receber</TableHead>
                  <TableHead>Data da Venda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailedSales.map((sale) => {
                  const productName = sale.product_name;
                  const productPrice = sale.product_price;
                  const commissionAmount = sale.total_price * (sale.commission_rate / 100);
                  const amountToReceive = sale.total_price - commissionAmount;

                  return (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{productName}</TableCell>
                      <TableCell>{sale.quantity}</TableCell>
                      <TableCell>R$ {productPrice.toFixed(2)}</TableCell>
                      <TableCell>R$ {sale.total_price.toFixed(2)}</TableCell>
                      <TableCell>{sale.commission_rate.toFixed(2)}%</TableCell>
                      <TableCell>R$ {commissionAmount.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold text-green-600">R$ {amountToReceive.toFixed(2)}</TableCell>
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

export default LojistaDashboard;