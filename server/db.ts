import { eq, and, desc, asc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  products,
  priceHistory,
  economicIndices,
  alerts,
  alertHistory,
  externalPriceImports,
  InsertExternalPriceImport,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ========== PRODUCTS ==========
export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(eq(products.active, 1)).orderBy(asc(products.name));
}

export async function getProductsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(products)
    .where(and(eq(products.active, 1), eq(products.category, category as any)))
    .orderBy(asc(products.name));
}

// ========== PRICE HISTORY ==========
export async function getLatestPrices(state?: string, category?: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT ph.id, ph.productId, p.name as productName, p.category, p.unit,
           ph.state, ph.source, ph.price, ph.collectedAt,
           (SELECT ph2.price FROM price_history ph2 
            WHERE ph2.productId = ph.productId AND ph2.state = ph.state 
            AND ph2.collectedAt < ph.collectedAt 
            ORDER BY ph2.collectedAt DESC LIMIT 1) as previousPrice
    FROM price_history ph
    JOIN products p ON p.id = ph.productId
    WHERE ph.collectedAt = (
      SELECT MAX(ph3.collectedAt) FROM price_history ph3 
      WHERE ph3.productId = ph.productId AND ph3.state = ph.state
    )
    ${state ? sql`AND ph.state = ${state}` : sql``}
    ${category ? sql`AND p.category = ${category}` : sql``}
    ORDER BY p.name, ph.state
  `);
  return (result as any)[0] || [];
}

export async function getPriceTimeSeries(productId: number, state?: string, months?: number) {
  const db = await getDb();
  if (!db) return [];
  const monthsBack = months || 12;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);
  const dateStr = startDate.toISOString().split("T")[0];
  const result = await db.execute(sql`
    SELECT ph.price, ph.collectedAt, ph.state, ph.source
    FROM price_history ph
    WHERE ph.productId = ${productId}
    AND ph.collectedAt >= ${dateStr}
    ${state ? sql`AND ph.state = ${state}` : sql``}
    ORDER BY ph.collectedAt ASC
  `);
  return (result as any)[0] || [];
}

export async function getMonthlyAverages(productId: number, state?: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT DATE_FORMAT(ph.collectedAt, '%Y-%m') as month,
           ph.state,
           ROUND(AVG(ph.price), 2) as avgPrice,
           ROUND(MIN(ph.price), 2) as minPrice,
           ROUND(MAX(ph.price), 2) as maxPrice,
           COUNT(*) as dataPoints
    FROM price_history ph
    WHERE ph.productId = ${productId}
    ${state ? sql`AND ph.state = ${state}` : sql``}
    GROUP BY month, ph.state
    ORDER BY month ASC, ph.state ASC
  `);
  return (result as any)[0] || [];
}

