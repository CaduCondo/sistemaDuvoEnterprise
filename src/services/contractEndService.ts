import { supabase } from "@/integrations/supabase/client";
import { calculateCorrectedDeposit } from "./igpmService";

/**
 * Valor SEMPRE ATUALIZADO do recebimento de Fim de Contrato (regra do Cadu,
 * 03/out/2026).
 *
 * O recebimento de Fim de Contrato nasce junto com a locação, meses (ou anos)
 * antes de a devolução acontecer. Nesse meio tempo o inquilino vai pagando as
 * parcelas do caução e a poupança vai rendendo -- então o valor gravado no
 * banco envelhece. Para a tela nunca mostrar um valor velho, a conta é feita
 * AQUI, na hora de mostrar (na lista e ao abrir o recebimento):
 *
 *   devolução = - caução EFETIVAMENTE PAGO corrigido pela poupança
 *               (do início do contrato até a data fim)
 *   total     = devolução + despesas adicionais + desconto
 *
 * Mesma regra de correção da rescisão (terminationService): corrige só o que
 * foi pago; parcela marcada como paga com valor 0 vale o valor da parcela.
 *
 * Só recalcula o Fim de Contrato AINDA NÃO PAGO (pending/overdue). Depois de
 * pago, vale o que foi gravado (é histórico).
 */

type Linha = Record<string, any>;

function ehFimDeContratoAberto(p: Linha): boolean {
  return (
    p?.payment_kind === "termination" &&
    p?.contract_end === true &&
    (p?.status === "pending" || p?.status === "overdue")
  );
}

/** Soma do caução efetivamente pago, por locação. */
export function somarCaucaoPago(parcelas: Linha[]): number {
  return (parcelas || []).reduce((soma, parcela) => {
    if (parcela.status !== "paid" && parcela.status !== "partial") return soma;
    const pago = Number(parcela.paid_amount || 0);
    const daParcela = Number(parcela.amount || 0);
    if (parcela.status === "paid" && pago === 0 && daParcela > 0) return soma + daParcela;
    return soma + pago;
  }, 0);
}

/** Devolução corrigida (número POSITIVO; o recebimento grava negativo). */
export function calcularDevolucaoCorrigida(caucaoPago: number, inicio: string, fim: string): number {
  if (!caucaoPago || caucaoPago <= 0 || !inicio || !fim) return 0;
  return Math.round(calculateCorrectedDeposit(caucaoPago, inicio, fim).correctedAmount * 100) / 100;
}

/** Aplica o valor atualizado numa linha de recebimento (sem gravar no banco). */
export function aplicarDevolucao<T extends Linha>(p: T, devolucaoPositiva: number): T {
  const devolucao = devolucaoPositiva > 0 ? -devolucaoPositiva : 0;
  const despesas = Number(p.termination_additional_expenses || 0);
  const desconto = Number(p.termination_discount || 0);
  const total = Math.round((devolucao + despesas + desconto) * 100) / 100;

  const breakdownAntigo: Linha[] = Array.isArray(p.breakdown) ? p.breakdown : [];
  const semCaucao = breakdownAntigo.filter(
    (item) => !String(item?.description || "").includes("Caução Corrigido p/ Devolução")
  );
  const breakdown = [
    { description: "Caução Corrigido p/ Devolução", amount: devolucao, type: "deduction" },
    ...semCaucao,
  ];

  return {
    ...p,
    termination_corrected_deposit: devolucao,
    expected_amount: total,
    breakdown,
  };
}

/**
 * Recebe linhas de `payments` (do jeito que vieram do banco) e devolve as
 * mesmas linhas com o Fim de Contrato em aberto recalculado. As demais linhas
 * voltam intactas. Precisa que as linhas tenham rental_id, payment_kind,
 * contract_end, status, termination_additional_expenses e
 * termination_discount (select "*" já traz tudo).
 */
export async function atualizarFimDeContrato<T extends Linha>(linhas: T[]): Promise<T[]> {
  const abertos = (linhas || []).filter(ehFimDeContratoAberto);
  if (abertos.length === 0) return linhas;

  const rentalIds = [...new Set(abertos.map((p) => p.rental_id).filter(Boolean))];

  try {
    const [{ data: locacoes, error: e1 }, { data: parcelas, error: e2 }] = await Promise.all([
      (supabase as any).from("rentals").select("id, start_date, end_date").in("id", rentalIds),
      (supabase as any)
        .from("deposit_installments")
        .select("rental_id, amount, paid_amount, status")
        .in("rental_id", rentalIds),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;

    const locacaoPorId = new Map<string, Linha>((locacoes || []).map((r: Linha) => [r.id, r]));
    const parcelasPorLocacao = new Map<string, Linha[]>();
    for (const parc of parcelas || []) {
      const lista = parcelasPorLocacao.get(parc.rental_id) || [];
      lista.push(parc);
      parcelasPorLocacao.set(parc.rental_id, lista);
    }

    return linhas.map((p) => {
      if (!ehFimDeContratoAberto(p)) return p;
      const locacao = locacaoPorId.get(p.rental_id);
      const fim = p.due_date || locacao?.end_date;
      const devolucao = calcularDevolucaoCorrigida(
        somarCaucaoPago(parcelasPorLocacao.get(p.rental_id) || []),
        locacao?.start_date,
        fim
      );
      return aplicarDevolucao(p, devolucao);
    });
  } catch (erro) {
    // Mostrar o valor gravado é melhor do que quebrar a tela inteira.
    console.error("❌ [atualizarFimDeContrato] Não foi possível recalcular o caução:", erro);
    return linhas;
  }
}
