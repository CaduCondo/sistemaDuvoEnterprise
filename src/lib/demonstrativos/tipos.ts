/**
 * Demonstrativos (DRE, Balanço, Fluxo de Caixa) -- tipos do motor (#128).
 *
 * O motor é feito só de funções puras: recebe os dados já lidos do banco
 * (ver src/services/demonstrativosService.ts) e devolve os números. Não fala
 * com o banco nem com a tela, para poder ser testado sozinho.
 *
 * Mês é sempre "AAAA-MM" (ex.: "2026-03").
 */

export type Mes = string;
export type Regime = "pf" | "holding";

// ---------------------------------------------------------------- entradas

/** Recebimento (tabela payments), só os campos que o motor usa. */
export interface RecebimentoBruto {
  id: string;
  rental_id: string;
  location_id: string;
  payment_kind?: string | null; // rent | termination | agreement
  status: string;
  expected_amount: number;
  paid_amount?: number | null;
  reference_month: string | number;
  reference_year: string | number;
  due_date?: string | null;
  payment_date?: string | null;
  discount_amount?: number | null;
  late_fee?: number | null;
  interest?: number | null;
  late_fee_waived?: boolean | null;
  interest_waived?: boolean | null;
  breakdown?: unknown;
  partial_payments?: unknown;
  termination_corrected_deposit?: number | null;
}

/** Parcela de caução (tabela deposit_installments). */
export interface CaucaoBruta {
  rental_id: string;
  location_id: string;
  status?: string | null;
  amount: number;
  paid_amount?: number | null;
  payment_date?: string | null;
  due_date?: string | null;
  pix_code?: string | null;
}

/** Despesa do Local (tabela location_expenses). Despesa lançada = paga. */
export interface DespesaBruta {
  location_id: string;
  amount: number;
  expense_type: string;
  reference_month: number;
  reference_year: number;
  is_capex?: boolean | null;
}

/** Acordo de parcelamento: o caução abatido é "devolvido" sem passar pelo caixa. */
export interface AcordoBruto {
  rental_id: string;
  location_id: string;
  agreement_date: string;
  status: string;
  deposit_returned?: number | null;
}

export interface LocacaoBruta {
  id: string;
  property_id: string;
  location_id: string;
  status?: string | null;
  start_date: string;
  end_date?: string | null;
  rent_value?: number | null;
  garage_value?: number | null;
  has_garage?: boolean | null;
}

export interface LocalBruto {
  id: string;
  name: string;
  /** Unidades (imóveis) do Local. */
  unidades: number;
}

export interface PatrimonioBruto {
  location_id: string;
  owner_regime: Regime;
  acquisition_date?: string | null;
  land_value: number;
  building_value: number;
  building_useful_life_years: number;
}

export interface FinanciamentoBruto {
  location_id: string;
  start_date: string;
  principal: number;
  annual_rate_pct: number;
  term_months: number;
  amortization_system: "SAC" | "PRICE";
}

export interface ParametrosImpostos {
  pf: {
    irpf_faixas: { ate: number | null; aliquota: number; deducao: number }[];
    redutor_ate: number;
    redutor_max: number;
    redutor_faixa_ate: number;
    redutor_a: number;
    redutor_b: number;
    deduz_taxas: boolean;
    /** Desconto simplificado mensal (25% do limite da faixa isenta). */
    desconto_simplificado_mensal?: number;
    ibs_cbs_limite_receita_anual: number;
    ibs_cbs_limite_imoveis: number;
  };
  holding: {
    presuncao_pct: number;
    irpj_pct: number;
    irpj_adicional_pct: number;
    irpj_adicional_limite_mensal: number;
    csll_pct: number;
    pis_pct: number;
    cofins_pct: number;
  };
  ibs_cbs: {
    reducao_locacao_pct: number;
    redutor_social_mensal_por_unidade: number;
    cbs_referencia_pct: number;
    ibs_referencia_pct: number;
    cbs_fator_por_ano: Record<string, number>;
    ibs_fator_por_ano: Record<string, number>;
    pis_cofins_ate_ano: number;
  };
}

