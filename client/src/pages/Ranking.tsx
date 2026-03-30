import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { ShieldAlert, ShieldCheck, AlertTriangle, Info, Search, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const categoryLabels: Record<string, string> = {
  proteinas: "Proteínas",
  hortifruti: "Hortifrúti",
  graos_secos: "Grãos e Secos",
  outros_insumos: "Outros Insumos",
  suprimentos: "Suprimentos",
};

/**
 * Nível de risco baseado na inflação temporal real (variation30d):
 * alto  → inflação 30d > 15%
 * médio → inflação 30d > 7%
 * baixo → inflação 30d ≤ 7%
 */
function getRiskLevel(stateVariation: number, variation30d: number) {
  const absVar = Math.abs(variation30d);
  if (absVar > 15) {
    return { level: "alto", color: "#ef4444", bg: "bg-red-50", border: "border-red-200", icon: ShieldAlert };
  }
  if (absVar > 7) {
    return { level: "moderado", color: "#EE7D00", bg: "bg-orange-50", border: "border-orange-200", icon: AlertTriangle };
  }
  return { level: "baixo", color: "#22c55e", bg: "bg-emerald-50", border: "border-emerald-200", icon: ShieldCheck };
}

type SortConfig = {
  key: "name" | "currentPrice" | "variation30d" | "stateVariation" | "riskScore" | null;
  direction: "asc" | "desc";
};

export default function Ranking() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "riskScore", direction: "desc" });

  // Sem filtro de estado: retorna 1 entrada por produto com score consolidado
  const { data: riskData, isLoading } = trpc.dashboard.riskRanking.useQuery(undefined);

  const allData = useMemo(() => {
    if (!riskData) return [];
    return (riskData as any[]).map((r: any) => {
      const stateVariation = Number(r.stateVariation || 0);
      const variation30d = Number(r.variation30d || 0);
      const riskScore = Number(r.riskScore || 0);
      return {
        ...r,
        variation30d,
        variation12m: Number(r.variation12m || 0),
        currentPrice: Number(r.currentPrice || 0),
        stateVariation,
        riskScore,
        priceRS: Number(r.priceRS || 0),
        priceSC: Number(r.priceSC || 0),
        pricePR: Number(r.pricePR || 0),
        riskLevel: getRiskLevel(stateVariation, variation30d),
      };
    });
  }, [riskData]);

  // Lista de produtos únicos para o filtro
  const uniqueProductNames = useMemo(() => {
    const names = new Set<string>();
    allData.forEach((r) => names.add(r.name));
    return Array.from(names).sort();
  }, [allData]);

  const filteredData = useMemo(() => {
    let data = [...allData];
    if (categoryFilter !== "all") data = data.filter((r) => r.category === categoryFilter);
    if (riskFilter !== "all") data = data.filter((r) => r.riskLevel.level === riskFilter);
    if (productFilter !== "all") data = data.filter((r) => r.name === productFilter);
    if (searchTerm.trim()) data = data.filter((r) => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (sortConfig.key) {
      data.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [allData, categoryFilter, riskFilter, productFilter, searchTerm, sortConfig]);

  const handleSort = (key: SortConfig["key"]) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (key: SortConfig["key"]) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortConfig.direction === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const riskSummary = useMemo(() => {
    const counts = { alto: 0, moderado: 0, baixo: 0 };
    let data = allData;
    if (categoryFilter !== "all") data = data.filter((r) => r.category === categoryFilter);
    data.forEach((r) => { counts[r.riskLevel.level as keyof typeof counts]++; });
    return counts;
  }, [allData, categoryFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ranking de Risco</h1>
          <div className="flex items-center gap-1 mt-1">
            <p className="text-muted-foreground text-sm">
              1 entrada por produto — score baseado na inflação temporal real (preço atual vs. mês anterior)
            </p>
            <Tooltip>
              <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-[300px]">
                <p className="text-xs">
                  <strong>Fórmula do Score de Risco:</strong><br/>
                  Score = |Inflação 30d| (variação temporal real)<br/><br/>
                  <strong>Alto Risco:</strong> Inflação 30d &gt; 15%<br/>
                  <strong>Moderado:</strong> Inflação 30d &gt; 7%<br/>
                  <strong>Baixo:</strong> Inflação 30d ≤ 7%<br/><br/>
                  Fonte: Média CEASA RS + SC + PR
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Nível de Risco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Níveis</SelectItem>
              <SelectItem value="alto">Alto Risco</SelectItem>
              <SelectItem value="moderado">Risco Moderado</SelectItem>
              <SelectItem value="baixo">Baixo Risco</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="proteinas">Proteínas</SelectItem>
              <SelectItem value="hortifruti">Hortifrúti</SelectItem>
              <SelectItem value="graos_secos">Grãos e Secos</SelectItem>
              <SelectItem value="outros_insumos">Outros Insumos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Produto específico" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {uniqueProductNames.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de resumo de risco — clicáveis */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { key: "alto", label: "Alto Risco", color: "red", icon: ShieldAlert, borderColor: "border-l-red-500", ringColor: "ring-red-400" },
          { key: "moderado", label: "Risco Moderado", color: "orange", icon: AlertTriangle, borderColor: "border-l-[#EE7D00]", ringColor: "ring-orange-400" },
          { key: "baixo", label: "Baixo Risco", color: "emerald", icon: ShieldCheck, borderColor: "border-l-emerald-500", ringColor: "ring-emerald-400" },
        ].map(({ key, label, color, icon: Icon, borderColor, ringColor }) => (
          <Card
            key={key}
            className={`border-l-4 ${borderColor} cursor-pointer transition-all hover:shadow-md ${riskFilter === key ? `ring-2 ${ringColor} shadow-md` : ""}`}
            onClick={() => setRiskFilter(riskFilter === key ? "all" : key)}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Icon className={`h-8 w-8 text-${color}-500`} />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className={`text-2xl font-bold text-${color}-600`}>{riskSummary[key as keyof typeof riskSummary]}</p>
                  <p className="text-xs text-muted-foreground">{riskFilter === key ? "Clique para ver todos" : "Clique para filtrar"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Indicadores de filtros ativos */}
      {(riskFilter !== "all" || searchTerm || productFilter !== "all") && (
        <div className="flex items-center gap-2 flex-wrap">
          {riskFilter !== "all" && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              {riskFilter.charAt(0).toUpperCase() + riskFilter.slice(1)} Risco
            </Badge>
          )}
          {productFilter !== "all" && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              {productFilter}
            </Badge>
          )}
          {searchTerm && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              Busca: "{searchTerm}"
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">({filteredData.length} produto{filteredData.length !== 1 ? 's' : ''})</span>
          <button
            onClick={() => { setRiskFilter("all"); setSearchTerm(""); setProductFilter("all"); setCategoryFilter("all"); }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Tabela de Ranking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Ranking por Produto — Score Consolidado RS/SC/PR
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Score = |Inflação 30d| (variação temporal real). Clique nos títulos para ordenar.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : filteredData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Nenhum produto encontrado com os filtros selecionados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th
                      className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">Produto {getSortIcon("name")}</div>
                    </th>
                    <th
                      className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("currentPrice")}
                    >
                      <div className="flex items-center justify-end">Média RS/SC/PR {getSortIcon("currentPrice")}</div>
                    </th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Preço RS</th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Preço SC</th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Preço PR</th>
                    <th
                      className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("stateVariation")}
                    >
                      <div className="flex items-center justify-end">Dif. Regional {getSortIcon("stateVariation")}</div>
                    </th>
                    <th
                      className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("variation30d")}
                    >
                      <div className="flex items-center justify-end">Inflação 30d {getSortIcon("variation30d")}</div>
                    </th>
                    <th
                      className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("riskScore")}
                    >
                      <div className="flex items-center justify-end">Score {getSortIcon("riskScore")}</div>
                    </th>
                    <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Nível</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((r: any, i: number) => {
                    const risk = r.riskLevel;
                    const RiskIcon = risk.icon;
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-2">
                          <div>
                            <span className="font-medium">{r.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">({r.unit})</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{categoryLabels[r.category]}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold">
                          R$ {r.currentPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-xs">
                          {r.priceRS > 0 ? `R$ ${r.priceRS.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-xs">
                          {r.priceSC > 0 ? `R$ ${r.priceSC.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-xs">
                          {r.pricePR > 0 ? `R$ ${r.pricePR.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className={`font-medium ${r.stateVariation > 15 ? "text-red-600" : r.stateVariation > 7 ? "text-amber-600" : "text-emerald-600"}`}>
                            {r.stateVariation.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className={`font-medium ${r.variation30d > 0 ? "text-red-600" : r.variation30d < 0 ? "text-emerald-600" : "text-gray-500"}`}>
                            {r.variation30d > 0 ? "+" : ""}{r.variation30d.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold">
                          {r.riskScore.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <Badge
                            className={`gap-1 ${risk.bg} ${risk.border} border`}
                            style={{ color: risk.color }}
                            variant="outline"
                          >
                            <RiskIcon className="h-3 w-3" />
                            {risk.level.charAt(0).toUpperCase() + risk.level.slice(1)}
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
