import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import TEST_CONFIG from '../../config/test.config';

/**
 * Teste 1: Login básico
 * O mais simples possível - apenas fazer login e validar que chegou no dashboard
 *
 * ⚠️ Corrigido em 2026-08: não existe rota "/login" nem credenciais
 * "admin@softgen.ai" (sistema antigo). O login administrativo é o dropdown
 * "Gerenciador" na home pública "/" — ver e2e/pages/LoginPage.ts. As
 * credenciais vêm de e2e/config/test.config.ts (usuário seedado em
 * `system_users` por DatabaseHelper.ensureDefaultTestUsers, chamado no
 * globalSetup do Playwright).
 */
test.describe('01. Login Básico', () => {
  test('Deve fazer login com sucesso e chegar no dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const { email, password } = TEST_CONFIG.users.admin;

    await loginPage.goto();
    await loginPage.login(email, password);

    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');
    await expect(page.locator('#dashboard-page')).toBeVisible();
  });
});
