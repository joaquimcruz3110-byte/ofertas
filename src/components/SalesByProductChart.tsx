"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface SalesByProductChartProps {
  data: Array<{ name: string; totalQuantity: number }>;
}

const SalesByProductChart = ({ data }: SalesByProductChartProps) => {
  const chartConfig = {
    totalQuantity: {
      label: "Quantidade Vendida",
      color: "hsl(var(--dyad-vibrant-orange))",
    },
    name: {
      label: "Produto",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendas por Produto</CardTitle>
        <CardDescription>Quantidade total de cada produto vendido.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            Nenhum dado de vendas disponível para o gráfico.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  angle={-45} // Rotaciona os rótulos do eixo X
                  textAnchor="end" // Alinha o texto ao final
                  interval={0} // Garante que todos os rótulos sejam exibidos
                />
                <YAxis
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.toFixed(0)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <Bar dataKey="totalQuantity" fill="var(--color-totalQuantity)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesByProductChart;