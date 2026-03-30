import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Verificar preços por produto e estado (mais recente por estado)
const [rows] = await conn.execute(`
  SELECT p.name, ph.state, CAST(ph.price AS DECIMAL(10,2)) as price, ph.source
  FROM price_history ph
  JOIN products p ON p.id = ph.productId
  WHERE ph.collectedAt = (
    SELECT MAX(ph2.collectedAt) 
    FROM price_history ph2 
    WHERE ph2.productId = ph.productId AND ph2.state = ph.state
  )
  ORDER BY p.name, ph.state
`);

// Agrupar por produto
const byProduct = {};
for (const r of rows) {
  const name = r.name;
  if (!byProduct[name]) byProduct[name] = {};
  byProduct[name][r.state] = Number(r.price);
}

let equalCount = 0;
let diffCount = 0;
console.log('\n=== DIAGNÓSTICO DE PREÇOS POR ESTADO ===\n');
for (const [name, states] of Object.entries(byProduct)) {
  const prices = Object.values(states);
  const allEqual = prices.length > 1 && prices.every(p => p === prices[0]);
  const stateStr = Object.entries(states).map(([s, p]) => `${s}: R$${p.toFixed(2)}`).join(' | ');
  if (allEqual) {
    equalCount++;
    console.log(`❌ IGUAL: ${name} → ${stateStr}`);
  } else {
    diffCount++;
    // Calcular variação
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const variation = ((max - min) / min * 100).toFixed(1);
    console.log(`✅ DIFF: ${name} → ${stateStr} (var: ${variation}%)`);
  }
}
console.log(`\nTotal iguais: ${equalCount} | Total diferentes: ${diffCount}`);
await conn.end();
