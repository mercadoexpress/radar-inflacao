import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const indexLabels: Record<string, string> = {
  IPCA_ALIM: "IPCA Alimentação",
  IPCA: "IPCA Geral",
  IGPM: "IGP-M",
  FIPE_ALIM: "FIPE Alimentação",
  SELIC: "Taxa Selic",
};

const indexDescriptions: Record<string, string> = {
  IPCA_ALIM: "Índice Nacional de Preços ao Consumidor Amplo — grupo Alimentação e Bebidas (IBGE). Mede a inflação dos alimentos no Brasil.",
  IPCA: "Índice Nacional de Preços ao Consumidor Amplo — índice oficial de inflação do Brasil (IBGE).",
  IGPM: "Índice Geral de Preços do Mercado (FGV). Referência para reajustes contratuais, aluguéis e tarifas.",
  FIPE_ALIM: "Índice de Preços ao Consumidor FIPE — grupo Alimentação. Referência para a região metropolitana de São Paulo.",
  SELIC: "Taxa de juros básica da economia (Selic). Influencia diretamente os custos de produção e preços de alimentos.",
};

// Metas/referências para comparação (mensal)
const indexTargets: Record<string, { label: string; value: number; annualTarget: number }> = {
  IPCA_ALIM: { label: "Meta IPCA (3,0% a.a. ≈ 0,25%/mês)", value: 0.25, annualTarget: 3.0 },
  IPCA: { label: "Meta IPCA (3,0% a.a. ≈ 0,25%/mês)", value: 0.25, annualTarget: 3.0 },
  IGPM: { label: "Referência IGP-M (0,40%/mês)", value: 0.40, annualTarget: 4.8 },
  FIPE_ALIM: { label: "Referência FIPE Alim. (0,35%/mês)", value: 0.35, annualTarget: 4.2 },
  SELIC: { label: "Meta Selic (10,5% a.a.)", value: 0.875, annualTarget: 10.5 },
};

const indexColors: Record<string, string> = {
  IPCA_ALIM: "#003770",
  IPCA: "#1e40af",
  IGPM: "#EE7D00",
  FIPE_ALIM: "#8b5cf6",
  SELIC: "#d946ef",
};

const regionLabels: Record<string, string> = { PR: "Paraná", SC: "Santa Catarina", RS: "Rio Grande do Sul", Nacional: "Nacional" };

function StatusBadge({ value, reference }: { value: number; reference: number }) {
  // Comparação: se o valor mensal está acima, abaixo ou na métrica de referência
  // Tolerância de 15% para considerar "na métrica"
  const tolerance = Math.abs(reference) * 0.15;
  const diff = value - reference;
  if (Math.abs(diff) <= tolerance) return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-xs">Na métrica</Badge>;
  if (diff > 0) return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">Acima da métrica</Badge>;
  return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs">Abaixo da métrica</Badge>;
}

function AccumulatedStatusBadge({ acumulado, annualTarget }: { acumulado: number; annualTarget: number }) {
  // Compara o acumulado 12m com a meta anual
  const tolerance = annualTarget * 0.15;
  const diff = acumulado - annualTarget;
  if (Math.abs(diff) <= tolerance) return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-xs">Dentro da meta anual</Badge>;
  if (diff > 0) return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">Acima da meta anual</Badge>;
  return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs">Abaixo da meta anual</Badge>;
}

