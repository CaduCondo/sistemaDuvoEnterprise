// Issue #137: o filtro de mês do Financeiro aceita VÁRIOS meses (checkbox por
// mês + "Marcar todos"). Contas puras do filtro ficam aqui para serem testadas.

export const NOMES_DOS_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const ABREVIACOES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Marca/desmarca um mês e devolve a lista ordenada, sem repetidos. */
export function alternarMes(selecionados: number[], mes: number): number[] {
  const set = new Set(selecionados);
  if (set.has(mes)) set.delete(mes);
  else set.add(mes);
  return [...set].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
}

export function todosMarcados(selecionados: number[]): boolean {
  return new Set(selecionados.filter((m) => m >= 1 && m <= 12)).size === 12;
}

/** "Marcar todos" (vira "Desmarcar todos" quando os 12 estão marcados). */
export function alternarTodos(selecionados: number[]): number[] {
  return todosMarcados(selecionados) ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Texto curto que aparece dentro do combo fechado. */
export function rotuloDoCombo(selecionados: number[]): string {
  const meses = [...new Set(selecionados)].sort((a, b) => a - b);
  if (meses.length === 0) return "Nenhum mês";
  if (meses.length === 12) return "Todos os meses";
  if (meses.length === 1) return maiuscula(NOMES_DOS_MESES[meses[0] - 1]);
  if (meses.length <= 3) return meses.map((m) => ABREVIACOES[m - 1]).join(", ");
  return `${meses.length} meses`;
}

/** Texto do período para títulos e arquivos. Um mês só = igual ao de antes ("novembro 2026"). */
export function tituloDoPeriodo(selecionados: number[], ano: number): string {
  const meses = [...new Set(selecionados)].sort((a, b) => a - b);
  if (meses.length === 0) return `nenhum mês de ${ano}`;
  if (meses.length === 1) return `${NOMES_DOS_MESES[meses[0] - 1]} ${ano}`;
  const seguidos = meses.every((m, i) => i === 0 || m === meses[i - 1] + 1);
  if (seguidos) {
    return `${NOMES_DOS_MESES[meses[0] - 1]} a ${NOMES_DOS_MESES[meses[meses.length - 1] - 1]} ${ano}`;
  }
  return `${meses.map((m) => NOMES_DOS_MESES[m - 1]).join(", ")} ${ano}`;
}
