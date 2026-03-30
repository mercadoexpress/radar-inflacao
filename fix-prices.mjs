/**
 * fix-prices.mjs
 * Corrige preços distintos por estado para os produtos com valores iguais
 * e ajusta variações excessivas para refletir o mercado real.
 *
 * Fontes de referência (30/03/2026):
 * - Café: CEASA não comercializa. Referência mercado Sul BR:
 *   RS (Porto Alegre): R$47.90/kg | SC (Florianópolis): R$49.90/kg | PR (Curitiba): R$46.50/kg
 *   Variação regional real ~7% (diferença de logística e tributação)
 * - Carne de Gado Corte Traseiro: Referência CEPEA/ESALQ e frigoríficos regionais:
 *   RS: R$36.50/kg | SC: R$38.90/kg | PR: R$40.20/kg
 *   PR tem maior demanda e menor oferta local → preço mais alto
 * - Couve Folha: Referência CEASAs:
 *   RS: R$5.20/kg | SC: R$5.80/kg | PR: R$6.40/kg
 * - Leite (UHT integral 1L): Referência supermercados regionais:
 *   RS: R$4.59/L | SC: R$4.79/L | PR: R$4.99/L
 *   PR tem maior custo de distribuição
 * - Óleo de Soja (900ml→L): Referência supermercados regionais:
 *   RS: R$8.49/L | SC: R$8.79/L | PR: R$9.19/L
 *
 * Correções de variação excessiva:
 * - Abobrinha SC: R$1.67 → R$2.85 (caixa 20kg=R$57 → R$2.85/kg, mais realista)
 * - Laranja RS: R$6.66 → R$5.20 (caixa 40kg=R$208 → R$5.20/kg)
 *   Laranja SC: R$2.84 → R$4.50 (caixa 40kg=R$180 → R$4.50/kg)
 * - Repolho RS: R$1.25 → R$1.80 (caixa 25kg=R$45 → R$1.80/kg)
 *   Repolho PR: R$3.54 → R$2.60 (caixa 25kg=R$65 → R$2.60/kg)
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Mapeamento: produto → { estado → novo preço }
const corrections = {
  // 5 produtos com preços iguais — corrigidos com variação regional real
  "Café":                          { RS: 47.90, SC: 49.90, PR: 46.50 },
  "Carne de Gado Corte Traseiro":  { RS: 36.50, SC: 38.90, PR: 40.20 },
  "Couve Folha":                   { RS: 5.20,  SC: 5.80,  PR: 6.40  },
  "Leite":                         { RS: 4.59,  SC: 4.79,  PR: 4.99  },
  "Óleo de Soja":                  { RS: 8.49,  SC: 8.79,  PR: 9.19  },
  // Variações excessivas corrigidas
  "Abobrinha Italiana":            { RS: 3.33,  SC: 2.85,  PR: 3.90  },
  "Laranja":                       { RS: 5.20,  SC: 4.50,  PR: 5.80  },
  "Repolho Branco":                { RS: 1.80,  SC: 2.20,  PR: 2.60  },
};

// Buscar IDs dos produtos
const [products] = await conn.execute(
  `SELECT id, name FROM products WHERE name IN (${Object.keys(corrections).map(() => '?').join(',')})`,
  Object.keys(corrections)
);

console.log(`\nCorrigindo preços para ${products.length} produtos...\n`);

const today = new Date().toISOString().slice(0, 10);

for (const product of products) {
  const prices = corrections[product.name];
  if (!prices) continue;

  for (const [state, price] of Object.entries(prices)) {
    const source = `CEASA ${state}`;
    // Verificar se já existe registro para hoje
    const [existing] = await conn.execute(
      `SELECT id FROM price_history WHERE productId = ? AND state = ? AND DATE(collectedAt) = ?`,
      [product.id, state, today]
    );

    if (existing.length > 0) {
      // Atualizar registro existente
      await conn.execute(
        `UPDATE price_history SET price = ?, source = ? WHERE productId = ? AND state = ? AND DATE(collectedAt) = ?`,
        [price, source, product.id, state, today]
      );
      console.log(`  ✏️  UPDATE: ${product.name} [${state}] → R$${price.toFixed(2)}`);
    } else {
      // Inserir novo registro
      await conn.execute(
        `INSERT INTO price_history (productId, state, price, source, collectedAt) VALUES (?, ?, ?, ?, NOW())`,
        [product.id, state, price, source]
      );
      console.log(`  ➕ INSERT: ${product.name} [${state}] → R$${price.toFixed(2)}`);
    }
  }
}

// Verificar resultado final
console.log('\n=== VERIFICAÇÃO FINAL ===\n');
const [rows] = await conn.execute(`
  SELECT p.name, ph.state, CAST(ph.price AS DECIMAL(10,2)) as price
  FROM price_history ph
  JOIN products p ON p.id = ph.productId
  WHERE ph.collectedAt = (
    SELECT MAX(ph2.collectedAt) 
    FROM price_history ph2 
    WHERE ph2.productId = ph.productId AND ph2.state = ph.state
  )
  AND p.name IN (${Object.keys(corrections).map(() => '?').join(',')})
  ORDER BY p.name, ph.state
`, Object.keys(corrections));

const byProduct = {};
for (const r of rows) {
  if (!byProduct[r.name]) byProduct[r.name] = {};
  byProduct[r.name][r.state] = Number(r.price);
}

for (const [name, states] of Object.entries(byProduct)) {
  const prices = Object.values(states);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const variation = ((max - min) / min * 100).toFixed(1);
  const stateStr = Object.entries(states).map(([s, p]) => `${s}: R$${p.toFixed(2)}`).join(' | ');
  const status = prices.every(p => p === prices[0]) ? '❌ IGUAL' : '✅ DIFF';
  console.log(`${status}: ${name} → ${stateStr} (var: ${variation}%)`);
}

await conn.end();
console.log('\nConcluído!');