export default function Indices() {
  const [regionFilter, setRegionFilter] = useState<string>("all");

  const { data: allIndices, isLoading } = trpc.indices.withAccumulated.useQuery();

  // Processar dados por índice (excluindo FIPE Geral)
  const indexData = useMemo(() => {
    if (!allIndices) return {};
    const grouped: Record<string, any[]> = {};
    (allIndices as any[]).forEach((i: any) => {
      const key = i.indexName;
      if (key === "FIPE") return; // Excluir IPC-FIPE Geral
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ ...i, value: Number(i.value) });
    });
    return grouped;
  }, [allIndices]);

  // Calcular estatísticas por índice
  const indexStats = useMemo(() => {
    const stats: Record<string, any> = {};
    Object.entries(indexData).forEach(([name, data]) => {
      const nacional = data.filter((d: any) => d.region === "Nacional");
      const values = nacional.map((d: any) => d.value);
      const avg12m = values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0;
      const acumulado12m = values.reduce((a: number, b: number) => a + b, 0);
      const latest = values.length > 0 ? values[values.length - 1] : 0;
      const latestPeriod = nacional.length > 0 ? nacional[nacional.length - 1].period : "—";

      // Dados regionais (para IPCA_ALIM)
      const regionData: Record<string, any> = {};
      if (name === "IPCA_ALIM") {
        for (const region of ["PR", "SC", "RS"]) {
          const rData = data.filter((d: any) => d.region === region);
          const rValues = rData.map((d: any) => d.value);
          const rAvg = rValues.length > 0 ? rValues.reduce((a: number, b: number) => a + b, 0) / rValues.length : 0;
          const rAcum = rValues.reduce((a: number, b: number) => a + b, 0);
          const rLatest = rValues.length > 0 ? rValues[rValues.length - 1] : 0;
          regionData[region] = { avg12m: rAvg, acumulado12m: rAcum, latest: rLatest };
        }
      }

      stats[name] = {
        avg12m: Math.round(avg12m * 100) / 100,
        acumulado12m: Math.round(acumulado12m * 100) / 100,
        latest,
        latestPeriod,
        count: values.length,
        regionData,
      };
    });
    return stats;
  }, [indexData, regionFilter]);

  // Dados para gráficos de série temporal
  const timeSeriesData = useMemo(() => {
    const result: Record<string, any[]> = {};
    Object.entries(indexData).forEach(([name, data]) => {
      const grouped: Record<string, any> = {};
      data.forEach((d: any) => {
        if (!grouped[d.period]) grouped[d.period] = { period: d.period };
        grouped[d.period][d.region || "Nacional"] = d.value;
      });
      result[name] = Object.values(grouped).sort((a, b) => b.period.localeCompare(a.period));
    });
    return result;
  }, [indexData]);

  const displayOrder = ["IPCA_ALIM", "IGPM", "FIPE_ALIM", "SELIC"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Índices Econômicos</h1>
          <p className="text-muted-foreground text-sm mt-1">Painel macroeconômico com IPCA, IGP-M e FIPE — impacto no setor de alimentação corporativa</p>
        </div>
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Região" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="PR">Paraná</SelectItem>
            <SelectItem value="SC">Santa Catarina</SelectItem>
            <SelectItem value="RS">Rio Grande do Sul</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Index Summary Cards — 3 cards: IPCA Alimentação, IGP-M, FIPE Alimentação */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {displayOrder.map((idx) => {
          const stats = indexStats[idx];
          const target = indexTargets[idx];
          if (!stats) return null;
          return (
            <Card key={idx} className="border-l-4" style={{ borderLeftColor: indexColors[idx] }}>
              <CardContent className="pt-4 pb-3">
                {isLoading ? <Skeleton className="h-32 w-full" /> : (
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight">{indexLabels[idx]}</p>
                        <UITooltip>
                          <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent className="max-w-[250px]"><p className="text-xs">{indexDescriptions[idx]}</p></TooltipContent>
                        </UITooltip>
                      </div>
                    </div>
                    <p className="text-xl font-bold mt-1" style={{ color: indexColors[idx] }}>
                      {stats.latest.toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Mensal ({stats.latestPeriod})</p>
                    <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                      {idx !== "SELIC" && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Média 12m</span>
                          <span className="font-medium">{stats.avg12m.toFixed(2)}%</span>
                        </div>
                      )}
                      {idx !== "SELIC" && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Acumulado 12m</span>
                          <span className="font-medium">{stats.acumulado12m.toFixed(2)}%</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-1 mt-1">
                        {target && <StatusBadge value={stats.latest} reference={target.value} />}
                        {idx !== "SELIC" && target && <AccumulatedStatusBadge acumulado={stats.acumulado12m} annualTarget={target.annualTarget} />}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* IPCA Alimentação Regional */}
      {indexStats["IPCA_ALIM"]?.regionData && Object.keys(indexStats["IPCA_ALIM"].regionData).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">IPCA Alimentação — Comparativo Regional</CardTitle>
            <p className="text-xs text-muted-foreground">Variação mensal, média e acumulado 12 meses por estado do Sul</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase">Região</th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase">Mensal</th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase">Média 12m</th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase">Acumulado 12m</th>
                    <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs uppercase">Status Mensal</th>
                    <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs uppercase">Status Anual</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <td className="py-2.5 px-2 font-medium">Nacional</td>
                    <td className="py-2.5 px-2 text-right font-mono">{indexStats["IPCA_ALIM"].latest.toFixed(2)}%</td>
                    <td className="py-2.5 px-2 text-right font-mono">{indexStats["IPCA_ALIM"].avg12m.toFixed(2)}%</td>
                    <td className="py-2.5 px-2 text-right font-mono">{indexStats["IPCA_ALIM"].acumulado12m.toFixed(2)}%</td>
                    <td className="py-2.5 px-2 text-center"><StatusBadge value={indexStats["IPCA_ALIM"].latest} reference={indexTargets["IPCA_ALIM"].value} /></td>
                    <td className="py-2.5 px-2 text-center"><AccumulatedStatusBadge acumulado={indexStats["IPCA_ALIM"].acumulado12m} annualTarget={indexTargets["IPCA_ALIM"].annualTarget} /></td>
                  </tr>
                  {["PR", "SC", "RS"].map((region) => {
                    const rd = indexStats["IPCA_ALIM"].regionData[region];
                    if (!rd) return null;
                    return (
                      <tr key={region} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2.5 px-2 font-medium">{regionLabels[region]}</td>
                        <td className="py-2.5 px-2 text-right font-mono">{rd.latest.toFixed(2)}%</td>
                        <td className="py-2.5 px-2 text-right font-mono">{(Math.round(rd.avg12m * 100) / 100).toFixed(2)}%</td>
                        <td className="py-2.5 px-2 text-right font-mono">{(Math.round(rd.acumulado12m * 100) / 100).toFixed(2)}%</td>
                        <td className="py-2.5 px-2 text-center"><StatusBadge value={rd.latest} reference={indexTargets["IPCA_ALIM"].value} /></td>
                        <td className="py-2.5 px-2 text-center"><AccumulatedStatusBadge acumulado={rd.acumulado12m} annualTarget={indexTargets["IPCA_ALIM"].annualTarget} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Series Charts */}
      {displayOrder.map((idx) => {
        const data = timeSeriesData[idx] || [];
        if (data.length === 0) return null;
        const target = indexTargets[idx];
        const hasRegions = idx === "IPCA_ALIM";
        return (
          <Card key={idx}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Evolução Mensal — {indexLabels[idx]}</CardTitle>
              <p className="text-xs text-muted-foreground">{indexDescriptions[idx]}</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="period" fontSize={11} tickFormatter={(v) => { const [y, m] = v.split("-"); return `${m}/${y.slice(2)}`; }} />
                  <YAxis fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                    formatter={(value: any, name: string) => [`${Number(value).toFixed(2)}%`, name]}
                    labelFormatter={(v) => { const [y, m] = String(v).split("-"); return `${m}/${y}`; }}
                  />
                  <Legend />
                  {target && (
                    <ReferenceLine y={target.value} stroke="#94a3b8" strokeDasharray="6 3" label={{ value: target.label, position: "insideTopRight", fontSize: 10, fill: "#94a3b8" }} />
                  )}
                  <Line type="monotone" dataKey="Nacional" stroke={indexColors[idx]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  {hasRegions && (
                    <>
                      <Line type="monotone" dataKey="PR" stroke="#EE7D00" strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
                      <Line type="monotone" dataKey="SC" stroke="#22c55e" strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
                      <Line type="monotone" dataKey="RS" stroke="#8b5cf6" strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })}

      {/* Análise de Mercado Atualizada */}
      <Card className="border-2 border-orange-300 bg-orange-50/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold text-orange-900">📊 Análise de Mercado — Impacto nos Custos de Alimentos</CardTitle>
          <p className="text-xs text-orange-700 mt-1">Atualizado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* IPCA Alimentação */}
          <div className="border-l-4 border-blue-600 pl-4 py-2">
            <h3 className="font-semibold text-sm text-blue-900 mb-1">📈 IPCA Alimentação (Inflação do Consumidor)</h3>
            <p className="text-xs text-gray-700 mb-2">
              <strong>Impacto Direto:</strong> Mede a variação de preços que o consumidor final paga pelos alimentos. Quando o IPCA Alimentação está acima da meta (3% a.a.), indica pressão inflacionária nos preços de varejo.
            </p>
            <div className="bg-white rounded p-2 text-xs space-y-1">
              <p><strong>Valor Atual:</strong> <span className="font-mono text-blue-600">{indexStats["IPCA_ALIM"]?.latest.toFixed(2) || "—"}%</span> (mensal)</p>
              <p><strong>Acumulado 12m:</strong> <span className="font-mono text-blue-600">{indexStats["IPCA_ALIM"]?.acumulado12m.toFixed(2) || "—"}%</span></p>
              <p><strong>Influência:</strong> Afeta diretamente os custos de compra de alimentos para restaurantes, supermercados e consumidores. Aumentos acima de 5% a.a. indicam pressão significativa.</p>
            </div>
          </div>

          {/* IGP-M */}
          <div className="border-l-4 border-orange-500 pl-4 py-2">
            <h3 className="font-semibold text-sm text-orange-900 mb-1">📦 IGP-M (Índice Geral de Preços do Mercado)</h3>
            <p className="text-xs text-gray-700 mb-2">
              <strong>Impacto Indireto:</strong> Mede a inflação no atacado e é usado para reajustar contratos, aluguéis e tarifas. Afeta indiretamente o custo de produção e distribuição de alimentos.
            </p>
            <div className="bg-white rounded p-2 text-xs space-y-1">
              <p><strong>Valor Atual:</strong> <span className="font-mono text-orange-600">{indexStats["IGPM"]?.latest.toFixed(2) || "—"}%</span> (mensal)</p>
              <p><strong>Acumulado 12m:</strong> <span className="font-mono text-orange-600">{indexStats["IGPM"]?.acumulado12m.toFixed(2) || "—"}%</span></p>
              <p><strong>Influência:</strong> Aumentos no IGP-M elevam custos de armazenagem, transporte e aluguel de espaços. Isso se reflete nos preços finais dos alimentos em 30-60 dias.</p>
            </div>
          </div>

          {/* FIPE Alimentação */}
          <div className="border-l-4 border-purple-600 pl-4 py-2">
            <h3 className="font-semibold text-sm text-purple-900 mb-1">🍽️ FIPE Alimentação (Índice Regional SP)</h3>
            <p className="text-xs text-gray-700 mb-2">
              <strong>Impacto Regional:</strong> Referência para a região metropolitana de São Paulo. Importante para entender tendências de preços em centros urbanos de alta demanda.
            </p>
            <div className="bg-white rounded p-2 text-xs space-y-1">
              <p><strong>Valor Atual:</strong> <span className="font-mono text-purple-600">{indexStats["FIPE_ALIM"]?.latest.toFixed(2) || "—"}%</span> (mensal)</p>
              <p><strong>Acumulado 12m:</strong> <span className="font-mono text-purple-600">{indexStats["FIPE_ALIM"]?.acumulado12m.toFixed(2) || "—"}%</span></p>
              <p><strong>Influência:</strong> Indica tendências de preços em mercados premium. Aumentos no FIPE precedem aumentos no IPCA em 2-3 meses.</p>
            </div>
          </div>

          {/* Taxa Selic */}
          <div className="border-l-4 border-red-600 pl-4 py-2">
            <h3 className="font-semibold text-sm text-red-900 mb-1">💰 Taxa Selic (Juros Básicos)</h3>
            <p className="text-xs text-gray-700 mb-2">
              <strong>Impacto Financeiro:</strong> A taxa de juros básica influencia o custo de financiamento para produtores, distribuidoras e varejistas. Afeta indiretamente o preço final dos alimentos.
            </p>
            <div className="bg-white rounded p-2 text-xs space-y-1">
              <p><strong>Valor Atual:</strong> <span className="font-mono text-red-600">{indexStats["SELIC"]?.latest.toFixed(2) || "—"}%</span> (a.a.)</p>
              <p><strong>Influência:</strong> Selic acima de 10% a.a. aumenta custos de capital, levando a aumentos de 2-4% nos preços de alimentos em 60-90 dias.</p>
            </div>
          </div>

          {/* Síntese e Recomendações */}
          <div className="bg-gradient-to-r from-orange-100 to-orange-50 rounded-lg p-3 border border-orange-300">
            <h4 className="font-semibold text-sm text-orange-900 mb-2">🎯 Síntese e Recomendações</h4>
            <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
              <li><strong>Pressão Atual:</strong> {indexStats["IPCA_ALIM"]?.acumulado12m > 5 ? "Alta (>5% a.a.)" : indexStats["IPCA_ALIM"]?.acumulado12m > 3 ? "Moderada (3-5% a.a.)" : "Controlada (<3% a.a.)"}</li>
              <li><strong>Tendência:</strong> {indexStats["SELIC"]?.latest > 10 ? "Selic elevada → esperar aumentos de preços em 60-90 dias" : "Selic controlada → preços mais estáveis"}</li>
              <li><strong>Ação Recomendada:</strong> Monitorar IGPM e FIPE como indicadores antecedentes. Aumentos acima de 0.5% a.m. no IGPM indicam pressão futura no varejo.</li>
              <li><strong>Próxima Atualização:</strong> Dados atualizados diariamente com informações do IBGE, FGV e Banco Central.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
