"use client";

import { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { showError } from '@/utils/toast';

interface Sale {
  id: string;
  product_id: string;
  buyer_id: string;
  quantity: number;
  total_price: number;
  commission_rate: number;
  sale_date: string;
  products: Array<{
    name: string;
    price: number;
  }>;
}

const MinhasVendas = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(true);

  const fetchSales = async () => {
    setIsLoadingSales(true);
    if (!session?.user?.id) {
      setSales([]);
      setIsLoadingSales(false);
      return;
    }

    // Passo 1: Obter os IDs dos produtos que pertencem ao lojista atual
    const { data: shopkeeperProducts, error: productsError } = await supabase
      .from('products')
      .select('id')
      .eq('shopkeeper_id', session.user.id);

    if (productsError) {
      showError('Erro ao carregar produtos do lojista: ' + productsError.message);
      console.error('Erro ao carregar produtos do lojista:', productsError.message);
      setSales([]);
      setIsLoadingSales(false);
      return;
    }

    const productIds = shopkeeperProducts.map(p => p.id);

    if (productIds.length === 0) {
      setSales([]);
      setIsLoadingSales(false);
      return;
    }

    // Passo 2: Buscar as vendas usando os IDs dos produtos obtidos, sem a consulta aninhada de produtos
    const { data: salesData, error: salesError } = await supabase
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
      .in('product_id', productIds); // Filtrar vendas pelos IDs dos produtos

    if (salesError) {
      showError('Erro ao carregar vendas: ' + salesError.message);
      console.error('Erro ao carregar vendas:', salesError.message);
      setSales([]);
      setIsLoadingSales(false);
      return;
    }

    // Passo 3: Para cada venda, buscar os detalhes do produto separadamente
    const salesWithProductDetails = await Promise.all(
      salesData.map(async (sale) => {
        const { data: productData, error: singleProductError } = await supabase
          .from('products')
          .select('name, price')
          .eq('id', sale.product_id)
          .single();

        if (singleProductError) {
          console.error(`Erro ao buscar produto ${sale.product_id}:`, singleProductError.message);
          return { ...sale, products: [] }; // Retorna produtos vazios em caso de erro
        }
        return { ...sale, products: [productData] };
      })
    );

    setSales(salesWithProductDetails as Sale[]);
    setIsLoadingSales(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'lojista') {
      fetchSales();
    }
  }, [session, isSessionLoading, userRole]);

  if (isSessionLoading || isLoadingSales) {
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
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Minhas Vendas</h1>
      <p className="text-lg text-gray-600 mb-8">
        Aqui você pode visualizar todas as vendas dos seus produtos.
      </p>

      {sales.length === 0 ? (
        <p className="text-center text-gray-500">Nenhuma venda encontrada para seus produtos.</p>
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
              {sales.map((sale) => {
                const productName = sale.products[0]?.name || 'Produto Desconhecido';
                const productPrice = sale.products[0]?.price;
                const commissionAmount = sale.total_price * (sale.commission_rate / 100);
                const amountToReceive = sale.total_price - commissionAmount;

                return (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{productName}</TableCell>
                    <TableCell>{sale.quantity}</TableCell>
                    <TableCell>{productPrice ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(productPrice) : 'N/A'}</TableCell>
                    <TableCell>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total_price)}</TableCell>
                    <TableCell>{sale.commission_rate.toFixed(2)}%</TableCell>
                    <TableCell>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(commissionAmount)}</TableCell>
                    <TableCell className="font-semibold text-green-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amountToReceive)}</TableCell>
                    <TableCell>{new Date(sale.sale_date).toLocaleDateString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default MinhasVendas;