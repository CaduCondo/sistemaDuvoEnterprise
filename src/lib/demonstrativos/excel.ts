/**
 * Exportação dos Demonstrativos para Excel (#128), com exceljs (o SheetJS
 * 0.18.5 do projeto não grava cores, bordas nem fontes). As outras
 * exportações do sistema continuam com o xlsx; esta é a única com exceljs.
 *
 * Organização das abas (padrão visual do Cadu):
 *   Premissas e Dados do sistema = únicas abas com números digitados (azul).
 *   Cálculos, DRE, Balanço, Fluxo de Caixa, Por Prédio, Resumo = só fórmulas
 *   (preto), e o que vem de outra aba em verde.
 * Os subtotais, o Balanço (saldo anterior + movimento), o Fluxo de Caixa, os
 * percentuais e as conferências são fórmulas vivas. A projeção e os impostos
 * chegam prontos na aba Dados (calculados pelo sistema com as premissas da
 * hora da exportação): para refazer, mude a premissa no sistema e exporte de novo.
 */
import ExcelJS from "exceljs";
import type { DadosDoMotor, Periodo, ResultadoDoLocal } from "./tipos";
import { consolidar, juntarPeriodos } from "./agregar";
import { anoDe, mesDe } from "./datas";
import { TIPOS_DE_DESPESA } from "./motor";
import { tiposDeDespesa } from "./linhas";

const C = {
  vinhoEscuro: "FF5E0B15", vinho: "FF7F252F", bege: "FFF1E8DB", begeEscuro: "FFD9CAB3", begeClaro: "FFF2ECE3",
  dourado: "FFBC8034", taupe: "FFA19386", texto: "FF222222", input: "FF0070C0", vinculo: "FF008000", branco: "FFFFFFFF",
  abaResumo: "FFA19485",
};
const FMT_R = '#,##0;(#,##0);"-"';
const FMT_PCT = '0.0%;(0.0%);"-"';
const FMT_DATA = "mmm-yy";
const PRIMEIRA_COL = 5; // E: os dados começam aqui (rótulos fixos em B..D)

const col = (n: number): string => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};
const preencher = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const fino = (argb = C.vinhoEscuro): Partial<ExcelJS.Border> => ({ style: "thin", color: { argb } });
const fonte = (o: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: "Aptos Narrow", size: 10, color: { argb: C.texto }, ...o });
const centro: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };
const q = (aba: string) => `'${aba}'`;

export interface ParametrosDoExcel {
  dados: DadosDoMotor;
  /** Locais do filtro (um só, ou todos do regime). */
  locais: ResultadoDoLocal[];
  visao: "mensal" | "anual";
  /** Períodos mostrados na tela (meses de um ano, ou anos). */
  periodos: Periodo[];
  nomeDoLocal: string;
  textoPeriodo: string;
  logoUrl?: string;
  logo?: ArrayBuffer | Buffer;
}

function preparar(ws: ExcelJS.Worksheet, zoom: number, corDaAba: string) {
  ws.views = [{ showGridLines: false, zoomScale: zoom, state: "frozen", xSplit: PRIMEIRA_COL - 1, ySplit: 0 }];
  ws.properties.tabColor = { argb: corDaAba };
  ws.properties.defaultRowHeight = 15.75;
  ws.getColumn(1).width = 3.4;
  ws.getColumn(2).width = 10.7;
  ws.getColumn(3).width = 39;
  ws.getColumn(4).width = 3;
}

/** Logo, "Local:"/"Período:", título da aba e a faixa vinho com o nome do bloco. */
function cabecalho(ws: ExcelJS.Worksheet, titulo: string, bloco: string, p: ParametrosDoExcel, largura: number, logoId?: number) {
  if (logoId != null) ws.addImage(logoId, { tl: { col: 1, row: 0 }, ext: { width: 120, height: 40 } });
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 18;
  const cDir = Math.max(PRIMEIRA_COL + 2, largura - 1);
  const rotulo = (linha: number, texto: string, valor: string) => {
    ws.getCell(linha, cDir).value = texto;
    ws.getCell(linha, cDir).font = fonte({ bold: true });
    ws.getCell(linha, cDir).alignment = { horizontal: "right" };
    ws.getCell(linha, cDir + 1).value = valor;
    ws.getCell(linha, cDir + 1).font = fonte();
  };
  rotulo(1, "Local:", p.nomeDoLocal);
  rotulo(2, "Período:", p.textoPeriodo);
  const t = ws.getCell(4, 2);
  t.value = titulo;
  t.font = { name: "Aptos Display", size: 16, bold: true, color: { argb: C.vinhoEscuro } };
  ws.getRow(4).height = 24;
  for (let c = 2; c <= Math.max(largura, cDir + 1); c++) ws.getCell(5, c).fill = preencher(C.vinhoEscuro);
  const f = ws.getCell(5, 2);
  f.value = bloco;
  f.font = fonte({ size: 11, bold: true, color: { argb: C.branco } });
  return 7; // primeira linha livre
}

function barraDeSecao(ws: ExcelJS.Worksheet, linha: number, largura: number) {
  ws.getRow(linha).height = 2.1;
  for (let c = 2; c <= largura; c++) ws.getCell(linha, c).fill = preencher(C.vinho);
}
function subtitulo(ws: ExcelJS.Worksheet, linha: number, texto: string) {
  const c = ws.getCell(linha, 2);
  c.value = texto;
  c.font = { name: "Aptos Display", size: 12, bold: true, color: { argb: C.dourado } };
}

/** Par rótulo (vinho, branco) + campo de input (tracejado taupe, azul). */
function parDePremissa(ws: ExcelJS.Worksheet, linha: number, colRotulo: number, rotulo: string, valor: number | string | Date, formato?: string) {
  const r = ws.getCell(linha, colRotulo);
  r.value = rotulo;
  r.fill = preencher(C.vinho);
  r.font = { name: "Aptos", size: 10, bold: true, color: { argb: C.branco } };
  const v = ws.getCell(linha, colRotulo + 1);
  v.value = valor as any;
  v.font = fonte({ size: 12, color: { argb: C.input } });
  v.fill = preencher(C.begeClaro);
  v.alignment = centro;
  v.border = { top: { style: "dashed", color: { argb: C.taupe } }, bottom: { style: "dashed", color: { argb: C.taupe } }, left: { style: "dashed", color: { argb: C.taupe } }, right: { style: "dashed", color: { argb: C.taupe } } };
  if (formato) v.numFmt = formato;
  return `$${col(colRotulo + 1)}$${linha}`;
}

