import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Search, X, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";

const categoryLabels: Record<string, string> = {
  proteinas: "Proteínas",
  hortifruti: "Hortifrúti",
  graos_secos: "Grãos e Secos",
  outros_insumos: "Outros Insumos",
  suprimentos: "Suprimentos",
};

function TrendIcon({ variation }: { variation: number }) {
  if (variation > 1) return (
    <Badge variant="outline" className="text-xs gap-1 bg-red-50 text-red-700 border-red-200">
      <TrendingUp className="h-3 w-3" />Alta
    </Badge>
  );
  if (variation < -1) return (
    <Badge variant="outline" className="text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
      <TrendingDown className="h-3 w-3" />Queda
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-xs gap-1 bg-gray-50 text-gray-700 border-gray-200">
      <Minus className="h-3 w-3" />Estável
    </Badge>
  );
}

function RiskBadge({ variation }: { variation: number }) {
  if (variation > 15) return (
    <Badge className="text-xs bg-red-100 text-red-800 border-red-300 gap-1">
      <AlertTriangle className="h-3 w-3" />Alto ({variation.toFixed(1)}%)
    </Badge>
  );
  if (variation > 7) return (
    <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">
      Médio ({variation.toFixed(1)}%)
    </Badge>
  );
  return (
    <Badge className="text-xs bg-emerald-100 text-emerald-800 border-emerald-300">
      Baixo ({variation.toFixed(1)}%)
    </Badge>
  );
}

