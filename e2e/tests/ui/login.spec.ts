import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import TEST_CONFIG from '../../config/test.config';

/**
 * Testes de UI - Login (dropdown "Gerenciador" na home pública "/")
 *
 * ⚠️ Atualizado em 2026-08: não existe mais uma rota "/login" dedicada — ver
 * src/components/public/PublicHeader.tsx e e2e/pages/LoginPage.ts.
 */

test.describe('Login (dropdown) - UI Tests', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.openLoginDropdown();
  });

  test('deve carregar o formulário corretamente', async () => {
    await loginPage.isLoaded();
  });

  test('deve preencher campos de usuário e senha', async () => {
    await loginPage.usernameInput.fill('teste@exemplo.com');
    await expect(loginPage.usernameInput).toHaveValue('teste@exemplo.com');

    await loginPage.passwordInput.fill('senha123');
    await expect(loginPage.passwordInput).toHaveValue('senha123');
  });

  test('deve alternar visibilidade da senha', async () => {
    await loginPage.passwordInput.fill('MinhaSenh@123');

    expect(await loginPage.isPasswordVisible()).toBe(false);

    await loginPage.togglePasswordVisibility();
    expect(await loginPage.isPasswordVisible()).toBe(true);

    await loginPage.togglePasswordVisibility();
    expect(await loginPage.isPasswordVisible()).toBe(false);
  });

  test('deve abrir o formulário de recuperação de senha e voltar', async () => {
    await loginPage.openForgotPasswordModal();
    await expect(loginPage.resetEmailInput).toBeVisible();

    await loginPage.resetBackButton.click();
    await expect(loginPage.usernameInput).toBeVisible();
  });

  test('deve exigir e-mail válido no formulário de recuperação (HTML5)', async () => {
    await loginPage.openForgotPasswordModal();

    const isValid = await loginPage.resetEmailInput.evaluate(
      (el: HTMLInputElement) => el.checkValidity()
    );
    // Campo vazio: HTML5 (type="email" required) barra o envio
    expect(isValid).toBe(false);
  });

  test('deve processar e-mail cadastrado no formulário de recuperação', async () => {
    await loginPage.openForgotPasswordModal();
    await loginPage.submitForgotPassword(TEST_CONFIG.users.admin.email);

    await expect(loginPage.resetSuccessTitle).toBeVisible({ timeout: 10000 });
  });

  test('deve mostrar erro com credenciais inválidas', async () => {
    const { email, password } = TEST_CONFIG.users.invalid;
    await loginPage.login(email, password);

    // Deve permanecer na home (não existe redirecionamento em caso de erro)
    expect(await loginPage.isOnLoginPage()).toBe(true);
    expect(await loginPage.hasError()).toBe(true);
  });
});
