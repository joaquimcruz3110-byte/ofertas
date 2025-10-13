"use client";

import { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { showError } from '@/utils/toast';
import { DollarSign, ShoppingBag, Percent, Users, Store, Settings, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Profile {
  first_name: string | null;
  last_name: string | null;
}

const AdminHomeSummary = () => {
  const { session, userName, userRole } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const fetchSummaryData = async () => {
      setIsLoadingData(true);
      if (!session?.user?.id) {
        setProfile(null);
        setTotalSalesCount(0);
        setTotalRevenue(0);
        setTotalCommission(0);
        setIsLoadingData(false);
        return;
      }

      const adminId = session.user.id;

      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', adminId)
        .single();

      if (profileError) {
        console.error('Erro ao carregar perfil do administrador:', profileError.message);
        setProfile(null);
      } else {
        setProfile(profileData);
      }

      // Fetch total sales count
      const { count: salesCount, error: countError } = await supabase
        .from('sales')
        .select('id', { count: 'exact' });

      if (countError) {
        showError('Erro ao carregar total de vendas: ' + countError.message);
        console.error('Erro ao carregar total de vendas:', countError.message);
      } else {
        setTotalSalesCount(salesCount || 0);
      }

      // Fetch total revenue and total commission
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total_price, commission_rate');

      if (salesError) {
        showError('Erro ao carregar dados de vendas para receita/comissão: ' + salesError.message);
        console.error('Erro ao carregar dados de vendas para receita/comissão:', salesError.message);
      } else {
        const revenue = salesData ? salesData.reduce((sum, sale) => sum + (sale.total_price || 0), 0) : 0;
        const commission = salesData ? salesData.reduce((sum, sale) => sum + ((sale.total_price || 0) * (sale.commission_rate / 100)), 0) : 0;
        setTotalRevenue(revenue);
        setTotalCommission(commission);
      }

      setIsLoadingData(false);
    };

    if (session && userRole === 'administrador') {
      fetchSummaryData();
    }
  }, [session, userRole]);

  if (isLoadingData) {
    return <div className="text-center text-gray-500">Carregando resumo do administrador...</div>;
  }

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Bem-vindo(a), {profile?.first_name || userName || "Administrador"}!</h1>
      <p className="text-lg text-gray-600 mb-8">
        Aqui está um resumo rápido das atividades da plataforma.
      </p>

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

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Link to="/gerenciar-usuarios">
          <Button className="w-full sm:w-auto bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
            <Users className="mr-2 h-4 w-4" /> Gerenciar Usuários
          </Button>
        </Link>
        <Link to="/gerenciar-produtos">
          <Button variant="outline" className="w-full sm:w-auto border-dyad-dark-blue text-dyad-dark-blue hover:bg-dyad-light-gray">
            <Store className="mr-2 h-4 w-4" /> Gerenciar Produtos
          </Button>
        </Link>
        <Link to="/gerenciar-comissoes">
          <Button variant="outline" className="w-full sm:w-auto border-dyad-dark-blue text-dyad-dark-blue hover:bg-dyad-light-gray">
            <Settings className="mr-2 h-4 w-4" /> Gerenciar Comissões
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

export default AdminHomeSummary;