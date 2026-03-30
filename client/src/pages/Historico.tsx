import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";

const stateColors: Record<string, string> = { PR: "#003770", SC: "#EE7D00", RS: "#22c55e" };

export default function Historico() {
  const [selectedProduct, setSelectedProduct] = useState<number>(0);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const filterState = stateFilter === "all" ? undefined : stateFilter;

  const { data: productsList } = trpc.products.list.useQuery();

  // Ordenar produtos alfabeticamente
  const sortedProducts = useMemo(() => {
    if (!productsList) return [];
    return [...(productsList as any[])].sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [productsList]);

  const productId = selectedProduct || sortedProducts[0]?.id || 1;

  const { data: timeSeries, isLoading: tsLoading } = trpc.prices.timeSeries.useQuery(
    { productId, state: filterState, months: 12 },
    { enabled: productId > 0 }
  );
  // Para comparação mensal, SEMPRE buscar todos os estados
  const { data: monthlyAvgAll, isLoading: maLoading } = trpc.prices.monthlyAverages.useQuery(
    { productId },
    { enabled: productId > 0 }
  );

  const selectedProductInfo = useMemo(() => {
    return sortedProducts.find((p: any) => p.id === productId);
  }, [sortedProducts, productId]);

  const chartData = useMemo(() => {
    if (!timeSeries) return [];
    return (timeSeries as any[]).map((d: any) => ({
      date: d.collectedAt,
      price: Number(d.price),
      state: d.state,
    }));
  }, [timeSeries]);

  // Agrupar dados mensais por mês com colunas para cada estado
  const monthlyChartData = useMemo(() => {
    if (!monthlyAvgAll) return [];
    const grouped: Record<string, any> = {};
    (monthlyAvgAll as any[]).forEach((d: any) => {
      if (!grouped[d.month]) grouped[d.month] = { month: d.month };
      grouped[d.month][`avg_${d.state}`] = Number(d.avgPrice);
      grouped[d.month][`min_${d.state}`] = Number(d.minPrice);
      grouped[d.month][`max_${d.state}`] = Number(d.maxPrice);
    });
    return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
  }, [monthlyAvgAll]);

  // Detectar quais estados têm dados
  const availableStates = useMemo(() => {
    if (!monthlyChartData.length) return [];
    const states = new Set<string>();
    for (const d of monthlyChartData) {
      if (d.avg_PR !== undefined) states.add("PR");
      if (d.avg_SC !== undefined) states.add("SC");
      if (d.avg_RS !== undefined) states.add("RS");
    }
    return Array.from(states);
  }, [monthlyChartData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico de Preços</h1>
          <p className="text-muted-foreground text-sm mt-1">Evolução de preços nos últimos 12 meses com médias móveis e tendências</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(productId)} onValueChange={(v) => setSelectedProduct(Number(v))}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              {sortedProducts.map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Região" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="PR">Paraná</SelectItem>
              <SelectItem value="SC">Santa Catarina</SelectItem>
              <SelectItem value="RS">Rio Grande do Sul</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedProductInfo && (
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-sm px-3 py-1">{selectedProductInfo.name}</Badge>
          <span className="text-sm text-muted-foreground">Unidade: <strong>{selectedProductInfo.unit}</strong></span>
          <span className="text-sm text-muted-foreground">Fonte: {selectedProductInfo.category === "hortifruti" ? "CEASAs do Sul" : "CEPEA"}</span>
        </div>
      )}

      {/* Monthly Comparison Chart - sempre mostra todos os estados */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Comparação Mensal por Estado</CardTitle>
          <p className="text-xs text-muted-foreground">Média mensal de preços por estado (PR, SC, RS) — comparação regional dos últimos 12 meses</p>
        </CardHeader>
        <CardContent>
          {maLoading ? <Skeleton className="h-[320px] w-full" /> : monthlyChartData.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">Sem dados disponíveis para este produto.</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={monthlyChartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => { const [y, m] = v.split("-"); return `${m}/${y.slice(2)}`; }} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${Number(v).toLocaleString("pt-BR")}`} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  formatter={(value: number, name: string) => {
                    const state = name.replace("avg_", "").replace("Média ", "");
                    return [`R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, state];
                  }}
                  labelFormatter={(v) => { const [y, m] = String(v).split("-"); return `${m}/${y}`; }}
                />
                <Legend />
                {availableStates.includes("PR") && (
                  <Line type="monotone" dataKey="avg_PR" name="Média PR" stroke="#003770" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                )}
                {availableStates.includes("SC") && (
                  <Line type="monotone" dataKey="avg_SC" name="Média SC" stroke="#EE7D00" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                )}
                {availableStates.includes("RS") && (
                  <Line type="monotone" dataKey="avg_RS" name="Média RS" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Daily Price Evolution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Evolução Diária de Preços</CardTitle>
          <p className="text-xs text-muted-foreground">Série temporal completa dos últimos 12 meses — dados de coleta periódica</p>
        </CardHeader>
        <CardContent>
          {tsLoading ? <Skeleton className="h-[300px] w-full" /> : chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Sem dados disponíveis.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#003770" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#003770" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={10} tickFormatter={(v) => { const d = new Date(v); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`; }} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${Number(v).toLocaleString("pt-BR")}`} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  labelFormatter={(v) => { const d = new Date(String(v)); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; }}
                  formatter={(value: number) => [`R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Preço"]}
                />
                <Area type="monotone" dataKey="price" stroke="#003770" strokeWidth={1.5} fill="url(#priceGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
