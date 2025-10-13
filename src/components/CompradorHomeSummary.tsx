"use client";

import { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { showError } from '@/utils/toast';
import { ShoppingBag, DollarSign, Package, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Profile {
  first_name: string | null;
  last_name: string | null;
}

const CompradorHomeSummary = () => {
  const { session, userName, userRole } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalItemsPurchased, setTotalItemsPurchased] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const fetchSummaryData = async () => {
      setIsLoadingData(true);
      if (!session?.user?.id) {
        setProfile(null);
        setTotalOrders(0);
        setTotalItemsPurchased(0);
        setTotalSpent(0);
        setIsLoadingData(false);
        return;
      }

      const buyerId = session.user.id;

      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', buyerId)
        .single();

      if (profileError) {
        console.error('Erro ao carregar perfil do comprador:', profileError.message);
        setProfile(null);
      } else {
        setProfile(profileData);
      }

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
        const spentAmount = salesData ? salesData.reduce((sum, sale) => sum + (sale.total_price || 0), 0) : 0;
        
        setTotalOrders(ordersCount);
        setTotalItemsPurchased(itemsCount);
        setTotalSpent(spentAmount);
      }

      setIsLoadingData(false);
    };

    if (session && userRole === 'comprador') {
      fetchSummaryData();
    }
  }, [session, userRole]);

  if (isLoadingData) {
    return <div className="text-center text-gray-500">Carregando resumo do comprador...</div>;
  }

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Bem-vindo(a), {profile?.first_name || userName || "Comprador"}!</h1>
      <p className="text-lg text-gray-600 mb-8">
        Aqui está um resumo rápido das suas atividades na plataforma.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
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
            <div className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSpent)}</div>
            <p className="text-xs text-muted-foreground">
              Valor total em suas compras
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Link to="/explorar-produtos">
          <Button className="w-full sm:w-auto bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
            Explorar Produtos
          </Button>
        </Link>
        <Link to="/meus-pedidos">
          <Button variant="outline" className="w-full sm:w-auto border-dyad-dark-blue text-dyad-dark-blue hover:bg-dyad-light-gray">
            Ver Meus Pedidos
          </Button>
        </Link>
        <Link to="/profile">
          <Button variant="outline" className="w-full sm:w-auto border-dyad-dark-blue text-dyad-dark-blue hover:bg-dyad-light-gray">
            <User className="mr-2 h-4 w-4" /> Meu Perfil
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default CompradorHomeSummary;