export default function Produtos() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Usar endpoint consolidado: 1 linha por produto com preços RS/SC/PR
  const { data: consolidatedProducts, isLoading } = trpc.products.consolidated.useQuery();

  const filteredProducts = useMemo(() => {
    if (!consolidatedProducts) return [];
    return (consolidatedProducts as any[]).filter((p: any) => {
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
      const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [consolidatedProducts, categoryFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos Monitorados</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Preços por estado (RS, SC, PR) com variação entre regiões — Fonte: CEASA RS / SC / PR
          </p>
        </div>

        {/* Filtros */}
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
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              <SelectItem value="proteinas">Proteínas</SelectItem>
              <SelectItem value="hortifruti">Hortifrúti</SelectItem>
              <SelectItem value="graos_secos">Grãos e Secos</SelectItem>
              <SelectItem value="outros_insumos">Outros Insumos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de Produtos */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[200px] w-full" />)}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum produto encontrado com os filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map((product: any) => {
            const priceRS = Number(product.priceRS || 0);
            const priceSC = Number(product.priceSC || 0);
            const pricePR = Number(product.pricePR || 0);
            const avgPrice = Number(product.avgPrice || 0);
            const stateVariation = Number(product.stateVariation || 0);
            // variation30d = inflação temporal real (preço atual vs. mês anterior)
            const variation30d = product.variation30d != null ? Number(product.variation30d) : null;
            const variation12m = product.variation12m != null ? Number(product.variation12m) : null;

            // Fonte exata baseada nos estados disponíveis
            const availableStates = [
              priceRS > 0 ? 'RS' : null,
              priceSC > 0 ? 'SC' : null,
              pricePR > 0 ? 'PR' : null,
            ].filter(Boolean) as string[];
            const sourceLabel = availableStates.length === 1
              ? `CEASA ${availableStates[0]}`
              : availableStates.length === 2
                ? `Média CEASA ${availableStates.join(' + ')}`
                : 'Média CEASA RS + SC + PR';

            // Estado mais barato e mais caro
            const statePrices = [
              { state: 'RS', price: priceRS },
              { state: 'SC', price: priceSC },
              { state: 'PR', price: pricePR },
            ].filter(s => s.price > 0);
            const cheapest = statePrices.reduce((a, b) => a.price < b.price ? a : b, statePrices[0]);
            const mostExpensive = statePrices.reduce((a, b) => a.price > b.price ? a : b, statePrices[0]);

            return (
              <Card key={product.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold">{product.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {categoryLabels[product.category] || product.category}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {product.unit}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/70">
                          Variação entre estados:
                        </span>
                        <RiskBadge variation={stateVariation} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold">R$ {avgPrice.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Média RS/SC/PR</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">Fonte: {sourceLabel}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Tabela de preços por estado */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2 font-semibold text-muted-foreground text-xs uppercase">Estado</th>
                          <th className="text-right py-2 px-2 font-semibold text-muted-foreground text-xs uppercase">Preço Atual</th>
                          <th className="text-right py-2 px-2 font-semibold text-muted-foreground text-xs uppercase">Inflação 30d</th>
                          <th className="text-right py-2 px-2 font-semibold text-muted-foreground text-xs uppercase">Var. 12m</th>
                          <th className="text-center py-2 px-2 font-semibold text-muted-foreground text-xs uppercase">Tendência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { state: 'RS', price: priceRS, source: product.sourceRS || 'CEASA RS' },
                          { state: 'SC', price: priceSC, source: product.sourceSC || 'CEASA SC' },
                          { state: 'PR', price: pricePR, source: product.sourcePR || 'CEASA PR' },
                        ].filter(row => row.price > 0).map((row) => {
                          const isCheapest = cheapest?.state === row.state && statePrices.length > 1;
                          const isMostExpensive = mostExpensive?.state === row.state && statePrices.length > 1;
                          return (
                            <tr key={row.state} className={`border-b border-border/50 hover:bg-muted/30 ${isCheapest ? 'bg-emerald-50/30' : isMostExpensive ? 'bg-red-50/30' : ''}`}>
                              <td className="py-2.5 px-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium">{row.state}</span>
                                  {isCheapest && <Badge className="text-[10px] py-0 px-1 bg-emerald-100 text-emerald-700 border-emerald-200">Mais barato</Badge>}
                                  {isMostExpensive && <Badge className="text-[10px] py-0 px-1 bg-red-100 text-red-700 border-red-200">Mais caro</Badge>}
                                </div>
                                <div className="text-[10px] text-muted-foreground/70">{row.source}</div>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono font-semibold">
                                R$ {row.price.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono text-xs">
                                <span className={variation30d > 0 ? 'text-red-600' : variation30d < 0 ? 'text-emerald-600' : 'text-gray-500'}>
                                  {variation30d != null ? `${variation30d > 0 ? '+' : ''}${variation30d.toFixed(1)}%` : '—'}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono text-xs">
                                <span className={variation12m > 0 ? 'text-red-600' : variation12m < 0 ? 'text-emerald-600' : 'text-gray-500'}>
                                  {variation12m > 0 ? '+' : ''}{variation12m.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <TrendIcon variation={variation30d} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Linha de resumo */}
                      <tfoot>
                        <tr className="bg-muted/20 border-t-2 border-border">
                          <td className="py-2 px-2 font-semibold text-xs text-muted-foreground">MÉDIA</td>
                          <td className="py-2 px-2 text-right font-mono font-bold">R$ {avgPrice.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right text-xs text-muted-foreground">—</td>
                          <td className="py-2 px-2 text-right font-mono text-xs">
                            <span className={variation12m > 0 ? 'text-red-600' : variation12m < 0 ? 'text-emerald-600' : 'text-gray-500'}>
                              {variation12m > 0 ? '+' : ''}{variation12m.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <TrendIcon variation={variation30d} />
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Resumo de variação entre estados */}
                  {stateVariation > 0 && statePrices.length > 1 && (
                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Diferença entre estados: <strong className={stateVariation > 15 ? 'text-red-600' : stateVariation > 7 ? 'text-amber-600' : 'text-emerald-600'}>
                          {stateVariation.toFixed(1)}%
                        </strong>
                        {cheapest && mostExpensive && cheapest.state !== mostExpensive.state && (
                          <> — Mais barato em <strong>{cheapest.state}</strong> (R$ {cheapest.price.toFixed(2)}), mais caro em <strong>{mostExpensive.state}</strong> (R$ {mostExpensive.price.toFixed(2)})</>
                        )}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
