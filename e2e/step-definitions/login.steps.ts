import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import DatabaseHelper from '../helpers/database.helper';
import TEST_CONFIG from '../config/test.config';

/**
 * Steps específicos do fluxo de login/recuperação de senha.
 *
 * ⚠️ Atualizado em 2026-08 para o fluxo real: dropdown "Gerenciador" na home
 * pública "/" (src/components/public/PublicHeader.tsx) — não existe mais
 * rota "/login" nem os ids "#login-toggle-password"/"#reset-email" usados
 * anteriormente. O click genérico em texto ("Esqueci minha senha", "Enviar
 * Senha") já é coberto por `clico em "{string}"` em common.steps.ts.
 */

When('clico no botão de visualizar senha', async function (this: CustomWorld) {
  await this.loginPage.togglePasswordVisibility();
});

When('clico no botão de visualizar senha novamente', async function (this: CustomWorld) {
  await this.loginPage.togglePasswordVisibility();
});

Then('devo ver o formulário de recuperação de senha', async function (this: CustomWorld) {
  await expect(this.loginPage.resetEmailInput).toBeVisible({ timeout: 5000 });
});

When('preencho o email de recuperação com {string}', async function (this: CustomWorld, email: string) {
  await this.loginPage.resetEmailInput.fill(email);
});

// ============================================================================
// RECUPERAÇÃO DE SENHA COM CONTA DESCARTÁVEL (issue #66/#65, 07/set/2026)
//
// "Esqueci minha senha" TROCA a senha do usuário por uma temporária. Usar a
// conta compartilhada (admin@teste.com) aqui derrubava toda a suíte a partir
// deste ponto -- 128 cenários vermelhos por um único cenário mal escrito.
// Cada execução cria uma conta nova, com e-mail único, que pode ser
// destruída à vontade.
// ============================================================================

Given(
  'que existe um usuário descartável para o teste de recuperação de senha',
  async function (this: CustomWorld) {
    const email = `recuperacao-e2e-${Date.now()}@teste.com`;

    await DatabaseHelper.ensureTestUser({
      email,
      username: email,
      password: 'Descartavel@123',
      name: 'Usuario Descartavel E2E',
      role: 'admin',
    });

    this.testData = { ...this.testData, usuarioDescartavel: { email } };
  }
);

When(
  'preencho o email de recuperação com o e-mail desse usuário descartável',
  async function (this: CustomWorld) {
    const email = this.testData?.usuarioDescartavel?.email;
    if (!email) {
      throw new Error(
        'nenhum usuário descartável foi criado -- falta o passo "Dado que existe um usuário descartável..."'
      );
    }
    await this.loginPage.resetEmailInput.fill(email);
  }
);

/**
 * Guarda-chuva contra a regressão: confere, na hora, que a conta
 * compartilhada continua entrando. Se algum dia alguém apontar o
 * "Esqueci minha senha" para o admin de novo, ESTE cenário fica vermelho --
 * em vez de 128 outros ficarem, escondendo a causa.
 */
Then('a senha do admin compartilhado deve continuar funcionando', async function (this: CustomWorld) {
  const resposta = await this.page.request.post(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
    data: {
      identificador: TEST_CONFIG.users.admin.email,
      senha: TEST_CONFIG.users.admin.password,
    },
  });

  expect(
    resposta.status(),
    'a conta compartilhada admin@teste.com parou de logar depois deste cenário -- ' +
      'algum passo aqui trocou a senha dela (foi exatamente isso que derrubou 128 cenários em 07/set/2026)'
  ).toBe(200);
});

Then('o campo senha deve estar oculto', async function (this: CustomWorld) {
  expect(await this.loginPage.isPasswordVisible()).toBe(false);
});

Then('o campo senha deve estar visível', async function (this: CustomWorld) {
  expect(await this.loginPage.isPasswordVisible()).toBe(true);
});

When('clico no menu do usuário', async function (this: CustomWorld) {
  await this.dashboardPage.openUserMenu();
});
