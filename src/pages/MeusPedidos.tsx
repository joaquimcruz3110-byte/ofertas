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
import { showError } from '@/utils/toast';
import { Loader2 } from 'lucide-react';

interface Order {
  id: string;
  product_id: string;
  buyer_id: string;
  quantity: number;
  total_price: number;
  sale_date: string;
  products: Array<{ // Alterado para Array
    name: string;
    price: number;
  }>; // Removido '| null' pois um array vazio pode representar a ausência
}

const MeusPedidos = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    if (!session?.user?.id) {
      setOrders([]);
      setIsLoadingOrders(false);
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
        sale_date,
        products (
          name,
          price
        )
      `)
      .eq('buyer_id', session.user.id); // Filtrar por buyer_id do usuário logado

    if (error) {
      showError('Erro ao carregar pedidos: ' + error.message);
      console.error('Erro ao carregar pedidos:', error.message);
      setOrders([]);
    } else {
      // Mapeia os dados para garantir que 'products' seja um array, mesmo que vazio
      const typedOrders: Order[] = data.map(order => ({
        ...order,
        products: order.products || [], // Garante que products é um array (pode ser vazio)
      })) as Order[];
      setOrders(typedOrders);
    }
    setIsLoadingOrders(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'comprador') {
      fetchOrders();
    }
  }, [session, isSessionLoading, userRole]);

  if (isSessionLoading || isLoadingOrders) {
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
            <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Meus Pedidos</h1>
            <p className="text-lg text-gray-600 mb-8">
              Aqui você pode visualizar todos os seus pedidos de compra.
            </p>

            {orders.length === 0 ? (
              <p className="text-center text-gray-500">Nenhum pedido encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Preço Unitário</TableHead>
                      <TableHead>Preço Total</TableHead>
                      <TableHead>Data do Pedido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.products[0]?.name || 'Produto Desconhecido'}</TableCell>
                        <TableCell>{order.quantity}</TableCell>
                        <TableCell>R$ {order.products[0]?.price ? order.products[0].price.toFixed(2) : 'N/A'}</TableCell>
                        <TableCell>R$ {order.total_price.toFixed(2)}</TableCell>
                        <TableCell>{new Date(order.sale_date).toLocaleDateString()}</TableCell>
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

export default MeusPedidos;