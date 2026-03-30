import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { runDailyScraping, getLastUpdateStatus } from "./scraper";
import { invokeLLM } from "./_core/llm";
import https from "https";
import http from "http";

// Cache simples em memória para análises LLM (evita chamadas repetidas)
const analysisCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

async function fetchUrlText(url: string): Promise<string> {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RadarInflacao/1.0)' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.setTimeout(8000, () => { req.destroy(); resolve(''); });
  });
}

function extractTextFromHtml(html: string, maxLen = 3000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

async function getMarketNewsContext(productName: string): Promise<string> {
  try {
    // Buscar notícias recentes sobre o produto
    const searchUrl = `https://www.noticiasagricolas.com.br/pesquisa?q=${encodeURIComponent(productName)}`;
    const html = await fetchUrlText(searchUrl);
    const text = extractTextFromHtml(html, 2000);
    return text || '';
  } catch {
    return '';
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  products: router({
    list: publicProcedure.query(async () => db.getAllProducts()),
    byCategory: publicProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => db.getProductsByCategory(input.category)),
    consolidated: publicProcedure.query(async () => db.getConsolidatedProducts()),
  }),
  prices: router({
    latest: publicProcedure
      .input(z.object({ state: z.string().optional(), category: z.string().optional() }).optional())
      .query(async ({ input }) => db.getLatestPrices(input?.state, input?.category)),
    timeSeries: publicProcedure
      .input(
        z.object({
          productId: z.number(),
          state: z.string().optional(),
          months: z.number().optional(),
        })
      )
      .query(async ({ input }) => db.getPriceTimeSeries(input.productId, input.state, input.months)),
    monthlyAverages: publicProcedure
      .input(z.object({ productId: z.number(), state: z.string().optional() }))
      .query(async ({ input }) => db.getMonthlyAverages(input.productId, input.state)),
    forecast: publicProcedure
      .input(z.object({ productId: z.number(), state: z.string().optional() }))
      .query(async ({ input }) => db.getPriceForecast(input.productId, input.state)),
    marketAnalysisLLM: publicProcedure
      .input(z.object({
        productName: z.string(),
        trend: z.string(),
        currentPrice: z.number(),
        variation30d: z.number(),
        variation90d: z.number(),
        variation12m: z.number(),
      }))
      .query(async ({ input }) => {
        const cacheKey = `${input.productName}:${input.trend}:${new Date().toISOString().slice(0, 10)}`;
        const cached = analysisCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          return cached.result;
        }
        // Buscar contexto de notícias recentes
        const newsContext = await getMarketNewsContext(input.productName);
        const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const prompt = `Você é um especialista em mercado de commodities e alimentos do Brasil, com foco no setor de alimentação corporativa e varejo do Sul do Brasil.

Data de hoje: ${today}
Produto: ${input.productName}
Tendência identificada: ${input.trend === 'alta' ? 'ALTA' : input.trend === 'queda' ? 'QUEDA' : 'ESTÁVEL'}
Preço atual (média CEASA RS/SC/PR): R$ ${input.currentPrice.toFixed(2)}
Variação 30 dias: ${input.variation30d > 0 ? '+' : ''}${input.variation30d.toFixed(2)}%
Variação 90 dias: ${input.variation90d > 0 ? '+' : ''}${input.variation90d.toFixed(2)}%
Variação 12 meses: ${input.variation12m > 0 ? '+' : ''}${input.variation12m.toFixed(2)}%

Contexto de notícias recentes (Noticias Agrícolas):
${newsContext || 'Sem notícias específicas disponíveis no momento.'}

Gere uma análise profissional em JSON com exatamente este formato:
{
  "text": "<parágrafo de 3-5 frases explicando a tendência, considerando: cenário internacional, cenário brasileiro, oferta e demanda, clima, exportações e logística. Seja específico para ${input.productName}>",
  "vantagens": ["<vantagem 1>", "<vantagem 2>", "<vantagem 3>", "<vantagem 4>"],
  "atencao": ["<ponto de atenção 1>", "<ponto de atenção 2>", "<ponto de atenção 3>", "<ponto de atenção 4>"]
}

Regras:
- Seja específico para ${input.productName}, não genérico
- Vantagens: oportunidades de negociação, hedge, contratos
- Atenção: riscos reais do mercado atual
- Use dados reais do mercado brasileiro de ${today}
- Responda APENAS o JSON, sem markdown`;
        try {
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: 'Você é um especialista em mercado de commodities agrícolas do Brasil. Responda sempre em JSON válido.' },
              { role: 'user', content: prompt },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'market_analysis',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                    vantagens: { type: 'array', items: { type: 'string' } },
                    atencao: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['text', 'vantagens', 'atencao'],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = (response as any)?.choices?.[0]?.message?.content || '{}';
          const result = typeof content === 'string' ? JSON.parse(content) : content;
          analysisCache.set(cacheKey, { result, timestamp: Date.now() });
          return result;
        } catch (err) {
          console.error('[LLM Analysis] Error:', err);
          // Fallback para análise estática em caso de erro
          return {
            text: `Tendência de ${input.trend} identificada para ${input.productName} com base nos dados das CEASAs RS/SC/PR. Variação de ${input.variation30d.toFixed(2)}% nos últimos 30 dias. Monitorar diariamente os boletins das CEASAs e notícias do setor agrícola.`,
            vantagens: ['Monitorar boletins diários das CEASAs RS, SC e PR', 'Contratos de médio prazo podem travar preços mais vantajosos', 'Diversificar fornecedores entre os três estados'],
            atencao: ['Acompanhar variações climáticas nas regiões produtoras', 'Verificar impacto do câmbio em produtos importados', 'Monitorar custos logísticos entre estados'],
          };
        }
      }),
  }),
  dashboard: router({
    summary: publicProcedure
      .input(z.object({ state: z.string().optional() }).optional())
      .query(async ({ input }) => db.getDashboardSummary(input?.state)),
    riskRanking: publicProcedure
      .input(z.object({ state: z.string().optional() }).optional())
      .query(async ({ input }) => db.getRiskRanking(input?.state)),
    marketAnalysis: publicProcedure
      .input(z.object({ state: z.string().optional() }).optional())
      .query(async ({ input }) => db.getMarketAnalysis(input?.state)),
  }),
  indices: router({
    list: publicProcedure
      .input(z.object({ region: z.string().optional() }).optional())
      .query(async ({ input }) => db.getEconomicIndices(input?.region)),
    latest: publicProcedure.query(async () => db.getLatestIndices()),
    withAccumulated: publicProcedure.query(async () => db.getIndicesWithAccumulated()),
  }),
  scraper: router({
    status: publicProcedure.query(async () => getLastUpdateStatus()),
    runNow: protectedProcedure.mutation(async () => {
      const result = await runDailyScraping();
      return result;
    }),
  }),
  alerts: router({
    list: protectedProcedure.query(async ({ ctx }) => db.getUserAlerts(ctx.user.id)),
    create: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          thresholdPercent: z.number().min(0.1).max(100),
          direction: z.enum(["up", "down", "both"]),
        })
      )
      .mutation(async ({ ctx, input }) =>
        db.createAlert(ctx.user.id, input.productId, input.thresholdPercent, input.direction)
      ),
    delete: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ ctx, input }) => db.deleteAlert(input.alertId, ctx.user.id)),
    toggle: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ ctx, input }) => db.toggleAlert(input.alertId, ctx.user.id)),
    triggered: protectedProcedure.query(async ({ ctx }) => db.getTriggeredAlerts(ctx.user.id)),
  }),
  externalPrices: router({
    import: protectedProcedure
      .input(
        z.array(
          z.object({
            productName: z.string(),
            currentPrice: z.number(),
            variation: z.number().optional(),
            source: z.string(),
            collectedAt: z.string(),
          })
        )
      )
      .mutation(async ({ input }) => {
        const data = input.map(item => ({
          ...item,
          currentPrice: item.currentPrice.toFixed(2),
          variation: item.variation?.toFixed(2),
          collectedAt: new Date(item.collectedAt),
          status: "pending" as const,
        }));
        return db.importExternalPrices(data);
      }),
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => db.getExternalPriceImports(input?.limit)),
  }),
});

export type AppRouter = typeof appRouter;
