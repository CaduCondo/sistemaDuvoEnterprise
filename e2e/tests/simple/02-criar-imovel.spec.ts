import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DatabaseHelper } from '../../helpers/database.helper';
import TEST_CONFIG from '../../config/test.config';

/**
 * Teste 2: Criar imóvel
 * Criar um imóvel simples e validar que aparece na lista
 *
 * ⚠️ Corrigido em 2026-08: rota "/login" e credenciais "admin@softgen.ai"
 * não existem mais; campos do formulário ("#property-identifier",
 * "#property-location-select") não correspondem ao formulário real
 * (src/components/properties/PropertyFormDialog.tsx). Selectors alinhados
 * com e2e/step-definitions/properties.steps.ts, já validados contra a UI.
 */
test.describe('02. Criar Imóvel', () => {
  let createdPropertyId: string | undefined;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    const { email, password } = TEST_CONFIG.users.admin;

    await loginPage.goto();
    await loginPage.login(email, password);
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    await page.getByRole('link', { name: /imóveis/i }).click();
    await page.waitForURL('**/properties');
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    if (createdPropertyId) {
      await DatabaseHelper.deleteProperty(createdPropertyId);
      createdPropertyId = undefined;
    }
  });

  test('Deve criar um imóvel com sucesso', async ({ page }) => {
    const timestamp = Date.now();
    const complement = `APTO ${timestamp}`;

    await page.getByRole('button', { name: /novo imóvel/i }).click();
    await expect(page.locator('#property-location')).toBeVisible({ timeout: 5000 });

    await page.locator('#property-location').click();
    await page.getByRole('option').first().click();

    await page.locator('#property-complement').fill(complement);
    await page.locator('#property-rooms').fill('2');
    await page.locator('#property-bathrooms').fill('1');
    await page.locator('#property-area').fill('80');
    await page.locator('#property-value').fill('1500');

    await page.getByRole('button', { name: /^salvar$/i }).click();
    await page.waitForTimeout(2000);

    await expect(page.getByText(complement)).toBeVisible({ timeout: 10000 });

    const property = await DatabaseHelper.findPropertyByComplement(complement).catch(() => null);
    createdPropertyId = property?.id;
  });
});