export interface Premissas {
  base_date: string;           // mês de abertura do Balanço
  opening_cash: number;        // caixa da carteira na abertura
  owner_distribution_pct: number;
  projected_vacancy_pct: number;
  projected_default_pct: number;
  projection_years: number;
  rent_index_by_year: Record<string, number>;
  expense_index_by_year: Record<string, number>;
  tax_params: ParametrosImpostos;
}

export interface Configuracao {
  percentualTaxaAdm?: number | null;
  percentualTaxaGer?: number | null;
  locaisIsentosAdm: string[];
  locaisIsentosGer: string[];
}

export interface DadosDoMotor {
  locais: LocalBruto[];
  recebimentos: RecebimentoBruto[];
  caucoes: CaucaoBruta[];
  despesas: DespesaBruta[];
  acordos: AcordoBruto[];
  locacoes: LocacaoBruta[];
  patrimonios: PatrimonioBruto[];
  financiamentos: FinanciamentoBruto[];
  premissas: Premissas;
  config: Configuracao;
  /** Último mês realizado (A). Depois dele tudo é projetado (P). */
  mesAtual: Mes;
}

// ----------------------------------------------------------------- saídas

/** Linhas da DRE (competência). Despesas e deduções vêm NEGATIVAS. */
export interface LinhasDRE {
  receitaAluguel: number;
  receitaGaragem: number;
  receitaBruta: number;
  descontos: number;
  impostosSobreReceita: number;
  receitaLiquida: number;
  taxaAdministracao: number;
  taxaGerenciamento: number;
  despesasPorTipo: Record<string, number>;
  despesasOperacionais: number;
  noi: number;
  depreciacao: number;
  outrasReceitas: number;       // multas/juros pagos + despesas adicionais da rescisão
  correcaoCaucao: number;       // correção (poupança) paga na devolução do caução
  jurosFinanciamento: number;
  lucroAntesIR: number;
  impostoDeRenda: number;
  lucroLiquido: number;
}

export interface LinhasBalanco {
  caixa: number;
  alugueisAReceber: number;
  terreno: number;
  edificacaoLiquida: number;
  totalAtivo: number;
  despesasAPagar: number;
  caucoesInquilinos: number;
  financiamentos: number;
  totalPassivo: number;
  capital: number;
  lucrosAcumulados: number;
  totalPL: number;
  /** Ativo − Passivo − PL. Tem que ser zero. */
  diferenca: number;
}

export interface LinhasDFC {
  lucroLiquido: number;
  depreciacao: number;
  variacaoAReceber: number;     // aumento do a receber = negativo
  variacaoDespesasAPagar: number;
  variacaoCaucoes: number;
  fco: number;
  capex: number;                // negativo
  fci: number;
  captacoes: number;
  amortizacoes: number;         // negativo
  repasses: number;             // negativo
  fcf: number;
  variacaoCaixa: number;
  caixaInicial: number;
  caixaFinal: number;
}

/** Informações que não são linha contábil, usadas no Resumo e no "Por Prédio". */
export interface Indicadores {
  /** Mesma conta do Financeiro (pelo mês de referência). */
  recebidoFinanceiro: number;
  contasDoMesFinanceiro: number;
  unidades: number;
  unidadesOcupadas: number;
  investimentoTotal: number;    // terreno + edificação + capex (custo)
  inadimplenciaValor: number;   // a receber vencido no fim do período
}

export interface Periodo {
  chave: string;                // "2026-03" ou "2026"
  tipo: "A" | "P" | "A+P";
  dre: LinhasDRE;
  balanco: LinhasBalanco;
  dfc: LinhasDFC;
  indicadores: Indicadores;
}

export interface ResultadoDoLocal {
  localId: string;
  nome: string;
  regime: Regime;
  meses: Periodo[];
}
