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
  proteinas: "Proteínas", hortifruti: "Hortifrúti", graos_secos: "Grãos e Secos",
  outros_insumos: "Grãos e Secos", suprimentos: "Suprimentos",
};

/**
 * Calcula o nível de risco baseado em variação percentual e volatilidade.
 * Lógica corrigida: volatilidade alta (> 5%) = risco alto
 */
function getRiskLevel(variation12m: number, variation90d: number, volatility: number) {
  const absVar12m = Math.abs(variation12m);
  const absVar90d = Math.abs(variation90d);
  const absVolatility = Math.abs(volatility);
  
  // Critérios de risco alto:
  // - Volatilidade > 5% (instável)
  // - Variação 12m > 10% (alta inflação)
  // - Score composto > 8
  if (absVolatility > 5 || absVar12m > 10) {
    return { level: "alto", color: "#ef4444", bg: "bg-red-50", border: "border-red-200", icon: ShieldAlert };
  }
  
  // Critérios de risco moderado:
  // - Volatilidade entre 2.5% e 5%
  // - Variação 12m entre 5% e 10%
  // - Score composto entre 4 e 8
  const score = absVar12m * 0.5 + absVar90d * 0.3 + absVolatility * 0.2;
  if (absVolatility > 2.5 || absVar12m > 5 || score > 4) {
    return { level: "moderado", color: "#EE7D00", bg: "bg-orange-50", border: "border-orange-200", icon: AlertTriangle };
  }
  
  // Risco baixo: tudo dentro dos limites
  return { level: "baixo", color: "#22c55e", bg: "bg-emerald-50", border: "border-emerald-200", icon: ShieldCheck };
}

type SortConfig = {
  key: "name" | "currentPrice" | "variation12m" | null;
  direction: "asc" | "desc";
};