// ========== UNIFIED METRICS LOGIC ==========
// Variação temporal real: preço atual vs. preço do período anterior
// variation30d  = (preço_atual - preço_1_mês_atrás)  / preço_1_mês_atrás  * 100
// variation90d  = (preço_atual - preço_3_meses_atrás) / preço_3_meses_atrás * 100
// variation12m  = (preço_atual - preço_12_meses_atrás) / preço_12_meses_atrás * 100
// tendência: >+2% Alta | <-2% Queda | entre -2% e +2% Estável
const unifiedMetricsSql = (state?: string) => sql`
  SELECT p.id, p.name, p.category, p.unit,
         curr.price as currentPrice, curr.state, curr.collectedAt as lastUpdate, curr.source,
         prev1m.price as prev1mPrice,
         prev3m.price as prev3mPrice,
         prev12m.price as prev12mPrice,
         CASE 
           WHEN prev1m.price IS NOT NULL AND prev1m.price > 0
           THEN ROUND(((curr.price - prev1m.price) / prev1m.price) * 100, 2)
           ELSE NULL
         END as variation30d,
         CASE 
           WHEN prev3m.price IS NOT NULL AND prev3m.price > 0
           THEN ROUND(((curr.price - prev3m.price) / prev3m.price) * 100, 2)
           ELSE NULL
         END as variation90d,
         CASE 
           WHEN prev12m.price IS NOT NULL AND prev12m.price > 0
           THEN ROUND(((curr.price - prev12m.price) / prev12m.price) * 100, 2)
           ELSE NULL
         END as variation12m,
         CASE
           WHEN prev1m.price IS NOT NULL AND prev1m.price > 0
             AND ROUND(((curr.price - prev1m.price) / prev1m.price) * 100, 2) > 2
           THEN 'alta'
           WHEN prev1m.price IS NOT NULL AND prev1m.price > 0
             AND ROUND(((curr.price - prev1m.price) / prev1m.price) * 100, 2) < -2
           THEN 'queda'
           ELSE 'estavel'
         END as trend,
         ROUND(vol.stddev_price, 2) as volatility
  FROM products p
  JOIN (
    SELECT ph.productId, ph.state, ph.price, ph.collectedAt, ph.source
    FROM price_history ph
    INNER JOIN (
      SELECT productId, state, MAX(collectedAt) as maxDate
      FROM price_history GROUP BY productId, state
    ) mx ON ph.productId = mx.productId AND ph.state = mx.state AND ph.collectedAt = mx.maxDate
    ${state ? sql`WHERE ph.state = ${state}` : sql``}
  ) curr ON curr.productId = p.id
  LEFT JOIN (
    SELECT ph.productId, ph.state, ph.price
    FROM price_history ph
    INNER JOIN (
      SELECT productId, state, MAX(collectedAt) as maxDate
      FROM price_history
      WHERE collectedAt < DATE_SUB(CURDATE(), INTERVAL 20 DAY)
      GROUP BY productId, state
    ) mx ON ph.productId = mx.productId AND ph.state = mx.state AND ph.collectedAt = mx.maxDate
  ) prev1m ON prev1m.productId = p.id AND prev1m.state = curr.state
  LEFT JOIN (
    SELECT ph.productId, ph.state, ph.price
    FROM price_history ph
    INNER JOIN (
      SELECT productId, state, MAX(collectedAt) as maxDate
      FROM price_history
      WHERE collectedAt < DATE_SUB(CURDATE(), INTERVAL 75 DAY)
      GROUP BY productId, state
    ) mx ON ph.productId = mx.productId AND ph.state = mx.state AND ph.collectedAt = mx.maxDate
  ) prev3m ON prev3m.productId = p.id AND prev3m.state = curr.state
  LEFT JOIN (
    SELECT ph.productId, ph.state, ph.price
    FROM price_history ph
    INNER JOIN (
      SELECT productId, state, MAX(collectedAt) as maxDate
      FROM price_history
      WHERE collectedAt < DATE_SUB(CURDATE(), INTERVAL 335 DAY)
      GROUP BY productId, state
    ) mx ON ph.productId = mx.productId AND ph.state = mx.state AND ph.collectedAt = mx.maxDate
  ) prev12m ON prev12m.productId = p.id AND prev12m.state = curr.state
  LEFT JOIN (
    SELECT productId, state, ROUND(STDDEV(price), 2) as stddev_price
    FROM price_history WHERE collectedAt >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
    GROUP BY productId, state
  ) vol ON vol.productId = p.id AND vol.state = curr.state
  WHERE p.active = 1
`;

