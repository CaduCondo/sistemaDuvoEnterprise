// Issue #86: recibo próprio do Recebimento de Rescisão.
//
// REGRA: o TIPO gravado (payment_kind = 'termination') SEMPRE vale -- o texto do
// detalhamento sozinho já enganou (ex.: "Caução Corrigido p/ Devolução" do Fim de Contrato
// não batia com "Devolução de Caução"). Como o recebimento de ALUGUEL da rescisão (tipo
// 'rent', com "Aluguel Proporcional" e "Multa Rescisória") sempre foi reconhecido pelo texto,
// o texto continua valendo para ele e para registros antigos sem tipo. Acordo nunca é rescisão.

export interface ItemDoRecibo {
  description: string;
  amount: number; // sempre positivo; o sentido está em `type`
  type: "addition" | "deduction";
}

const TEXTOS_ANTIGOS_DE_RESCISAO = [
  "Multa Rescisória",
  "Devolução de Caução",
  "Aluguel Proporcional",
  "terminationFee",
  "depositRefund",
  "proportionalRent",
];

export function ehRecebimentoDeRescisao(paymentKind: string | null | undefined, breakdown: unknown): boolean {
  if (paymentKind === "termination") return true;
  if (paymentKind === "agreement") return false;
  if (!breakdown) return false;
  let texto = "";
  try {
    texto = JSON.stringify(breakdown);
  } catch {
    return false;
  }
  return TEXTOS_ANTIGOS_DE_RESCISAO.some((t) => texto.includes(t));
}

/** Itens (com valor) que o recibo da rescisão lista, em valor absoluto. */
export function itensDoReciboDeRescisao(breakdown: unknown): ItemDoRecibo[] {
  let dados: unknown = breakdown;
  if (typeof dados === "string") {
    try {
      dados = JSON.parse(dados);
    } catch {
      return [];
    }
  }
  if (!dados) return [];

  if (Array.isArray(dados)) {
    const itens: ItemDoRecibo[] = [];
    for (const bruto of dados as any[]) {
      const valor = Number(bruto?.amount ?? 0);
      if (!Number.isFinite(valor) || Math.abs(valor) <= 0) continue;
      itens.push({
        description: String(bruto?.description ?? ""),
        amount: Math.abs(valor),
        type: bruto?.type === "deduction" ? "deduction" : "addition",
      });
    }
    return itens;
  }

  // Formato antigo (objeto com propriedades).
  const o = dados as Record<string, unknown>;
  const itens: ItemDoRecibo[] = [];
  const proporcional = Number(o.proportionalRent || 0);
  const multa = Number(o.terminationFee || 0);
  const devolucao = Number(o.depositRefund || 0);
  const despesas = Number(o.additionalExpenses || 0);
  if (proporcional > 0) itens.push({ description: "Aluguel Proporcional", amount: proporcional, type: "addition" });
  if (multa > 0) itens.push({ description: "Multa Rescisória", amount: multa, type: "addition" });
  if (devolucao !== 0) itens.push({ description: "Devolução de Caução", amount: Math.abs(devolucao), type: devolucao < 0 ? "deduction" : "addition" });
  if (despesas > 0) itens.push({ description: "Despesas Adicionais", amount: despesas, type: "addition" });
  return itens;
}
