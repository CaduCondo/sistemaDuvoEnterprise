import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Step Definitions específicos da página /tenants (feature 6-inquilinos-crud).
 * Seletores baseados em src/components/tenants/TenantFormDialog.tsx e
 * src/components/tenants/TenantFilters.tsx.
 */

When('seleciono o filtro de status {string}', async function (this: CustomWorld, statusLabel: string) {
  await this.page.locator('#tenant-filters-status').click();
  await this.page.getByText(new RegExp(statusLabel, 'i')).click();
  await this.page.waitForTimeout(500);
});

Then('devo ver apenas inquilinos com status locatário', async function (this: CustomWorld) {
  const rows = this.page.locator('table tbody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(/locat[aá]rio/i);
  }
});

When('preencho o CPF com {string}', async function (this: CustomWorld, value: string) {
  await this.page.locator('#tenant-document').fill(value);
});

When('preencho o CNPJ com {string}', async function (this: CustomWorld, value: string) {
  await this.page.locator('#tenant-document').fill(value);
});

When('preencho o telefone com {string}', async function (this: CustomWorld, value: string) {
  await this.page.locator('#tenant-phone').fill(value);
});

When('preencho o CEP com {string}', async function (this: CustomWorld, value: string) {
  await this.page.locator('#tenant-cep').fill(value);
});

Then('os campos de endereço devem ser preenchidos automaticamente', async function (this: CustomWorld) {
  await this.page.waitForTimeout(800); // aguarda a busca do CEP (ViaCEP)
  await expect(this.page.locator('#tenant-street')).not.toHaveValue('');
});

Then('devo ver apenas inquilinos que contenham {string} no nome', async function (this: CustomWorld, text: string) {
  const rows = this.page.locator('table tbody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(new RegExp(text, 'i'));
  }
});

Then('devo ver o formulário de cadastro de inquilino', async function (this: CustomWorld) {
  await expect(this.page.locator('#tenant-name')).toBeVisible({ timeout: 5000 });
});

Then('devo ver o seletor de tipo {string}', async function (this: CustomWorld, typeLabel: string) {
  await expect(this.page.locator('#tenant-doc-type-cpf')).toBeVisible({ timeout: 5000 });
  await expect(this.page.locator('#tenant-doc-type-cnpj')).toBeVisible({ timeout: 5000 });
});

Then('o inquilino deve aparecer na lista', async function (this: CustomWorld) {
  await this.page.waitForTimeout(500);
  await expect(this.page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 });
});

// A feature 8-pagamentos-calculos escreve "E quando filtro por ..." — o
// "quando" acaba fazendo parte do texto do step (só a palavra-chave Gherkin
// no início da linha é removida). Delega para a mesma lógica de
// "filtro por {string}" definida em common.steps.ts.
When('quando filtro por {string}', async function (this: CustomWorld, filterValue: string) {
  const monthSelect = this.page.locator('[id*="month-filter"]');
  if (await monthSelect.isVisible().catch(() => false)) {
    const [monthName] = filterValue.split('/');
    await monthSelect.click();
    await this.page.waitForTimeout(300);
    await this.page.getByText(new RegExp(monthName, 'i')).click();
    await this.page.waitForTimeout(500);
  }
  this.testData.currentFilter = filterValue;
});
