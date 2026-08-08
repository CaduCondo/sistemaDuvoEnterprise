import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import TEST_CONFIG from '../../config/test.config';

/**
 * @performance
 * Testes de Performance - Tempo de Carregamento
 *
 * ⚠️ Corrigido em 2026-08: não existe rota "/login" — a home pública "/" é
 * quem carrega o dropdown "Gerenciador" de login (ver e2e/pages/LoginPage.ts).
 */

test.describe('Performance - Tempo de Carregamento', () => {
  test('página inicial (com dropdown de login) deve carregar em menos de 3s @performance', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    console.log(`⏱️ Tempo de carregamento da home: ${loadTime}ms`);

    expect(loadTime).toBeLessThan(3000); // 3 segundos
  });

  test('dashboard deve carregar em menos de 5s @performance', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const { email, password } = TEST_CONFIG.users.admin;

    await loginPage.goto();
    await loginPage.login(email, password);

    const startTime = Date.now();
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    console.log(`⏱️ Tempo de carregamento do dashboard: ${loadTime}ms`);

    expect(loadTime).toBeLessThan(5000); // 5 segundos
  });

  test('listagem de imóveis deve carregar em menos de 4s @performance', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const { email, password } = TEST_CONFIG.users.admin;

    await loginPage.goto();
    await loginPage.login(email, password);
    await page.waitForURL('**/dashboard');

    const startTime = Date.now();
    await page.goto('/properties');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    console.log(`⏱️ Tempo de carregamento de imóveis: ${loadTime}ms`);

    expect(loadTime).toBeLessThan(4000); // 4 segundos
  });
});
