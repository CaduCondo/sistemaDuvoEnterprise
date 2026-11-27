// Issue #53: o "VALOR TOTAL DA RESCISÃO" precisa dizer CLARAMENTE o sentido do
// dinheiro. Negativo = a imobiliária paga/devolve ao inquilino; positivo = o
// inquilino paga. (Convenção do sistema: devolução de caução é valor negativo.)

export type SentidoDaRescisao = "pagar_ao_inquilino" | "receber_do_inquilino" | "nada";

export function sentidoDoTotalDaRescisao(total: number): SentidoDaRescisao {
  const arredondado = Math.round(total * 100) / 100;
  if (arredondado < 0) return "pagar_ao_inquilino";
  if (arredondado > 0) return "receber_do_inquilino";
  return "nada";
}

export function textoDoSentido(total: number): string {
  switch (sentidoDoTotalDaRescisao(total)) {
    case "pagar_ao_inquilino":
      return "A pagar ao inquilino (a imobiliária devolve)";
    case "receber_do_inquilino":
      return "A receber do inquilino";
    default:
      return "Nada a pagar nem a receber";
  }
}
