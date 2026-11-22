/**
 * Padrão visual dos Demonstrativos (pedido do Cadu, 22/nov/2026 -- #128).
 * Os mesmos códigos são usados na tela e no Excel (src/lib/demonstrativos/excel.ts).
 */
export const COR = {
  vinhoEscuro: "#5E0B15",  // faixas de título, título da página, bordas de cabeçalho/subtotal
  vinho: "#7F252F",        // rótulos das premissas, barras finas entre seções
  bege: "#F1E8DB",         // cabeçalhos de tabela e linhas de subtotal/total
  begeEscuro: "#D9CAB3",   // cabeçalhos das séries por ano (Premissas)
  begeClaro: "#F2ECE3",    // fundo dos campos de input
  dourado: "#BC8034",      // subtítulos de seção
  taupe: "#A19386",        // borda tracejada dos inputs e bordas finas das premissas
  texto: "#222222",
  input: "#0070C0",        // número digitado
  formula: "#222222",      // número calculado
  vinculo: "#008000",      // número puxado de outra aba
  abaResumo: "#A19485",
} as const;

export const FONTE_CORPO = '"Aptos Narrow", "Segoe UI", "Arial Narrow", sans-serif';
export const FONTE_TITULO = '"Aptos Display", "Segoe UI", Arial, sans-serif';

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** R$ inteiros: #,##0;(#,##0);"-" */
export function fmtR(v: number): string {
  const n = Math.round(v || 0);
  if (n === 0) return "-";
  const s = Math.abs(n).toLocaleString("pt-BR");
  return n < 0 ? `(${s})` : s;
}

/** Percentual: 0.0%;(0.0%);"-" */
export function fmtPct(v: number): string {
  if (!isFinite(v) || Math.abs(v) < 0.0005) return "-";
  const s = `${(Math.abs(v) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  return v < 0 ? `(${s})` : s;
}

/** "2026-03" → "mar-26"; "2026" → "2026". */
export function fmtPeriodo(chave: string): string {
  if (chave.length === 4) return chave;
  const [a, m] = chave.split("-");
  return `${MESES_CURTOS[Number(m) - 1]}-${a.slice(2)}`;
}
