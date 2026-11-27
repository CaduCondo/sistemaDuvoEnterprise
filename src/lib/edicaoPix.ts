// Issue #138: edição inline do Código PIX no Financeiro.
//
// Um recebimento pago em várias partes aparece em várias LINHAS que têm o MESMO
// `id` (cada uma com `_rowKey` próprio). A edição precisa ser por linha, senão
// todas as linhas do recebimento viram campo ao mesmo tempo e brigam pelo foco.

export interface LinhaDoFinanceiro {
  id: string;
  _rowKey?: string;
}

export interface CelulaPixEmEdicao {
  /** Identifica a LINHA clicada (id + posição do pagamento parcial). */
  rowKey: string;
  /** Id do recebimento que será atualizado no banco. */
  id: string;
}

/** Chave única da linha: `_rowKey` quando existe, senão o próprio id. */
export function chaveDaLinha(linha: LinhaDoFinanceiro): string {
  return linha._rowKey || linha.id;
}

/** Só a linha clicada fica em edição (e não todas que partilham o mesmo id). */
export function linhaEstaEmEdicao(celula: CelulaPixEmEdicao | null, linha: LinhaDoFinanceiro): boolean {
  return celula !== null && celula.rowKey === chaveDaLinha(linha);
}

/** Salva só se o valor mudou: clicar no campo e sair sem digitar não grava nada. */
export function deveSalvarPix(valorOriginal: string | null | undefined, valorDigitado: string | null | undefined): boolean {
  return (valorOriginal ?? "").trim() !== (valorDigitado ?? "").trim();
}
