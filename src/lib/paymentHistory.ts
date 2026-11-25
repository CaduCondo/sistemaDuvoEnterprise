// Regra (issue #130): o campo "valor pago" de um recebimento (paid_amount) tem
// que ser SEMPRE a soma dos pagamentos registrados no histórico
// (partial_payments). Este arquivo concentra essa conta num só lugar para a
// tela de pagar e a de excluir recibo não divergirem.

export interface EntradaHistoricoPagamento {
  amount?: number | string | null;
}

/** Soma (em valor absoluto) de tudo que está registrado no histórico. */
export function somarHistoricoPagamentos(
  historico: EntradaHistoricoPagamento[] | null | undefined
): number {
  if (!Array.isArray(historico)) return 0;
  const soma = historico.reduce((acc, entrada) => acc + Math.abs(Number(entrada?.amount) || 0), 0);
  return Math.round(soma * 100) / 100;
}

/**
 * Valor pago do recebimento DEPOIS de registrar um novo pagamento.
 *
 * - Se já existe histórico: soma do histórico + o novo pagamento (independe
 *   do status — antes só somava quando o status era "parcial", e um 2º
 *   pagamento sobre recebimento "pago"/"pendente" sobrescrevia o valor).
 * - Se não existe histórico (recebimento antigo, anterior ao histórico): só
 *   soma ao valor já pago quando o recebimento está "parcial".
 */
export function calcularValorPagoAposNovoPagamento(params: {
  historicoAnterior: EntradaHistoricoPagamento[] | null | undefined;
  valorPagoAnterior: number | null | undefined;
  statusAnterior: string | null | undefined;
  novoPagamento: number;
}): number {
  const { historicoAnterior, valorPagoAnterior, statusAnterior, novoPagamento } = params;
  const novo = Math.abs(novoPagamento || 0);

  let base: number;
  if (Array.isArray(historicoAnterior) && historicoAnterior.length > 0) {
    base = somarHistoricoPagamentos(historicoAnterior);
  } else if (statusAnterior === "partial" && (valorPagoAnterior || 0) > 0) {
    base = valorPagoAnterior || 0;
  } else {
    base = 0;
  }
  return Math.round((base + novo) * 100) / 100;
}
