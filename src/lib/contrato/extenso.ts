// Números por extenso em português, para o contrato de locação (issue #125).
// Ex.: 1300 -> "mil e trezentos"; 1756.7 (reais) -> "mil, setecentos e
// cinquenta e seis reais e setenta centavos".

const UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

// 0..999
function ateMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 20) partes.push(UNIDADES[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

/** Inteiro (0 a 999.999.999) por extenso. */
export function inteiroPorExtenso(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const grupos: string[] = [];
  if (milhoes > 0) grupos.push(milhoes === 1 ? "um milhão" : `${ateMil(milhoes)} milhões`);
  if (milhares > 0) grupos.push(milhares === 1 ? "mil" : `${ateMil(milhares)} mil`);
  if (resto > 0) grupos.push(ateMil(resto));

  if (grupos.length === 1) return grupos[0];
  // Regra do "e" entre o último grupo e o anterior: usa "e" quando o último
  // grupo é menor que 100 ou é centena redonda (ex.: "mil e trezentos",
  // "mil e cinquenta"); senão, vírgula ("mil, setecentos e cinquenta").
  const ultimo = grupos.pop()!;
  const usaE = resto < 100 || resto % 100 === 0;
  return `${grupos.join(", ")}${usaE ? " e " : ", "}${ultimo}`;
}

/** Valor em reais por extenso: 1300 -> "mil e trezentos reais". */
export function reaisPorExtenso(valor: number): string {
  const centavosTotal = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(centavosTotal / 100);
  const centavos = centavosTotal % 100;

  const partes: string[] = [];
  if (reais > 0) {
    const ext = inteiroPorExtenso(reais);
    // "um milhão de reais", "dois milhões de reais"
    const de = reais % 1_000_000 === 0 ? " de" : "";
    partes.push(`${ext}${de} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) {
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  if (partes.length === 0) return "zero real";
  return partes.join(" e ");
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-11-28" -> "28 de novembro de 2026" (sem fuso: lê a data como texto). */
export function dataPorExtenso(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** "2026-11-28" -> "28/11/2026" (sem fuso). */
export function dataCurta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Prazo em meses entre início e término. Contratos costumam terminar na
 * véspera do "mesmo dia" (02/11/2026 a 01/06/2028 = 19 meses), então conta
 * até o dia seguinte ao término.
 */
export function mesesEntre(inicioIso: string, terminoIso: string): number {
  const [a1, m1, d1] = inicioIso.slice(0, 10).split("-").map(Number);
  const [at, mt, dt] = terminoIso.slice(0, 10).split("-").map(Number);
  const fim = new Date(Date.UTC(at, mt - 1, dt + 1)); // dia seguinte ao término
  const a2 = fim.getUTCFullYear();
  const m2 = fim.getUTCMonth() + 1;
  const d2 = fim.getUTCDate();
  let meses = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  return Math.max(meses, 0);
}
