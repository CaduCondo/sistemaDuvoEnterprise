import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model - Login
 *
 * ⚠️ IMPORTANTE (corrigido em 2026-08): não existe mais uma página dedicada
 * "/login". O acesso administrativo é feito através de um dropdown
 * ("Gerenciador") no cabeçalho da página pública "/" — ver
 * src/components/public/PublicHeader.tsx. Este Page Object reflete o
 * comportamento real e atual do componente.
 */
export class LoginPage {
  readonly page: Page;

  // Trigger do dropdown
  readonly managerTrigger: Locator;

  // Formulário de login
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly togglePasswordButton: Locator;
  readonly submitButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  // Formulário de recuperação de senha
  readonly resetEmailInput: Locator;
  readonly resetSubmitButton: Locator;
  readonly resetBackButton: Locator;
  readonly resetSuccessTitle: Locator;

  constructor(page: Page) {
    this.page = page;

    this.managerTrigger = page.getByRole('button', { name: /gerenciador/i });

    this.usernameInput = page.locator('#username');
    this.passwordInput = page.locator('#password');
    this.togglePasswordButton = this.passwordInput.locator('xpath=following-sibling::button[1]');
    this.submitButton = page.getByRole('button', { name: /^entrar$/i });
    this.forgotPasswordLink = page.getByRole('button', { name: /esqueci minha senha/i });
    this.errorMessage = page.getByText(/senha incorreta|não encontrado|bloqueada|erro ao processar/i);
    this.successMessage = page.getByText(/login realizado com sucesso/i);

    this.resetEmailInput = page.locator('#recovery-email');
    this.resetSubmitButton = page.getByRole('button', { name: /enviar senha/i });
    this.resetBackButton = page.getByRole('button', { name: /voltar/i });
    this.resetSuccessTitle = page.getByText(/e-mail enviado com sucesso/i);
  }

  /** Navega para a home pública, onde vive o acesso administrativo. */
  async goto() {
    await this.page.goto('/');
  }

  /** Abre o dropdown "Gerenciador" com o formulário de login. */
  async openLoginDropdown() {
    await this.managerTrigger.click();
    await expect(this.usernameInput).toBeVisible({ timeout: 5000 });
  }

  /** Fluxo completo: abre o dropdown (se necessário) e faz login. */
  async login(username: string, password: string) {
    if (!(await this.usernameInput.isVisible().catch(() => false))) {
      await this.openLoginDropdown();
    }
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async isLoaded() {
    await expect(this.page.getByText(/property control system/i)).toBeVisible();
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async togglePasswordVisibility() {
    await this.togglePasswordButton.click();
  }

  async isPasswordVisible(): Promise<boolean> {
    const type = await this.passwordInput.getAttribute('type');
    return type === 'text';
  }

  async openForgotPasswordModal() {
    await this.forgotPasswordLink.click();
    await this.page.waitForTimeout(300);
    await expect(this.resetEmailInput).toBeVisible();
  }

  async submitForgotPassword(email: string) {
    await this.resetEmailInput.fill(email);
    await this.resetSubmitButton.click();
  }

  async hasError(): Promise<boolean> {
    try {
      await expect(this.errorMessage).toBeVisible({ timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /** Antes o login era numa rota própria; hoje é sempre a home. */
  async isOnLoginPage(): Promise<boolean> {
    return this.page.url().endsWith('/') || this.page.url().includes('localhost:3000/');
  }
}
