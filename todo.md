# Radar Inflação — TODO

- [x] Migrar drizzle/schema.ts com tabelas de produtos, preços, índices e alertas
- [x] Aplicar migrações SQL no banco de dados
- [x] Migrar server/db.ts com todas as funções de consulta
- [x] Migrar server/routers.ts com todos os procedimentos tRPC
- [x] Migrar server/scraper.ts
- [x] Migrar shared/types.ts
- [x] Migrar client/src/index.css com tema Express
- [x] Migrar client/src/App.tsx com roteamento completo
- [x] Migrar DashboardLayout.tsx
- [x] Migrar página Home.tsx
- [x] Migrar página Produtos.tsx
- [x] Migrar página Ranking.tsx
- [x] Migrar página Top10.tsx
- [x] Migrar página ComparativoRegional.tsx
- [x] Migrar página Indices.tsx
- [x] Migrar página Historico.tsx
- [x] Migrar página Previsoes.tsx
- [x] Migrar página Alertas.tsx
- [x] Migrar NotFound.tsx
- [x] Instalar dependências extras (cheerio, node-cron, axios)
- [x] Popular banco com dados iniciais via update-seed.mjs (27 produtos, 972 preços, 96 índices)
- [x] Corrigir erros de imports e compatibilidade (tipos TypeScript no scraper, collectedAt)
- [x] Executar testes vitest (10 testes passando)
- [x] Salvar checkpoint e publicar

## Correção de Preços — Fontes Reais CEASAs

- [x] Coletar preços reais CEASA RS (ceasa.rs.gov.br)
- [x] Coletar preços reais CEASA SC (ceasa.sc.gov.br)
- [x] Coletar preços reais CEASA PR (celepar7.pr.gov.br)
- [x] Coletar preços HF Brasil como validação
- [x] Reescrever scraper com lógica: média CEASAs, padronização unidades, descarte outliers
- [x] Atualizar update-seed.mjs com preços reais dos 26 produtos
- [x] Repopular banco com dados reais
- [x] Publicar versão atualizada

## Ajustes de Consistência e Análise Profissional

- [ ] Ajuste 1: Exibir fonte exata por estado (CEASA RS / SC / Média CEASA RS+SC)
- [ ] Ajuste 2: Corrigir contagem de produtos únicos (distinct por nome)
- [ ] Ajuste 3: Previsões com análise profissional via LLM + dados reais
- [ ] Ajuste 4: Filtros no Ranking de Risco (nível, estado, produto)
- [ ] Ajuste 5: Remover "Acumulado 12m" da SELIC
- [ ] Ajuste 6: Validar consistência de dados entre telas
- [ ] Commit e push no GitHub
- [ ] Novo deploy no Manus

## Correção de Erros HMR/Vite

- [x] Corrigir erro de sintaxe/import em Previsoes.tsx (trpc duplicado)
- [x] Corrigir erros em Ranking.tsx, Produtos.tsx, Indices.tsx, Home.tsx, Historico.tsx
- [x] Corrigir erro em index.css
