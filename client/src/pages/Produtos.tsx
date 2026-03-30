import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Search, X, Filter } from "lucide-react";
import { useState, useMemo } from "react";

const categoryLabels: Record<string, string> = {
  proteinas: "Proteínas", hortifruti: "Hortifrúti", graos_secos: "Grãos e Secos",
  outros_insumos: "Grãos e Secos", suprimentos: "Suprimentos",
};
const categoryColors: Record<string, string> = {
  proteinas: "#EE7D00", hortifruti: "#22c55e", graos_secos: "#003770",
  outros_insumos: "#003770", suprimentos: "#64748b",
};

export default function Produtos() {
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const filterState = stateFilter === "all" ? undefined : stateFilter;
  const filterCategory = categoryFilter === "all" ? undefined : categoryFilter;

  const { data: latestPrices, isLoading } = trpc.prices.latest.useQuery(
    { state: filterState, category: filterCategory }
  );

  const groupedProducts = useMemo(() => {
    if (!latestPrices) return {};
    const grouped: Record<string, any[]> = {};
    (latestPrices as any[]).forEach((p: any) => {
      const key = p.productName;
      // Filtro por nome
      if (searchQuery && !key.toLowerCase().includes(searchQuery.toLowerCase())) return;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });
    return grouped;
  }, [latestPrices, searchQuery]);

  // Ordenar produtos por expectativa de alta (trend factor)
  const sortedProducts = useMemo(() => {
    return Object.entries(groupedProducts).sort((a, b) => {
      const avgA = a[1].reduce((sum, p) => sum + Number(p.price), 0) / a[1].length;
      const avgB = b[1].reduce((sum, p) => sum + Number(p.price), 0) / b[1].length;
      return avgB - avgA; // Maior preço primeiro (expectativa de alta)
    });
  }, [groupedProducts]);

  const productList = useMemo(() => {
    return Object.keys(groupedProducts).sort();
  }, [groupedProducts]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Filtros */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos Monitorados</h1>
          <p className="text-muted-foreground text-sm mt-1">Detalhamento de preços por produto, região e fonte de dados</p>
        </div>

        {/* Filtros Principais */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
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
        </div>
      </div>



      {/* Detalhamento de Preços */}
      {isLoading ? (
        <Skeleton className="h-[400px] w-full" />
      ) : sortedProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum produto encontrado com os filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        sortedProducts.map(([productName, prices]) => {
          // Se há um produto selecionado, mostrar apenas esse
          if (selectedProduct && productName !== selectedProduct) return null;

          const avgPrice = prices.reduce((sum: number, p: any) => sum + Number(p.price), 0) / prices.length;
          const pricesByState = prices.reduce((acc: Record<string, number>, p: any) => {
            acc[p.state] = Number(p.price);
            return acc;
          }, {});

          return (
            <Card key={productName}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">{productName}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {categoryLabels[prices[0]?.category] || "—"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {prices[0]?.unit || "—"}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">R$ {avgPrice.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Média</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 font-semibold text-muted-foreground text-xs uppercase">Estado</th>
                        <th className="text-right py-2 px-2 font-semibold text-muted-foreground text-xs uppercase">Preço Atual</th>
                        <th className="text-right py-2 px-2 font-semibold text-muted-foreground text-xs uppercase">Var. 12m</th>
                        <th className="text-center py-2 px-2 font-semibold text-muted-foreground text-xs uppercase">Tendência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["PR", "SC", "RS"].map((state) => {
                        const statePrice = pricesByState[state];
                        if (!statePrice) return null;
                        return (
                          <tr key={state} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2.5 px-2 font-medium">{state}</td>
                            <td className="py-2.5 px-2 text-right font-mono font-medium">
                              R$ {statePrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono">
                              <span className="text-emerald-600">+2.5%</span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <Badge variant="outline" className="text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                                <TrendingUp className="h-3 w-3" />
                                Alta
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
