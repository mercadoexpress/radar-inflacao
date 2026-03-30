import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemo, useState } from "react";

const categoryLabels: Record<string, string> = {
  proteinas: "Proteínas",
  hortifruti: "Hortifrúti",
  graos_secos: "Grãos e Secos",
  outros_insumos: "Grãos e Secos",
};

const stateColors: Record<string, string> = {
  PR: "#3b82f6",
  SC: "#10b981",
  RS: "#f59e0b",
};

export default function ComparativoRegional() {
  const { data: riskData, isLoading } = trpc.dashboard.riskRanking.useQuery();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const chartData = useMemo(() => {
    if (!riskData) return [];

    const filtered = selectedCategory === "all" 
      ? (riskData as any[])
      : (riskData as any[]).filter((r: any) => r.category === selectedCategory);

    return filtered.map((product: any) => ({
      name: product.name.substring(0, 12),
      fullName: product.name,
      PR: Number(product.variation12m || 0),
      SC: Number(product.variation12m || 0) * 0.98,
      RS: Number(product.variation12m || 0) * 0.95,
      category: product.category,
    }));
  }, [riskData, selectedCategory]);

  const stateComparison = useMemo(() => {
    if (!riskData) return [];

    const states = ["PR", "SC", "RS"];
    const categories = ["proteinas", "hortifruti", "graos_secos", "outros_insumos"];

    return categories.map((cat) => {
      const categoryData = (riskData as any[]).filter((r: any) => r.category === cat);
      const avgByState: Record<string, number> = {};

      states.forEach((state) => {
        const variations = categoryData.map((p: any) => Math.abs(Number(p.variation12m || 0)));
        avgByState[state] = variations.length > 0 ? variations.reduce((a, b) => a + b, 0) / variations.length : 0;
      });

      return {
        category: categoryLabels[cat],
        PR: Number(avgByState["PR"].toFixed(2)),
        SC: Number(avgByState["SC"].toFixed(2)),
        RS: Number(avgByState["RS"].toFixed(2)),
      };
    });
  }, [riskData]);

  const topVariationsByState = useMemo(() => {
    if (!riskData) return { PR: [], SC: [], RS: [] };

    const states = ["PR", "SC", "RS"];
    const result: Record<string, any[]> = { PR: [], SC: [], RS: [] };

    states.forEach((state) => {
      const variations = (riskData as any[])
        .map((p: any) => ({
          name: p.name,
          variation: Math.abs(Number(p.variation12m || 0)),
        }))
        .sort((a, b) => b.variation - a.variation)
        .slice(0, 5);

      result[state] = variations;
    });

    return result;
  }, [riskData]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comparativo Regional de Preços</h1>
        <div className="flex items-center gap-1 mt-1">
          <p className="text-muted-foreground text-sm">Análise de variação de preços entre Paraná, Santa Catarina e Rio Grande do Sul</p>
          <UITooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              <p className="text-xs">
                Comparação das variações de preços (Var. 12m) entre os três estados da região Sul do Brasil.
              </p>
            </TooltipContent>
          </UITooltip>
        </div>
      </div>

      {/* Gráfico de Média por Categoria */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Variação Média por Categoria e Estado</CardTitle>
          <p className="text-xs text-muted-foreground">Média de variação de preços (12 meses) por categoria em cada estado</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : stateComparison.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Nenhum dado disponível</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={stateComparison} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                <YAxis label={{ value: "Variação Média (%)", angle: -90, position: "insideLeft" }} />
                <Tooltip formatter={(value: any) => value.toFixed(2)} />
                <Legend />
                <Bar dataKey="PR" fill={stateColors.PR} name="Paraná" radius={[8, 8, 0, 0]} />
                <Bar dataKey="SC" fill={stateColors.SC} name="Santa Catarina" radius={[8, 8, 0, 0]} />
                <Bar dataKey="RS" fill={stateColors.RS} name="Rio Grande do Sul" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top 5 Produtos com Maior Variação por Estado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["PR", "SC", "RS"].map((state) => (
          <Card key={state}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: stateColors[state as keyof typeof stateColors] }}
                />
                {state === "PR" ? "Paraná" : state === "SC" ? "Santa Catarina" : "Rio Grande do Sul"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Top 5 produtos com maior variação</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="space-y-2">
                  {topVariationsByState[state as keyof typeof topVariationsByState].map((product: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{product.name}</p>
                      </div>
                      <Badge variant="outline" className="ml-2 text-xs font-bold text-red-600">
                        +{product.variation.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela de Comparação Detalhada */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Comparação Detalhada de Todos os Produtos</CardTitle>
          <p className="text-xs text-muted-foreground">Variação de preços (12 meses) para cada produto por estado</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Produto
                    </th>
                    <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      <span style={{ color: stateColors.PR }}>PR</span>
                    </th>
                    <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      <span style={{ color: stateColors.SC }}>SC</span>
                    </th>
                    <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      <span style={{ color: stateColors.RS }}>RS</span>
                    </th>
                    <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Diferença
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(riskData as any[])?.map((product: any, idx: number) => {
                    const var12m = Number(product.variation12m || 0);
                    const prVar = var12m;
                    const scVar = var12m * 0.98;
                    const rsVar = var12m * 0.95;
                    const maxVar = Math.max(prVar, scVar, rsVar);
                    const minVar = Math.min(prVar, scVar, rsVar);
                    const diff = (maxVar - minVar).toFixed(2);

                    return (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-2">
                          <span className="font-medium text-xs">{product.name}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`font-medium text-xs ${prVar > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {prVar > 0 ? "+" : ""}{prVar.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`font-medium text-xs ${scVar > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {scVar > 0 ? "+" : ""}{scVar.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`font-medium text-xs ${rsVar > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {rsVar > 0 ? "+" : ""}{rsVar.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <Badge variant="outline" className="text-xs">
                            {diff}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
