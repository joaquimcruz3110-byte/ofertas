"use client";

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSession } from '@/components/SessionContextProvider';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { showSuccess, showError } from '@/utils/toast';
import { Loader2 } from 'lucide-react';

interface Sale {
  id: string;
  product_id: string;
  buyer_id: string;
  quantity: number;
  total_price: number;
  commission_rate: number;
  sale_date: string;
  products: Array<{ // Alterado para Array
    name: string;
    price: number;
  }>; // Removido '| null' pois um array vazio pode representar a ausência
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

    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        product_id,
        buyer_id,
        quantity,
        total_price,
        commission_rate,
        sale_date,
        products (
          name,
          price
        )
      `)
      .eq('products.shopkeeper_id', session.user.id);

    if (error) {
      showError('Erro ao carregar vendas: ' + error.message);
      console.error('Erro ao carregar vendas:', error.message);
      setSales([]);
    } else {
      // Mapeia os dados para garantir que 'products' seja um array, mesmo que vazio
      const typedSales: Sale[] = data.map(sale => ({
        ...sale,
        products: sale.products || [], // Garante que products é um array (pode ser vazio)
      })) as Sale[];
      setSales(typedSales);
    }
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
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex-grow p-4 bg-dyad-light-gray">
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
                      <TableHead>Data da Venda</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">{sale.products[0]?.name || 'Produto Desconhecido'}</TableCell>
                        <TableCell>{sale.quantity}</TableCell>
                        <TableCell>R$ {sale.products[0]?.price ? sale.products[0].price.toFixed(2) : 'N/A'}</TableCell>
                        <TableCell>R$ {sale.total_price.toFixed(2)}</TableCell>
                        <TableCell>{sale.commission_rate.toFixed(2)}%</TableCell>
                        <TableCell>{new Date(sale.sale_date).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </main>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default MinhasVendas;