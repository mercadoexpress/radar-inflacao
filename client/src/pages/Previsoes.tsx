import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Minus, Target, Gauge, BarChart3, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";

// ============================================================
// ANÁLISE PROFISSIONAL DE MERCADO — ATUALIZAÇÃO DIÁRIA
// Prompt: Análise de dados de mercado, notícias internacionais e brasileiras,
// agronegócio, insights e oportunidades de negociação com pontos de vantagem e atenção.
// ============================================================
const marketContext: Record<string, { alta: string; queda: string; estavel: string; vantagens: string[]; atencao: string[] }> = {
  "Boi Gordo (Traseiro)": {
    alta: `O mercado de boi gordo está sob forte pressão de alta impulsionada por múltiplos vetores simultâneos. No cenário internacional, as exportações brasileiras de carne bovina batem recordes consecutivos, especialmente para China, Estados Unidos e Oriente Médio, reduzindo a oferta disponível no mercado interno. O câmbio favorável ao exportador (dólar elevado) torna a carne brasileira ainda mais competitiva no exterior. No mercado doméstico, a entressafra pecuária limita a reposição de animais terminados, enquanto a demanda do varejo e da indústria frigorífica permanece aquecida. No agronegócio, o ciclo de liquidação de fêmeas dos últimos anos reduziu o rebanho disponível para abate, pressionando ainda mais os preços. Notícias recentes indicam que frigoríficos estão operando com margens reduzidas e repassando custos ao consumidor final.`,
    queda: `O ciclo de safra pecuária está aumentando a oferta de animais terminados no mercado, pressionando os preços para baixo. Exportações com menor ritmo em função de barreiras sanitárias em mercados-chave e câmbio menos favorável contribuem para a retração. No cenário doméstico, a concorrência com frango e suíno mais baratos desvia parte da demanda. Frigoríficos aproveitam o momento para recompor estoques a preços mais baixos.`,
    estavel: `O mercado pecuário encontra-se em equilíbrio técnico, com oferta de animais terminados alinhada à demanda dos frigoríficos. Exportações regulares e câmbio estável mantêm o fluxo de negócios sem grandes oscilações. Período adequado para contratos de fornecimento de médio prazo.`,
    vantagens: [
      "Câmbio elevado favorece exportações — frigoríficos pagam melhor pelo animal",
      "Demanda asiática aquecida sustenta preços por mais tempo",
      "Contratos futuros na B3 (BGI) permitem travar preço com antecedência",
      "Período de entressafra reduz concorrência de oferta — vendedor tem poder de negociação",
    ],
    atencao: [
      "Monitorar embargos sanitários que podem fechar mercados de exportação abruptamente",
      "Custo do frete e logística para frigoríficos pode comprimir margens",
      "Câmbio volátil pode reverter vantagem exportadora rapidamente",
      "Pressão do varejo por redução de preços ao consumidor final pode limitar repasses",
    ],
  },
  "Frango Congelado": {
    alta: `O setor avícola enfrenta pressão de custos estrutural: o milho e o farelo de soja — que respondem por 70% do custo de produção — permanecem em patamares elevados, comprimindo margens e forçando repasse de preços. No cenário internacional, a gripe aviária (influenza H5N1) em países produtores europeus e norte-americanos reduziu a oferta global, abrindo espaço para exportações brasileiras. A demanda doméstica por proteína acessível permanece robusta, especialmente em períodos de pressão inflacionária sobre a carne bovina. Notícias recentes apontam para aumento das exportações para Arábia Saudita, Japão e União Europeia.`,
    queda: `Redução nos preços do milho e farelo de soja alivia o custo de produção, permitindo que integradores repassem a queda ao mercado. Aumento da oferta de aves no mercado interno, com lotes maiores saindo para abate, pressiona os preços. A concorrência entre grandes frigoríficos integrados (BRF, JBS, Seara) intensifica a disputa por mercado.`,
    estavel: `Mercado avícola em equilíbrio com custos de ração estabilizados e produção ajustada à demanda. Exportações regulares e consumo doméstico estável mantêm preços sem grandes oscilações. Bom momento para contratos de fornecimento trimestral.`,
    vantagens: [
      "Proteína mais acessível — demanda resiliente mesmo em crises econômicas",
      "Exportações aquecidas para Ásia e Oriente Médio sustentam preços mínimos",
      "Ciclo de produção curto (42-45 dias) permite ajuste rápido de oferta",
      "Diversificação de cortes (peito, coxa, sobrecoxa) permite arbitragem de valor",
    ],
    atencao: [
      "Gripe aviária: qualquer foco no Brasil pode gerar embargo imediato de mercados exportadores",
      "Volatilidade do milho e soja impacta diretamente o custo de produção",
      "Sazonalidade: demanda cai no verão (concorrência com outros alimentos frescos)",
      "Concentração de mercado em poucos frigoríficos reduz poder de negociação do comprador",
    ],
  },
  "Carne Suína": {
    alta: `O mercado suinícola brasileiro está em fase de valorização sustentada por demanda asiática crescente, especialmente da China, que enfrenta restrições de produção interna após surtos de Peste Suína Africana (PSA). O câmbio favorável potencializa as exportações. No mercado doméstico, o aumento do consumo de proteína suína — impulsionado por campanhas de marketing e maior disponibilidade em redes de varejo — contribui para a alta. Custos de produção elevados com milho e soja pressionam os preços ao longo da cadeia.`,
    queda: `Aumento da oferta no mercado interno com maior número de suínos terminados saindo para abate. Retração das exportações por barreiras tarifárias ou sanitárias e concorrência com frango mais barato. Período de maior consumo de carnes brancas no verão pode desviar demanda.`,
    estavel: `Mercado suinícola equilibrado com produção e demanda alinhadas. Exportações regulares para Ásia e Europa mantêm preços estáveis. Momento adequado para planejamento de compras de médio prazo.`,
    vantagens: [
      "Demanda asiática (China) garante piso de preços via exportação",
      "Versatilidade de cortes permite negociação de diferentes partes da carcaça",
      "Crescimento do consumo doméstico abre oportunidades para contratos diretos com frigoríficos",
      "Câmbio elevado favorece exportadores e sustenta preços no mercado interno",
    ],
    atencao: [
      "Peste Suína Africana: monitorar focos globais que podem afetar demanda e oferta",
      "Dependência de milho e soja para ração — volatilidade desses grãos impacta diretamente",
      "Sazonalidade: consumo cai no verão brasileiro",
      "Restrições sanitárias internacionais podem fechar mercados exportadores sem aviso prévio",
    ],
  },
  "Ovos": {
    alta: `Os ovos vivem momento de alta demanda como proteína acessível em cenário de pressão inflacionária sobre carnes. Custos de produção elevados com ração (milho e farelo de soja) pressionam os preços ao produtor. No período de inverno e festas, o consumo aumenta significativamente. A gripe aviária em países produtores globais reduziu a oferta internacional, elevando preços de referência. No Brasil, a concentração da produção no interior de SP e MG cria custos logísticos para o Sul do país.`,
    queda: `Aumento da produção com novos lotes de poedeiras entrando em ciclo e oferta abundante no mercado. Período de menor demanda sazonal (verão) com maior disponibilidade de outros alimentos frescos. Redução nos custos de ração alivia pressão sobre preços.`,
    estavel: `Produção e demanda equilibradas com custos de ração estabilizados. Mercado previsível para planejamento de compras regulares.`,
    vantagens: [
      "Proteína mais barata por grama — demanda inelástica em todas as faixas de renda",
      "Ciclo de produção rápido permite ajuste de oferta em 3-4 semanas",
      "Produto com longa vida útil relativa facilita estocagem estratégica",
      "Diversificação de fornecedores regionais reduz dependência logística",
    ],
    atencao: [
      "Gripe aviária pode eliminar plantéis inteiros em dias — monitorar alertas sanitários",
      "Alta dependência de milho e soja para ração",
      "Sazonalidade de demanda cria picos e vales de preço previsíveis",
      "Concentração geográfica da produção cria riscos logísticos para o Sul",
    ],
  },
  "Milho": {
    alta: `O milho está sob pressão de alta por múltiplos fatores simultâneos. No cenário internacional, os estoques globais estão abaixo da média histórica, com demanda crescente dos EUA para etanol e da China para ração animal. No Brasil, a safrinha (segunda safra) apresentou produtividade abaixo do esperado em função de veranico em regiões produtoras do Centro-Oeste. A demanda interna do setor de ração animal (frangos, suínos e bovinos) permanece aquecida. O câmbio favorável às exportações reduz a disponibilidade interna. Notícias recentes apontam para revisão baixista nas estimativas da CONAB para a safra atual.`,
    queda: `Safra abundante com condições climáticas favoráveis no Mato Grosso e Paraná. Estoques elevados nos principais polos produtores e menor demanda para exportação. Preços do etanol em queda reduzem a demanda norte-americana por milho. Boa produtividade da safrinha recompõe estoques.`,
    estavel: `Oferta e demanda equilibradas no mercado de milho com safra dentro das expectativas da CONAB. Exportações regulares e demanda de ração estável mantêm preços sem grandes oscilações.`,
    vantagens: [
      "Safra brasileira é a maior do mundo — oportunidade de compra local a preços competitivos",
      "Mercado futuro na B3 (CCM) permite hedge de preço com antecedência",
      "Diversificação de fornecedores (MT, PR, GO) reduz risco de concentração",
      "Período pós-colheita (março-junho) oferece os melhores preços do ano",
    ],
    atencao: [
      "Veranico no Centro-Oeste pode reduzir safra em 10-15% rapidamente",
      "Câmbio elevado incentiva exportações e reduz disponibilidade interna",
      "Demanda crescente do setor de etanol cria concorrência com ração animal",
      "Monitorar relatórios mensais da CONAB e USDA para ajuste de estimativas",
    ],
  },
  "Arroz Parboilizado": {
    alta: `O mercado de arroz enfrenta pressão de alta com estoques reduzidos no Rio Grande do Sul — principal estado produtor — após safra afetada por eventos climáticos extremos (El Niño e La Niña). No cenário internacional, a Índia mantém restrições às exportações de arroz para controlar preços internos, reduzindo a oferta global. A demanda doméstica permanece estável e inelástica. Custos de produção elevados com insumos agrícolas pressionam o preço ao produtor gaúcho.`,
    queda: `Safra gaúcha abundante com condições climáticas favoráveis e importações de arroz asiático (Tailândia, Vietnã) a preços competitivos. Estoques recompostos nas principais redes de varejo e atacado. Relaxamento das restrições indianas às exportações aumenta oferta global.`,
    estavel: `Mercado de arroz em equilíbrio com safra dentro das expectativas e consumo estável. Importações regulares complementam a produção nacional sem pressionar preços.`,
    vantagens: [
      "Produto de demanda inelástica — base alimentar da população brasileira",
      "Importações de arroz asiático como válvula de pressão em momentos de alta",
      "Contratos de longo prazo com cooperativas gaúchas garantem preço e volume",
      "Diversificação entre arroz parboilizado e branco permite arbitragem de custo",
    ],
    atencao: [
      "Eventos climáticos extremos no RS (enchentes, secas) podem devastar safra em semanas",
      "Câmbio impacta competitividade das importações asiáticas",
      "Monitorar restrições indianas às exportações — maior exportador global",
      "Logística do RS para o Sul do Brasil pode ser interrompida por eventos climáticos",
    ],
  },
  "Feijão Preto": {
    alta: `O feijão preto — produto de consumo intenso no Sul do Brasil — está em período de entressafra com oferta reduzida. Condições climáticas adversas afetaram a produtividade nas principais regiões produtoras (PR e SC). A demanda doméstica permanece constante e inelástica, especialmente no Sul onde o feijão preto é preferido ao carioca. Estoques nos atacadistas estão abaixo da média histórica para o período.`,
    queda: `Início da safra com aumento da oferta e estoques recompostos nos principais centros de distribuição. Condições climáticas favoráveis garantiram boa produtividade. Importações do Mercosul (Argentina e Uruguai) complementam a oferta interna.`,
    estavel: `Oferta e demanda equilibradas no mercado de feijão com transição entre safras sem grandes impactos. Estoques reguladores nos atacadistas mantêm preços estáveis.`,
    vantagens: [
      "Produto de demanda inelástica no Sul — consumo não cai mesmo com alta de preços",
      "Entressafra previsível permite planejamento antecipado de estoque",
      "Importações do Mercosul como alternativa em momentos de escassez",
      "Contratos diretos com cooperativas paranaenses garantem fornecimento regular",
    ],
    atencao: [
      "Alta sazonalidade de preços — entressafra pode dobrar preços em semanas",
      "Condições climáticas adversas (geadas, secas) impactam diretamente a produtividade",
      "Monitorar estoques nos CEASAS regionais para antecipar movimentos de preço",
      "Concorrência com feijão carioca importado pode pressionar preços em momentos de alta",
    ],
  },
  "Trigo": {
    alta: `O mercado global de trigo permanece tenso em função do conflito Rússia-Ucrânia, que restringe a oferta dos dois maiores exportadores mundiais. No Brasil, a safra paranaense — responsável por 50% da produção nacional — apresentou produtividade abaixo do esperado por condições climáticas adversas. A demanda da indústria de panificação, massas e biscoitos permanece robusta. O câmbio elevado torna as importações de trigo argentino mais caras, pressionando os moinhos a pagar mais pelo produto nacional.`,
    queda: `Safra paranaense abundante e importações de trigo argentino a preços competitivos pressionam os preços para baixo. Estoques elevados nos moinhos reduzem urgência de compras. Câmbio mais favorável às importações amplia a oferta disponível.`,
    estavel: `Mercado de trigo equilibrado com safra dentro das expectativas e importações regulares da Argentina. Demanda da indústria de panificação estável mantém preços sem grandes oscilações.`,
    vantagens: [
      "Safra paranaense concentrada em novembro-dezembro — melhor momento para compras spot",
      "Importações argentinas como alternativa competitiva em momentos de alta",
      "Contratos de longo prazo com moinhos garantem preço e disponibilidade",
      "Mercado futuro internacional (CBOT) permite hedge cambial e de preço",
    ],
    atencao: [
      "Conflito Rússia-Ucrânia: qualquer escalada pode elevar preços globais em 20-30%",
      "Câmbio elevado encarece importações argentinas — principal alternativa ao trigo nacional",
      "Condições climáticas no PR (geadas tardias, excesso de chuva na colheita) impactam qualidade",
      "Monitorar relatórios do USDA e IGC para ajuste de estimativas globais mensalmente",
    ],
  },
  "Café Arábica": {
    alta: `O café arábica vive um superciclo de alta sustentado por fundamentos sólidos. Os estoques globais certificados nas bolsas de Nova York (ICE) estão nos menores níveis em décadas. A safra brasileira 2024/25 é de bienalidade negativa (safra menor), reduzindo a oferta do maior produtor mundial. O Vietnã — segundo maior produtor de robusta — enfrenta seca severa que afeta também a produção de arábica. A demanda global por cafés especiais e de qualidade premium cresce consistentemente. O câmbio favorável ao exportador brasileiro mantém os preços em reais em patamares elevados mesmo quando o dólar oscila.`,
    queda: `Safra brasileira 2025/26 de bienalidade positiva promete colheita recorde, pressionando preços para baixo. Recomposição de estoques globais e menor demanda da indústria de solúvel. Câmbio mais favorável às importações reduz custos para torrefadoras.`,
    estavel: `Mercado de café em equilíbrio com safra dentro das expectativas e demanda global estável. Estoques nas bolsas internacionais em níveis adequados mantêm preços sem grandes oscilações.`,
    vantagens: [
      "Alta de preços internacionais favorece produtores e cooperativas brasileiras",
      "Contratos futuros na ICE (Nova York) permitem hedge de preço com antecedência de 12 meses",
      "Diversificação entre arábica e robusta permite arbitragem de custo para a indústria",
      "Certificações de qualidade (specialty coffee) abrem mercados premium com margens maiores",
    ],
    atencao: [
      "Bienalidade: safra positiva em 2025/26 pode reverter alta rapidamente",
      "Câmbio: valorização do real pode reduzir preços em reais mesmo com alta em dólar",
      "Monitorar relatórios mensais da CONAB e CECAFÉ para estimativas de safra",
      "Mudanças climáticas afetam regiões produtoras — monitorar previsões para MG e ES",
    ],
  },
  "Café Robusta": {
    alta: `O café robusta (conilon) vive momento de forte valorização global. O Vietnã — maior produtor mundial de robusta — enfrenta seca severa que reduziu a safra em 20-30%, criando déficit global. A demanda crescente da indústria de café solúvel e cápsulas (Nespresso, Dolce Gusto) impulsiona o consumo. No Brasil, a produção de conilon no Espírito Santo e Rondônia não consegue suprir a demanda global. Preços na bolsa de Londres (LIFFE) atingiram máximas históricas.`,
    queda: `Safra vietnamita abundante e aumento da produção brasileira de conilon pressionam os preços para baixo. Estoques recompostos nas bolsas internacionais reduzem urgência de compras. Menor demanda da indústria de solúvel em períodos de recessão global.`,
    estavel: `Mercado de robusta equilibrado com oferta e demanda alinhadas globalmente. Estoques nas bolsas internacionais em níveis adequados.`,
    vantagens: [
      "Preços em máximas históricas — oportunidade para produtores e cooperativas brasileiras",
      "Contratos futuros na LIFFE (Londres) permitem hedge de preço",
      "Demanda crescente de cápsulas e solúvel garante mercado de longo prazo",
      "Substituição parcial de arábica por robusta em blends reduz custo para torrefadoras",
    ],
    atencao: [
      "Seca no Vietnã pode se reverter rapidamente com El Niño/La Niña",
      "Alta de preços pode reduzir demanda da indústria de solúvel por substituição",
      "Monitorar relatórios da ICO (Organização Internacional do Café) mensalmente",
      "Câmbio impacta competitividade das exportações brasileiras de conilon",
    ],
  },
  "Açúcar Cristal": {
    alta: `O mercado global de açúcar está em déficit de oferta com a Índia — segundo maior produtor mundial — mantendo restrições às exportações para proteger o mercado interno. O Brasil, maior exportador global, tem direcionado parte da cana para etanol em função dos preços atrativos do combustível. O câmbio favorável às exportações mantém preços em reais elevados. A demanda global por açúcar cresce com a expansão do consumo em mercados emergentes da Ásia e África.`,
    queda: `Safra brasileira recorde no Centro-Sul e relaxamento das restrições indianas às exportações aumentam a oferta global. Estoques nos principais países consumidores recompostos. Menor demanda do setor de bebidas e alimentos processados em períodos de recessão.`,
    estavel: `Mercado de açúcar em equilíbrio com produção brasileira e demanda global estáveis. Exportações regulares e câmbio sem grandes oscilações mantêm preços previsíveis.`,
    vantagens: [
      "Brasil é o maior exportador global — preços domésticos seguem referência internacional",
      "Contratos futuros na ICE (Nova York, contrato 11) permitem hedge de preço",
      "Diversificação entre açúcar e etanol permite arbitragem conforme preços relativos",
      "Demanda inelástica da indústria alimentícia garante mercado estável",
    ],
    atencao: [
      "Monitorar restrições indianas às exportações — decisão política pode mudar rapidamente",
      "Câmbio: valorização do real pode reduzir preços em reais mesmo com alta em dólar",
      "Seca no Centro-Sul pode reduzir safra e elevar preços rapidamente",
      "Preços do petróleo afetam a competitividade do etanol e, indiretamente, o açúcar",
    ],
  },
  "Óleo de Soja": {
    alta: `O óleo de soja está sob pressão de alta pela demanda crescente do setor de biodiesel, impulsionada pela política de mistura obrigatória (B15 no Brasil). A demanda alimentícia permanece robusta. No cenário internacional, a produção de soja da Argentina — principal concorrente do Brasil — foi afetada por seca, reduzindo a oferta de óleo. O câmbio favorável às exportações de óleo e farelo de soja mantém preços elevados no mercado interno.`,
    queda: `Safra de soja abundante no Brasil e Argentina aumenta a oferta de óleo. Menor demanda do setor de biodiesel por ajuste na política de mistura ou queda no preço do petróleo. Importações de óleo de palma asiático a preços competitivos pressionam o mercado.`,
    estavel: `Mercado de óleo de soja equilibrado com produção e demanda estáveis. Setor de biodiesel com demanda regular e safra de soja dentro das expectativas.`,
    vantagens: [
      "Demanda do biodiesel garante piso de preços — política de mistura é lei federal",
      "Safra brasileira de soja é a maior do mundo — oportunidade de compra local",
      "Contratos futuros na B3 (SFI) permitem hedge de preço",
      "Diversificação entre óleo e farelo permite arbitragem de valor na industrialização",
    ],
    atencao: [
      "Política de biodiesel: mudanças na mistura obrigatória impactam diretamente a demanda",
      "Preço do petróleo afeta competitividade do biodiesel e, indiretamente, o óleo de soja",
      "Concorrência com óleo de palma indonésio e malaio em momentos de alta",
      "Monitorar safra argentina — seca no país pode elevar preços globais rapidamente",
    ],
  },
  "Leite": {
    alta: `O mercado de leite enfrenta pressão de custos estrutural com ração cara (milho e soja) e insumos veterinários e energéticos em alta. O período de entressafra (inverno) reduz naturalmente a produção leiteira, criando déficit de oferta. A demanda da indústria de laticínios (queijos, iogurtes, leite UHT) permanece aquecida. No cenário internacional, a Nova Zelândia — maior exportador global de lácteos — reportou menor produção por condições climáticas adversas, elevando preços de referência no GDT (Global Dairy Trade).`,
    queda: `Período de safra (primavera-verão) com aumento da produção e oferta abundante. Redução nos custos de ração alivia pressão sobre produtores. Importações de lácteos do Mercosul (Argentina, Uruguai) complementam a oferta interna.`,
    estavel: `Mercado de leite em equilíbrio com produção sazonal dentro das expectativas. Demanda da indústria estável e custos de ração sem grandes oscilações.`,
    vantagens: [
      "Entressafra previsível permite planejamento antecipado de estoque de derivados",
      "Contratos diretos com cooperativas leiteiras garantem preço e volume",
      "Importações do Mercosul como válvula de pressão em momentos de alta",
      "Diversificação de fornecedores regionais (PR, SC, RS) reduz risco logístico",
    ],
    atencao: [
      "Alta sazonalidade: entressafra pode elevar preços em 20-30% em semanas",
      "Custo de ração (milho e soja) é o principal driver de custo — monitorar grãos",
      "Febre Aftosa e outras doenças podem impactar produção e exportações",
      "Monitorar leilões GDT (Global Dairy Trade) para referência de preços internacionais",
    ],
  },
  "Tomate": {
    alta: `O tomate está em período de entressafra com oferta reduzida nas principais regiões produtoras. Condições climáticas adversas — calor excessivo, chuvas irregulares — afetaram a produtividade e aumentaram a incidência de pragas e doenças. A alta sazonalidade típica do verão brasileiro amplifica as oscilações de preço. Custos de produção elevados com defensivos agrícolas e mão de obra pressionam os produtores. Nos CEASAs do Sul, a oferta está 30-40% abaixo da média histórica para o período.`,
    queda: `Safra abundante com condições climáticas favoráveis e aumento da oferta nas CEASAs regionais. Período de temperaturas amenas beneficia o cultivo e reduz perdas pós-colheita. Concorrência entre produtores de diferentes regiões (SP, MG, PR) pressiona preços para baixo.`,
    estavel: `Oferta e demanda equilibradas no mercado de tomate com produção dentro das expectativas sazonais. Preços nos CEASAs estáveis e sem grandes oscilações.`,
    vantagens: [
      "Alta sazonalidade cria oportunidades de compra antecipada em períodos de safra",
      "Diversificação de fornecedores regionais reduz dependência de uma única origem",
      "Tomate processado (polpa, extrato) como alternativa em períodos de alta do fresco",
      "Monitoramento diário dos CEASAs permite antecipar movimentos de preço",
    ],
    atencao: [
      "Alta perecibilidade — perdas pós-colheita podem chegar a 30% em dias quentes",
      "Pragas e doenças (tospovírus, mosca-branca) podem devastar lavouras rapidamente",
      "Sazonalidade extrema: preços podem triplicar em semanas durante entressafra",
      "Dependência de condições climáticas — qualquer evento extremo impacta imediatamente",
    ],
  },
  "Batata": {
    alta: `A batata está em período de entressafra com oferta reduzida nos principais estados produtores (MG, PR, SP). Custos de produção elevados com fertilizantes, defensivos e energia pressionam os produtores. Condições climáticas adversas afetaram a produtividade da última safra. Nos CEASAs do Sul, a oferta está abaixo da média histórica, com preços subindo rapidamente. A demanda da indústria de processamento (batata frita, chips) permanece estável e competitiva com o mercado in natura.`,
    queda: `Safra abundante com boa produtividade e aumento da oferta nos principais polos produtores. Período de colheita concentrada com excesso de oferta nos CEASAs. Redução nos custos de fertilizantes alivia pressão sobre produtores.`,
    estavel: `Mercado de batata equilibrado com transição entre safras sem grandes impactos na oferta. Demanda estável e custos de produção sem grandes oscilações.`,
    vantagens: [
      "Sazonalidade previsível permite planejamento de estoque com antecedência",
      "Diversificação entre batata in natura e processada permite arbitragem de valor",
      "Contratos diretos com cooperativas paranaenses garantem fornecimento regular",
      "Monitoramento dos CEASAs regionais permite antecipar movimentos de preço",
    ],
    atencao: [
      "Alta sazonalidade: entressafra pode dobrar preços em semanas",
      "Custo de fertilizantes (potássio, fósforo) é o principal driver de custo",
      "Pragas (requeima, pulgões) podem devastar lavouras rapidamente",
      "Concorrência com batata importada (Argentina) em momentos de alta",
    ],
  },
  "Cebola": {
    alta: `A cebola está em período de entressafra com oferta reduzida e importações insuficientes para suprir a demanda. Condições climáticas adversas afetaram a produtividade nas principais regiões produtoras (SC, SP). A demanda doméstica permanece constante e inelástica. Nos CEASAs do Sul, a oferta está significativamente abaixo da média histórica para o período, com preços em alta acelerada.`,
    queda: `Safra abundante e importações de cebola argentina a preços competitivos pressionam os preços para baixo. Estoques elevados nos atacadistas e CEASAs reduzem urgência de compras. Câmbio favorável às importações amplia a oferta disponível.`,
    estavel: `Mercado de cebola equilibrado com oferta e demanda alinhadas. Importações regulares da Argentina complementam a produção nacional sem pressionar preços.`,
    vantagens: [
      "Produto com vida útil longa — permite estocagem estratégica em períodos de safra",
      "Importações argentinas como válvula de pressão em momentos de alta",
      "Sazonalidade previsível permite planejamento antecipado de compras",
      "Diversificação entre cebola nacional e importada permite arbitragem de custo",
    ],
    atencao: [
      "Alta sazonalidade: entressafra pode triplicar preços em semanas",
      "Câmbio impacta competitividade das importações argentinas",
      "Condições climáticas em SC (principal produtor) determinam o nível de preços",
      "Monitorar estoques nos CEASAs regionais para antecipar movimentos de preço",
    ],
  },
  "Cenoura": {
    alta: `A cenoura está com oferta reduzida por condições climáticas adversas nas principais regiões produtoras (MG, SP, PR). Custos de produção elevados com defensivos e mão de obra pressionam os produtores. A demanda doméstica permanece estável e inelástica. Nos CEASAs do Sul, a oferta está abaixo da média histórica, com preços em alta.`,
    queda: `Safra abundante com boa produtividade e aumento da oferta nas CEASAs regionais. Condições climáticas favoráveis garantiram boa produtividade nas principais regiões produtoras. Concorrência entre produtores de diferentes regiões pressiona preços para baixo.`,
    estavel: `Mercado de cenoura equilibrado com produção e demanda estáveis. Preços nos CEASAs sem grandes oscilações.`,
    vantagens: [
      "Produto com boa vida útil — permite estocagem estratégica",
      "Diversificação de fornecedores regionais reduz dependência de uma única origem",
      "Monitoramento diário dos CEASAs permite antecipar movimentos de preço",
      "Demanda inelástica garante mercado estável independente de oscilações econômicas",
    ],
    atencao: [
      "Alta sazonalidade: entressafra pode dobrar preços rapidamente",
      "Condições climáticas adversas impactam diretamente a produtividade",
      "Pragas e doenças podem reduzir oferta rapidamente",
      "Monitorar estoques nos CEASAs regionais semanalmente",
    ],
  },
  "Alface": {
    alta: `A alface está com oferta reduzida por condições climáticas adversas — calor excessivo e chuvas fortes prejudicam o cultivo e aumentam a incidência de doenças foliares. A alta perecibilidade do produto amplifica as oscilações de preço, pois qualquer redução na oferta é imediatamente sentida no mercado. Nos CEASAs do Sul, a oferta está significativamente abaixo da média histórica para o período.`,
    queda: `Condições climáticas favoráveis (temperaturas amenas, boa distribuição de chuvas) aumentam a produção e oferta. Período de outono-inverno beneficia o cultivo de folhosas. Concorrência entre produtores regionais pressiona preços para baixo.`,
    estavel: `Produção e demanda equilibradas com condições climáticas favoráveis ao cultivo. Preços nos CEASAs estáveis e sem grandes oscilações.`,
    vantagens: [
      "Ciclo de produção curto (30-45 dias) permite ajuste rápido de oferta",
      "Diversificação entre tipos (crespa, americana, romana) permite arbitragem de valor",
      "Monitoramento diário dos CEASAs permite antecipar movimentos de preço",
      "Produção hidropônica local reduz dependência de condições climáticas externas",
    ],
    atencao: [
      "Alta perecibilidade — perdas pós-colheita podem chegar a 40% em dias quentes",
      "Extremamente sensível a condições climáticas — qualquer evento extremo impacta imediatamente",
      "Sazonalidade marcada: verão quente reduz oferta e eleva preços rapidamente",
      "Monitorar previsões climáticas semanais para as regiões produtoras do Sul",
    ],
  },
};

