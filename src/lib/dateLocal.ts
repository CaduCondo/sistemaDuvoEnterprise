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
