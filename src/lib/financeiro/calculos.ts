/**
 * Contas do Financeiro (aba Locações), em funções puras.
 *
 * Até nov/2026 estas contas moravam dentro de `src/pages/financial.tsx`.
 * Foram trazidas para cá SEM mudar nenhum resultado (issue #128), para que a
 * página Demonstrativos use exatamente a mesma conta: Financeiro e
 * Demonstrativos têm que mostrar os mesmos números para o mesmo filtro.
 *
 * Regras (ver docs/REGRAS_DE_NEGOCIO.md, seção "📊 Financeiro"):
 * - Recebimento de Rescisão (`payment_kind = 'termination'`) fica de fora de
 *   tudo: é caução, dinheiro do inquilino, não receita (#49).
 * - Receita Bruta (recebido) = soma do que foi PAGO (status paid, partial ou
 *   renegotiated), pelo mês de referência do recebimento.
 * - Taxas Adm/Ger = % sobre o valor recebido, só de valores positivos,
 *   pulando os Locais isentos (listas separadas para cada taxa).
 * - Renegociado (#119): o esperado passa a ser só o que dele já foi pago.
 */

export interface LinhaDoFinanceiro {
  id: string;
  status: string;
  paymentKind?: string | null;
  paidAmount?: number | null;
  expectedAmount: number;
  lateFee?: number | null;
  interest?: number | null;
  breakdown?: unknown;
  /** Valor esperado do boleto inteiro, quando a linha veio de um parcial. */
  _billExpectedAmount?: number;
  property?: { locationId?: string | null } | null;
}

export interface DespesaDoFinanceiro {
  amount?: number | null;
}

/** Status cujo `paid_amount` conta como dinheiro recebido. */
export const STATUS_RECEBIDO = ["paid", "partial", "renegotiated"] as const;

export function contaComoRecebido(status: string): boolean {
  return (STATUS_RECEBIDO as readonly string[]).includes(status);
}

/** Valor esperado de uma linha: itens do breakdown (ou expected) + multa + juros. */
export function valorEsperadoDaLinha(linha: LinhaDoFinanceiro): number {
  let baseTotal = 0;
  if (linha.breakdown) {
    try {
      const dados = typeof linha.breakdown === "string" ? JSON.parse(linha.breakdown) : linha.breakdown;
      if (Array.isArray(dados) && dados.length > 0) {
        baseTotal = dados.reduce((soma: number, item: any) => soma + Number(item.value || item.amount || 0), 0);
      }
    } catch (erro) {
      console.error("Erro ao processar breakdown:", erro);
      baseTotal = linha.expectedAmount;
    }
  } else {
    baseTotal = linha.expectedAmount;
  }
  return baseTotal + Number(linha.lateFee || 0) + Number(linha.interest || 0);
}

/**
 * Um boleto pago em várias vezes vira várias linhas: uma por pagamento feito
 * (`partial_payments`) e, se ainda falta dinheiro, uma do saldo em aberto.
 * `base` é a linha já montada pela tela; `bruto` é o registro do banco.
 */
