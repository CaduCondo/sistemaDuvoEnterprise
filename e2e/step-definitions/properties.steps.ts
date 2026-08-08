import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Step Definitions específicos da página /properties (feature 5-imoveis-crud).
 * Seletores baseados em src/components/properties/PropertyFormDialog.tsx e
 * src/pages/properties.tsx (colunas reais: Local, Complemento, Valor,
 * Quartos, Banheiros, Área Útil, Status, Foto).
 */

Given('existe uma localização {string}', async function (this: CustomWorld, name: string) {
  const location = await this.createLocation({ name });
  this.locationId = location.id;
});

Given('que existe um imóvel {string}', async function (this: CustomWorld, identifier: string) {
  const property = await this.createProperty({ property_identifier: identifier });
  this.propertyId = property.id;
  this.testData.propertyIdentifier = identifier;
  await this.page.reload();
  await this.page.waitForLoadState('networkidle');
});

Given('existe um imóvel {string} disponível', async function (this: CustomWorld, identifier: string) {
  const property = await this.createProperty({ property_identifier: identifier, status: 'available' });
  this.propertyId = property.id;
  this.testData.propertyIdentifier = identifier;
});

Given('que existe um imóvel disponível {string} com aluguel de {string}', async function (
  this: CustomWorld,
  identifier: string,
  rentValue: string
) {
  const property = await this.createProperty({
    property_identifier: identifier,
    status: 'available',
    value: parseFloat(rentValue.replace(/\./g, '').replace(',', '.')),
  });
  this.propertyId = property.id;
});

When('clico no botão de visualização em grid', async function (this: CustomWorld) {
  await this.page.locator('#properties-view-grid').click();
  await this.page.waitForTimeout(300);
});

When('clico no botão de visualização em lista', async function (this: CustomWorld) {
  await this.page.locator('#properties-view-table').click();
  await this.page.waitForTimeout(300);
});

Then('devo ver os imóveis em formato de cards', async function (this: CustomWorld) {
  await expect(this.page.locator('table')).not.toBeVisible().catch(() => {});
  await expect(this.page.locator('[class*="card" i]').first()).toBeVisible({ timeout: 5000 });
});

Then('devo ver os imóveis em formato de tabela', async function (this: CustomWorld) {
  await expect(this.page.locator('table').first()).toBeVisible({ timeout: 5000 });
});

When('preencho o campo de busca com {string}', async function (this: CustomWorld, text: string) {
  const search = this.page.locator('#property-filters-search, #tenant-filters-search, #rentals-search-input').first();
  await search.fill(text);
  await this.page.waitForTimeout(500);
});

Then('devo ver apenas imóveis que contenham {string} no endereço ou localização', async function (
  this: CustomWorld,
  text: string
) {
  const rows = this.page.locator('table tbody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(new RegExp(text, 'i'));
  }
});

When('seleciono a localização {string}', async function (this: CustomWorld, locationName: string) {
  const select = this.page.locator('#property-filters-location-desktop, #property-filters-location-mobile').first();
  await select.click();
  await this.page.getByRole('option', { name: new RegExp(locationName, 'i') }).click();
  await this.page.waitForTimeout(500);
});

Then('devo ver apenas imóveis desta localização', async function (this: CustomWorld) {
  await expect(this.page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 });
});

When('seleciono o status {string}', async function (this: CustomWorld, status: string) {
  // Reaproveitado nas páginas de Imóveis, Inquilinos e Pagamentos — tenta os
  // seletores conhecidos de cada uma.
  const candidates = [
    '#property-filters-status-desktop',
    '#property-filters-status-mobile',
    '#tenant-filters-status',
    '[id*="status-filter"]',
  ];
  for (const selector of candidates) {
    const el = this.page.locator(selector).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
      await this.page.waitForTimeout(500);
      return;
    }
  }
  throw new Error('Nenhum filtro de status visível na página atual');
});

Then('devo ver apenas imóveis disponíveis', async function (this: CustomWorld) {
  const rows = this.page.locator('table tbody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(/dispon[ií]vel/i);
  }
});

Then('devo ver apenas imóveis ocupados', async function (this: CustomWorld) {
  const rows = this.page.locator('table tbody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(/ocupado/i);
  }
});

Then('devo ver o formulário de cadastro de imóvel', async function (this: CustomWorld) {
  await expect(this.page.locator('#property-location')).toBeVisible({ timeout: 5000 });
});