// ========== DASHBOARD SUMMARY ==========
export async function getDashboardSummary(state?: string) {
  const db = await getDb();
  if (!db) return { totalProducts: 0, avgVariation: 0, highRiskCount: 0, categories: [], productVariations: [] };
  const productResult = await db.execute(sql`${unifiedMetricsSql(state)} ORDER BY variation30d DESC`);
  const productVariations = (productResult as any)[0] || [];
  // Agrupar por produto único (distinct por nome) para evitar duplicação por estado
  const uniqueProductsMap: Record<string, any> = {};
  productVariations.forEach((p: any) => {
    if (!uniqueProductsMap[p.name]) {
      uniqueProductsMap[p.name] = { ...p };
    }
  });
  const uniqueProducts = Object.values(uniqueProductsMap);
  const categoriesMap: Record<string, any> = {};
  uniqueProducts.forEach((p: any) => {
    if (!categoriesMap[p.category]) {
      categoriesMap[p.category] = { category: p.category, productCount: 0, totalVariation: 0 };
    }
    categoriesMap[p.category].productCount++;
    categoriesMap[p.category].totalVariation += Number(p.variation30d || 0);
  });
  const categories = Object.values(categoriesMap).map((c: any) => ({
    category: c.category,
    productCount: c.productCount,
    avgVariation: Math.round((c.totalVariation / c.productCount) * 100) / 100,
  }));
  const totalProducts = uniqueProducts.length; // Conta produtos únicos, não por estado
  const allVariations = productVariations.map((p: any) => Number(p.variation30d || 0));
  const avgVariation =
    allVariations.length > 0 ? allVariations.reduce((a: number, b: number) => a + b, 0) / allVariations.length : 0;
  const highRiskCount = categories.filter((c: any) => Math.abs(Number(c.avgVariation || 0)) > 3).length;
  return {
    totalProducts,
    avgVariation: Math.round(avgVariation * 100) / 100,
    highRiskCount,
    categories,
    productVariations,
  };
}

// ========== CONSOLIDATED PRODUCTS (1 linha por produto com preços RS/SC/PR) ==========
export async function getConsolidatedProducts() {
  const db = await getDb();
  if (!db) return [];
  // Buscar preços mais recentes por produto e estado
  // Usa INNER JOIN com subquery de MAX para evitar subquery correlacionada (incompatível com TiDB)
  try {
    const result = await db.execute(sql`
      SELECT 
        p.id, p.name, p.category, p.unit,
        MAX(CASE WHEN lp.state = 'RS' THEN lp.price END) as priceRS,
        MAX(CASE WHEN lp.state = 'SC' THEN lp.price END) as priceSC,
        MAX(CASE WHEN lp.state = 'PR' THEN lp.price END) as pricePR,
        MAX(CASE WHEN lp.state = 'RS' THEN lp.source END) as sourceRS,
        MAX(CASE WHEN lp.state = 'SC' THEN lp.source END) as sourceSC,
        MAX(CASE WHEN lp.state = 'PR' THEN lp.source END) as sourcePR,
        ROUND(AVG(lp.price), 2) as avgPrice,
        MAX(lp.collectedAt) as lastUpdate,
        -- Variação entre estados (diferença regional de preços)
        CASE 
          WHEN MIN(lp.price) > 0 
          THEN ROUND(((MAX(lp.price) - MIN(lp.price)) / MIN(lp.price)) * 100, 2)
          ELSE 0
        END as stateVariation,
        -- Variação temporal real: preço atual vs. preço 1 mês atrás
        ROUND(AVG(
          CASE 
            WHEN prev1m.price IS NOT NULL AND prev1m.price > 0
            THEN ((lp.price - prev1m.price) / prev1m.price) * 100
            ELSE NULL
          END
        ), 2) as variation30d,
        -- Variação temporal 12 meses: preço atual vs. preço 12 meses atrás
        ROUND(AVG(
          CASE 
            WHEN prev12m.price IS NOT NULL AND prev12m.price > 0
            THEN ((lp.price - prev12m.price) / prev12m.price) * 100
            ELSE NULL
          END
        ), 2) as variation12m,
        -- Tendência baseada na inflação temporal
        CASE
          WHEN AVG(CASE WHEN prev1m.price > 0 THEN ((lp.price - prev1m.price) / prev1m.price) * 100 ELSE NULL END) > 2 THEN 'alta'
          WHEN AVG(CASE WHEN prev1m.price > 0 THEN ((lp.price - prev1m.price) / prev1m.price) * 100 ELSE NULL END) < -2 THEN 'queda'
          ELSE 'estavel'
        END as trend
      FROM products p
      JOIN (
        SELECT ph.productId, ph.state, ph.price, ph.source, ph.collectedAt
        FROM price_history ph
        INNER JOIN (
          SELECT productId, state, MAX(collectedAt) as maxDate
          FROM price_history
          GROUP BY productId, state
        ) latest ON ph.productId = latest.productId AND ph.state = latest.state AND ph.collectedAt = latest.maxDate
      ) lp ON lp.productId = p.id
      LEFT JOIN (
        SELECT ph.productId, ph.state, ph.price
        FROM price_history ph
        INNER JOIN (
          SELECT productId, state, MAX(collectedAt) as maxDate
          FROM price_history
          WHERE collectedAt < DATE_SUB(CURDATE(), INTERVAL 20 DAY)
          GROUP BY productId, state
        ) mx ON ph.productId = mx.productId AND ph.state = mx.state AND ph.collectedAt = mx.maxDate
      ) prev1m ON prev1m.productId = p.id AND prev1m.state = lp.state
      LEFT JOIN (
        SELECT ph.productId, ph.state, ph.price
        FROM price_history ph
        INNER JOIN (
          SELECT productId, state, MAX(collectedAt) as maxDate
          FROM price_history
          WHERE collectedAt < DATE_SUB(CURDATE(), INTERVAL 335 DAY)
          GROUP BY productId, state
        ) mx ON ph.productId = mx.productId AND ph.state = mx.state AND ph.collectedAt = mx.maxDate
      ) prev12m ON prev12m.productId = p.id AND prev12m.state = lp.state
      WHERE p.active = 1
      GROUP BY p.id, p.name, p.category, p.unit
      ORDER BY p.name ASC
    `);
    return (result as any)[0] || [];
  } catch (error: any) {
    console.error('[getConsolidatedProducts] MySQL error:', error?.message || error);
    throw error;
  }
}

