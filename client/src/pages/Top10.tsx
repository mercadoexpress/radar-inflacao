import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { TrendingUp, AlertTriangle, Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemo } from "react";

const categoryLabels: Record<string, string> = {
  proteinas: "Proteínas",
  hortifruti: "Hortifrúti",
  graos_secos: "Grãos e Secos",
  outros_insumos: "Grãos e Secos",
};

const categoryColors: Record<string, string> = {
  proteinas: "#EE7D00",
  hortifruti: "#22c55e",
  graos_secos: "#003770",
  outros_insumos: "#003770",
};

export default function Top10() {
  const { data: riskData, isLoading } = trpc.dashboard.riskRanking.useQuery();

  const top10 = useMemo(() => {
    if (!riskData) return [];

    // Calcular pressão inflacionária: |Var. 12m| + (|Var. 90d| × 0.5)
    const withPressure = (riskData as any[]).map((r: any) => ({
      ...r,
      variation12m: Number(r.variation12m || 0),
      variation90d: Number(r.variation90d),
      pressure: Math.abs(Number(r.variation12m || 0)) + Math.abs(Number(r.variation90d)) * 0.5,
    }));

    // Ordenar por pressão inflacionária descendente e pegar top 10
    return withPressure
      .sort((a, b) => b.pressure - a.pressure)
      .slice(0, 10)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));
  }, [riskData]);

  const chartData = useMemo(() => {
    return top10.map((item) => ({
      name: item.name.substring(0, 14),
      pressure: Number(item.pressure.toFixed(2)),
      variation12m: Number(item.variation12m.toFixed(2)),
      fullName: item.name,
      category: item.category,
    }));
  }, [top10]);

  const totalPressure = useMemo(() => {
    return top10.reduce((sum, item) => sum + item.pressure, 0);
  }, [top10]);

  const avgPressure = useMemo(() => {
    return top10.length > 0 ? totalPressure / top10.length : 0;
  }, [top10, totalPressure]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Top 10 Produtos com Maior Pressão Inflacionária</h1>
        <div className="flex items-center gap-1 mt-1">
          <p className="text-muted-foreground text-sm">Análise dos produtos com maior impacto inflacionário — todos os 28 itens analisados</p>
          <UITooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              <p className="text-xs">
                <strong>Pressão Inflacionária:</strong>
                <br />
                Score = |Var. 12m| + (|Var. 90d| × 0.5)
                <br />
                <br />
                Quanto maior o score, maior a pressão nos preços do produto.
              </p>
            </TooltipContent>
          </UITooltip>
        </div>
      </div>

      {/* Métricas Resumidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pressão Total (Top 10)</p>
                <p className="text-2xl font-bold text-red-600">{totalPressure.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pressão Média</p>
                <p className="text-2xl font-bold text-orange-600">{avgPressure.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-sm font-bold text-blue-600">📊</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Produtos Analisados</p>
                <p className="text-2xl font-bold text-blue-600">28</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Pressão Inflacionária */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Ranking de Pressão Inflacionária</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ordenado por pressão inflacionária (Score = |Var. 12m| + |Var. 90d| × 0.5)
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : top10.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Nenhum dado disponível</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  tick={{ fontSize: 11 }}
                />
                <YAxis label={{ value: "Pressão Inflacionária", angle: -90, position: "insideLeft" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  formatter={(value: any) => value.toFixed(2)}
                  labelFormatter={(label) => `Pressão: ${label}`}
                />
                <Legend />
                <Bar dataKey="pressure" fill="#ef4444" name="Pressão Inflacionária" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={categoryColors[top10[index]?.category] || "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Detalhamento do Top 10</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-12">
                      Rank
                    </th>
                    <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Produto
                    </th>
                    <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Var. 12m
                    </th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Var. 90d
                    </th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Pressão
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {top10.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-2 text-center">
                        <Badge variant="outline" className="text-xs font-bold w-8 h-8 flex items-center justify-center">
                          {item.rank}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="font-medium">{item.name}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            backgroundColor: `${categoryColors[item.category]}20`,
                            borderColor: categoryColors[item.category],
                            color: categoryColors[item.category],
                          }}
                        >
                          {categoryLabels[item.category]}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span
                          className={`font-medium ${
                            item.variation12m > 0
                              ? "text-red-600"
                              : item.variation12m < 0
                                ? "text-emerald-600"
                                : "text-gray-500"
                          }`}
                        >
                          {item.variation12m > 0 ? "+" : ""}
                          {item.variation12m.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span
                          className={`font-medium ${
                            item.variation90d > 0
                              ? "text-red-600"
                              : item.variation90d < 0
                                ? "text-emerald-600"
                                : "text-gray-500"
                          }`}
                        >
                          {item.variation90d > 0 ? "+" : ""}
                          {item.variation90d.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-red-600">
                        {item.pressure.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
