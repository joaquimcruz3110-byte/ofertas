"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface RevenueOverTimeChartProps {
  data: Array<{ date: string; totalRevenue: number }>;
}

const RevenueOverTimeChart = ({ data }: RevenueOverTimeChartProps) => {
  const chartConfig = {
    totalRevenue: {
      label: "Receita Total (R$)",
      color: "hsl(var(--dyad-dark-blue))",
    },
    date: {
      label: "Data",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receita Total ao Longo do Tempo</CardTitle>
        <CardDescription>Receita bruta de todas as vendas por data.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            Nenhum dado de receita disponível para o gráfico.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
                />
                <YAxis
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => `R$ ${value.toFixed(2)}`}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <Line
                  dataKey="totalRevenue"
                  type="monotone"
                  stroke="var(--color-totalRevenue)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default RevenueOverTimeChart;