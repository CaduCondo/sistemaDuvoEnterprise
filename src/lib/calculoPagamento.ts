// Conta do recebimento: aluguel, garagem, multa e juros por atraso, valor a pagar e o que
// ainda falta. Era uma conta escondida dentro de um hook de tela (usePaymentCalculations);
// agora é função pura, testada em src/lib/__tests__/calculoPagamento.test.ts (issue #141).
// O hook só chama esta função.

export interface ItemDeValor {
  description?: string;
  amount?: number;
  value?: number;
  type?: string;
}

export interface PagamentoParaCalculo {
  due_date: string;
  breakdown?: unknown;
  payment_kind?: string | null;
  expected_amount?: number | null;
  paid_amount?: number | null;
  status?: string | null;
}

export interface EntradaCalculoPagamento {
  payment: PagamentoParaCalculo | null | undefined;
  /** Data em que o pagamento está sendo registrado (AAAA-MM-DD); vazio = ainda não escolheu. */
  paymentDate: string | null | undefined;
  rentalValue: number;
  garageValue: number;
  isTerminationPayment: boolean;
  originalBreakdown: Array<{ description?: string; amount: number }>;
  removeLateFee: boolean;
  removeInterest: boolean;
  /** Multa por atraso, em % (uma vez). */
  lateFeePercentage: number;
  /** Juros por atraso, em % AO DIA. */
  interestRatePercentage: number;
}

export interface ResultadoCalculoPagamento {
  valorAluguel: number;
  multa: number;
  juros: number;
  valorTotal: number;
  valorAPagar: number;
  valorJaPago: number;
  valorRestante: number;
  diasAtraso: number;
  jurosDiario: number;
  isProportional: boolean;
  proportionalDays: number;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

function lerBreakdown(breakdown: unknown): ItemDeValor[] | null {
  try {
    const dados = typeof breakdown === "string" ? JSON.parse(breakdown) : breakdown || [];
    return Array.isArray(dados) ? (dados as ItemDeValor[]) : null;
  } catch {
    return null;
  }
}

export function calcularValoresDoPagamento(e: EntradaCalculoPagamento): ResultadoCalculoPagamento {
  const { payment, rentalValue, garageValue } = e;

  // Aluguel e garagem SEPARADOS, lidos do detalhamento (inclui proporcional); sem detalhamento
  // (ou sem nenhuma linha de aluguel/garagem) usa os valores da locação.
  let valorDoAluguel = rentalValue;
  let valorDaGaragem = garageValue;
  if (payment?.breakdown) {
    const itens = lerBreakdown(payment.breakdown);
    if (itens && itens.length > 0) {
      valorDoAluguel = 0;
      valorDaGaragem = 0;
      for (const item of itens) {
        const descricao = item.description || "";
        const valor = item.value || item.amount || 0;
        if (descricao.includes("Aluguel") && !descricao.includes("Garagem")) valorDoAluguel += valor;
        else if (descricao.includes("Garagem") || descricao.includes("Vaga")) valorDaGaragem += valor;
      }
      if (valorDoAluguel === 0 && valorDaGaragem === 0) {
        valorDoAluguel = rentalValue;
        valorDaGaragem = garageValue;
      }
    } else if (itens === null) {
      valorDoAluguel = rentalValue;
      valorDaGaragem = garageValue;
    }
  }

  // Parcela/entrada de acordo (#119): o valor é o da parcela (e é sobre ele que multa e juros contam).
  if (payment?.payment_kind === "agreement") {
    valorDoAluguel = Number(payment.expected_amount) || 0;
    valorDaGaragem = 0;
  }

  const valorAluguel = arredondar(valorDoAluguel + valorDaGaragem);

  let isProportional = false;
  let proportionalDays = 0;
  if (payment?.breakdown) {
    const itens = lerBreakdown(payment.breakdown);
    const proporcional = itens?.find((i) => i.description?.toLowerCase().includes("proporcional"));
    if (proporcional) {
      isProportional = true;
      const m = String(proporcional.description).match(/(\d+)\s*dias?/i);
      if (m) proportionalDays = parseInt(m[1]);
    }
  }

  // Multa e juros: só se pagou DEPOIS do vencimento.
  let multa = 0;
  let juros = 0;
  let diasAtraso = 0;
  if (payment && e.paymentDate) {
    const vencimento = new Date(payment.due_date + "T12:00:00");
    const pagamento = new Date(e.paymentDate + "T12:00:00");
    if (pagamento > vencimento) {
      diasAtraso = Math.ceil((pagamento.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));

      let base = 0;
      if (e.isTerminationPayment && e.originalBreakdown.length > 0) {
        // Rescisão: base sem multa/juros por atraso e sem despesas.
        base = Math.abs(
          e.originalBreakdown
            .filter(
              (i) =>
                !i.description?.includes("Multa por Atraso") &&
                !i.description?.includes("Juros por Atraso") &&
                !i.description?.includes("Despesas")
            )
            .reduce((soma, i) => soma + i.amount, 0)
        );
      } else {
        base = Math.max(0, valorAluguel);
      }

      if (base > 0) {
        multa = arredondar((base * e.lateFeePercentage) / 100);
        juros = arredondar(((base * e.interestRatePercentage) / 100) * diasAtraso);
      }
    }
  }

  const valorTotal = arredondar(valorAluguel + multa + juros);
  // Aluguel + multa (se não removida) + juros (se não removido). Antes, com nada removido,
  // o juros ficava de fora (#141).
  const valorAPagar = arredondar(valorAluguel + (e.removeLateFee ? 0 : multa) + (e.removeInterest ? 0 : juros));

  const valorJaPago = payment?.paid_amount || 0;
  let valorRestante = 0;
  if (payment?.status !== "paid") {
    const esperado = payment?.expected_amount || valorAPagar;
    valorRestante = Math.max(0, arredondar(esperado - valorJaPago));
  }

  return {
    valorAluguel: arredondar(valorAluguel),
    multa: arredondar(multa),
    juros: arredondar(juros),
    valorTotal: arredondar(valorTotal),
    valorAPagar: arredondar(valorAPagar),
    valorJaPago: arredondar(valorJaPago),
    valorRestante: arredondar(valorRestante),
    diasAtraso,
    jurosDiario: e.interestRatePercentage,
    isProportional,
    proportionalDays,
  };
}