type EstiloLinha = "grupo" | "detalhe" | "total";
function estilizarLinha(ws: ExcelJS.Worksheet, linha: number, ate: number, tipo: EstiloLinha) {
  for (let c = 2; c <= ate; c++) {
    const cel = ws.getCell(linha, c);
    if (tipo !== "detalhe") {
      cel.fill = preencher(C.bege);
      cel.border = { ...(cel.border || {}), top: fino(), bottom: fino() };
    }
    const cor = (cel.font?.color as any)?.argb;
    cel.font = fonte({ bold: tipo !== "detalhe", color: { argb: tipo !== "detalhe" && cor !== C.vinculo ? C.vinhoEscuro : cor || C.texto } });
  }
}

/** Gera a pasta de trabalho (sem baixar). Separado para poder testar. */
export async function gerarWorkbookDosDemonstrativos(p: ParametrosDoExcel): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema DUvo Enterprise";
  wb.created = new Date();
  const logoId = p.logo ? wb.addImage({ buffer: p.logo as any, extension: "png" }) : undefined;
  // Abas criadas já na ordem da barra (Resumo primeiro, como na tela).
  for (const nome of ["Resumo", "Premissas", "Dados do sistema", "Cálculos", "DRE", "Balanço", "Fluxo de Caixa", "Por Prédio"]) {
    wb.addWorksheet(nome);
  }
  const aba = (nome: string) => wb.getWorksheet(nome)!;

  const meses = consolidar(p.locais); // todos os meses do modelo, filtro aplicado
  const tiposDesp = tiposDeDespesa(meses);
  const n = meses.length;
  const fimCol = PRIMEIRA_COL + n - 1;
  const ultimaColDados = col(fimCol);
  const premissas = p.dados.premissas;

  // ------------------------------------------------------------ Premissas
  const wsP = aba("Premissas");
  preparar(wsP, 70, C.vinhoEscuro);
  for (const c of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) wsP.getColumn(c).width = 14;
  wsP.getColumn(3).width = 39;
  let lin = cabecalho(wsP, "Premissas", "Premissas gerais", p, 12, logoId);
  subtitulo(wsP, lin++, "Gerais");
  const [anoB, mesB] = (mesDe(premissas.base_date) ?? "2026-01").split("-").map(Number);
  const refMesBase = parDePremissa(wsP, lin, 3, "Mês de abertura do Balanço", new Date(Date.UTC(anoB, mesB - 1, 1)), FMT_DATA);
  parDePremissa(wsP, lin++, 6, "Vacância projetada", premissas.projected_vacancy_pct / 100, FMT_PCT);
  parDePremissa(wsP, lin, 3, "Caixa inicial da carteira (R$)", premissas.opening_cash, FMT_R);
  parDePremissa(wsP, lin++, 6, "Inadimplência projetada", premissas.projected_default_pct / 100, FMT_PCT);
  parDePremissa(wsP, lin, 3, "Repasse ao proprietário (% do caixa)", premissas.owner_distribution_pct / 100, FMT_PCT);
  parDePremissa(wsP, lin++, 6, "Anos de projeção", premissas.projection_years, "0");
  lin++;
  barraDeSecao(wsP, lin++, 14);
  subtitulo(wsP, lin++, "Índices por ano");
  const anos = [...new Set(meses.map((m) => anoDe(m.chave)))];
  const tabelaIndice = (titulo: string, valores: Record<string, number>) => {
    const cab = wsP.getCell(lin, 3);
    cab.value = titulo;
    cab.font = fonte({ bold: true, color: { argb: C.vinhoEscuro } });
    cab.fill = preencher(C.begeEscuro);
    anos.forEach((a, i) => {
      const c = wsP.getCell(lin, PRIMEIRA_COL + i);
      c.value = a;
      c.font = fonte({ bold: true, color: { argb: C.vinhoEscuro } });
      c.fill = preencher(C.begeEscuro);
      c.alignment = centro;
      c.border = { top: fino(C.taupe), bottom: fino(C.taupe), left: fino(C.taupe), right: fino(C.taupe) };
    });
    const la = lin + 1;
    const lm = lin + 2;
    parDePremissa(wsP, la, 3, "% a.a.", "");
    wsP.getCell(la, 4).value = null;
    wsP.getCell(la, 4).border = {};
    wsP.getCell(la, 4).fill = { type: "pattern", pattern: "none" };
    const rm = wsP.getCell(lm, 3);
    rm.value = "% a.m.";
    rm.fill = preencher(C.vinho);
    rm.font = { name: "Aptos", size: 10, bold: true, color: { argb: C.branco } };
    anos.forEach((a, i) => {
      const ref = `${col(PRIMEIRA_COL + i)}${la}`;
      const v = wsP.getCell(la, PRIMEIRA_COL + i);
      v.value = (Number(valores[String(a)] ?? 0) || 0) / 100;
      v.numFmt = FMT_PCT;
      v.font = fonte({ size: 12, color: { argb: C.input } });
      v.fill = preencher(C.begeClaro);
      v.alignment = centro;
      v.border = { top: { style: "dashed", color: { argb: C.taupe } }, bottom: { style: "dashed", color: { argb: C.taupe } }, left: { style: "dashed", color: { argb: C.taupe } }, right: { style: "dashed", color: { argb: C.taupe } } };
      const m = wsP.getCell(lm, PRIMEIRA_COL + i);
      m.value = { formula: `(1+${ref})^(1/12)-1` };
      m.numFmt = FMT_PCT;
      m.font = fonte();
      m.alignment = centro;
      m.border = { top: fino(C.taupe), bottom: fino(C.taupe), left: fino(C.taupe), right: fino(C.taupe) };
    });
    lin += 4;
  };
  tabelaIndice("Reajuste dos aluguéis", premissas.rent_index_by_year);
  tabelaIndice("Reajuste das despesas", premissas.expense_index_by_year);
  barraDeSecao(wsP, lin++, 14);
  subtitulo(wsP, lin++, "Impostos");
  const tp = premissas.tax_params;
  const pares: [string, number, string, string, number, string][] = [
    ["Presunção do lucro (holding)", tp.holding.presuncao_pct / 100, FMT_PCT, "CBS de referência", tp.ibs_cbs.cbs_referencia_pct / 100, FMT_PCT],
    ["IRPJ (holding)", tp.holding.irpj_pct / 100, FMT_PCT, "IBS de referência", tp.ibs_cbs.ibs_referencia_pct / 100, FMT_PCT],
    ["Adicional de IRPJ", tp.holding.irpj_adicional_pct / 100, FMT_PCT, "Redução da locação", tp.ibs_cbs.reducao_locacao_pct / 100, FMT_PCT],
    ["Limite do adicional (R$/mês)", tp.holding.irpj_adicional_limite_mensal, FMT_R, "Redutor social (R$/unid./mês)", tp.ibs_cbs.redutor_social_mensal_por_unidade, FMT_R],
    ["CSLL (holding)", tp.holding.csll_pct / 100, FMT_PCT, "PIS/COFINS até o ano", tp.ibs_cbs.pis_cofins_ate_ano, "0"],
    ["PIS + COFINS (holding)", (tp.holding.pis_pct + tp.holding.cofins_pct) / 100, '0.00%;(0.00%);"-"', "PF: desconto simplificado (R$/mês)", tp.pf.desconto_simplificado_mensal ?? 0, FMT_R],
    ["PF: isento até (R$/mês)", tp.pf.redutor_ate, FMT_R, "PF: redução parcial até (R$/mês)", tp.pf.redutor_faixa_ate, FMT_R],
  ];
  for (const [r1, v1, f1, r2, v2, f2] of pares) {
    parDePremissa(wsP, lin, 3, r1, v1, f1);
    parDePremissa(wsP, lin++, 6, r2, v2, f2);
  }
  lin++;
  barraDeSecao(wsP, lin++, 14);
  subtitulo(wsP, lin++, "Patrimônio de cada Local");
  const cabs = ["Local", "Proprietário", "Aquisição", "Terreno (R$)", "Edificação (R$)", "Vida útil (anos)"];
  cabs.forEach((t, i) => {
    const c = wsP.getCell(lin, 3 + (i === 0 ? 0 : i + 1));
    c.value = t;
    c.font = fonte({ bold: true, color: { argb: C.vinhoEscuro } });
    c.fill = preencher(C.bege);
    c.alignment = centro;
    c.border = { top: fino(), bottom: fino() };
  });
  lin++;
  for (const l of p.locais) {
    const pat = p.dados.patrimonios.find((x) => x.location_id === l.localId);
    wsP.getCell(lin, 3).value = l.nome;
    wsP.getCell(lin, 3).font = fonte({ bold: true });
    const valores: [any, string | undefined][] = [
      [l.regime === "holding" ? "Holding" : "Pessoa física", undefined],
      [pat?.acquisition_date ? new Date(`${pat.acquisition_date}T00:00:00Z`) : "", "dd/mm/yyyy"],
      [pat?.land_value ?? 0, FMT_R],
      [pat?.building_value ?? 0, FMT_R],
      [pat?.building_useful_life_years ?? 25, "0"],
    ];
    valores.forEach(([v, f], i) => {
      const c = wsP.getCell(lin, 5 + i);
      c.value = v;
      c.font = fonte({ size: 12, color: { argb: C.input } });
      c.alignment = centro;
      c.border = { bottom: fino(C.taupe) };
      if (f) c.numFmt = f;
    });
    lin++;
  }
  if (p.dados.financiamentos.length) {
    lin++;
    barraDeSecao(wsP, lin++, 14);
    subtitulo(wsP, lin++, "Financiamentos");
    for (const f of p.dados.financiamentos.filter((x) => p.locais.some((l) => l.localId === x.location_id))) {
      const nome = p.locais.find((l) => l.localId === f.location_id)?.nome || "";
      wsP.getCell(lin, 3).value = nome;
      [new Date(`${f.start_date}T00:00:00Z`), f.principal, f.annual_rate_pct / 100, f.term_months, f.amortization_system].forEach((v, i) => {
        const c = wsP.getCell(lin, 5 + i);
        c.value = v as any;
        c.font = fonte({ size: 12, color: { argb: C.input } });
        c.alignment = centro;
        c.numFmt = ["dd/mm/yyyy", FMT_R, FMT_PCT, "0", "@"][i];
      });
      lin++;
    }
  }

  // -------------------------------------------------- Dados do sistema
  const wsD = aba("Dados do sistema");
  preparar(wsD, 85, C.vinhoEscuro);
  for (let c = PRIMEIRA_COL; c <= fimCol; c++) wsD.getColumn(c).width = 14;
  lin = cabecalho(wsD, "Dados do sistema", "Valores mês a mês lidos do sistema (entrada do modelo)", p, Math.min(fimCol, 16), logoId);
  const linhaMesD = lin++;
  wsD.getCell(linhaMesD, 3).value = "Mês";
  meses.forEach((m, i) => {
    const c = wsD.getCell(linhaMesD, PRIMEIRA_COL + i);
    const [a, mm] = m.chave.split("-").map(Number);
    c.value = new Date(Date.UTC(a, mm - 1, 1));
    c.numFmt = FMT_DATA;
    c.font = fonte({ bold: true, color: { argb: C.vinhoEscuro } });
    c.fill = preencher(C.bege);
    c.alignment = centro;
  });
  const refD: Record<string, number> = {};
  const linhaDeDados = (chave: string, rotulo: string, valor: (m: Periodo) => number | string, formato = FMT_R) => {
    refD[chave] = lin;
    wsD.getCell(lin, 3).value = rotulo;
    wsD.getCell(lin, 3).font = fonte();
    meses.forEach((m, i) => {
      const c = wsD.getCell(lin, PRIMEIRA_COL + i);
      const v = valor(m);
      c.value = typeof v === "number" ? Math.round(v * 100) / 100 : v;
      c.numFmt = formato;
      c.font = fonte({ color: { argb: C.input } });
      c.alignment = centro;
    });
    lin++;
  };
  linhaDeDados("tipo", "Realizado (A) ou projetado (P)", (m) => m.tipo, "@");
  linhaDeDados("aluguel", "Aluguel", (m) => m.dre.receitaAluguel);
  linhaDeDados("garagem", "Garagem", (m) => m.dre.receitaGaragem);
  linhaDeDados("descontos", "Descontos concedidos", (m) => m.dre.descontos);
  linhaDeDados("impReceita", "Impostos sobre a receita", (m) => m.dre.impostosSobreReceita);
  linhaDeDados("taxaAdm", "Taxa de administração", (m) => m.dre.taxaAdministracao);
  linhaDeDados("taxaGer", "Taxa de gerenciamento", (m) => m.dre.taxaGerenciamento);
  for (const t of tiposDesp) linhaDeDados(`desp_${t}`, TIPOS_DE_DESPESA[t] || t, (m) => m.dre.despesasPorTipo[t] || 0);
  linhaDeDados("depreciacao", "Depreciação", (m) => m.dre.depreciacao);
  linhaDeDados("outras", "Outras receitas (multas, juros, rescisão)", (m) => m.dre.outrasReceitas);
  linhaDeDados("correcao", "Correção do caução devolvido", (m) => m.dre.correcaoCaucao);
  linhaDeDados("juros", "Juros de financiamento", (m) => m.dre.jurosFinanciamento);
  linhaDeDados("ir", "IR (carnê-leão / IRPJ + CSLL)", (m) => m.dre.impostoDeRenda);
  linhaDeDados("varAReceber", "Variação de aluguéis a receber (caixa)", (m) => m.dfc.variacaoAReceber);
  linhaDeDados("varAPagar", "Variação de despesas a pagar (caixa)", (m) => m.dfc.variacaoDespesasAPagar);
  linhaDeDados("varCaucoes", "Variação de cauções de inquilinos (caixa)", (m) => m.dfc.variacaoCaucoes);
  linhaDeDados("capex", "Investimentos e reformas (capex)", (m) => m.dfc.capex);
  linhaDeDados("captacoes", "Financiamentos recebidos", (m) => m.dfc.captacoes);
  linhaDeDados("amortizacoes", "Amortizações", (m) => m.dfc.amortizacoes);
  linhaDeDados("repasses", "Repasses ao proprietário", (m) => m.dfc.repasses);
  linhaDeDados("recebidoFin", "Receita Bruta (recebido) -- Financeiro", (m) => m.indicadores.recebidoFinanceiro);
  linhaDeDados("contasFin", "Contas do Mês -- Financeiro", (m) => m.indicadores.contasDoMesFinanceiro);
  linhaDeDados("unidades", "Unidades", (m) => m.indicadores.unidades, "0");
  linhaDeDados("ocupadas", "Unidades ocupadas", (m) => m.indicadores.unidadesOcupadas, "0.0");
  linhaDeDados("investimento", "Investimento (terreno + edificação + capex)", (m) => m.indicadores.investimentoTotal);
  lin++;
  // Saldos de abertura (fim do mês anterior ao primeiro mês do modelo).
  const p0 = meses[0];
  const abertura = (chave: string, rotulo: string, v: number) => {
    refD[chave] = lin;
    wsD.getCell(lin, 3).value = rotulo;
    wsD.getCell(lin, 3).font = fonte({ bold: true });
    const c = wsD.getCell(lin, PRIMEIRA_COL);
    c.value = Math.round(v * 100) / 100;
    c.numFmt = FMT_R;
    c.font = fonte({ color: { argb: C.input } });
    c.alignment = centro;
    lin++;
  };
  abertura("abCaixa", "Abertura: caixa", p0.dfc.caixaInicial);
  abertura("abAReceber", "Abertura: aluguéis a receber", p0.balanco.alugueisAReceber + p0.dfc.variacaoAReceber);
  abertura("abTerreno", "Abertura: terreno", p0.balanco.terreno);
  abertura("abEdificacao", "Abertura: edificação líquida", p0.balanco.edificacaoLiquida + p0.dfc.capex - p0.dre.depreciacao);
  abertura("abAPagar", "Abertura: despesas a pagar", p0.balanco.despesasAPagar - p0.dfc.variacaoDespesasAPagar);
  abertura("abCaucoes", "Abertura: cauções de inquilinos", p0.balanco.caucoesInquilinos - p0.dfc.variacaoCaucoes);
  abertura("abDivida", "Abertura: financiamentos", p0.balanco.financiamentos - p0.dfc.captacoes - p0.dfc.amortizacoes);
  abertura("capital", "Capital", p0.balanco.capital);
  // Bloco "Por Prédio": valores de cada Local no período escolhido.
  lin++;
  const linhaPredioD = lin;
  const mesesDoPeriodo = (lista: Periodo[]) => {
    const chaves = new Set<string>();
    for (const x of p.periodos) {
      if (x.chave.length === 4) lista.filter((m) => m.chave.startsWith(x.chave)).forEach((m) => chaves.add(m.chave));
      else chaves.add(x.chave);
    }
    return lista.filter((m) => chaves.has(m.chave));
  };
  ["Local", "Proprietário", "Receita bruta", "Receita líquida", "NOI", "Ocupação média", "Unidades", "Investimento", "Meses"].forEach((t, i) => {
    const c = wsD.getCell(lin, i === 0 ? 3 : PRIMEIRA_COL + i - 1);
    c.value = t;
    c.font = fonte({ bold: true, color: { argb: C.vinhoEscuro } });
    c.fill = preencher(C.bege);
    c.alignment = centro;
  });
  lin++;
  const predios = p.locais
    .map((l) => ({ l, lista: mesesDoPeriodo(l.meses) }))
    .filter((x) => x.lista.length)
    .map(({ l, lista }) => ({ l, j: juntarPeriodos(lista, "x") }))
    .filter(({ j }) => j.dre.receitaBruta !== 0 || j.balanco.totalAtivo !== 0);
  for (const { l, j } of predios) {
    wsD.getCell(lin, 3).value = l.nome;
    [l.regime === "holding" ? "Holding" : "Pessoa física", j.dre.receitaBruta, j.dre.receitaLiquida, j.dre.noi,
      j.indicadores.unidadesOcupadas, j.indicadores.unidades, j.indicadores.investimentoTotal, j.meses ?? 1].forEach((v, i) => {
      const c = wsD.getCell(lin, PRIMEIRA_COL + i);
      c.value = typeof v === "number" ? Math.round(v * 100) / 100 : v;
      c.numFmt = i === 4 ? "0.0" : i >= 5 ? "0" : FMT_R;
      if (i === 6) c.numFmt = FMT_R;
      c.font = fonte({ color: { argb: C.input } });
      c.alignment = centro;
    });
    lin++;
  }
  const ultimaLinhaPredioD = lin - 1;

  // ------------------------------------------------------------ Cálculos
  const wsC = aba("Cálculos");
  preparar(wsC, 85, C.dourado);
  for (let c = PRIMEIRA_COL; c <= fimCol; c++) wsC.getColumn(c).width = 14;
  lin = cabecalho(wsC, "Cálculos", "Linha do tempo", p, Math.min(fimCol, 16), logoId);
  const lIndice = lin++;
  const lData = lin++;
  const lAno = lin++;
  const lTipo = lin++;
  wsC.getCell(lIndice, 3).value = "Período";
  wsC.getCell(lData, 3).value = "Mês";
  wsC.getCell(lAno, 3).value = "Ano";
  wsC.getCell(lTipo, 3).value = "Realizado (A) / projetado (P)";
  const D = q("Dados do sistema");
  const P = q("Premissas");
  for (let i = 0; i < n; i++) {
    const cc = col(PRIMEIRA_COL + i);
    const ci = wsC.getCell(lIndice, PRIMEIRA_COL + i);
    ci.value = i === 0 ? { formula: "0" } : { formula: `${col(PRIMEIRA_COL + i - 1)}${lIndice}+1` };
    const cd = wsC.getCell(lData, PRIMEIRA_COL + i);
    cd.value = { formula: `EDATE(${P}!${refMesBase},${cc}${lIndice})` };
    cd.numFmt = FMT_DATA;
    cd.font = fonte({ color: { argb: C.vinculo } });
    wsC.getCell(lAno, PRIMEIRA_COL + i).value = { formula: `YEAR(${cc}${lData})` };
    wsC.getCell(lTipo, PRIMEIRA_COL + i).value = { formula: `${D}!${cc}${refD.tipo}` };
    wsC.getCell(lTipo, PRIMEIRA_COL + i).font = fonte({ color: { argb: C.vinculo } });
    for (const l of [lIndice, lData, lAno, lTipo]) wsC.getCell(l, PRIMEIRA_COL + i).alignment = centro;
  }
  estilizarLinha(wsC, lIndice, fimCol, "total");
  for (const l of [lData, lAno, lTipo]) wsC.getCell(l, 3).font = fonte();
  lin++;

  const refC: Record<string, number> = {};
  /** Linha de Cálculos: `f(cc, prev)` devolve a fórmula da coluna. */
  const linhaCalc = (chave: string, rotulo: string, tipo: EstiloLinha, f?: (cc: string, ant: string | null, i: number) => string, vinculo = false) => {
    refC[chave] = lin;
    wsC.getCell(lin, 3).value = rotulo;
    if (f) {
      for (let i = 0; i < n; i++) {
        const cc = col(PRIMEIRA_COL + i);
        const ant = i === 0 ? null : col(PRIMEIRA_COL + i - 1);
        const c = wsC.getCell(lin, PRIMEIRA_COL + i);
        c.value = { formula: f(cc, ant, i) };
        c.numFmt = FMT_R;
        c.alignment = centro;
        c.font = fonte({ color: { argb: vinculo ? C.vinculo : C.texto } });
      }
    }
    estilizarLinha(wsC, lin, fimCol, tipo);
    wsC.getCell(lin, PRIMEIRA_COL - 1).border = {};
    if (f) wsC.getCell(lin, PRIMEIRA_COL).border = { ...(wsC.getCell(lin, PRIMEIRA_COL).border || {}), left: fino() };
    lin++;
  };
  const dLink = (chave: string) => (cc: string) => `${D}!${cc}${refD[chave]}`;
  const r = (chave: string, cc: string) => `${cc}${refC[chave]}`;

  linhaCalc("g_rec", "Receitas", "grupo");
  linhaCalc("aluguel", "Aluguel", "detalhe", dLink("aluguel"), true);
  linhaCalc("garagem", "Garagem", "detalhe", dLink("garagem"), true);
  linhaCalc("rb", "Receita bruta", "total", (cc) => `${r("aluguel", cc)}+${r("garagem", cc)}`);
  linhaCalc("descontos", "(−) Descontos concedidos", "detalhe", dLink("descontos"), true);
  linhaCalc("impReceita", "(−) Impostos sobre a receita", "detalhe", dLink("impReceita"), true);
  linhaCalc("rl", "Receita líquida", "total", (cc) => `${r("rb", cc)}+${r("descontos", cc)}+${r("impReceita", cc)}`);
  linhaCalc("g_desp", "Despesas operacionais", "grupo");
  linhaCalc("taxaAdm", "(−) Taxa de administração", "detalhe", dLink("taxaAdm"), true);
  linhaCalc("taxaGer", "(−) Taxa de gerenciamento", "detalhe", dLink("taxaGer"), true);
  for (const t of tiposDesp) linhaCalc(`desp_${t}`, `(−) ${TIPOS_DE_DESPESA[t] || t}`, "detalhe", dLink(`desp_${t}`), true);
  const somaDesp = (cc: string) => ["taxaAdm", "taxaGer", ...tiposDesp.map((t) => `desp_${t}`)].map((k) => r(k, cc)).join("+");
  linhaCalc("noi", "Resultado operacional (NOI)", "total", (cc) => `${r("rl", cc)}+${somaDesp(cc)}`);
  linhaCalc("depreciacao", "(−) Depreciação", "detalhe", dLink("depreciacao"), true);
  linhaCalc("outras", "(+) Outras receitas (multas, juros, rescisão)", "detalhe", dLink("outras"), true);
  linhaCalc("correcao", "(−) Correção do caução devolvido", "detalhe", dLink("correcao"), true);
  linhaCalc("juros", "(−) Juros de financiamento", "detalhe", dLink("juros"), true);
  linhaCalc("lair", "Lucro antes do IR", "total", (cc) => ["noi", "depreciacao", "outras", "correcao", "juros"].map((k) => r(k, cc)).join("+"));
  linhaCalc("ir", "(−) IR (carnê-leão / IRPJ + CSLL)", "detalhe", dLink("ir"), true);
  linhaCalc("ll", "Lucro líquido", "total", (cc) => `${r("lair", cc)}+${r("ir", cc)}`);
  lin++;
  linhaCalc("g_fco", "Fluxo de caixa -- operações", "grupo");
  linhaCalc("f_ll", "Lucro líquido", "detalhe", (cc) => r("ll", cc));
  linhaCalc("f_dep", "(+) Depreciação", "detalhe", (cc) => `-${r("depreciacao", cc)}`);
  linhaCalc("varAReceber", "(±) Variação de aluguéis a receber", "detalhe", dLink("varAReceber"), true);
  linhaCalc("varAPagar", "(±) Variação de despesas a pagar", "detalhe", dLink("varAPagar"), true);
  linhaCalc("varCaucoes", "(±) Variação de cauções de inquilinos", "detalhe", dLink("varCaucoes"), true);
  linhaCalc("fco", "Caixa das operações (FCO)", "total", (cc) => ["f_ll", "f_dep", "varAReceber", "varAPagar", "varCaucoes"].map((k) => r(k, cc)).join("+"));
  linhaCalc("capex", "(−) Investimentos e reformas (capex)", "detalhe", dLink("capex"), true);
  linhaCalc("fci", "Caixa de investimentos (FCI)", "total", (cc) => r("capex", cc));
  linhaCalc("captacoes", "(+) Financiamentos recebidos", "detalhe", dLink("captacoes"), true);
  linhaCalc("amortizacoes", "(−) Amortizações", "detalhe", dLink("amortizacoes"), true);
  linhaCalc("repasses", "(−) Repasses ao proprietário", "detalhe", dLink("repasses"), true);
  linhaCalc("fcf", "Caixa de financiamentos (FCF)", "total", (cc) => ["captacoes", "amortizacoes", "repasses"].map((k) => r(k, cc)).join("+"));
  linhaCalc("varCaixa", "Variação do caixa", "total", (cc) => ["fco", "fci", "fcf"].map((k) => r(k, cc)).join("+"));
  linhaCalc("caixaIni", "Caixa inicial", "detalhe", (cc, ant) => (ant ? `${ant}${refC.caixaIni + 1}` : `${D}!$${col(PRIMEIRA_COL)}$${refD.abCaixa}`));
  linhaCalc("caixaFim", "Caixa final", "total", (cc) => `${r("caixaIni", cc)}+${r("varCaixa", cc)}`);
  lin++;
  const saldo = (chave: string, abertura: string, mov: (cc: string) => string) =>
    (cc: string, ant: string | null) => `${ant ? `${ant}${refC[chave] ?? lin}` : `${D}!$${col(PRIMEIRA_COL)}$${refD[abertura]}`}+${mov(cc)}`;
  linhaCalc("g_ativo", "Balanço -- Ativo", "grupo");
  linhaCalc("b_caixa", "Caixa", "detalhe", (cc) => r("caixaFim", cc));
  refC.b_ar = lin;
  linhaCalc("b_ar", "Aluguéis a receber", "detalhe", saldo("b_ar", "abAReceber", (cc) => `-${r("varAReceber", cc)}`));
  linhaCalc("b_terreno", "Terreno", "detalhe", () => `${D}!$${col(PRIMEIRA_COL)}$${refD.abTerreno}`, true);
  refC.b_edif = lin;
  linhaCalc("b_edif", "Edificação (líquida de depreciação)", "detalhe", saldo("b_edif", "abEdificacao", (cc) => `-${r("capex", cc)}+${r("depreciacao", cc)}`));
  linhaCalc("b_ativo", "Total do Ativo", "total", (cc) => ["b_caixa", "b_ar", "b_terreno", "b_edif"].map((k) => r(k, cc)).join("+"));
  linhaCalc("g_passivo", "Balanço -- Passivo e PL", "grupo");
  refC.b_apagar = lin;
  linhaCalc("b_apagar", "Despesas a pagar", "detalhe", saldo("b_apagar", "abAPagar", (cc) => r("varAPagar", cc)));
  refC.b_caucoes = lin;
  linhaCalc("b_caucoes", "Cauções de inquilinos", "detalhe", saldo("b_caucoes", "abCaucoes", (cc) => r("varCaucoes", cc)));
  refC.b_divida = lin;
  linhaCalc("b_divida", "Financiamentos", "detalhe", saldo("b_divida", "abDivida", (cc) => `${r("captacoes", cc)}+${r("amortizacoes", cc)}`));
  linhaCalc("b_passivo", "Total do Passivo", "total", (cc) => ["b_apagar", "b_caucoes", "b_divida"].map((k) => r(k, cc)).join("+"));
  linhaCalc("b_capital", "Capital", "detalhe", () => `${D}!$${col(PRIMEIRA_COL)}$${refD.capital}`, true);
  refC.b_lucros = lin;
  linhaCalc("b_lucros", "Lucros acumulados", "detalhe", (cc, ant) => `${ant ? `${ant}${refC.b_lucros}` : "0"}+${r("ll", cc)}+${r("repasses", cc)}`);
  linhaCalc("b_pl", "Total do Patrimônio líquido", "total", (cc) => `${r("b_capital", cc)}+${r("b_lucros", cc)}`);
  linhaCalc("b_ppl", "Passivo + Patrimônio líquido", "total", (cc) => `${r("b_passivo", cc)}+${r("b_pl", cc)}`);
  linhaCalc("b_check", "Conferência (Ativo − Passivo − PL)", "detalhe", (cc) => `ROUND(${r("b_ativo", cc)}-${r("b_ppl", cc)},2)`);
  linhaCalc("dfc_check", "Conferência (caixa do DFC − caixa do Balanço)", "detalhe", (cc) => `ROUND(${r("caixaFim", cc)}-${r("b_caixa", cc)},2)`);
  lin++;
  linhaCalc("recebidoFin", "Receita Bruta (recebido) -- igual ao Financeiro", "detalhe", dLink("recebidoFin"), true);
  linhaCalc("contasFin", "Contas do Mês -- igual ao Financeiro", "detalhe", dLink("contasFin"), true);
  linhaCalc("unidades", "Unidades", "detalhe", dLink("unidades"), true);
  linhaCalc("ocupadas", "Unidades ocupadas", "detalhe", dLink("ocupadas"), true);
  linhaCalc("investimento", "Investimento (terreno + edificação + capex)", "detalhe", dLink("investimento"), true);
  for (const k of ["unidades", "ocupadas"]) for (let i = 0; i < n; i++) wsC.getCell(refC[k], PRIMEIRA_COL + i).numFmt = "0.0";

  // ------------------------------------- DRE / Balanço / Fluxo de Caixa
  const calc = q("Cálculos");
  const colunasDe = (per: Periodo) => {
    // Colunas de Cálculos que formam o período (mês ou ano).
    const idx = meses.map((m, i) => ({ m, i })).filter(({ m }) => (per.chave.length === 4 ? m.chave.startsWith(per.chave) : m.chave === per.chave));
    return { de: col(PRIMEIRA_COL + idx[0].i), ate: col(PRIMEIRA_COL + idx[idx.length - 1].i) };
  };
  type Def = { rotulo: string; tipo: EstiloLinha; chave?: string; saldo?: boolean; inicial?: boolean };
  const defsDRE: Def[] = [
    { rotulo: "Receitas", tipo: "grupo" }, { rotulo: "Aluguel", tipo: "detalhe", chave: "aluguel" },
    { rotulo: "Garagem", tipo: "detalhe", chave: "garagem" }, { rotulo: "Receita bruta", tipo: "total", chave: "rb" },
    { rotulo: "(−) Descontos concedidos", tipo: "detalhe", chave: "descontos" },
    { rotulo: "(−) Impostos sobre a receita (PIS/COFINS, IBS/CBS)", tipo: "detalhe", chave: "impReceita" },
    { rotulo: "Receita líquida", tipo: "total", chave: "rl" }, { rotulo: "Despesas operacionais", tipo: "grupo" },
    { rotulo: "(−) Taxa de administração", tipo: "detalhe", chave: "taxaAdm" },
    { rotulo: "(−) Taxa de gerenciamento", tipo: "detalhe", chave: "taxaGer" },
    ...tiposDesp.map<Def>((t) => ({ rotulo: `(−) ${TIPOS_DE_DESPESA[t] || t}`, tipo: "detalhe", chave: `desp_${t}` })),
    { rotulo: "Resultado operacional (NOI)", tipo: "total", chave: "noi" },
    { rotulo: "(−) Depreciação", tipo: "detalhe", chave: "depreciacao" },
    { rotulo: "(+) Outras receitas (multas, juros, rescisão)", tipo: "detalhe", chave: "outras" },
    { rotulo: "(−) Correção do caução devolvido", tipo: "detalhe", chave: "correcao" },
    { rotulo: "(−) Juros de financiamento", tipo: "detalhe", chave: "juros" },
    { rotulo: "Lucro antes do IR", tipo: "total", chave: "lair" },
    { rotulo: "(−) IR (carnê-leão / IRPJ + CSLL)", tipo: "detalhe", chave: "ir" },
    { rotulo: "Lucro líquido", tipo: "total", chave: "ll" },
  ];
  const defsBal: Def[] = [
    { rotulo: "Ativo", tipo: "grupo" }, { rotulo: "Caixa", tipo: "detalhe", chave: "b_caixa", saldo: true },
    { rotulo: "Aluguéis a receber", tipo: "detalhe", chave: "b_ar", saldo: true },
    { rotulo: "Terreno", tipo: "detalhe", chave: "b_terreno", saldo: true },
    { rotulo: "Edificação (líquida de depreciação)", tipo: "detalhe", chave: "b_edif", saldo: true },
    { rotulo: "Total do Ativo", tipo: "total", chave: "b_ativo", saldo: true }, { rotulo: "Passivo", tipo: "grupo" },
    { rotulo: "Despesas a pagar", tipo: "detalhe", chave: "b_apagar", saldo: true },
    { rotulo: "Cauções de inquilinos", tipo: "detalhe", chave: "b_caucoes", saldo: true },
    { rotulo: "Financiamentos", tipo: "detalhe", chave: "b_divida", saldo: true },
    { rotulo: "Total do Passivo", tipo: "total", chave: "b_passivo", saldo: true }, { rotulo: "Patrimônio líquido", tipo: "grupo" },
    { rotulo: "Capital", tipo: "detalhe", chave: "b_capital", saldo: true },
    { rotulo: "Lucros acumulados", tipo: "detalhe", chave: "b_lucros", saldo: true },
    { rotulo: "Total do Patrimônio líquido", tipo: "total", chave: "b_pl", saldo: true },
    { rotulo: "Passivo + Patrimônio líquido", tipo: "total", chave: "b_ppl", saldo: true },
    { rotulo: "Conferência (Ativo − Passivo − PL)", tipo: "detalhe", chave: "b_check", saldo: true },
  ];
  const defsDFC: Def[] = [
    { rotulo: "Atividades operacionais", tipo: "grupo" }, { rotulo: "Lucro líquido", tipo: "detalhe", chave: "f_ll" },
    { rotulo: "(+) Depreciação", tipo: "detalhe", chave: "f_dep" },
    { rotulo: "(±) Variação de aluguéis a receber", tipo: "detalhe", chave: "varAReceber" },
    { rotulo: "(±) Variação de despesas a pagar", tipo: "detalhe", chave: "varAPagar" },
    { rotulo: "(±) Variação de cauções de inquilinos", tipo: "detalhe", chave: "varCaucoes" },
    { rotulo: "Caixa das operações (FCO)", tipo: "total", chave: "fco" }, { rotulo: "Atividades de investimento", tipo: "grupo" },
    { rotulo: "(−) Investimentos e reformas (capex)", tipo: "detalhe", chave: "capex" },
    { rotulo: "Caixa de investimentos (FCI)", tipo: "total", chave: "fci" }, { rotulo: "Atividades de financiamento", tipo: "grupo" },
    { rotulo: "(+) Financiamentos recebidos", tipo: "detalhe", chave: "captacoes" },
    { rotulo: "(−) Amortizações", tipo: "detalhe", chave: "amortizacoes" },
    { rotulo: "(−) Repasses ao proprietário", tipo: "detalhe", chave: "repasses" },
    { rotulo: "Caixa de financiamentos (FCF)", tipo: "total", chave: "fcf" },
    { rotulo: "Variação do caixa", tipo: "total", chave: "varCaixa" },
    { rotulo: "Caixa inicial", tipo: "detalhe", chave: "caixaIni", inicial: true },
    { rotulo: "Caixa final", tipo: "total", chave: "caixaFim", saldo: true },
  ];

  const abaDemonstrativo = (nome: string, titulo: string, defs: Def[]) => {
    const ws = aba(nome);
    preparar(ws, 85, C.dourado);
    const largura = PRIMEIRA_COL + p.periodos.length * 2 - 1;
    p.periodos.forEach((_, i) => {
      ws.getColumn(PRIMEIRA_COL + i * 2).width = 14;
      ws.getColumn(PRIMEIRA_COL + i * 2 + 1).width = 8;
    });
    let l = cabecalho(ws, titulo, titulo, p, Math.max(largura, 10), logoId);
    // Cabeçalho das colunas (bege, vinho): período + A/P, e R$ / %.
    const lPer = l++;
    const lSub = l++;
    ws.getCell(lPer, 3).value = "R$";
    p.periodos.forEach((per, i) => {
      const c0 = PRIMEIRA_COL + i * 2;
      const { de, ate } = colunasDe(per);
      const cel = ws.getCell(lPer, c0);
      cel.value = per.chave.length === 4
        ? { formula: `${calc}!${ate}${lAno}&" "&${calc}!${ate}${lTipo}` }
        : { formula: `TEXT(${calc}!${de}${lData},"mmm-yy")&" "&${calc}!${de}${lTipo}` };
      ws.mergeCells(lPer, c0, lPer, c0 + 1);
      ws.getCell(lSub, c0).value = "R$";
      ws.getCell(lSub, c0 + 1).value = "%";
    });
    for (const x of [lPer, lSub]) {
      estilizarLinha(ws, x, largura, "total");
      for (let c = PRIMEIRA_COL; c <= largura; c++) ws.getCell(x, c).alignment = centro;
    }
    const lRB = l + defs.length + 1; // linha de apoio: receita bruta do período (base do %)
    for (const d of defs) {
      ws.getCell(l, 3).value = d.rotulo;
      if (d.chave) {
        p.periodos.forEach((per, i) => {
          const c0 = PRIMEIRA_COL + i * 2;
          const { de, ate } = colunasDe(per);
          const linhaC = refC[d.chave!];
          const formula = d.saldo
            ? `${calc}!${ate}${linhaC}`
            : d.inicial ? `${calc}!${de}${linhaC}` : de === ate ? `${calc}!${de}${linhaC}` : `SUM(${calc}!${de}${linhaC}:${ate}${linhaC})`;
          const v = ws.getCell(l, c0);
          v.value = { formula };
          v.numFmt = FMT_R;
          v.alignment = centro;
          v.font = fonte({ color: { argb: C.vinculo } });
          const pc = ws.getCell(l, c0 + 1);
          const base = `${col(c0)}$${lRB}`;
          pc.value = { formula: `IF(${base}=0,0,${col(c0)}${l}/${base})` };
          pc.numFmt = FMT_PCT;
          pc.alignment = centro;
          pc.font = fonte();
        });
      }
      estilizarLinha(ws, l, largura, d.tipo);
      for (let i = 0; i < p.periodos.length; i++) {
        const c = ws.getCell(l, PRIMEIRA_COL + i * 2);
        c.border = { ...(c.border || {}), left: fino() };
      }
      l++;
    }
    ws.getCell(lRB, 3).value = "Receita bruta do período (base da coluna %)";
    ws.getCell(lRB, 3).font = fonte({ italic: true });
    p.periodos.forEach((per, i) => {
      const { de, ate } = colunasDe(per);
      const c = ws.getCell(lRB, PRIMEIRA_COL + i * 2);
      c.value = { formula: de === ate ? `${calc}!${de}${refC.rb}` : `SUM(${calc}!${de}${refC.rb}:${ate}${refC.rb})` };
      c.numFmt = FMT_R;
      c.alignment = centro;
      c.font = fonte({ italic: true, color: { argb: C.vinculo } });
    });
    return ws;
  };
  abaDemonstrativo("DRE", "Demonstração do Resultado (DRE)", defsDRE);
  abaDemonstrativo("Balanço", "Balanço Patrimonial", defsBal);
  abaDemonstrativo("Fluxo de Caixa", "Fluxo de Caixa (método indireto)", defsDFC);

  // ---------------------------------------------------------- Por Prédio
  const wsPP = aba("Por Prédio");
  preparar(wsPP, 85, C.dourado);
  for (let c = PRIMEIRA_COL; c <= PRIMEIRA_COL + 5; c++) wsPP.getColumn(c).width = 14;
  lin = cabecalho(wsPP, "Por Prédio", "Por Prédio", p, PRIMEIRA_COL + 5, logoId);
  ["Local", "Proprietário", "Receita", "NOI", "Margem NOI", "Ocupação", "Yield s/ custo"].forEach((t, i) => {
    wsPP.getCell(lin, i === 0 ? 3 : PRIMEIRA_COL + i - 1).value = t;
  });
  estilizarLinha(wsPP, lin, PRIMEIRA_COL + 5, "total");
  for (let c = PRIMEIRA_COL; c <= PRIMEIRA_COL + 5; c++) wsPP.getCell(lin, c).alignment = centro;
  lin++;
  for (let rD = linhaPredioD + 1; rD <= ultimaLinhaPredioD; rD++) {
    const ref = (k: number) => `${D}!${col(PRIMEIRA_COL + k)}${rD}`;
    const forms = [
      ref(0), ref(1), ref(3),
      `IF(${ref(2)}=0,0,${ref(3)}/${ref(2)})`,
      `IF(${ref(5)}=0,0,${ref(4)}/${ref(5)})`,
      `IF(${ref(6)}=0,0,${ref(3)}*12/${ref(7)}/${ref(6)})`,
    ];
    wsPP.getCell(lin, 3).value = { formula: `${D}!C${rD}` };
    wsPP.getCell(lin, 3).font = fonte({ color: { argb: C.vinculo } });
    forms.forEach((f, i) => {
      const c = wsPP.getCell(lin, PRIMEIRA_COL + i);
      c.value = { formula: f };
      c.numFmt = i <= 2 ? FMT_R : FMT_PCT;
      if (i === 0) c.numFmt = "@";
      c.alignment = centro;
      c.font = fonte({ color: { argb: i <= 2 ? C.vinculo : C.texto } });
    });
    wsPP.getCell(lin, 3).border = { left: fino() };
    lin++;
  }

  // -------------------------------------------------------------- Resumo
  const wsR = aba("Resumo");
  preparar(wsR, 85, C.abaResumo);
  wsR.getColumn(PRIMEIRA_COL).width = 18;
  lin = cabecalho(wsR, "Resumo", "Resumo", p, PRIMEIRA_COL + 1, logoId);
  wsR.getCell(lin, 3).value = "Indicador";
  wsR.getCell(lin, PRIMEIRA_COL).value = "Valor";
  estilizarLinha(wsR, lin, PRIMEIRA_COL, "total");
  wsR.getCell(lin, PRIMEIRA_COL).alignment = centro;
  lin++;
  const sel = (() => {
    const todos = p.periodos.flatMap((per) => {
      const { de, ate } = colunasDe(per);
      return [de, ate];
    });
    const idx = todos.map((c) => meses.findIndex((_, i) => col(PRIMEIRA_COL + i) === c));
    return { de: col(PRIMEIRA_COL + Math.min(...idx)), ate: col(PRIMEIRA_COL + Math.max(...idx)) };
  })();
  const soma = (k: string) => `SUM(${calc}!${sel.de}${refC[k]}:${sel.ate}${refC[k]})`;
  const fim = (k: string) => `${calc}!${sel.ate}${refC[k]}`;
  const nMeses = `COUNT(${calc}!${sel.de}${refC.rb}:${sel.ate}${refC.rb})`;
  const indicadores: [string, string, string][] = [
    ["Receita bruta", soma("rb"), FMT_R],
    ["Resultado operacional (NOI)", soma("noi"), FMT_R],
    ["Margem NOI (sobre a receita líquida)", `IF(${soma("rl")}=0,0,${soma("noi")}/${soma("rl")})`, FMT_PCT],
    ["Lucro líquido", soma("ll"), FMT_R],
    ["Caixa gerado no período", soma("varCaixa"), FMT_R],
    ["Ocupação média", `IF(${soma("unidades")}=0,0,${soma("ocupadas")}/${soma("unidades")})`, FMT_PCT],
    ["Inadimplência (a receber ÷ receita do ano)", `IF(${soma("rb")}=0,0,MAX(0,${fim("b_ar")})/(${soma("rb")}*12/${nMeses}))`, FMT_PCT],
    ["Yield sobre custo (NOI do ano ÷ investimento)", `IF(${fim("investimento")}=0,0,${soma("noi")}*12/${nMeses}/${fim("investimento")})`, FMT_PCT],
    ["Receita Bruta (recebido) -- igual ao Financeiro", soma("recebidoFin"), FMT_R],
    ["Taxa de administração -- igual ao Financeiro", `-${soma("taxaAdm")}`, FMT_R],
    ["Taxa de gerenciamento -- igual ao Financeiro", `-${soma("taxaGer")}`, FMT_R],
    ["Contas do Mês -- igual ao Financeiro", soma("contasFin"), FMT_R],
    ["Status do balanço",
      `IF(SUMPRODUCT(ABS(${calc}!${col(PRIMEIRA_COL)}${refC.b_check}:${ultimaColDados}${refC.b_check}))+SUMPRODUCT(ABS(${calc}!${col(PRIMEIRA_COL)}${refC.dfc_check}:${ultimaColDados}${refC.dfc_check}))<0.01,"Balanço fechado ✓","⚠ Balanço NÃO fecha")`,
      "@"],
  ];
  for (const [rot, f, fmt] of indicadores) {
    wsR.getCell(lin, 3).value = rot;
    const c = wsR.getCell(lin, PRIMEIRA_COL);
    c.value = { formula: f };
    c.numFmt = fmt;
    c.alignment = centro;
    c.font = fonte({ bold: rot === "Status do balanço" });
    wsR.getCell(lin, 3).font = fonte({ bold: rot === "Status do balanço" });
    lin++;
  }

  // O Excel recalcula todas as fórmulas ao abrir o arquivo.
  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

/** Gera e baixa o arquivo no navegador. */
export async function exportarDemonstrativosExcel(p: ParametrosDoExcel) {
  let logo = p.logo;
  if (!logo && p.logoUrl) {
    try { logo = await (await fetch(p.logoUrl)).arrayBuffer(); } catch { logo = undefined; }
  }
  const wb = await gerarWorkbookDosDemonstrativos({ ...p, logo });
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const nome = p.nomeDoLocal.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "");
  a.href = url;
  a.download = `Demonstrativos_${nome}_${p.textoPeriodo.replace(/\s+/g, "_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
