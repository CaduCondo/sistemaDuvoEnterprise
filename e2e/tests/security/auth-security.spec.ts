import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import TEST_CONFIG from '../../config/test.config';

/**
 * @security
 * Testes de Segurança - Autenticação e Autorização
 *
 * ⚠️ Corrigido em 2026-08: não existe mais uma rota "/login" com formulário
 * próprio — o login é o dropdown "Gerenciador" na home pública "/" (ver
 * e2e/pages/LoginPage.ts). A rota "/login" ainda existe como *destino* de
 * redirecionamento (src/contexts/AuthContext.tsx redireciona usuários não
 * autenticados para lá), mas não existe página cadastrada em
 * src/pages/login.tsx — isso é uma inconsistência real do app (o
 * redirecionamento aponta para uma rota inexistente); o teste abaixo
 * verifica apenas que o acesso não autenticado É de fato bloqueado
 * (redirecionado para longe de /dashboard), não o conteúdo da página de
 * destino.
 */

test.describe('Security - Autenticação', () => {
  test('não deve permitir acesso sem autenticação @security @critical', async ({ page }) => {
    await page.goto('/dashboard');

    // AuthContext (src/contexts/AuthContext.tsx) redireciona para "/login"
    // quando não há sessão válida — não deve permanecer em /dashboard.
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).not.toContain('/dashboard');
  });

  test('não deve expor credenciais em cookies @security', async ({ page }) => {
    await page.goto('/');

    const cookies = await page.context().cookies();

    // Verificar que nenhum cookie contém senha em texto plano
    cookies.forEach(cookie => {
      expect(cookie.value).not.toMatch(/password|senha|pwd/i);
    });
  });

  test('deve bloquear SQL injection no login @security @critical', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login("admin' OR '1'='1", "' OR '1'='1");
    await page.waitForTimeout(2000);

    // NÃO deve fazer login
    const url = page.url();
    expect(url).not.toContain('/dashboard');
    expect(await loginPage.hasError()).toBe(true);
  });

  test('deve bloquear XSS em campos de input @security', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.openLoginDropdown();

    const xssPayload = '<script>alert("XSS")</script>';
    await loginPage.usernameInput.fill(xssPayload);

    // Verificar que script não foi executado
    const alerts: string[] = [];
    page.on('dialog', dialog => {
      alerts.push(dialog.message());
      dialog.dismiss();
    });

    await page.waitForTimeout(1000);
    expect(alerts.length).toBe(0);
  });
});

test.describe('Security - Autorização por Perfil', () => {
  test('usuário Financeiro não deve acessar /properties @security @permissions', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const { email, password } = TEST_CONFIG.users.financial;

    await loginPage.goto();
    await loginPage.login(email, password);
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Tentar acessar properties
    await page.goto('/properties');

    // Deve ser bloqueado
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(
      url.includes('/dashboard') ||
      url.includes('/403') ||
      url.includes('/unauthorized')
    ).toBe(true);
  });
});
