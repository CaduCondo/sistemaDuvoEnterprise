import type { Periodo } from "./tipos";
import { TIPOS_DE_DESPESA } from "./motor";

/**
 * Linhas de cada demonstrativo, na ordem em que aparecem. A tela
 * (TabelaDemonstrativo) e o Excel (excel.ts) usam esta mesma lista.
 */
export type TipoDeLinha = "grupo" | "detalhe" | "total";

export interface Linha {
  rotulo: string;
  tipo: TipoDeLinha;
  valor?: (p: Periodo) => number;
  testId?: string;
}

/** Tipos de despesa que aparecem em algum período (na ordem do cadastro). */
export function tiposDeDespesa(periodos: Periodo[]): string[] {
  const usados = new Set<string>();
  for (const p of periodos) for (const [t, v] of Object.entries(p.dre.despesasPorTipo)) if (Math.abs(v) > 0.005) usados.add(t);
  const ordem = Object.keys(TIPOS_DE_DESPESA);
  return [...usados].sort((a, b) => (ordem.indexOf(a) + 1 || 99) - (ordem.indexOf(b) + 1 || 99));
}

export function linhasDRE(periodos: Periodo[]): Linha[] {
  return [
    { rotulo: "Receitas", tipo: "grupo" },
    { rotulo: "Aluguel", tipo: "detalhe", valor: (p) => p.dre.receitaAluguel },
    { rotulo: "Garagem", tipo: "detalhe", valor: (p) => p.dre.receitaGaragem },
    { rotulo: "Receita bruta", tipo: "total", valor: (p) => p.dre.receitaBruta, testId: "dre-receita-bruta" },
    { rotulo: "(−) Descontos concedidos", tipo: "detalhe", valor: (p) => p.dre.descontos },
    { rotulo: "(−) Impostos sobre a receita (PIS/COFINS, IBS/CBS)", tipo: "detalhe", valor: (p) => p.dre.impostosSobreReceita },
    { rotulo: "Receita líquida", tipo: "total", valor: (p) => p.dre.receitaLiquida },
    { rotulo: "Despesas operacionais", tipo: "grupo" },
    { rotulo: "(−) Taxa de administração", tipo: "detalhe", valor: (p) => p.dre.taxaAdministracao, testId: "dre-taxa-adm" },
    { rotulo: "(−) Taxa de gerenciamento", tipo: "detalhe", valor: (p) => p.dre.taxaGerenciamento, testId: "dre-taxa-ger" },
    ...tiposDeDespesa(periodos).map<Linha>((t) => ({
      rotulo: `(−) ${TIPOS_DE_DESPESA[t] || t}`,
      tipo: "detalhe",
      valor: (p) => p.dre.despesasPorTipo[t] || 0,
    })),
    { rotulo: "Resultado operacional (NOI)", tipo: "total", valor: (p) => p.dre.noi, testId: "dre-noi" },
    { rotulo: "(−) Depreciação", tipo: "detalhe", valor: (p) => p.dre.depreciacao },
    { rotulo: "(+) Outras receitas (multas, juros, rescisão)", tipo: "detalhe", valor: (p) => p.dre.outrasReceitas },
    { rotulo: "(−) Correção do caução devolvido", tipo: "detalhe", valor: (p) => p.dre.correcaoCaucao },
    { rotulo: "(−) Juros de financiamento", tipo: "detalhe", valor: (p) => p.dre.jurosFinanciamento },
    { rotulo: "Lucro antes do IR", tipo: "total", valor: (p) => p.dre.lucroAntesIR },
    { rotulo: "(−) IR (carnê-leão / IRPJ + CSLL)", tipo: "detalhe", valor: (p) => p.dre.impostoDeRenda },
    { rotulo: "Lucro líquido", tipo: "total", valor: (p) => p.dre.lucroLiquido, testId: "dre-lucro-liquido" },
  ];
}

