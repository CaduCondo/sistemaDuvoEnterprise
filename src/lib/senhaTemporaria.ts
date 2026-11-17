import { randomInt } from "crypto";

/**
 * Senha temporária aleatória (10 caracteres: maiúscula, minúscula, número
 * e símbolo garantidos). Só para uso no servidor (usa o módulo crypto).
 */
export function gerarSenhaTemporariaSegura(): string {
  const grupos = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnpqrstuvwxyz",
    "23456789",
    "!@#$%&*",
  ];
  const todos = grupos.join("");
  const caracteres = grupos.map((g) => g[randomInt(g.length)]);
  while (caracteres.length < 10) caracteres.push(todos[randomInt(todos.length)]);
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join("");
}
