"use client";

import { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { showError } from '@/utils/toast';
import { Package, DollarSign, ShoppingBag, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Profile {
  first_name: string | null;
  last_name: string | null;
}

const LojistaHomeSummary = () => {
  const { session, userName, userRole } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const fetchSummaryData = async () => {
      setIsLoadingData(true);
      if (!session?.user?.id) {
        setProfile(null);
        setTotalProducts(0);
        setTotalSalesCount(0);
        setTotalRevenue(0);
        setIsLoadingData(false);
        return;
      }

      const shopkeeperId = session.user.id;

      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', shopkeeperId)
        .single();

      if (profileError) {
        console.error('Erro ao carregar perfil do lojista:', profileError.message);
        setProfile(null);
      } else {
        setProfile(profileData);
      }

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
        const revenue = salesData ? salesData.reduce((sum, sale) => sum + (sale.total_price || 0), 0) : 0;
        setTotalSalesCount(salesCount);
        setTotalRevenue(revenue);
      }

      setIsLoadingData(false);
    };

    if (session && userRole === 'lojista') {
      fetchSummaryData();
    }
  }, [session, userRole]);

  if (isLoadingData) {
    return <div className="text-center text-gray-500">Carregando resumo do lojista...</div>;
  }

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Bem-vindo(a), {profile?.first_name || userName || "Lojista"}!</h1>
      <p className="text-lg text-gray-600 mb-8">
        Aqui está um resumo rápido das suas atividades na plataforma.
      </p>

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

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Link to="/meus-produtos">
          <Button className="w-full sm:w-auto bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
            Gerenciar Meus Produtos
          </Button>
        </Link>
        <Link to="/minhas-vendas">
          <Button variant="outline" className="w-full sm:w-auto border-dyad-dark-blue text-dyad-dark-blue hover:bg-dyad-light-gray">
            Ver Minhas Vendas
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

export default LojistaHomeSummary;