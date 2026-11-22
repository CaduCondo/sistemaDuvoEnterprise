import type { FinanciamentoBruto, Mes } from "./tipos";
import { mesDe, somarMeses, taxaMensal } from "./datas";

export interface ParcelaDoFinanciamento {
  mes: Mes;
  juros: number;
  amortizacao: number;
  saldoFinal: number;
}

/**
 * Cronograma de um financiamento (SAC ou Price). O dinheiro entra no mês
 * de início; a 1ª parcela vence no mês seguinte.
 */
export function cronograma(f: FinanciamentoBruto): { mesInicio: Mes; parcelas: ParcelaDoFinanciamento[] } {
  const mesInicio = mesDe(f.start_date) as Mes;
  const i = taxaMensal(f.annual_rate_pct);
  const n = f.term_months;
  const parcelas: ParcelaDoFinanciamento[] = [];
  let saldo = f.principal;
  const prestacaoPrice = i === 0 ? f.principal / n : (f.principal * i) / (1 - Math.pow(1 + i, -n));
  for (let k = 1; k <= n; k++) {
    const juros = saldo * i;
    let amortizacao = f.amortization_system === "SAC" ? f.principal / n : prestacaoPrice - juros;
    if (k === n) amortizacao = saldo; // fecha os centavos
    saldo = Math.max(0, saldo - amortizacao);
    parcelas.push({ mes: somarMeses(mesInicio, k), juros, amortizacao, saldoFinal: saldo });
  }
  return { mesInicio, parcelas };
}

/** Saldo devedor no FIM de um mês. */
export function saldoNoFimDe(f: FinanciamentoBruto, mes: Mes): number {
  const { mesInicio, parcelas } = cronograma(f);
  if (mes < mesInicio) return 0;
  let saldo = f.principal;
  for (const p of parcelas) {
    if (p.mes > mes) break;
    saldo = p.saldoFinal;
  }
  return saldo;
}
