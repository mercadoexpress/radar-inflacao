import axios from "axios";
import * as cheerio from "cheerio";
import { getDb } from "./db";
import { priceHistory, products } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

// ========== UTILS ==========

function parseCepeaDate(dateStr: string): string {
  const parts = dateStr.trim().split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return dateStr;
}

function parseBrazilianNumber(str: string): number {
  if (!str || str.trim() === "-" || str.trim() === "***" || str.trim() === "s/ cotação") return 0;
  const cleaned = str.trim().replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ========== CEASA PR SCRAPER ==========
async function scrapeCeasaPR(): Promise<any[]> {
  try {
    const response = await axios.get("https://celepar7.pr.gov.br/ceasa/hoje.asp", {
      headers: { "User-Agent": USER_AGENT },
      timeout: 15000,
    });
    const $ = cheerio.load(response.data);
    const results: any[] = [];
    const dateText = $("b").first().text().match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
    const collectedAt = dateText ? parseCepeaDate(dateText) : new Date().toISOString().split("T")[0];

    $("table tr").each((_i: number, row: any) => {
      const cells = $(row).find("td");
      if (cells.length >= 6) {
        const name = $(cells[0]).text().trim();
        const priceCuritiba = parseBrazilianNumber($(cells[1]).text());
        const priceCascavel = parseBrazilianNumber($(cells[5]).text());
        const price = priceCuritiba || priceCascavel;
        if (price > 0) {
          results.push({ name, price, state: "PR", source: "CEASA/PR", collectedAt });
        }
      }
    });
    return results;
  } catch (e) {
    console.error("[Scraper] CEASA PR Error:", e);
    return [];
  }
}

// ========== NOTICIAS AGRICOLAS SCRAPER ==========
async function scrapeNoticiasAgricolas(): Promise<any[]> {
  try {
    const response = await axios.get("https://www.noticiasagricolas.com.br/cotacoes/", {
      headers: { "User-Agent": USER_AGENT },
      timeout: 15000,
    });
    const $ = cheerio.load(response.data);
    const results: any[] = [];
    const today = new Date().toISOString().split("T")[0];

    // Exemplo: Feijão Preto
    $(".cotacao-tabela").each((_i: number, table: any) => {
      const title = $(table).prevAll("h2").first().text();
      if (title.includes("Feijão Preto")) {
        $(table).find("tr").each((_j: number, row: any) => {
          const cells = $(row).find("td");
          if (cells.length >= 2) {
            const region = $(cells[0]).text().trim();
            const price = parseBrazilianNumber($(cells[1]).text());
            if (price > 0) {
              let state = "PR";
              if (region.includes("Catarinense")) state = "SC";
              if (region.includes("Rio-grandense")) state = "RS";
              results.push({ name: "Feijão Preto", price, state, source: "Notícias Agrícolas", collectedAt: today });
            }
          }
        });
      }
    });
    return results;
  } catch (e) {
    console.error("[Scraper] Notícias Agrícolas Error:", e);
    return [];
  }
}

// ========== CEASA RS (SIMULATED FOR NOW DUE TO GOOGLE DRIVE) ==========
async function scrapeCeasaRS(): Promise<any[]> {
  // CEASA RS uses Google Drive for daily PDFs/XLS, which is hard to scrape directly via axios.
  // We'll use a fallback or a simplified version if possible.
  return []; 
}

// ========== CEASA SC (SIMULATED FOR NOW) ==========
async function scrapeCeasaSC(): Promise<any[]> {
  return [];
}

// ========== MAIN SCRAPING FUNCTION ==========

export async function runDailyScraping(): Promise<{
  success: boolean;
  productsUpdated: number;
  pricesInserted: number;
  errors: string[];
  timestamp: string;
}> {
  const errors: string[] = [];
  let productsUpdated = 0;
  let pricesInserted = 0;

  const db = await getDb();
  if (!db) return { success: false, productsUpdated: 0, pricesInserted: 0, errors: ["DB Offline"], timestamp: new Date().toISOString() };

  const allProducts = await db.select().from(products).where(eq(products.active, 1));
  const productMap = new Map(allProducts.map(p => [p.name.toLowerCase(), p]));

  const scrapedData = [
    ...(await scrapeCeasaPR()),
    ...(await scrapeNoticiasAgricolas()),
  ];

  for (const item of scrapedData) {
    // Match product name (fuzzy)
    const product = Array.from(productMap.values()).find(p => 
      item.name.toLowerCase().includes(p.name.toLowerCase()) || 
      p.name.toLowerCase().includes(item.name.toLowerCase())
    );

    if (product) {
      try {
        const existing = await db.execute(sql`
          SELECT id FROM price_history 
          WHERE productId = ${product.id} AND state = ${item.state} AND collectedAt = ${item.collectedAt}
          LIMIT 1
        `);
        
        if (((existing as any)[0] || []).length === 0) {
          await db.insert(priceHistory).values({
            productId: product.id,
            state: item.state as any,
            source: item.source,
            price: item.price.toFixed(2),
            collectedAt: new Date(item.collectedAt),
          });
          pricesInserted++;
        }
        productsUpdated++;
      } catch (e) {
        errors.push(`Error inserting ${item.name}: ${e}`);
      }
    }
  }

  return {
    success: errors.length === 0,
    productsUpdated,
    pricesInserted,
    errors,
    timestamp: new Date().toISOString(),
  };
}

export async function getLastUpdateStatus() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.execute(sql`SELECT MAX(collectedAt) as lastUpdate FROM price_history`);
  return (result as any)[0][0];
}
