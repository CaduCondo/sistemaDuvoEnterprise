import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Contrato de locação (#125). O dado da locação é montado pelo passo
 * "uma locação com estes recebimentos em aberto" (agreement.steps.ts), que
 * guarda `this.tenantName` e `this.rentalId`; o botão é clicado pela TELA.
 */

When('abro "Gerar contrato" dessa locação na tela de Locações', { timeout: 60 * 1000 }, async function (this: CustomWorld) {
  await this.page.goto('/rentals');
  await this.page.waitForLoadState('domcontentloaded');
  const busca = this.page.locator('#rentals-search-input');
  await busca.waitFor({ state: 'visible', timeout: 20000 });
  await busca.fill(this.tenantName!);
  const botao = this.page.locator(`#rentals-contract-${this.rentalId}`).first();
  await expect(botao, 'não achei o botão "Gerar contrato" na linha da locação').toBeVisible({ timeout: 20000 });
  await botao.click();
  await expect(this.page.locator('#contrato-locacao-dialog')).toBeVisible({ timeout: 10000 });
  await expect(this.page.getByText('Montando o contrato...')).toHaveCount(0, { timeout: 20000 });
});

Then('o contrato não deve ser gerado', async function (this: CustomWorld) {
  await expect(this.page.locator('#contrato-faltando')).toBeVisible({ timeout: 10000 });
  await expect(this.page.locator('#contrato-documento')).toHaveCount(0);
});

Then('a lista do que falta deve citar {string}', async function (this: CustomWorld, texto: string) {
  await expect(this.page.locator('#contrato-faltando')).toContainText(texto, { timeout: 10000 });
});
