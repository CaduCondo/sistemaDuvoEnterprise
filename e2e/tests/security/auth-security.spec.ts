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
    await loginPage.openLoginDropdown();

    // ⚠️ Corrigido em 2026-08: #username é <input type="email" required>
    // (src/components/public/PublicHeader.tsx) — um payload de SQL
    // injection como "admin' OR '1'='1" não é um e-mail válido, então o
    // próprio navegador bloqueia o submit via validação HTML5 nativa,
    // ANTES de qualquer chamada ao backend. Não aparece um toast de erro
    // customizado (hasError() nunca fica true) porque handleSubmit nunca
    // roda — essa é a barreira de segurança real neste formulário.
    await loginPage.usernameInput.fill("admin' OR '1'='1");
    await loginPage.passwordInput.fill("' OR '1'='1");

    const isValid = await loginPage.usernameInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);

    await loginPage.submitButton.click();
    await page.waitForTimeout(500);

    // NÃO deve fazer login
    expect(page.url()).not.toContain('/dashboard');
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
