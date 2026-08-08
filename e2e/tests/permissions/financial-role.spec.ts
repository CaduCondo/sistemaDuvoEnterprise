import { test, expect } from '@playwright/test';
import { createAuthHelper } from '../../helpers/auth.helper';
import { DashboardPage } from '../../pages/DashboardPage';
import DatabaseHelper from '../../helpers/database.helper';
import TEST_CONFIG from '../../config/test.config';

/**
 * Testes de Permissões - Perfil Financeiro
 * 
 * Validar que usuário com perfil Financeiro:
 * - Vê apenas menus Dashboard e Financeiro
 * - Não vê Properties, Tenants, Rentals, Payments, Settings
 */

test.describe('Permissions - Financial Role', () => {
  test.beforeAll(async () => {
    // Criar (ou reaproveitar) o usuário de teste Financeiro em `system_users`
    const { email, password, name } = TEST_CONFIG.users.financial;
    await DatabaseHelper.ensureTestUser({
      email,
      password,
      name: name || 'Usuário Financeiro',
      role: 'financial',
    });
  });

  test.afterAll(async () => {
    // Limpar dados de teste (opcional)
    // await DatabaseHelper.cleanupTestData();
  });

  test('usuário Financeiro deve ver apenas Dashboard e Financeiro', async ({ page }) => {
    const authHelper = createAuthHelper(page);
    const dashboardPage = new DashboardPage(page);

    // Login como usuário Financeiro
    await authHelper.loginAsFinancial();

    // Verificar que está no dashboard
    await dashboardPage.isLoaded();

    // Obter menus visíveis
    const visibleMenus = await dashboardPage.getVisibleMenuItems();

    // Verificar que APENAS Dashboard e Financial estão visíveis
    expect(visibleMenus).toContain('dashboard');
    expect(visibleMenus).toContain('financial');

    // Verificar que outros menus NÃO estão visíveis
    expect(visibleMenus).not.toContain('properties');
    expect(visibleMenus).not.toContain('tenants');
    expect(visibleMenus).not.toContain('rentals');
    expect(visibleMenus).not.toContain('payments');
    expect(visibleMenus).not.toContain('settings');

    console.log('✅ Menus visíveis para Financeiro:', visibleMenus);
  });

  test('usuário Financeiro não deve acessar página de Properties', async ({ page }) => {
    const authHelper = createAuthHelper(page);

    // Login como usuário Financeiro
    await authHelper.loginAsFinancial();

    // Tentar acessar página de Properties diretamente
    await page.goto('/properties');

    // Deve ser redirecionado ou mostrar erro
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    
    // Não deve estar na página de properties
    expect(currentUrl).not.toContain('/properties');
    
    // Pode estar no dashboard ou numa página de erro
    expect(
      currentUrl.includes('/dashboard') || 
      currentUrl.includes('/403') ||
      currentUrl.includes('/unauthorized')
    ).toBe(true);
  });
});