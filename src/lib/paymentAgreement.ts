/**
 * Acordo de parcelamento do débito do inquilino (#119) — contas puras.
 *
 * Regras combinadas com o Cadu (06 e 07/out/2026):
 *  - entram no acordo os recebimentos em aberto da locação (pendente, parcial,
 *    atrasado) com vencimento a partir de 01/01/2026, pelo SALDO (o que falta
 *    pagar). O Recebimento de Rescisão entra com caução corrigido (negativo,
 *    abate) + Despesas Adicionais − Desconto, como estão SALVOS nele;
 *  - multa e juros por atraso até a data do acordo entram, com os percentuais de
 *    Configurações > Multas e Juros e a MESMA conta da tela de pagamento
 *    (usePaymentCalculations): multa = base x %multa; juros = base x %juros ao
 *    dia x dias de atraso; base = aluguel + garagem do recebimento;
 *  - parcelas sem juros, no máximo 6; os centavos que sobram da divisão vão
 *    para a última parcela;
 *  - as parcelas seguintes vencem no mesmo dia dos meses seguintes (dia 31 em
 *    mês curto vira o último dia do mês).
 *
 * Nada aqui fala com o banco: é o que a tela usa para mostrar a prévia e o que
 * vai para a função criar_acordo_parcelamento (que confere tudo de novo).
 */

export const MAX_PARCELAS_ACORDO = 6;

export interface RecebimentoDoAcordo {
  id: string;
  dueDate: string; // YYYY-MM-DD
  descricao: string;
  tipo: "rent" | "termination" | "agreement";
  status: string;
  expectedAmount: number;
  paidAmount: number;
  /** O que falta pagar. Negativo no Recebimento de Rescisão que devolve caução. */
  saldo: number;
  /** Base da multa/juros por atraso (aluguel + garagem). 0 = não gera atraso. */
  baseAtraso: number;
  /** Só no Recebimento de Rescisão: caução corrigido (negativo), despesas e desconto (negativo). */
  caucao?: number;
  despesas?: number;
  desconto?: number;
}

/** Recebimentos com vencimento antes disto nunca entram em acordo (o sistema não existia). */
export const PRIMEIRO_VENCIMENTO_ACEITO = "2026-01-01";

export interface AtrasoCalculado {
  diasAtraso: number;
  multa: number;
  juros: number;
}

export interface ParcelaDoAcordo {
  numero: number;
  vencimento: string; // YYYY-MM-DD
  valor: number;
}

