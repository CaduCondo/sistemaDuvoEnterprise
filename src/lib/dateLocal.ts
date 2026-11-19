/**
 * Data de hoje (ou de uma data qualquer) no formato "AAAA-MM-DD" no horário
 * DO COMPUTADOR de quem usa (Brasil), e não no horário de Londres.
 *
 * Por que existe (auditoria de 16/nov/2026): `new Date().toISOString()` devolve
 * a data de Londres. Entre 21h e meia-noite no Brasil, Londres já está no dia
 * seguinte -- a data de pagamento vinha preenchida com "amanhã" e parcelas que
 * vencem hoje já apareciam como atrasadas.
 */
export function dataLocalISO(data: Date = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Transforma "AAAA-MM-DD" (como vem do banco) em uma data à meia-noite do
 * horário local. `new Date("2026-11-16")` vira meia-noite de LONDRES, que no
 * Brasil é 21h do dia anterior -- por isso uma locação que termina hoje
 * aparecia como "vencida" um dia antes do certo.
 */
export function dataDoBanco(texto: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return new Date(texto);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
