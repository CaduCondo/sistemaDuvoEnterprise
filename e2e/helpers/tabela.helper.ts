import { expect, Page } from '@playwright/test';

/**
 * Conferência de "a tela deve mostrar APENAS X" — criado em 29/set/2026 pela
 * auditoria de falso positivo pedida pelo Cadu.
 *
 * ## O defeito que este arquivo existe para matar
 *
 * Nove passos da suíte conferiam um filtro assim:
 *
 * ```ts
 * const linhas = page.locator('table tbody tr');
 * const total = await linhas.count();
 * for (let i = 0; i < total; i++) {
 *   await expect(linhas.nth(i)).toContainText(/disponível/i);
 * }
 * ```
 *
 * Parece correto, e é o jeito mais natural de escrever. Mas quando a tabela
 * vem **vazia**, `total` é zero, o laço não roda nenhuma vez e o passo passa.
 * Ou seja: um filtro que funciona e um filtro que zera a lista dão exatamente
 * o mesmo resultado — verde. O mesmo vale para a tela que não terminou de
 * carregar e para a tabela que nem existe.
 *
 * Um teste de filtro precisa de duas provas, não uma:
 *   1. sobrou alguma coisa na tela (senão não há o que conferir);
 *   2. tudo o que sobrou atende ao filtro.
 *
 * E olhar só as linhas VISÍVEIS: telas com abas (Recebimentos) mantêm as duas
 * abas montadas no HTML e escondem a inativa — sem `:visible`, a conferência
 * acaba lendo linhas de uma aba que o usuário não está vendo.
 */
export async function conferirQueTodasAsLinhasAtendem(
  page: Page,
  oQueProcurar: RegExp,
  descricaoDoFiltro: string
) {
  const linhas = page.locator('tbody tr:visible');

  await expect(
    linhas,
    `o filtro de ${descricaoDoFiltro} não deixou NENHUMA linha na tela. ` +
      'Sem linha nenhuma este cenário não prova nada — uma lista vazia passava ' +
      'como se o filtro estivesse funcionando.'
  ).not.toHaveCount(0, { timeout: 10000 });

  const textos = await linhas.allInnerTexts();
  const forasteiras = textos.filter((t) => !oQueProcurar.test(t.replace(/\s+/g, ' ')));

  expect(
    forasteiras.length,
    `${forasteiras.length} de ${textos.length} linha(s) não atendem ao filtro de ` +
      `${descricaoDoFiltro}. Primeira fora: ${forasteiras[0]?.replace(/\s+/g, ' ').slice(0, 200)}`
  ).toBe(0);
}
