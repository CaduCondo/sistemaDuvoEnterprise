import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DatabaseHelper } from '../../helpers/database.helper';
import TEST_CONFIG from '../../config/test.config';

/**
 * Teste 3: Criar inquilino
 * Criar um inquilino simples e validar que aparece na lista
 *
 * ⚠️ Corrigido em 2026-08: rota "/login" e credenciais "admin@softgen.ai"
 * não existem mais; o campo é "#tenant-document" (não "#tenant-cpf") —
 * ver src/components/tenants/TenantFormDialog.tsx e
 * e2e/step-definitions/tenants.steps.ts.
 */
test.describe('03. Criar Inquilino', () => {
  let createdTenantId: string | undefined;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    const { email, password } = TEST_CONFIG.users.admin;

    await loginPage.goto();
    await loginPage.login(email, password);
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    await page.getByRole('link', { name: /inquilinos/i }).click();
    await page.waitForURL('**/tenants');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    if (createdTenantId) {
      await DatabaseHelper.deleteTenant(createdTenantId);
      createdTenantId = undefined;
    }
  });

  test('Deve criar um inquilino com sucesso', async ({ page }) => {
    const timestamp = Date.now();
    const name = `Teste Inquilino ${timestamp}`;
    const email = `teste${timestamp}@example.com`;

    await page.getByRole('button', { name: /novo inquilino/i }).click();
    await expect(page.locator('#tenant-name')).toBeVisible({ timeout: 5000 });

    await page.locator('#tenant-name').fill(name);
    await page.locator('#tenant-document').fill('123.456.789-00');
    await page.locator('#tenant-email').fill(email);
    await page.locator('#tenant-phone').fill('(11) 99999-9999');

    await page.getByRole('button', { name: /^salvar$/i }).click();
    await page.waitForTimeout(2000);

    await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });

    const tenant = await DatabaseHelper.findTenantByName(name).catch(() => null);
    createdTenantId = tenant?.id;
  });
});