export function linhasBalanco(): Linha[] {
  return [
    { rotulo: "Ativo", tipo: "grupo" },
    { rotulo: "Caixa", tipo: "detalhe", valor: (p) => p.balanco.caixa, testId: "bal-caixa" },
    { rotulo: "Aluguéis a receber", tipo: "detalhe", valor: (p) => p.balanco.alugueisAReceber },
    { rotulo: "Terreno", tipo: "detalhe", valor: (p) => p.balanco.terreno },
    { rotulo: "Edificação (líquida de depreciação)", tipo: "detalhe", valor: (p) => p.balanco.edificacaoLiquida },
    { rotulo: "Total do Ativo", tipo: "total", valor: (p) => p.balanco.totalAtivo },
    { rotulo: "Passivo", tipo: "grupo" },
    { rotulo: "Despesas a pagar", tipo: "detalhe", valor: (p) => p.balanco.despesasAPagar },
    { rotulo: "Cauções de inquilinos", tipo: "detalhe", valor: (p) => p.balanco.caucoesInquilinos },
    { rotulo: "Financiamentos", tipo: "detalhe", valor: (p) => p.balanco.financiamentos },
    { rotulo: "Total do Passivo", tipo: "total", valor: (p) => p.balanco.totalPassivo },
    { rotulo: "Patrimônio líquido", tipo: "grupo" },
    { rotulo: "Capital", tipo: "detalhe", valor: (p) => p.balanco.capital },
    { rotulo: "Lucros acumulados", tipo: "detalhe", valor: (p) => p.balanco.lucrosAcumulados },
    { rotulo: "Total do Patrimônio líquido", tipo: "total", valor: (p) => p.balanco.totalPL },
    { rotulo: "Passivo + Patrimônio líquido", tipo: "total", valor: (p) => p.balanco.totalPassivo + p.balanco.totalPL },
    { rotulo: "Conferência (Ativo − Passivo − PL)", tipo: "detalhe", valor: (p) => p.balanco.diferenca, testId: "bal-diferenca" },
  ];
}

export function linhasDFC(): Linha[] {
  return [
    { rotulo: "Atividades operacionais", tipo: "grupo" },
    { rotulo: "Lucro líquido", tipo: "detalhe", valor: (p) => p.dfc.lucroLiquido },
    { rotulo: "(+) Depreciação", tipo: "detalhe", valor: (p) => p.dfc.depreciacao },
    { rotulo: "(±) Variação de aluguéis a receber", tipo: "detalhe", valor: (p) => p.dfc.variacaoAReceber },
    { rotulo: "(±) Variação de despesas a pagar", tipo: "detalhe", valor: (p) => p.dfc.variacaoDespesasAPagar },
    { rotulo: "(±) Variação de cauções de inquilinos", tipo: "detalhe", valor: (p) => p.dfc.variacaoCaucoes },
    { rotulo: "Caixa das operações (FCO)", tipo: "total", valor: (p) => p.dfc.fco, testId: "dfc-fco" },
    { rotulo: "Atividades de investimento", tipo: "grupo" },
    { rotulo: "(−) Investimentos e reformas (capex)", tipo: "detalhe", valor: (p) => p.dfc.capex },
    { rotulo: "Caixa de investimentos (FCI)", tipo: "total", valor: (p) => p.dfc.fci },
    { rotulo: "Atividades de financiamento", tipo: "grupo" },
    { rotulo: "(+) Financiamentos recebidos", tipo: "detalhe", valor: (p) => p.dfc.captacoes },
    { rotulo: "(−) Amortizações", tipo: "detalhe", valor: (p) => p.dfc.amortizacoes },
    { rotulo: "(−) Repasses ao proprietário", tipo: "detalhe", valor: (p) => p.dfc.repasses },
    { rotulo: "Caixa de financiamentos (FCF)", tipo: "total", valor: (p) => p.dfc.fcf },
    { rotulo: "Variação do caixa", tipo: "total", valor: (p) => p.dfc.variacaoCaixa },
    { rotulo: "Caixa inicial", tipo: "detalhe", valor: (p) => p.dfc.caixaInicial },
    { rotulo: "Caixa final", tipo: "total", valor: (p) => p.dfc.caixaFinal, testId: "dfc-caixa-final" },
  ];
}
