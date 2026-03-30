import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAuthContext(): { ctx: TrpcContext; clearedCookies: Array<{ name: string; options: Record<string, unknown> }> } {
  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Test User");
    expect(result?.email).toBe("test@example.com");
  });
});

describe("router structure", () => {
  it("has products router", () => {
    expect(appRouter._def.procedures["products.list"]).toBeDefined();
    expect(appRouter._def.procedures["products.byCategory"]).toBeDefined();
  });

  it("has prices router", () => {
    expect(appRouter._def.procedures["prices.latest"]).toBeDefined();
    expect(appRouter._def.procedures["prices.timeSeries"]).toBeDefined();
    expect(appRouter._def.procedures["prices.monthlyAverages"]).toBeDefined();
    expect(appRouter._def.procedures["prices.forecast"]).toBeDefined();
  });

  it("has dashboard router", () => {
    expect(appRouter._def.procedures["dashboard.summary"]).toBeDefined();
    expect(appRouter._def.procedures["dashboard.riskRanking"]).toBeDefined();
    expect(appRouter._def.procedures["dashboard.marketAnalysis"]).toBeDefined();
  });

  it("has indices router", () => {
    expect(appRouter._def.procedures["indices.list"]).toBeDefined();
    expect(appRouter._def.procedures["indices.latest"]).toBeDefined();
    expect(appRouter._def.procedures["indices.withAccumulated"]).toBeDefined();
  });

  it("has alerts router", () => {
    expect(appRouter._def.procedures["alerts.list"]).toBeDefined();
    expect(appRouter._def.procedures["alerts.create"]).toBeDefined();
    expect(appRouter._def.procedures["alerts.delete"]).toBeDefined();
    expect(appRouter._def.procedures["alerts.toggle"]).toBeDefined();
    expect(appRouter._def.procedures["alerts.triggered"]).toBeDefined();
  });

  it("has scraper router", () => {
    expect(appRouter._def.procedures["scraper.status"]).toBeDefined();
    expect(appRouter._def.procedures["scraper.runNow"]).toBeDefined();
  });
});
