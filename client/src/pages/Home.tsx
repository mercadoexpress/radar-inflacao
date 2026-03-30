import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, Minus, Package, ShieldAlert, Activity, Info, Search, ExternalLink, RefreshCw, Clock, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation } from "wouter";

const categoryLabels: Record<string, string> = {
  proteinas: "Proteínas",
  hortifruti: "Hortifrúti",
  graos_secos: "Grãos e Secos",
  outros_insumos: "Grãos e Secos",
  suprimentos: "Suprimentos",
};
const categoryColors: Record<string, string> = {
  proteinas: "#EE7D00",
  hortifruti: "#22c55e",
  graos_secos: "#003770",
  outros_insumos: "#003770",
  suprimentos: "#64748b",
};

// Mapeamento de expectativa para ordenação numérica
const expectativaOrder: Record<string, number> = {
  "Alta forte": 6,
  "Tendência de alta": 5,
  "Reversão p/ alta": 4,
  "Estável": 3,
  "Reversão p/ queda": 2,
  "Tendência de queda": 1,
  "Queda forte": 0,
};

function formatCurrency(value: number | string) {
  return `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function VariationBadge({ value }: { value: number }) {
  if (value > 0.01) return (
    <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 gap-1 font-medium">
      <TrendingUp className="h-3 w-3" /> +{value.toFixed(2)}%
    </Badge>
  );
  if (value < -0.01) return (
    <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 gap-1 font-medium">
      <TrendingDown className="h-3 w-3" /> {value.toFixed(2)}%
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-gray-500 border-gray-200 bg-gray-50 gap-1 font-medium">
      <Minus className="h-3 w-3" /> 0.00%
    </Badge>
  );
}

function StatusBadge({ value, average }: { value: number; average: number }) {
  const tolerance = Math.abs(average) * 0.15;
  const diff = value - average;
  const status = Math.abs(diff) <= tolerance ? "na_media" : diff > 0 ? "acima" : "abaixo";
  const colors = {
    acima: "text-red-600 border-red-200 bg-red-50",
    abaixo: "text-emerald-600 border-emerald-200 bg-emerald-50",
    na_media: "text-blue-600 border-blue-200 bg-blue-50",
  };
  const labels = { acima: "Acima da média 12m", abaixo: "Abaixo da média 12m", na_media: "Na média 12m" };
  return <Badge variant="outline" className={`${colors[status]} text-xs font-medium`}>{labels[status]}</Badge>;
}

/**
 * Lógica de tendência unificada com o backend.
 * Baseada em variação de 30d e 90d para alinhar com a projeção linear.
 */
function getTrendLabel(variation30d: number, variation90d: number) {
  // Alta forte: subindo consistentemente nos dois períodos
  if (variation30d > 3 && variation90d > 0) return { label: "Alta forte", color: "text-red-700 bg-red-50 border-red-200" };
  
  // Tendência de alta: subindo no curto prazo
  if (variation30d > 0.5) {
    if (variation90d < -0.5) return { label: "Reversão p/ alta", color: "text-amber-600 bg-amber-50 border-amber-200" };
    return { label: "Tendência de alta", color: "text-red-600 bg-red-50 border-red-200" };
  }
  
  // Queda forte: caindo consistentemente nos dois períodos
  if (variation30d < -3 && variation90d < 0) return { label: "Queda forte", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  
  // Tendência de queda: caindo no curto prazo
  if (variation30d < -0.5) {
    if (variation90d > 0.5) return { label: "Reversão p/ queda", color: "text-blue-600 bg-blue-50 border-blue-200" };
    return { label: "Tendência de queda", color: "text-emerald-600 bg-emerald-50 border-emerald-200" };
  }
  
  return { label: "Estável", color: "text-gray-600 bg-gray-50 border-gray-200" };
}

export default function Home() {
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [marketSearch, setMarketSearch] = useState("");
  const [marketSortBy, setMarketSortBy] = useState<string>("name");
  const [marketSortOrder, setMarketSortOrder] = useState<"asc" | "desc">("asc");
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const filterState = stateFilter === "all" ? undefined : stateFilter;

  // Scraper status
  const { data: scraperStatus, refetch: refetchStatus } = trpc.scraper.status.useQuery();
  const runScraper = trpc.scraper.runNow.useMutation({
    onSuccess: (result) => {
      toast.success(`Atualização concluída: ${result.productsUpdated} produtos, ${result.pricesInserted} preços inseridos`);
      refetchStatus();
      window.location.reload();
    },
    onError: (err) => toast.error(`Erro na atualização: ${err.message}`),
  });

  const { data: summary, isLoading: summaryLoading } = trpc.dashboard.summary.useQuery(
    filterState ? { state: filterState } : undefined
  );
  const { data: riskData, isLoading: riskLoading } = trpc.dashboard.riskRanking.useQuery(
    filterState ? { state: filterState } : undefined
  );
  const { data: marketData, isLoading: marketLoading } = trpc.dashboard.marketAnalysis.useQuery(
    filterState ? { state: filterState } : undefined
  );
  const { data: allIndices } = trpc.indices.withAccumulated.useQuery();

  // FIPE Alimentação
  const fipeAlim = useMemo(() => {
    if (!allIndices) return null;
    const fipeData = (allIndices as any[]).filter((i: any) => i.indexName === "FIPE_ALIM" && i.region === "Nacional");
    if (fipeData.length === 0) return null;
    const values = fipeData.map((d: any) => Number(d.value));
    const avg12m = values.reduce((a: number, b: number) => a + b, 0) / values.length;
    const latest = values[values.length - 1];
    return { avg12m: Math.round(avg12m * 100) / 100, mensal: latest };
  }, [allIndices]);

  // IPCA Alimentação
  const ipcaAlim = useMemo(() => {
    if (!allIndices) return null;
    const ipcaData = (allIndices as any[]).filter((i: any) => i.indexName === "IPCA_ALIM" && i.region === "Nacional");
    if (ipcaData.length === 0) return null;
    const values = ipcaData.map((d: any) => Number(d.value));
    const avg12m = values.reduce((a: number, b: number) => a + b, 0) / values.length;
    const latest = values[values.length - 1];
    return { avg12m: Math.round(avg12m * 100) / 100, mensal: latest };
  }, [allIndices]);

  // Top 10 produtos — unificado com a lógica de pressão inflacionária (Var. 30d)
  const topRisks = useMemo(() => {
    if (!riskData) return [];
    // O backend já retorna ordenado por variation30d DESC em getRiskRanking
    return (riskData as any[])
      .map((r: any) => ({ ...r, variation30d: Number(r.variation30d), currentPrice: Number(r.currentPrice) }))
      .slice(0, 10);
  }, [riskData]);

  // Análise de mercado — projeção futura unificada
  const marketAnalysis = useMemo(() => {
    if (!marketData) return [];
    let items = (marketData as any[]).map((m: any) => ({
      ...m,
      currentPrice: Number(m.currentPrice),
      variation30d: Number(m.variation30d),
      variation90d: Number(m.variation90d),
      variation12m: Number(m.variation12m),
    }));

    // Aplicar ordenação
    items.sort((a: any, b: any) => {
      let compareResult = 0;
      if (marketSortBy === "name") {
        compareResult = a.name.localeCompare(b.name);
      } else if (marketSortBy === "currentPrice") {
        compareResult = a.currentPrice - b.currentPrice;
      } else if (marketSortBy === "variation30d") {
        compareResult = a.variation30d - b.variation30d;
      } else if (marketSortBy === "variation90d") {
        compareResult = a.variation90d - b.variation90d;
      } else if (marketSortBy === "variation12m") {
        compareResult = a.variation12m - b.variation12m;
      } else if (marketSortBy === "expectativa") {
        const trendA = getTrendLabel(a.variation30d, a.variation90d);
        const trendB = getTrendLabel(b.variation30d, b.variation90d);
        compareResult = (expectativaOrder[trendA.label] ?? 3) - (expectativaOrder[trendB.label] ?? 3);
      }
      return marketSortOrder === "asc" ? compareResult : -compareResult;
    });

    if (marketSearch) {
      const q = marketSearch.toLowerCase();
      items = items.filter((m: any) => m.name.toLowerCase().includes(q));
    }
    return items;
  }, [marketData, marketSearch, marketSortBy, marketSortOrder]);

  const handleSort = (column: string) => {
    if (marketSortBy === column) {
      setMarketSortOrder(marketSortOrder === "asc" ? "desc" : "asc");
    } else {
      setMarketSortBy(column);
      setMarketSortOrder(column === "name" ? "asc" : "desc");
    }
  };

  const SortHeader = ({ column, label, align = "left" }: { column: string; label: string; align?: string }) => (
    <th
      className={`text-${align} py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none`}
      onClick={() => handleSort(column)}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
        {label}
        <ArrowUpDown className={`h-3 w-3 shrink-0 ${marketSortBy === column ? "text-[#003770]" : "text-muted-foreground/40"} ${marketSortBy === column && marketSortOrder === "desc" ? "rotate-180" : ""}`} />
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Radar Express de Inflação</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitoramento de preços agrícolas e inflação alimentar — Sul do Brasil
          </p>
          <button
            onClick={() => setLocation("/produtos")}
            className="inline-flex items-center gap-1.5 mt-2 text-sm text-[#EE7D00] hover:text-[#d56e00] font-medium transition-colors"
          >
            <Package className="h-3.5 w-3.5" />
            Ver lista completa dos {summary?.totalProducts || 22} produtos monitorados
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Região" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Regiões</SelectItem>
              <SelectItem value="PR">Paraná</SelectItem>
              <SelectItem value="SC">Santa Catarina</SelectItem>
              <SelectItem value="RS">Rio Grande do Sul</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            {scraperStatus?.lastUpdate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Atualizado: {new Date(scraperStatus.lastUpdate).toLocaleDateString("pt-BR")}
              </span>
            )}
            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => runScraper.mutate()}
                disabled={runScraper.isPending}
              >
                <RefreshCw className={`h-3 w-3 ${runScraper.isPending ? "animate-spin" : ""}`} />
                {runScraper.isPending ? "Atualizando..." : "Atualizar Preços"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-[#003770]">
          <CardContent className="pt-5 pb-4">
            {summaryLoading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Produtos Monitorados</p>
                  <p className="text-3xl font-bold text-[#003770] mt-1">{summary?.totalProducts || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Indicadores CEASA RS / SC / PR</p>
                </div>
                <div className="p-2.5 rounded-xl bg-[#003770]/10"><Package className="h-5 w-5 text-[#003770]" /></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#EE7D00]">
          <CardContent className="pt-5 pb-4">
            {!fipeAlim ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">FIPE Alimentação</p>
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent><p className="text-xs max-w-[200px]">FIPE grupo Alimentação (FGV). Mensal: variação do último mês. Média: média dos últimos 12 meses.</p></TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-2xl font-bold text-[#EE7D00] mt-1">{fipeAlim.mensal.toFixed(2)}%</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">Média 12m: {fipeAlim.avg12m.toFixed(2)}%</span>
                    <StatusBadge value={fipeAlim.mensal} average={fipeAlim.avg12m} />
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#EE7D00]/10"><Activity className="h-5 w-5 text-[#EE7D00]" /></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-4">
            {!ipcaAlim ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">IPCA Alimentação</p>
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent><p className="text-xs max-w-[200px]">IPCA grupo Alimentação e Bebidas (IBGE). Mensal: variação do último mês. Média: média dos últimos 12 meses.</p></TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-2xl font-bold text-red-600 mt-1">{ipcaAlim.mensal.toFixed(2)}%</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">Média 12m: {ipcaAlim.avg12m.toFixed(2)}%</span>
                    <StatusBadge value={ipcaAlim.mensal} average={ipcaAlim.avg12m} />
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-red-50"><ShieldAlert className="h-5 w-5 text-red-500" /></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Produtos com Maior Pressão Inflacionária */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Top 10 Produtos com Maior Pressão Inflacionária</CardTitle>
          <p className="text-xs text-muted-foreground">
            Produtos com maior variação positiva nos últimos 30 dias (do mais inflacionado ao menor) — Fonte: CEASA RS / SC / PR
          </p>
        </CardHeader>
        <CardContent>
          {riskLoading ? <Skeleton className="h-[350px] w-full" /> : (
            <div className="space-y-2">
              {topRisks.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors border border-border/40">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-6 text-center ${i < 3 ? "text-red-600" : "text-muted-foreground"}`}>{i + 1}.</span>
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{categoryLabels[r.category]} · {r.state} · {r.unit}</p>
                      {r.source && <p className="text-[10px] text-muted-foreground/70 mt-0.5">Fonte: {r.source}</p>}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <p className="text-sm font-mono font-medium">{formatCurrency(r.currentPrice)}</p>
                    <VariationBadge value={r.variation30d} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Análise de Mercado — Projeção e Expectativa */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Projeção e Expectativa de Mercado</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Análise de tendência dos {summary?.totalProducts || 19} itens monitorados com base na evolução dos últimos 30d, 90d e 12 meses para projetar o comportamento futuro dos preços — Fontes: CEASA RS / CEASA SC / CEASA PR
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clique nos cabeçalhos das colunas para ordenar: A→Z (alfabético), maior→menor (preço) ou por expectativa de mercado
              </p>
            </div>
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {marketLoading ? <Skeleton className="h-[300px] w-full" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <SortHeader column="name" label="Produto" />
                    <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Categoria</th>
                    <SortHeader column="currentPrice" label="Preço Atual" align="right" />
                    <SortHeader column="variation30d" label="Var. 30d" align="right" />
                    <SortHeader column="variation90d" label="Var. 90d" align="right" />
                    <SortHeader column="variation12m" label="Var. 12m" align="right" />
                    <SortHeader column="expectativa" label="Expectativa" align="center" />
                  </tr>
                </thead>
                <tbody>
                  {marketAnalysis.map((m: any, i: number) => {
                    const trend = getTrendLabel(m.variation30d, m.variation90d);
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-2">
                          <p className="font-medium">{m.name}</p>
                          {m.source && (
                            <p className="text-xs text-muted-foreground mt-0.5">Fonte: {m.source}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          <Badge variant="secondary" className="text-xs font-normal" style={{ backgroundColor: `${categoryColors[m.category]}15`, color: categoryColors[m.category] }}>
                            {categoryLabels[m.category]}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-medium">{formatCurrency(m.currentPrice)}</td>
                        <td className="py-2.5 px-2 text-right"><VariationBadge value={m.variation30d} /></td>
                        <td className="py-2.5 px-2 text-right"><VariationBadge value={m.variation90d} /></td>
                        <td className="py-2.5 px-2 text-right"><VariationBadge value={m.variation12m} /></td>
                        <td className="py-2.5 px-2 text-center">
                          <Badge variant="outline" className={`text-xs font-medium ${trend.color}`}>{trend.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {marketAnalysis.length === 0 && marketSearch && (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum produto encontrado para "{marketSearch}"</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