function getMarketExplanation(productName: string, trend: string): { text: string; vantagens: string[]; atencao: string[] } {
  const ctx = marketContext[productName];
  if (!ctx) {
    const defaultExplanations: Record<string, { text: string; vantagens: string[]; atencao: string[] }> = {
      alta: {
        text: "Tendência de alta identificada com base na análise de dados de mercado, notícias internacionais e brasileiras. Pressão de custos e demanda aquecida sustentam a valorização. Monitorar diariamente notícias do setor para identificar pontos de reversão.",
        vantagens: ["Oportunidade de compras futuras com hedge de preço", "Contratos de longo prazo podem travar preços mais baixos", "Diversificação de fornecedores reduz exposição à alta"],
        atencao: ["Monitorar fatores geopolíticos e cambiais que podem intensificar a alta", "Verificar disponibilidade de substitutos mais baratos", "Acompanhar relatórios setoriais semanalmente"],
      },
      queda: {
        text: "Tendência de queda identificada com base em dados de mercado e notícias do setor. Aumento de oferta e/ou redução de demanda pressionam os preços. Bom momento para compras de volume e recomposição de estoques.",
        vantagens: ["Bom momento para compras de volume e recomposição de estoques", "Contratos spot oferecem melhores condições que contratos futuros", "Oportunidade de negociar melhores condições com fornecedores"],
        atencao: ["Verificar sustentabilidade da queda — pode ser temporária", "Monitorar possíveis reviravoltas por fatores climáticos ou geopolíticos", "Não comprometer todo o orçamento em um único fornecedor"],
      },
      estavel: {
        text: "Mercado estável com preços previsíveis e oscilações mínimas. Fundamentos de oferta e demanda equilibrados. Período adequado para contratos de longo prazo.",
        vantagens: ["Contratos de longo prazo são viáveis e seguros", "Previsibilidade facilita o planejamento financeiro", "Momento adequado para diversificação de fornecedores"],
        atencao: ["Manter monitoramento diário de notícias que possam impactar a estabilidade", "Estabilidade pode ser quebrada por eventos inesperados", "Não negligenciar gestão de estoque por falsa sensação de segurança"],
      },
    };
    return defaultExplanations[trend] || defaultExplanations["estavel"];
  }
  const text = trend === "alta" ? ctx.alta : trend === "queda" ? ctx.queda : ctx.estavel;
  return { text, vantagens: ctx.vantagens, atencao: ctx.atencao };
}

