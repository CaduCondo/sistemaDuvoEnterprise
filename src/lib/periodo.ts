// Issue #112: a coluna "Período" nunca pode escrever "/NaN" para o usuário.
// Quando a parcela não tem mês/ano válidos (ex.: sem data de vencimento),
// mostra "-".

export function formatarPeriodo(
  nomeDoMes: string | null | undefined,
  ano: number | string | null | undefined
): string {
  const anoNumero = Number(ano);
  if (!nomeDoMes || !Number.isFinite(anoNumero) || anoNumero <= 0) return "-";
  return `${nomeDoMes}/${anoNumero}`;
}