export default function Ranking() {
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "variation12m", direction: "desc" });
  
  const filterState = stateFilter === "all" ? undefined : stateFilter;

  const { data: riskData, isLoading } = trpc.dashboard.riskRanking.useQuery(
    filterState ? { state: filterState } : undefined
  );

  const allData = useMemo(() => {
    if (!riskData) return [];
    return (riskData as any[]).map((r: any) => ({
      ...r,
      variation12m: Number(r.variation12m || 0),
      variation90d: Number(r.variation90d),
      variation30d: Number(r.variation30d),
      currentPrice: Number(r.currentPrice),
      volatility: Number(r.volatility || 0),
      avg30d: Number(r.avg30d || 0),
      avg90d: Number(r.avg90d || 0),
      avg12m: Number(r.avg12m || 0),
      riskLevel: getRiskLevel(Number(r.variation12m || 0), Number(r.variation90d), Number(r.volatility || 0)),
    }));
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
    
    // Ordenação
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
  }, [allData, categoryFilter, riskFilter, searchTerm, sortConfig]);

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
    data.forEach((r) => {
      counts[r.riskLevel.level as keyof typeof counts]++;
    });
    return counts;
  }, [allData, categoryFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ranking de Risco</h1>
          <div className="flex items-center gap-1 mt-1">
            <p className="text-muted-foreground text-sm">Classificação de risco por produto baseada em variação e volatilidade</p>
            <Tooltip>
              <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-[300px]">
                <p className="text-xs">
                  <strong>Fórmula do Score de Risco:</strong><br/>
                  Score = |Var. 12m| x 0.5 + |Var. 90d| x 0.3 + Volatilidade x 0.2<br/><br/>
                  <strong>Alto Risco:</strong> Score &gt; 8 ou |Var. 12m| &gt; 10%<br/>
                  <strong>Moderado:</strong> Score &gt; 4 ou |Var. 12m| &gt; 5%<br/>
                  <strong>Baixo:</strong> Score ≤ 4
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="proteinas">Proteínas</SelectItem>
              <SelectItem value="hortifruti">Hortifrúti</SelectItem>
              <SelectItem value="graos_secos">Grãos e Secos</SelectItem>
              <SelectItem value="outros_insumos">Grãos e Secos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PR">Paraná</SelectItem>
              <SelectItem value="SC">Santa Catarina</SelectItem>
              <SelectItem value="RS">Rio Grande do Sul</SelectItem>
            </SelectContent>
          </Select>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {uniqueProductNames.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Risk Summary - Clickable tabs */}
      <div className="grid grid-cols-3 gap-4">
        <Card
          className={`border-l-4 border-l-red-500 cursor-pointer transition-all hover:shadow-md ${riskFilter === "alto" ? "ring-2 ring-red-400 shadow-md" : ""}`}
          onClick={() => setRiskFilter(riskFilter === "alto" ? "all" : "alto")}
        >
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Alto Risco</p>
                <p className="text-2xl font-bold text-red-600">{riskSummary.alto}</p>
                <p className="text-xs text-muted-foreground">{riskFilter === "alto" ? "Clique para ver todos" : "Clique para filtrar"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-l-4 border-l-[#EE7D00] cursor-pointer transition-all hover:shadow-md ${riskFilter === "moderado" ? "ring-2 ring-orange-400 shadow-md" : ""}`}
          onClick={() => setRiskFilter(riskFilter === "moderado" ? "all" : "moderado")}
        >
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-[#EE7D00]" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Risco Moderado</p>
                <p className="text-2xl font-bold text-[#EE7D00]">{riskSummary.moderado}</p>
                <p className="text-xs text-muted-foreground">{riskFilter === "moderado" ? "Clique para ver todos" : "Clique para filtrar"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-l-4 border-l-emerald-500 cursor-pointer transition-all hover:shadow-md ${riskFilter === "baixo" ? "ring-2 ring-emerald-400 shadow-md" : ""}`}
          onClick={() => setRiskFilter(riskFilter === "baixo" ? "all" : "baixo")}
        >
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Baixo Risco</p>
                <p className="text-2xl font-bold text-emerald-600">{riskSummary.baixo}</p>
                <p className="text-xs text-muted-foreground">{riskFilter === "baixo" ? "Clique para ver todos" : "Clique para filtrar"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(riskFilter !== "all" || searchTerm) && (
        <div className="flex items-center gap-2 flex-wrap">
          {riskFilter !== "all" && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              {riskFilter.charAt(0).toUpperCase() + riskFilter.slice(1)} Risco
            </Badge>
          )}
          {searchTerm && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              Busca: "{searchTerm}"
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">({filteredData.length} itens)</span>
          <button
            onClick={() => {
              setRiskFilter("all");
              setSearchTerm("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Risk Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Detalhamento por Produto
            {riskFilter !== "all" && ` — ${riskFilter.charAt(0).toUpperCase() + riskFilter.slice(1)} Risco`}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Score = |Var. 12m| x 50% + |Var. 90d| x 30% + Volatilidade x 20%. Clique nos títulos das colunas para ordenar.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-[400px] w-full" /> : filteredData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Nenhum produto encontrado nesta categoria de risco.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th 
                      className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">
                        Produto {getSortIcon("name")}
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                    <th 
                      className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("currentPrice")}
                    >
                      <div className="flex items-center justify-end">
                        Preço Atual {getSortIcon("currentPrice")}
                      </div>
                    </th>
                    <th 
                      className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("variation12m")}
                    >
                      <div className="flex items-center justify-end">
                        Expectativa {getSortIcon("variation12m")}
                      </div>
                    </th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Var. 90d</th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Var. 30d</th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Volatilidade</th>
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
                        <td className="py-2.5 px-2 text-center">
                          <Badge variant="outline" className="text-xs">{r.state}</Badge>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-medium">
                          R$ {r.currentPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className={`font-medium ${r.variation12m > 0 ? "text-red-600" : r.variation12m < 0 ? "text-emerald-600" : "text-gray-500"}`}>
                            {r.variation12m > 0 ? "+" : ""}{r.variation12m.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className={`font-medium ${r.variation90d > 0 ? "text-red-600" : r.variation90d < 0 ? "text-emerald-600" : "text-gray-500"}`}>
                            {r.variation90d > 0 ? "+" : ""}{r.variation90d.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className={`font-medium ${r.variation30d > 0 ? "text-red-600" : r.variation30d < 0 ? "text-emerald-600" : "text-gray-500"}`}>
                            {r.variation30d > 0 ? "+" : ""}{r.variation30d.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-muted-foreground">
                          {r.volatility.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <Badge className={`gap-1 ${risk.bg} ${risk.border} border`} style={{ color: risk.color }} variant="outline">
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
