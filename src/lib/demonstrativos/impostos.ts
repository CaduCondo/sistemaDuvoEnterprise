import type { ParametrosImpostos } from "./tipos";

/**
 * Impostos dos Demonstrativos (#128). Todos os números vêm das Premissas
 * (editáveis); os valores iniciais estão na migração 20261122120000 e a
 * fonte de cada um em docs/REGRAS_DE_NEGOCIO.md, seção Demonstrativos.
 *
 * Simplificações assumidas (documentadas no manual):
 * - regime de caixa: o imposto incide sobre o que foi RECEBIDO no mês e é
 *   pago no próprio mês (não há "impostos a pagar" no Balanço);
 * - pessoa física: um só proprietário (carnê-leão de uma pessoa), somando
 *   todos os Locais PF, depois repartido entre eles pela base de cada um;
 * - holding: IRPJ/CSLL do lucro presumido calculados mês a mês (a apuração
 *   real é trimestral; o adicional de 10% usa o limite mensal de R$ 20 mil).
 */

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * IRPF mensal (carnê-leão) com o redutor da Lei 15.270/2025.
 * `rendimento` = aluguel recebido no mês; `deducoes` = despesas dedutíveis
 * pagas pelo locador (ex.: taxa de administração). Usa a maior entre as
 * deduções e o desconto simplificado mensal. O redutor olha o rendimento.
 */
export function irpfMensal(rendimento: number, p: ParametrosImpostos["pf"], deducoes = 0): number {
  if (rendimento <= 0) return 0;
  const base = Math.max(0, rendimento - Math.max(deducoes, p.desconto_simplificado_mensal ?? 0));
  const faixa = p.irpf_faixas.find((f) => f.ate == null || base <= f.ate) ?? p.irpf_faixas[p.irpf_faixas.length - 1];
  const bruto = Math.max(0, base * (faixa.aliquota / 100) - faixa.deducao);
  let redutor = 0;
  if (rendimento <= p.redutor_ate) redutor = Math.min(p.redutor_max, bruto);
  else if (rendimento <= p.redutor_faixa_ate) redutor = Math.max(0, p.redutor_a - p.redutor_b * rendimento);
  return r2(Math.max(0, bruto - redutor));
}

/** Alíquota efetiva de IBS + CBS sobre a locação no ano (já com a redução de 70%). */
export function aliquotaIbsCbs(ano: number, p: ParametrosImpostos["ibs_cbs"]): number {
  const fator = (tabela: Record<string, number>) => {
    const anos = Object.keys(tabela).map(Number).sort((a, b) => a - b);
    if (anos.length === 0) return 0;
    // Vale o ano mais recente da tabela que não passe do ano pedido.
    const ate = anos.filter((a) => a <= ano);
    return ate.length === 0 ? 0 : tabela[String(ate[ate.length - 1])];
  };
  const cheia = p.cbs_referencia_pct * fator(p.cbs_fator_por_ano) + p.ibs_referencia_pct * fator(p.ibs_fator_por_ano);
  return (cheia / 100) * (1 - p.reducao_locacao_pct / 100);
}

/** IBS/CBS do mês: (receita − redutor social por unidade ocupada) × alíquota. */
export function ibsCbsMensal(receita: number, unidadesOcupadas: number, ano: number, p: ParametrosImpostos["ibs_cbs"]): number {
  const base = Math.max(0, receita - p.redutor_social_mensal_por_unidade * unidadesOcupadas);
  return r2(base * aliquotaIbsCbs(ano, p));
}

/** Holding no lucro presumido: impostos sobre a receita (PIS/COFINS até a CBS entrar). */
export function pisCofinsMensal(receita: number, ano: number, p: ParametrosImpostos): number {
  if (receita <= 0 || ano > p.ibs_cbs.pis_cofins_ate_ano) return 0;
  return r2(receita * ((p.holding.pis_pct + p.holding.cofins_pct) / 100));
}

/** Holding no lucro presumido: IRPJ + adicional + CSLL do mês. */
export function irpjCsllMensal(receita: number, p: ParametrosImpostos["holding"]): number {
  if (receita <= 0) return 0;
  const base = receita * (p.presuncao_pct / 100);
  const irpj = base * (p.irpj_pct / 100);
  const adicional = Math.max(0, base - p.irpj_adicional_limite_mensal) * (p.irpj_adicional_pct / 100);
  const csll = base * (p.csll_pct / 100);
  return r2(irpj + adicional + csll);
}

/** Reparte um total entre partes proporcionalmente aos pesos (só pesos positivos). */
export function repartir(total: number, pesos: number[]): number[] {
  const soma = pesos.reduce((s, p) => s + Math.max(0, p), 0);
  if (soma <= 0 || total === 0) return pesos.map(() => 0);
  return pesos.map((p) => (total * Math.max(0, p)) / soma);
}
