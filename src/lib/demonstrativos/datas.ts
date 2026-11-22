import type { Mes } from "./tipos";

/** "2026-03-15" ou {ano, mes} → "2026-03". */
export function mesDe(data: string | null | undefined): Mes | null {
  if (!data) return null;
  const m = /^(\d{4})-(\d{2})/.exec(String(data));
  return m ? `${m[1]}-${m[2]}` : null;
}

export function mesDeReferencia(ano: string | number, mes: string | number): Mes {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
}

export function somarMeses(mes: Mes, n: number): Mes {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Meses de `de` até `ate`, inclusive. */
export function listaDeMeses(de: Mes, ate: Mes): Mes[] {
  const meses: Mes[] = [];
  for (let m = de; m <= ate; m = somarMeses(m, 1)) meses.push(m);
  return meses;
}

/** Quantos meses de `de` até `ate` (pode ser negativo). */
export function diferencaEmMeses(de: Mes, ate: Mes): number {
  const [a1, m1] = de.split("-").map(Number);
  const [a2, m2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

export function anoDe(mes: Mes): number {
  return Number(mes.slice(0, 4));
}

/** Taxa mensal equivalente: (1 + a.a.)^(1/12) − 1. */
export function taxaMensal(anualPct: number): number {
  return Math.pow(1 + anualPct / 100, 1 / 12) - 1;
}