export function expandirParciais<T extends LinhaDoFinanceiro & Record<string, any>>(
  bruto: { status: string; expected_amount: number; partial_payments?: unknown },
  base: T,
): T[] {
  const renegociado = bruto.status === "renegotiated";
  const historico = Array.isArray(bruto.partial_payments) ? (bruto.partial_payments as any[]) : [];
  if (historico.length === 0) return [base];

  const totalEsperadoBase = Math.abs((renegociado ? bruto.expected_amount : base.expectedAmount) || 0);
  let pagoAcumulado = 0;
  const linhas: T[] = historico.map((entrada: any, indice: number) => {
    const valorPago = Number(entrada.amount || 0);
    const esperado = entrada.expected_amount != null
      ? Math.abs(Number(entrada.expected_amount))
      : Math.max(totalEsperadoBase - pagoAcumulado, Math.abs(valorPago));
    pagoAcumulado += Math.abs(valorPago);
    return {
      ...base,
      _rowKey: `${base.id}-${indice}`,
      _billExpectedAmount: totalEsperadoBase,
      paidAmount: valorPago,
      expectedAmount: esperado,
      breakdown: null,
      lateFee: 0,
      interest: 0,
      paymentDate: entrada.payment_date || null,
      paymentTime: entrada.payment_time || null,
      paymentMethod: entrada.payment_method || null,
      attachments: Array.isArray(entrada.attachments)
        ? entrada.attachments.map((a: any) => (typeof a === "string" ? a : a?.url)).filter(Boolean)
        : [],
      status: "paid",
    };
  });

  if (renegociado) {
    for (const linha of linhas) linha._billExpectedAmount = pagoAcumulado;
  }

  const restante = totalEsperadoBase - pagoAcumulado;
  if (base.status !== "paid" && !renegociado && restante > 0.01) {
    linhas.push({
      ...base,
      _rowKey: `${base.id}-remaining`,
      _billExpectedAmount: totalEsperadoBase,
      paidAmount: 0,
      expectedAmount: restante,
      breakdown: null,
      lateFee: 0,
      interest: 0,
      paymentDate: null,
      paymentTime: null,
      paymentMethod: null,
      attachments: [],
    });
  }
  return linhas;
}

export interface ParametrosDosCards {
  linhas: LinhaDoFinanceiro[];
  /** Despesas já filtradas pelos Locais que a pessoa pode/quer ver. */
  despesas: DespesaDoFinanceiro[];
  percentualTaxaAdm?: number | null;
  percentualTaxaGer?: number | null;
  locaisIsentosAdm: string[];
  locaisIsentosGer: string[];
}

export interface CardsDoFinanceiro {
  totalExpected: number;
  totalReceived: number;
  adminFee: number;
  managementFee: number;
  netRevenue: number;
  totalPaid: number;
  locationExpenses: number;
}

/** Os cards do topo do Financeiro (Receita Bruta, Taxas, Contas, Líquida). */
export function calcularCardsDoFinanceiro(p: ParametrosDosCards): CardsDoFinanceiro {
  const linhas = p.linhas.filter((l) => l.paymentKind !== "termination");

  const contas = p.despesas.reduce((soma, d) => soma + (d.amount || 0), 0);

  const vistos = new Set<string>();
  const totalExpected = linhas.reduce((soma, l) => {
    if (vistos.has(l.id)) return soma;
    vistos.add(l.id);
    return soma + (l._billExpectedAmount != null ? l._billExpectedAmount : valorEsperadoDaLinha(l));
  }, 0);

  const recebidas = linhas.filter((l) => contaComoRecebido(l.status));
  const totalReceived = recebidas.reduce((soma, l) => soma + (l.paidAmount || 0), 0);

  const taxaAdm = (p.percentualTaxaAdm ?? 5) / 100;
  const taxaGer = (p.percentualTaxaGer ?? 3) / 100;
  const positivas = recebidas.filter((l) => (l.paidAmount || 0) > 0);
  const local = (l: LinhaDoFinanceiro) => l.property?.locationId || "";

  const adminFee = positivas.reduce(
    (soma, l) => soma + (l.property && p.locaisIsentosAdm.includes(local(l)) ? 0 : (l.paidAmount || 0) * taxaAdm),
    0,
  );
  const managementFee = positivas.reduce(
    (soma, l) => soma + (l.property && p.locaisIsentosGer.includes(local(l)) ? 0 : (l.paidAmount || 0) * taxaGer),
    0,
  );

  return {
    totalExpected,
    totalReceived,
    adminFee,
    managementFee,
    netRevenue: totalReceived - adminFee - managementFee - contas,
    totalPaid: totalReceived,
    locationExpenses: contas,
  };
}
