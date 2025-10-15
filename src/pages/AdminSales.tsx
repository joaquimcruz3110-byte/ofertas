import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { showSuccess, showError } from "@/utils/toast";
import { format } from "date-fns";
import { formatCurrency } from '@/utils/formatters'; // Importar a função de formatação de moeda

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

// A interface ShopDetail foi removida pois não estava sendo utilizada.

interface ProductDetail {
  id: string;
  name: string;
  shopkeeper_id: string | null;
}

interface Sale {
  id: string;
  product_id: string;
  buyer_id: string;
  quantity: number;
  total_price: number;
  commission_rate: number;
  sale_date: string;
  payment_gateway_id: string | null;
  payment_gateway_status: string | null;
  is_paid_out: boolean;
  payout_date: string | null;
  payout_admin_id: string | null;
  buyer_name: string;
  product_name: string;
  shopkeeper_name: string; // Mantido como string, pois a lógica garante que sempre será uma string
}

const AdminSales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [shopkeepers, setShopkeepers] = useState<Profile[]>([]);
  const [selectedShopkeeperId, setSelectedShopkeeperId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchShopkeepers();
  }, []);

  useEffect(() => {
    fetchSales(selectedShopkeeperId);
  }, [selectedShopkeeperId]);

  const fetchShopkeepers = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role")
      .eq("role", "lojista");

    if (error) {
      console.error("Erro ao buscar lojistas:", error);
      showError("Erro ao carregar lojistas: " + error.message);
      setError(error.message);
    } else {
      setShopkeepers(data || []);
    }
    setLoading(false);
  };

  const fetchSales = async (shopkeeperIdFilter: string | null) => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("sales")
      .select(
        `
        id,
        product_id,
        buyer_id,
        quantity,
        total_price,
        commission_rate,
        sale_date,
        payment_gateway_id,
        payment_gateway_status,
        is_paid_out,
        payout_date,
        payout_admin_id
      `,
      )
      .order("sale_date", { ascending: false });

    if (shopkeeperIdFilter) {
      const { data: productIdsData, error: productIdsError } = await supabase
        .from("products")
        .select("id")
        .eq("shopkeeper_id", shopkeeperIdFilter);

      if (productIdsError) {
        console.error("Erro ao buscar IDs de produtos para o lojista:", productIdsError);
        showError("Erro ao carregar vendas: não foi possível filtrar por lojista. Detalhes: " + productIdsError.message);
        setError(productIdsError.message);
        setLoading(false);
        return;
      }

      const productIds = productIdsData ? productIdsData.map(p => p.id) : [];
      if (productIds.length === 0) {
        setSales([]);
        setLoading(false);
        return;
      }
      query = query.in("product_id", productIds);
    }

    const { data: salesRawData, error: salesError } = await query;

    if (salesError) {
      console.error("Erro ao buscar vendas:", salesError);
      showError("Erro ao carregar vendas. Detalhes: " + salesError.message);
      setError(salesError.message);
      setLoading(false);
      return;
    }

    const salesData = salesRawData || [];

    // Collect all unique product IDs from the fetched sales
    const uniqueProductIds = [...new Set(salesData.map(sale => sale.product_id))];
    
    // Fetch product details (name, shopkeeper_id) for all unique product IDs
    let productDetailsMap = new Map<string, ProductDetail>();
    if (uniqueProductIds.length > 0) {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, shopkeeper_id')
        .in('id', uniqueProductIds);

      if (productsError) {
        console.error('Erro ao buscar detalhes dos produtos:', productsError.message);
        showError('Erro ao carregar detalhes dos produtos: ' + productsError.message);
      } else {
        productsData?.forEach(p => {
          productDetailsMap.set(p.id, { id: p.id, name: p.name, shopkeeper_id: p.shopkeeper_id });
        });
      }
    }

    // Collect all unique shopkeeper IDs from the fetched product details
    const uniqueShopkeeperIds = [...new Set(Array.from(productDetailsMap.values()).map(p => p.shopkeeper_id).filter(Boolean))] as string[];

    // Fetch shop names for these shopkeepers
    let shopNamesMap = new Map<string, string>();
    if (uniqueShopkeeperIds.length > 0) {
      const { data: shopDetailsData, error: shopDetailsError } = await supabase
        .from('shop_details')
        .select('id, shop_name')
        .in('id', uniqueShopkeeperIds);

      if (shopDetailsError) {
        console.error('Erro ao buscar detalhes das lojas:', shopDetailsError.message);
        showError('Erro ao carregar detalhes das lojas: ' + shopDetailsError.message);
      } else {
        shopDetailsData?.forEach(shop => {
          shopNamesMap.set(shop.id, shop.shop_name || 'Lojista Desconhecido');
        });
      }
    }

    // Fetch buyer profiles separately
    const uniqueBuyerIds = [...new Set(salesData.map(sale => sale.buyer_id))];
    let buyerProfilesMap = new Map<string, string>();
    if (uniqueBuyerIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', uniqueBuyerIds);

      if (profilesError) {
        console.error('Erro ao buscar perfis dos compradores:', profilesError.message);
        showError('Erro ao carregar perfis dos compradores: ' + profilesError.message);
      } else {
        profilesData?.forEach(profile => {
          buyerProfilesMap.set(profile.id, `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Comprador Desconhecido');
        });
      }
    }

    const typedSales: Sale[] = salesData.map((item: any) => {
      const productDetail = productDetailsMap.get(item.product_id);
      const productName = productDetail?.name || "N/A";
      const shopkeeperIdForProduct = productDetail?.shopkeeper_id;
      
      let shopkeeperName: string;
      if (shopkeeperIdForProduct) {
        shopkeeperName = shopNamesMap.get(shopkeeperIdForProduct) || 'Lojista Desconhecido';
      } else {
        shopkeeperName = 'N/A';
      }

      return {
        id: item.id,
        product_id: item.product_id,
        buyer_id: item.buyer_id,
        quantity: item.quantity,
        total_price: item.total_price,
        commission_rate: item.commission_rate,
        sale_date: item.sale_date,
        payment_gateway_id: item.payment_gateway_id,
        payment_gateway_status: item.payment_gateway_status,
        is_paid_out: item.is_paid_out,
        payout_date: item.payout_date,
        payout_admin_id: item.payout_admin_id,
        buyer_name: buyerProfilesMap.get(item.buyer_id) || 'Comprador Desconhecido',
        product_name: productName,
        shopkeeper_name: shopkeeperName,
      };
    });
    setSales(typedSales);
    setLoading(false);
  };

  const handleMarkAsPaidOut = async (saleId: string) => {
    setLoading(true);
    const user = await supabase.auth.getUser();
    const adminId = user.data.user?.id;

    if (!adminId) {
      showError("Você precisa estar logado como administrador para realizar esta ação.");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("sales")
      .update({
        is_paid_out: true,
        payout_date: new Date().toISOString(),
        payout_admin_id: adminId,
      })
      .eq("id", saleId);

    if (error) {
      console.error("Erro ao marcar venda como repassada:", error);
      showError("Erro ao marcar venda como repassada: " + error.message);
      setError(error.message);
    } else {
      showSuccess("Venda marcada como repassada com sucesso!");
      fetchSales(selectedShopkeeperId);
    }
    setLoading(false);
  };

  const { totalSalesCount, totalRevenue, totalCommission, totalPaidOut, totalPendingPayout } = useMemo(() => {
    let totalSalesCount = 0;
    let totalRevenue = 0;
    let totalCommission = 0;
    let totalPaidOut = 0;
    let totalPendingPayout = 0;

    sales.forEach(sale => {
      totalSalesCount++;
      totalRevenue += sale.total_price;
      totalCommission += sale.total_price * (sale.commission_rate / 100);

      const amountToShopkeeper = sale.total_price * (1 - (sale.commission_rate / 100));

      if (sale.is_paid_out) {
        totalPaidOut += amountToShopkeeper;
      } else {
        totalPendingPayout += amountToShopkeeper;
      }
    });

    return {
      totalSalesCount,
      totalRevenue,
      totalCommission,
      totalPaidOut,
      totalPendingPayout,
    };
  }, [sales]);

  if (loading && sales.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Carregando vendas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500">
        <p>Ocorreu um erro: {error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Painel de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Label htmlFor="shopkeeper-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Lojista:
            </Label>
            <Select
              onValueChange={(value) => setSelectedShopkeeperId(value === "all" ? null : value)}
              value={selectedShopkeeperId || "all"}
            >
              <SelectTrigger id="shopkeeper-filter" className="w-[280px]">
                <SelectValue placeholder="Todos os Lojistas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Lojistas</SelectItem>
                {shopkeepers.map((shopkeeper) => (
                  <SelectItem key={shopkeeper.id} value={shopkeeper.id}>
                    {shopkeeper.first_name} {shopkeeper.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalSalesCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Comissão Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalCommission)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Repassado Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalPaidOut)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendente de Repasse</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalPendingPayout)}</div>
              </CardContent>
            </Card>
          </div>

          {sales.length === 0 ? (
            <p className="text-center text-gray-500">Nenhuma venda encontrada para o filtro selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Lojista</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Preço Total</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Data da Venda</TableHead>
                    <TableHead>Status Pagamento</TableHead>
                    <TableHead>Status Repasse</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.product_name}</TableCell>
                      <TableCell>{sale.shopkeeper_name}</TableCell>
                      <TableCell>{sale.buyer_name}</TableCell>
                      <TableCell>{sale.quantity}</TableCell>
                      <TableCell>{formatCurrency(sale.total_price)}</TableCell>
                      <TableCell>{(sale.commission_rate).toFixed(2)}%</TableCell>
                      <TableCell>{format(new Date(sale.sale_date), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>{sale.payment_gateway_status || "N/A"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          sale.is_paid_out ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {sale.is_paid_out ? `Repassado em ${format(new Date(sale.payout_date!), "dd/MM/yyyy")}` : "Pendente"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {!sale.is_paid_out && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsPaidOut(sale.id)}
                            disabled={loading}
                          >
                            Marcar como Repassado
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSales;