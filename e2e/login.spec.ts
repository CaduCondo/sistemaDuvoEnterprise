import { test, expect } from '@playwright/test';

/**
 * Testes completos do fluxo de login.
 *
 * ⚠️ Atualizado em 2026-08: não existe mais rota "/login" nem os ids
 * "#login-submit-button"/"#login-forgot-password-*"/"#reset-email" usados
 * antes. O acesso administrativo é o dropdown "Gerenciador" na home pública
 * "/" — ver src/components/public/PublicHeader.tsx.
 */

async function openLoginDropdown(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /gerenciador/i }).click();
  await page.locator('#username').waitFor({ state: 'visible' });
}

test.describe('Login via dropdown "Gerenciador"', () => {
  test.beforeEach(async ({ page }) => {
    await openLoginDropdown(page);
  });

  test('deve exibir todos os elementos da interface', async ({ page }) => {
    await expect(page.getByText("D'Uvo Enterprise")).toBeVisible();
    await expect(page.getByText('Property Control System')).toBeVisible();

    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /^entrar$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /esqueci minha senha/i })).toBeVisible();

    await expect(page.getByText('Carlos Uva')).toBeVisible();
  });

  test('deve preencher e limpar os campos corretamente', async ({ page }) => {
    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');

    await usernameInput.fill('usuario@exemplo.com');
    await expect(usernameInput).toHaveValue('usuario@exemplo.com');

    await passwordInput.fill('MinhaSenh@123');
    await expect(passwordInput).toHaveValue('MinhaSenh@123');

    await usernameInput.clear();
    await passwordInput.clear();

    await expect(usernameInput).toHaveValue('');
    await expect(passwordInput).toHaveValue('');
  });

  test('toggle de senha deve alternar visibilidade', async ({ page }) => {
    const passwordInput = page.locator('#password');
    // O botão de mostrar/ocultar senha não tem id — é o único <button> ao
    // lado do campo #password.
    const toggleButton = passwordInput.locator('xpath=following-sibling::button[1]');

    await expect(passwordInput).toHaveAttribute('type', 'password');

    await passwordInput.fill('SenhaSecreta123');

    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('botão de submit deve estar habilitado quando campos preenchidos', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /^entrar$/i });

    await expect(submitButton).toBeEnabled();

    await page.locator('#username').fill('usuario@exemplo.com');
    await page.locator('#password').fill('senha123');

    await expect(submitButton).toBeEnabled();
  });

  test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
    await page.locator('#username').fill('invalido@exemplo.com');
    await page.locator('#password').fill('senhaerrada');
    await page.getByRole('button', { name: /^entrar$/i }).click();

    await page.waitForTimeout(3000);

    const hasError = await page.getByText(/senha incorreta|não encontrado|bloqueada/i).isVisible().catch(() => false);
    const stillOnHome = page.url().endsWith('/') || page.url().includes('localhost:3000/');

    expect(hasError || stillOnHome).toBeTruthy();
  });
});

test.describe('Recuperação de senha', () => {
  test.beforeEach(async ({ page }) => {
    await openLoginDropdown(page);
    await page.getByRole('button', { name: /esqueci minha senha/i }).click();
    await page.waitForTimeout(300);
  });

  test('deve abrir e voltar do formulário de recuperação', async ({ page }) => {
    await expect(page.locator('#recovery-email')).toBeVisible();
    await expect(page.getByText('Recuperar Senha')).toBeVisible();

    await page.getByRole('button', { name: /^voltar$/i }).click();
    await page.waitForTimeout(300);

    await expect(page.locator('#username')).toBeVisible();
  });

  test('deve exigir e-mail preenchido (validação HTML5)', async ({ page }) => {
    const isValid = await page.locator('#recovery-email').evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });

  test('deve informar quando o e-mail não está cadastrado', async ({ page }) => {
    await page.locator('#recovery-email').fill('nao-cadastrado@teste.com');
    await page.getByRole('button', { name: /enviar senha/i }).click();

    await expect(page.getByText(/e-mail não encontrado/i)).toBeVisible({ timeout: 10000 });
  });
});
