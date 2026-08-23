import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Steps da feature de smoke (e2e/features/0-smoke.feature).
 *
 * São só os steps que não existiam ainda em common.steps.ts. Tudo o que já
 * existia (clicar, ver botão, ver o dashboard, fazer login) é reaproveitado
 * de lá — o objetivo é ter UM vocabulário só na suíte inteira, não um
 * dialeto novo por arquivo.
 */

/**
 * Chamada direta ao endereço de saúde, sem passar pelo navegador.
 *
 * É de propósito o primeiro cenário da suíte: se a aplicação nem subiu,
 * este falha em milissegundos e deixa claro que o problema é a aplicação,
 * e não os testes. Sem ele, o mesmo problema apareceria disfarçado de
 * "cliquei e nada aconteceu" em todos os outros cenários.
 */
When('consulto o endereço de saúde da aplicação', async function (this: CustomWorld) {
  const resposta = await this.page.request.get('/api/health');
  this.testData.respostaSaude = {
    ok: resposta.ok(),
    status: resposta.status(),
    corpo: await resposta.json().catch(() => null),
  };
});

Then('a aplicação responde que está no ar', async function (this: CustomWorld) {
  const r = this.testData.respostaSaude;
  expect(r, 'O step de consultar o endereço de saúde não rodou antes deste.').toBeTruthy();
  expect(r.ok, `A aplicação respondeu com o código ${r.status}.`).toBe(true);
  expect(r.corpo?.status).toBe('ok');
});

/**
 * Abre a home pública SEM abrir o dropdown de login (diferente de
 * "que estou na página de login", em common.steps.ts, que já abre).
 *
 * Começa a escutar os erros de JavaScript antes de navegar — se escutasse
 * depois, os erros do carregamento inicial, que são justamente os que
 * interessam, passariam despercebidos.
 */
Given('que estou na página inicial pública', async function (this: CustomWorld) {
  const erros: string[] = [];
  this.testData.errosDeJavaScript = erros;

  this.page.on('pageerror', (erro) => erros.push(erro.message));

  await this.page.goto('/');
  await this.page.waitForLoadState('networkidle');
});

Then('a página não deve ter erros de JavaScript', async function (this: CustomWorld) {
  const erros: string[] = this.testData.errosDeJavaScript || [];
  expect(erros, `Erros de JavaScript encontrados na página: ${erros.join(' | ')}`).toEqual([]);
});
