import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

/**
 * @smoke @critical
 * Testes de Fumaça - Fluxos Mais Críticos do Sistema
 * 
 * Estes testes devem rodar SEMPRE e RÁPIDO para validar que o sistema básico funciona.
 */

test.describe('Smoke Tests - Fluxos Críticos', () => {
  test('deve carregar a página inicial sem erros @smoke @critical', async ({ page }) => {
    await page.goto('/');
    
    // Não deve haver erros de console críticos
    page.on('pageerror', error => {
      throw new Error(`Erro JavaScript: ${error.message}`);
    });

    // Deve carregar em menos de 5 segundos
    expect(page.url()).toContain('localhost:3000');
  });

  test('deve fazer login com credenciais válidas @smoke @critical', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Login básico deve funcionar (dropdown "Gerenciador" na home pública)
    await loginPage.login('admin@teste.com', 'Admin@123');

    // Deve redirecionar para dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('API de saúde deve responder @smoke @critical @api', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
  });
});