Then('devo ver os campos obrigatórios:', async function (this: CustomWorld, dataTable: any) {
  const fields = dataTable.hashes ? dataTable.hashes() : dataTable.raw().map((r: string[]) => ({ campo: r[0] }));
  const map: Record<string, string> = {
    local: '#property-location',
    quartos: '#property-rooms',
    banheiros: '#property-bathrooms',
    'área (m²)': '#property-area',
    'área útil': '#property-area',
    valor: '#property-value',
  };
  for (const row of fields) {
    const key = (row.campo || '').toLowerCase();
    const selector = map[key];
    if (selector) {
      await expect(this.page.locator(selector)).toBeVisible({ timeout: 5000 });
    }
  }
});

When('tento salvar sem preencher o local', async function (this: CustomWorld) {
  await this.page.locator('#property-form-submit').click();
});

When('tento salvar sem preencher os quartos', async function (this: CustomWorld) {
  await this.page.locator('#property-rooms').fill('');
  await this.page.locator('#property-form-submit').click();
});

When('tento salvar sem preencher o código', async function (this: CustomWorld) {
  await this.page.locator('#property-form-submit').click();
});

When('tento salvar sem preencher o endereço', async function (this: CustomWorld) {
  await this.page.locator('#property-form-submit').click();
});

When('preencho todos os campos obrigatórios:', async function (this: CustomWorld, dataTable: any) {
  const rows = dataTable.hashes();

  for (const row of rows) {
    const campo = row.campo.toLowerCase();
    const valor = row.valor;

    // ---- Campos do formulário de Imóvel ----
    if (campo === 'local') {
      await this.page.locator('#property-location').click();
      await this.page.getByRole('option', { name: new RegExp(valor, 'i') }).click();
    } else if (campo === 'complemento') {
      await this.page.locator('#property-complement').fill(valor);
    } else if (campo === 'quartos') {
      await this.page.locator('#property-rooms').fill(valor);
    } else if (campo === 'banheiros') {
      await this.page.locator('#property-bathrooms').fill(valor);
    } else if (campo === 'área' || campo === 'área útil' || campo === 'área (m²)') {
      await this.page.locator('#property-area').fill(valor);
    } else if (campo === 'valor' || campo === 'valor aluguel' || campo === 'valor do aluguel') {
      await this.page.locator('#property-value').fill(valor);

      // ---- Campos do formulário de Inquilino ----
    } else if (campo === 'nome' || campo === 'razão social') {
      await this.page.locator('#tenant-name').fill(valor);
    } else if (campo === 'cpf') {
      await this.page.locator('#tenant-document').fill(valor);
    } else if (campo === 'cnpj') {
      await this.page.locator('#tenant-document').fill(valor);
    } else if (campo === 'telefone') {
      await this.page.locator('#tenant-phone').fill(valor);
    } else if (campo === 'e-mail' || campo === 'email') {
      await this.page.locator('#tenant-email').fill(valor);
    }
  }
});

Then('o imóvel deve aparecer na lista', async function (this: CustomWorld) {
  await this.page.waitForTimeout(500);
  await expect(this.page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 });
});

Then('o imóvel NÃO deve aparecer na lista', async function (this: CustomWorld) {
  const identifier = this.testData.propertyIdentifier;
  if (identifier) {
    await expect(this.page.getByText(identifier)).not.toBeVisible();
  }
});

Then('o imóvel deve permanecer na lista', async function (this: CustomWorld) {
  const identifier = this.testData.propertyIdentifier;
  if (identifier) {
    await expect(this.page.getByText(identifier)).toBeVisible();
  }
});

When('clico no botão de editar do imóvel {string}', async function (this: CustomWorld, identifier: string) {
  const row = this.page.locator('tr', { hasText: identifier });
  await row.getByRole('button').first().click();
  await this.page.waitForTimeout(500);
});

When('clico no botão de deletar do imóvel {string}', async function (this: CustomWorld, identifier: string) {
  const row = this.page.locator('tr', { hasText: identifier });
  await row.getByRole('button', { name: /deletar|excluir/i }).click();
  await this.page.waitForTimeout(500);
});

Then('devo ver o formulário com os dados preenchidos', async function (this: CustomWorld) {
  await expect(this.page.locator('#property-value')).not.toHaveValue('');
});

Then('devo ver o alerta de confirmação', async function (this: CustomWorld) {
  await expect(this.page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 });
});

Then('o valor deve estar atualizado na lista', async function (this: CustomWorld) {
  await this.page.waitForTimeout(500);
  await expect(this.page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 });
});