export const arred = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Dias entre o vencimento e a data de referência (0 se não venceu). */
export function diasDeAtraso(vencimento: string, dataReferencia: string): number {
  const venc = new Date(vencimento + "T12:00:00");
  const ref = new Date(dataReferencia + "T12:00:00");
  if (!(ref > venc)) return 0;
  return Math.ceil((ref.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Aluguel + garagem do recebimento, igual à tela de pagamento: soma as linhas
 * da "Formação de Valores" que são aluguel (inclusive proporcional) ou
 * garagem/vaga. Multa rescisória, despesas etc. não entram. Sem formação
 * gravada, usa o valor do próprio recebimento.
 */
export function baseDeAtrasoDoRecebimento(breakdown: unknown, expectedAmount: number): number {
  let itens: any[] = [];
  try {
    itens = typeof breakdown === "string" ? JSON.parse(breakdown) : Array.isArray(breakdown) ? breakdown : [];
  } catch {
    itens = [];
  }
  let base = 0;
  for (const item of itens) {
    const descricao = String(item?.description || item?.label || "");
    const valor = Number(item?.value ?? item?.amount ?? 0) || 0;
    if (descricao.includes("Aluguel") && !descricao.includes("Garagem")) base += valor;
    else if (descricao.includes("Garagem") || descricao.includes("Vaga")) base += valor;
  }
  if (base <= 0) base = Number(expectedAmount) || 0;
  return arred(Math.max(0, base));
}

/** Multa e juros por atraso de UM recebimento até a data do acordo. */
export function calcularAtraso(
  item: Pick<RecebimentoDoAcordo, "dueDate" | "saldo" | "baseAtraso" | "tipo">,
  dataAcordo: string,
  multaPercentual: number,
  jurosDiarioPercentual: number
): AtrasoCalculado {
  const diasAtraso = diasDeAtraso(item.dueDate, dataAcordo);
  if (item.tipo === "termination" || item.saldo <= 0 || diasAtraso <= 0 || item.baseAtraso <= 0) {
    return { diasAtraso: item.tipo === "termination" ? 0 : diasAtraso, multa: 0, juros: 0 };
  }
  const multa = arred((item.baseAtraso * (multaPercentual || 0)) / 100);
  const juros = arred(((item.baseAtraso * (jurosDiarioPercentual || 0)) / 100) * diasAtraso);
  return { diasAtraso, multa, juros };
}

/** Soma `n` meses mantendo o dia (dia 31 em mês curto vira o último dia). */
export function somarMeses(data: string, n: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + n, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  const d = Math.min(dia, ultimoDia);
  return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Divide o valor em parcelas iguais; os centavos que sobram vão para a última. */
export function dividirEmParcelas(valor: number, quantidade: number, primeiroVencimento: string): ParcelaDoAcordo[] {
  const qtd = Math.max(1, Math.min(MAX_PARCELAS_ACORDO, Math.floor(quantidade || 1)));
  const totalCentavos = Math.round(arred(valor) * 100);
  const baseCentavos = Math.floor(totalCentavos / qtd);
  const parcelas: ParcelaDoAcordo[] = [];
  for (let i = 0; i < qtd; i++) {
    const centavos = i === qtd - 1 ? totalCentavos - baseCentavos * (qtd - 1) : baseCentavos;
    parcelas.push({ numero: i + 1, vencimento: somarMeses(primeiroVencimento, i), valor: centavos / 100 });
  }
  return parcelas;
}

export interface ResumoDoAcordo {
  saldo: number; // soma dos saldos (caução já abatido)
  multa: number;
  juros: number;
  desconto: number;
  total: number; // saldo + multa + juros - desconto
  entrada: number;
  parcelado: number; // total - entrada
  parcelas: ParcelaDoAcordo[];
  erros: string[];
}

export function montarAcordo(params: {
  itens: RecebimentoDoAcordo[];
  dataAcordo: string;
  incluirAtraso: boolean;
  multaPercentual: number;
  jurosDiarioPercentual: number;
  desconto: number;
  entrada: number;
  entradaData: string | null;
  quantidadeParcelas: number;
  primeiroVencimento: string;
}): ResumoDoAcordo & { atrasos: Record<string, AtrasoCalculado> } {
  const erros: string[] = [];
  const atrasos: Record<string, AtrasoCalculado> = {};
  let saldo = 0;
  let multa = 0;
  let juros = 0;

  for (const item of params.itens) {
    saldo += item.saldo;
    const atraso = params.incluirAtraso
      ? calcularAtraso(item, params.dataAcordo, params.multaPercentual, params.jurosDiarioPercentual)
      : { diasAtraso: diasDeAtraso(item.dueDate, params.dataAcordo), multa: 0, juros: 0 };
    atrasos[item.id] = atraso;
    multa += atraso.multa;
    juros += atraso.juros;
  }

  saldo = arred(saldo);
  multa = arred(multa);
  juros = arred(juros);
  const desconto = arred(Math.max(0, params.desconto || 0));
  const entrada = arred(Math.max(0, params.entrada || 0));
  const total = arred(saldo + multa + juros - desconto);
  const parcelado = arred(total - entrada);

  if (params.itens.length === 0) erros.push("Escolha pelo menos um recebimento.");
  if (total <= 0) erros.push("Não há débito para parcelar: o saldo é a favor do inquilino.");
  if (entrada > 0 && !params.entradaData) erros.push("Informe a data da entrada.");
  if (entrada > 0 && parcelado <= 0) erros.push("A entrada não pode ser maior ou igual ao total.");
  if (params.quantidadeParcelas < 1 || params.quantidadeParcelas > MAX_PARCELAS_ACORDO) {
    erros.push(`Escolha de 1 a ${MAX_PARCELAS_ACORDO} parcelas.`);
  }
  if (!params.primeiroVencimento) erros.push("Informe o vencimento da 1ª parcela.");

  const parcelas =
    parcelado > 0 && params.primeiroVencimento
      ? dividirEmParcelas(parcelado, params.quantidadeParcelas, params.primeiroVencimento)
      : [];

  return { saldo, multa, juros, desconto, total, entrada, parcelado, parcelas, erros, atrasos };
}