// ========== RISK RANKING (1 entrada por produto, score consolidado com variação temporal) ==========
export async function getRiskRanking(state?: string) {
  const db = await getDb();
  if (!db) return [];

  // Retorna 1 entrada por produto com:
  // - variação temporal real (preço atual vs. preço 1 mês atrás)
  // - score de risco baseado em variação temporal + volatilidade
  // - nível: alto (>15%), medio (>7%), baixo
  try {
    const result = await db.execute(sql`
      SELECT 
        p.id, p.name, p.category, p.unit,
        ROUND(AVG(lp.price), 2) as currentPrice,
        'RS/SC/PR' as state,
        MAX(lp.collectedAt) as lastUpdate,
        CONCAT('Média CEASA ', CONCAT_WS(' + ',
          IF(MAX(CASE WHEN lp.state = 'PR' THEN 1 ELSE 0 END) = 1, 'PR', NULL),
          IF(MAX(CASE WHEN lp.state = 'RS' THEN 1 ELSE 0 END) = 1, 'RS', NULL),
          IF(MAX(CASE WHEN lp.state = 'SC' THEN 1 ELSE 0 END) = 1, 'SC', NULL)
        )) as source,
        ROUND(AVG(
          CASE 
            WHEN prev1m.price IS NOT NULL AND prev1m.price > 0
            THEN ((lp.price - prev1m.price) / prev1m.price) * 100
            ELSE NULL
          END
        ), 2) as variation30d,
        ROUND(AVG(
          CASE 
            WHEN prev12m.price IS NOT NULL AND prev12m.price > 0
            THEN ((lp.price - prev12m.price) / prev12m.price) * 100
            ELSE NULL
          END
        ), 2) as variation12m,
        ROUND(ABS(AVG(
          CASE 
            WHEN prev1m.price IS NOT NULL AND prev1m.price > 0
            THEN ((lp.price - prev1m.price) / prev1m.price) * 100
            ELSE 0
          END
        )), 2) as riskScore,
        CASE 
          WHEN ABS(AVG(
            CASE WHEN prev1m.price IS NOT NULL AND prev1m.price > 0
            THEN ((lp.price - prev1m.price) / prev1m.price) * 100 ELSE 0 END
          )) > 15 THEN 'alto'
          WHEN ABS(AVG(
            CASE WHEN prev1m.price IS NOT NULL AND prev1m.price > 0
            THEN ((lp.price - prev1m.price) / prev1m.price) * 100 ELSE 0 END
          )) > 7 THEN 'medio'
          ELSE 'baixo'
        END as riskLevel,
        CASE
          WHEN AVG(
            CASE WHEN prev1m.price IS NOT NULL AND prev1m.price > 0
            THEN ((lp.price - prev1m.price) / prev1m.price) * 100 ELSE NULL END
          ) > 2 THEN 'alta'
          WHEN AVG(
            CASE WHEN prev1m.price IS NOT NULL AND prev1m.price > 0
            THEN ((lp.price - prev1m.price) / prev1m.price) * 100 ELSE NULL END
          ) < -2 THEN 'queda'
          ELSE 'estavel'
        END as trend,
        MAX(CASE WHEN lp.state = 'RS' THEN lp.price END) as priceRS,
        MAX(CASE WHEN lp.state = 'SC' THEN lp.price END) as priceSC,
        MAX(CASE WHEN lp.state = 'PR' THEN lp.price END) as pricePR
      FROM products p
      JOIN (
        SELECT ph.productId, ph.state, ph.price, ph.collectedAt
        FROM price_history ph
        INNER JOIN (
          SELECT productId, state, MAX(collectedAt) as maxDate
          FROM price_history GROUP BY productId, state
        ) latest ON ph.productId = latest.productId AND ph.state = latest.state AND ph.collectedAt = latest.maxDate
        ${state ? sql`WHERE ph.state = ${state}` : sql``}
      ) lp ON lp.productId = p.id
      LEFT JOIN (
        SELECT ph.productId, ph.state, ph.price
        FROM price_history ph
        INNER JOIN (
          SELECT productId, state, MAX(collectedAt) as maxDate
          FROM price_history
          WHERE collectedAt < DATE_SUB(CURDATE(), INTERVAL 20 DAY)
          GROUP BY productId, state
        ) mx ON ph.productId = mx.productId AND ph.state = mx.state AND ph.collectedAt = mx.maxDate
      ) prev1m ON prev1m.productId = p.id AND prev1m.state = lp.state
      LEFT JOIN (
        SELECT ph.productId, ph.state, ph.price
        FROM price_history ph
        INNER JOIN (
          SELECT productId, state, MAX(collectedAt) as maxDate
          FROM price_history
          WHERE collectedAt < DATE_SUB(CURDATE(), INTERVAL 335 DAY)
          GROUP BY productId, state
        ) mx ON ph.productId = mx.productId AND ph.state = mx.state AND ph.collectedAt = mx.maxDate
      ) prev12m ON prev12m.productId = p.id AND prev12m.state = lp.state
      WHERE p.active = 1
      GROUP BY p.id, p.name, p.category, p.unit
      ORDER BY riskScore DESC
    `);
    return (result as any)[0] || [];
  } catch (error: any) {
    console.error('[getRiskRanking] MySQL error:', error?.message || error);
    throw error;
  }
}

