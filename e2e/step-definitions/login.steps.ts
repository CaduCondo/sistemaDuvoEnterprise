import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

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

Then('o campo senha deve estar oculto', async function (this: CustomWorld) {
  expect(await this.loginPage.isPasswordVisible()).toBe(false);
});

Then('o campo senha deve estar visível', async function (this: CustomWorld) {
  expect(await this.loginPage.isPasswordVisible()).toBe(true);
});

When('clico no menu do usuário', async function (this: CustomWorld) {
  await this.dashboardPage.openUserMenu();
});