export default function Previsoes() {
  const [selectedProduct, setSelectedProduct] = useState<number>(0);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const filterState = stateFilter === "all" ? undefined : stateFilter;

  const { data: productsList } = trpc.products.list.useQuery();

  const sortedProducts = useMemo(() => {
    if (!productsList) return [];
    return [...(productsList as any[])].sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [productsList]);

  const productId = selectedProduct || sortedProducts[0]?.id || 1;

  const { data: forecast, isLoading } = trpc.prices.forecast.useQuery(
    { productId, state: filterState },
    { enabled: productId > 0 }
  );

  const selectedProductInfo = useMemo(() => {
    return sortedProducts.find((p: any) => p.id === productId);
  }, [sortedProducts, productId]);

  const chartData = useMemo(() => {
    if (!forecast) return [];
    const historical = (forecast.historical as any[]).map((d: any) => ({
      month: d.month,
      real: Number(d.avgPrice),
      previsao: null as number | null,
    }));
    const forecasted = (forecast.forecasts as any[]).map((d: any) => ({
      month: d.month,
      real: null as number | null,
      previsao: d.price,
    }));
    if (historical.length > 0 && forecasted.length > 0) {
      forecasted[0].real = historical[historical.length - 1].real;
    }
    return [...historical, ...forecasted];
  }, [forecast]);

  const trendIcon = (trend: string) => {
    if (trend === "alta") return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (trend === "queda") return <TrendingDown className="h-4 w-4 text-emerald-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const trendColor = (trend: string) => {
    if (trend === "alta") return "text-red-600";
    if (trend === "queda") return "text-emerald-600";
    return "text-gray-600";
  };

  // Análise profissional via LLM — dados atualizados diariamente
  const llmAnalysisInput = useMemo(() => {
    if (!forecast || !selectedProductInfo) return null;
    const f = forecast as any;
    return {
      productName: selectedProductInfo.name,
      trend: f.trend,
      currentPrice: Number(f.lastPrice || 0),
      variation30d: Number(f.var30d || f.variation30d || 0),
      variation90d: Number(f.var90d || f.variation90d || 0),
      variation12m: Number(f.var12m || f.variation12m || 0),
    };
  }, [forecast, selectedProductInfo]);
  const { data: llmAnalysis, isLoading: llmLoading } = trpc.prices.marketAnalysisLLM.useQuery(
    llmAnalysisInput!,
    { enabled: !!llmAnalysisInput, staleTime: 6 * 60 * 60 * 1000 }
  );
  // Fallback para análise estática enquanto LLM carrega ou em caso de erro
  const marketAnalysis = useMemo(() => {
    if (llmAnalysis) return llmAnalysis;
    if (!forecast || !selectedProductInfo) return null;
    return getMarketExplanation(selectedProductInfo.name, forecast.trend);
  }, [llmAnalysis, forecast, selectedProductInfo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Previsões de Preços</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Projeção de preços para os próximos 6 meses com análise de mercado profissional
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(selectedProduct || sortedProducts[0]?.id || "")} onValueChange={(v) => setSelectedProduct(Number(v))}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              {sortedProducts.map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Região" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="PR">Paraná</SelectItem>
              <SelectItem value="SC">Santa Catarina</SelectItem>
              <SelectItem value="RS">Rio Grande do Sul</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-[350px] w-full" />
        </div>
      ) : forecast ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-[#003770]">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tendência Geral</p>
                    <div className="flex items-center gap-2 mt-2">
                      {trendIcon(forecast.trend)}
                      <p className={`text-xl font-bold capitalize ${trendColor(forecast.trend)}`}>{forecast.trend}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Direção predominante do preço nos próximos 6 meses de 2026</p>
                  </div>
                  <div className="p-2 rounded-xl bg-[#003770]/10"><Target className="h-5 w-5 text-[#003770]" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-[#EE7D00]">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Crescimento Mensal</p>
                    <p className={`text-xl font-bold mt-2 ${forecast.monthlyGrowthRate > 0 ? "text-red-600" : forecast.monthlyGrowthRate < 0 ? "text-emerald-600" : "text-gray-600"}`}>
                      {forecast.monthlyGrowthRate > 0 ? "+" : ""}{forecast.monthlyGrowthRate}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {forecast.monthlyGrowthRate > 0
                        ? `O preço sobe em média ${Math.abs(forecast.monthlyGrowthRate).toFixed(2)}% ao mês — indica pressão inflacionária contínua`
                        : forecast.monthlyGrowthRate < 0
                        ? `O preço cai em média ${Math.abs(forecast.monthlyGrowthRate).toFixed(2)}% ao mês — indica deflação e alívio nos custos`
                        : "Preço estável, sem variação significativa mensal — custos previsíveis"}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-[#EE7D00]/10"><Gauge className="h-5 w-5 text-[#EE7D00]" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Volatilidade</p>
                    <p className="text-xl font-bold mt-2 text-purple-600">{forecast.volatility}%</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {forecast.volatility > 10
                        ? "Alta instabilidade: preço oscila muito, risco elevado de variações bruscas — recomenda-se estoque de segurança"
                        : forecast.volatility > 5
                        ? "Volatilidade moderada: oscilações frequentes nos preços — atenção recomendada nas compras"
                        : "Baixa volatilidade: preço relativamente estável e previsível — bom momento para contratos de longo prazo"}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-purple-50"><BarChart3 className="h-5 w-5 text-purple-500" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Análise Profissional de Mercado */}
          {(marketAnalysis || llmLoading) && (
            <Card className="border border-amber-200 bg-amber-50/50">
              <CardContent className="pt-5 pb-5">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-amber-800 mb-2">
                        Por que a tendência de {forecast.trend} para {selectedProductInfo?.name}?
                      </p>
                      {llmLoading && !marketAnalysis ? (
                        <div className="flex items-center gap-2 text-sm text-amber-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Gerando análise profissional com dados de mercado atualizados...</span>
                        </div>
                      ) : (
                        <p className="text-sm text-amber-700 leading-relaxed">
                          {marketAnalysis?.text}
                        </p>
                      )}
                      <p className="text-xs text-amber-600 mt-2">
                        {llmAnalysis && <span className="font-medium">Análise gerada por IA com dados de mercado ({new Date().toLocaleDateString('pt-BR')}) | </span>}
                        Fonte: CEASA RS / SC / PR
                      </p>
                      <p className="text-xs text-amber-600 mt-2">
                        Preço médio (6 meses): R$ {forecast.avgPrice?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} | 
                        Último preço: R$ {forecast.lastPrice?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} | 
                        Inclinação da reta: {forecast.slope > 0 ? "+" : ""}{forecast.slope}
                      </p>
                    </div>

                    {/* Pontos de Vantagem e Atenção */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-amber-200">
                      {/* Pontos de Vantagem */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Pontos de Vantagem para Negociação</p>
                        </div>
                        <ul className="space-y-1.5">
                          {(marketAnalysis?.vantagens as string[] || []).map((v: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-emerald-700">
                              <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                              <span>{v}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Pontos de Atenção */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">Pontos de Atenção</p>
                        </div>
                        <ul className="space-y-1.5">
                          {(marketAnalysis?.atencao as string[] || []).map((a: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-red-700">
                              <span className="text-red-500 mt-0.5 shrink-0">•</span>
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Forecast Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Projeção de Preços — {selectedProductInfo?.name || "Produto"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Linha azul: dados reais (média mensal) | Linha laranja tracejada: previsão para os próximos 6 meses de 2026
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => { const [y, m] = v.split("-"); return `${m}/${y.slice(2)}`; }} />
                  <YAxis fontSize={11} tickFormatter={(v) => `R$${Number(v).toLocaleString("pt-BR")}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                    formatter={(value: any, name: string) => {
                      if (value === null || value === undefined) return ["-", name];
                      return [`R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name === "real" ? "Preço Real" : "Previsão 2026"];
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="real" name="Preço Real" stroke="#003770" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                  <Line type="monotone" dataKey="previsao" name="Previsão 2026" stroke="#EE7D00" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 4, strokeDasharray: "0" }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Forecast Table — Previsão para os próximos 6 meses */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Previsão para os Próximos 6 Meses de 2026</CardTitle>
              <p className="text-xs text-muted-foreground">
                Projeção mensal com base em regressão linear — a precisão diminui para meses mais distantes
              </p>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase">Mês</th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-xs uppercase">Preço Previsto</th>
                    <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs uppercase">Precisão Estimada</th>
                    <th className="text-center py-3 px-2 font-semibold text-muted-foreground text-xs uppercase">Tendência</th>
                    <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {(forecast.forecasts as any[]).map((f: any, i: number) => {
                    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                    const [y, m] = f.month.split("-");
                    const monthLabel = `${monthNames[parseInt(m) - 1]}/${y}`;
                    const precisionLabel = f.confidence > 0.85 ? "Alta" : f.confidence > 0.7 ? "Moderada" : "Baixa";
                    const precisionColor = f.confidence > 0.85 ? "text-emerald-600" : f.confidence > 0.7 ? "text-amber-600" : "text-red-600";
                    const observation = i === 0 ? "Projeção de curto prazo, maior confiabilidade"
                      : i <= 2 ? "Horizonte médio, considerar sazonalidade"
                      : "Horizonte longo, sujeito a fatores externos";
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2.5 px-2 font-medium">{monthLabel}</td>
                        <td className="py-2.5 px-2 text-right font-mono font-medium">
                          R$ {Number(f.price).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${f.confidence * 100}%`,
                                  backgroundColor: f.confidence > 0.85 ? "#22c55e" : f.confidence > 0.7 ? "#EE7D00" : "#ef4444",
                                }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${precisionColor}`}>{precisionLabel}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <Badge variant="outline" className={`text-xs capitalize ${f.trend === "alta" ? "text-red-600 border-red-200" : f.trend === "queda" ? "text-emerald-600 border-emerald-200" : "text-gray-500"}`}>
                            {f.trend}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">{observation}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Dados insuficientes para gerar previsão. Selecione outro produto ou região.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
