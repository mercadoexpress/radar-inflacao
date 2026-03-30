import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { runDailyScraping, getLastUpdateStatus } from "./scraper";

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
