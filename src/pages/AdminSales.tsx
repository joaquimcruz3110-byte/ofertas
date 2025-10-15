import React, { useEffect, useState } from "react";
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
import { showSuccess, showError } from "@/utils/toast";
import { format } from "date-fns";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
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
  products: {
    name: string;
    shopkeeper_id: string;
  };
  profiles: {
    first_name: string;
    last_name: string;
  };
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
      showError("Erro ao carregar lojistas.");
      setError(error.message);
    } else {
      setShopkeepers(data || []);
    }
    setLoading(false);
  };

  const fetchSales = async (shopkeeperId: string | null) => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("sales")
      .select(
        `
        id,
        quantity,
        total_price,
        commission_rate,
        sale_date,
        payment_gateway_id,
        payment_gateway_status,
        products (
          name,
          shopkeeper_id
        ),
        profiles (
          first_name,
          last_name
        )
      `,
      )
      .order("sale_date", { ascending: false });

    if (shopkeeperId) {
      query = query.eq("products.shopkeeper_id", shopkeeperId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar vendas:", error);
      showError("Erro ao carregar vendas.");
      setError(error.message);
    } else {
      setSales(data as Sale[] || []);
      showSuccess("Vendas carregadas com sucesso!");
    }
    setLoading(false);
  };

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
      <Card>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.products?.name || "N/A"}</TableCell>
                      <TableCell>
                        {shopkeepers.find(s => s.id === sale.products?.shopkeeper_id)?.first_name || "N/A"}
                      </TableCell>
                      <TableCell>{sale.profiles?.first_name} {sale.profiles?.last_name}</TableCell>
                      <TableCell>{sale.quantity}</TableCell>
                      <TableCell>R$ {sale.total_price.toFixed(2)}</TableCell>
                      <TableCell>{(sale.commission_rate * 100).toFixed(2)}%</TableCell>
                      <TableCell>{format(new Date(sale.sale_date), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>{sale.payment_gateway_status || "N/A"}</TableCell>
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