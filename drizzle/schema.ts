import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Produtos monitorados
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  category: mysqlEnum("category", ["proteinas", "hortifruti", "graos_secos", "outros_insumos", "suprimentos"]).notNull(),
  unit: varchar("unit", { length: 16 }).notNull(),
  priority: int("priority").default(0).notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;

// Preços históricos
export const priceHistory = mysqlTable("price_history", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  state: mysqlEnum("state", ["PR", "SC", "RS"]).notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  collectedAt: date("collectedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PriceHistory = typeof priceHistory.$inferSelect;

// Estrutura para recebimento de dados externos de preços agrícolas
export const externalPriceImports = mysqlTable("external_price_imports", {
  id: int("id").autoincrement().primaryKey(),
  productName: varchar("productName", { length: 128 }).notNull(),
  currentPrice: decimal("currentPrice", { precision: 10, scale: 2 }).notNull(),
  variation: decimal("variation", { precision: 8, scale: 2 }),
  source: varchar("source", { length: 64 }).notNull(),
  collectedAt: date("collectedAt").notNull(),
  status: mysqlEnum("status", ["pending", "processed", "error"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
});

export type ExternalPriceImport = typeof externalPriceImports.$inferSelect;
export type InsertExternalPriceImport = typeof externalPriceImports.$inferInsert;

// Índices econômicos
export const economicIndices = mysqlTable("economic_indices", {
  id: int("id").autoincrement().primaryKey(),
  indexName: varchar("indexName", { length: 32 }).notNull(),
  region: varchar("region", { length: 32 }),
  value: decimal("value", { precision: 8, scale: 4 }).notNull(),
  period: varchar("period", { length: 16 }).notNull(),
  referenceDate: date("referenceDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EconomicIndex = typeof economicIndices.$inferSelect;

// Alertas configuráveis pelo usuário
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productId: int("productId").notNull(),
  thresholdPercent: decimal("thresholdPercent", { precision: 5, scale: 2 }).notNull(),
  direction: mysqlEnum("direction", ["up", "down", "both"]).default("up").notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;

// Histórico de alertas disparados
export const alertHistory = mysqlTable("alert_history", {
  id: int("id").autoincrement().primaryKey(),
  alertId: int("alertId").notNull(),
  productId: int("productId").notNull(),
  state: varchar("state", { length: 4 }).notNull(),
  variationPercent: decimal("variationPercent", { precision: 8, scale: 2 }).notNull(),
  priceFrom: decimal("priceFrom", { precision: 10, scale: 2 }).notNull(),
  priceTo: decimal("priceTo", { precision: 10, scale: 2 }).notNull(),
  riskLevel: mysqlEnum("riskLevel", ["baixo", "moderado", "alto"]).default("moderado").notNull(),
  triggeredAt: timestamp("triggeredAt").defaultNow().notNull(),
});

export type AlertHistory = typeof alertHistory.$inferSelect;