// ========== MARKET ANALYSIS ==========
export async function getMarketAnalysis(state?: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`${unifiedMetricsSql(state)} ORDER BY p.name, curr.state`);
  return (result as any)[0] || [];
}

// ========== ECONOMIC INDICES ==========
export async function getEconomicIndices(region?: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT indexName, region, value, period, referenceDate
    FROM economic_indices
    ${region ? sql`WHERE region = ${region} OR region = 'Nacional'` : sql``}
    ORDER BY indexName, period ASC
  `);
  return (result as any)[0] || [];
}

export async function getLatestIndices() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT ei.indexName, ei.region, ei.value, ei.period, ei.referenceDate
    FROM economic_indices ei
    WHERE ei.referenceDate = (
      SELECT MAX(ei2.referenceDate) FROM economic_indices ei2 
      WHERE ei2.indexName = ei.indexName AND ei2.region = ei.region
    )
    ORDER BY ei.indexName, ei.region
  `);
  return (result as any)[0] || [];
}

export async function getIndicesWithAccumulated() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT indexName, region, value, period, referenceDate
    FROM economic_indices
    ORDER BY indexName, region, period ASC
  `);
  return (result as any)[0] || [];
}

// ========== ALERTS ==========
export async function getUserAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT a.*, p.name as productName, p.category, p.unit
    FROM alerts a JOIN products p ON p.id = a.productId
    WHERE a.userId = ${userId}
    ORDER BY a.createdAt DESC
  `);
  return (result as any)[0] || [];
}

