/**
 * Regra do FIM DE CONTRATO (definida pelo Cadu em 03/out/2026, issue #108).
 *
 * Todo contrato termina com TRÊS cobranças no último trecho:
 *
 *   1. A parcela REGULAR do último vencimento que cai até a data fim -- valor
 *      CHEIO, vencendo no dia de vencimento de sempre (ex.: 05/09).
 *   2. O PROPORCIONAL de fim de contrato -- só os dias entre esse último
 *      vencimento e a data fim, vencendo NA PRÓPRIA DATA FIM (ex.: 29/09).
 *      O dia do vencimento NÃO entra na conta (já foi coberto pela parcela
 *      anterior): de 05/09 a 29/09 são 24 dias (06/09 até 29/09).
 *      Se a data fim cair exatamente no dia de vencimento, não existe
 *      proporcional (seriam 0 dias).
 *   3. O recebimento de FIM DE CONTRATO (payment_kind = 'termination') --
 *      devolução do caução corrigido + campos de despesas e desconto, também
 *      vencendo na data fim. Existe mesmo sem caução (nasce com R$ 0,00), para
 *      poder lançar uma cobrança (pintura, limpeza) ou um desconto na saída.
 *
 * Os itens 2 e 3 são marcados com `contract_end = true` no banco. É essa
 * marca -- e nunca o texto das observações -- que diz ao sistema quais
 * recebimentos apagar quando o contrato é RENOVADO (eles vão para a nova data
 * fim) ou RESCINDIDO (a rescisão cria os dela).
 *
 * Este arquivo só tem contas, sem banco de dados, para ser fácil de testar.
 */

/** Data válida de vencimento: dia 31 em mês de 30 dias vira 30, etc. */
export function vencimentoValido(diaEscolhido: number, ano: number, mes: number): string {
  const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
  const dia = Math.min(diaEscolhido, ultimoDiaDoMes);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Diferença em dias entre duas datas "YYYY-MM-DD" (fim - início). */
export function diasEntre(inicio: string, fim: string): number {
  const [ai, mi, di] = inicio.split("-").map(Number);
  const [af, mf, df] = fim.split("-").map(Number);
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(af, mf - 1, df) - Date.UTC(ai, mi - 1, di)) / msPorDia);
}

/**
 * Último vencimento regular que cai ATÉ a data fim (inclusive).
 * Ex.: vencimento dia 5, fim 29/09/2026 -> 2026-09-05.
 *      vencimento dia 20, fim 10/09/2026 -> 2026-08-20.
 */
export function ultimoVencimentoRegular(dataFim: string, diaVencimento: number): string {
  const [ano, mes] = dataFim.split("-").map(Number);
  const noMesDoFim = vencimentoValido(diaVencimento, ano, mes);
  if (noMesDoFim <= dataFim) return noMesDoFim;
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoAnterior = mes === 1 ? ano - 1 : ano;
  return vencimentoValido(diaVencimento, anoAnterior, mesAnterior);
}

/**
 * Quantos dias o proporcional de fim de contrato cobra: do dia seguinte ao
 * último vencimento regular até a data fim (inclusive). 0 = não há proporcional.
 */
export function diasProporcionalFimContrato(dataFim: string, diaVencimento: number): number {
  return diasEntre(ultimoVencimentoRegular(dataFim, diaVencimento), dataFim);
}