export async function createAlert(
  userId: number,
  productId: number,
  thresholdPercent: number,
  direction: string
) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(alerts).values({
    userId,
    productId,
    thresholdPercent: thresholdPercent.toFixed(2),
    direction: direction as any,
    active: 1,
  });
}

export async function deleteAlert(alertId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(alerts).where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)));
  return true;
}

export async function toggleAlert(alertId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .limit(1);
  if (existing.length === 0) return false;
  const newActive = existing[0].active === 1 ? 0 : 1;
  await db.update(alerts).set({ active: newActive }).where(eq(alerts.id, alertId));
  return true;
}

export async function getTriggeredAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT ah.*, p.name as productName, p.category, p.unit
    FROM alert_history ah JOIN products p ON p.id = ah.productId
    JOIN alerts a ON a.id = ah.alertId
    WHERE a.userId = ${userId}
    ORDER BY ah.triggeredAt DESC LIMIT 50
  `);
  return (result as any)[0] || [];
}

// ========== PRICE FORECAST ==========
export async function getPriceForecast(productId: number, state?: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.execute(sql`
    SELECT DATE_FORMAT(collectedAt, '%Y-%m') as month,
           ROUND(AVG(price), 2) as avgPrice
    FROM price_history
    WHERE productId = ${productId}
    ${state ? sql`AND state = ${state}` : sql``}
    AND collectedAt >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY month ORDER BY month ASC
  `);
  const monthlyData = (result as any)[0] || [];
  if (monthlyData.length < 3) return null;

  const prices = monthlyData.map((d: any) => Number(d.avgPrice));
  const n = prices.length;
  const xMean = (n - 1) / 2;
  const yMean = prices.reduce((a: number, b: number) => a + b, 0) / n;
  let numerator = 0,
    denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (prices[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const monthlyGrowthRate = slope / yMean;
  const lastPrice = prices[prices.length - 1];
  const volatility = Math.sqrt(
    prices.reduce((sum: number, p: number) => sum + (p - yMean) ** 2, 0) / n
  );
  const volatilityPct = (volatility / yMean) * 100;

  const recentResult = await db.execute(sql`
    SELECT 
      (SELECT price FROM price_history WHERE productId = ${productId} ${state ? sql`AND state = ${state}` : sql``} ORDER BY collectedAt DESC LIMIT 1) as currentPrice,
      (SELECT AVG(price) FROM price_history WHERE productId = ${productId} ${state ? sql`AND state = ${state}` : sql``} AND collectedAt >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) as avg30d
  `);
  const recent = (recentResult as any)[0][0];
  const var30d =
    recent.avg30d > 0 ? ((recent.currentPrice - recent.avg30d) / recent.avg30d) * 100 : 0;

  let unifiedTrend = "estável";
  if (var30d > 0.5 && slope > 0.01) unifiedTrend = "alta";
  else if (var30d < -0.5 && slope < -0.01) unifiedTrend = "queda";
  else if (var30d > 1) unifiedTrend = "alta";
  else if (var30d < -1) unifiedTrend = "queda";

  const forecasts = [];
  for (let m = 1; m <= 6; m++) {
    const forecastPrice = lastPrice * (1 + monthlyGrowthRate * m);
    const confidence = Math.max(0.5, 1 - m * 0.08);
    const d = new Date();
    d.setMonth(d.getMonth() + m);
    forecasts.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      price: Math.round(forecastPrice * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      trend: unifiedTrend,
    });
  }

  return {
    historical: monthlyData,
    forecasts,
    trend: unifiedTrend,
    monthlyGrowthRate: Math.round(monthlyGrowthRate * 10000) / 100,
    volatility: Math.round(volatilityPct * 100) / 100,
    avgPrice: Math.round(yMean * 100) / 100,
    lastPrice,
    slope: Math.round(slope * 100) / 100,
    var30d: Math.round(var30d * 100) / 100,
  };
}

// ========== EXTERNAL PRICE IMPORTS ==========
export async function importExternalPrices(data: InsertExternalPriceImport[]) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(externalPriceImports).values(data);
}

export async function getExternalPriceImports(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(externalPriceImports)
    .orderBy(desc(externalPriceImports.createdAt))
    .limit(limit);
}
