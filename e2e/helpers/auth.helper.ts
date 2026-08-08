import { Page } from '@playwright/test';
import TEST_CONFIG from '../config/test.config';

/**
 * Helper de Autenticação
 * 
 * Funções reutilizáveis para login/logout nos testes
 */

export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Fazer login com credenciais.
   *
   * ⚠️ O acesso administrativo não é mais uma rota "/login" dedicada: é um
   * dropdown ("Gerenciador") no cabeçalho da home pública "/" — ver
   * src/components/public/PublicHeader.tsx.
   */
  async login(email: string, password: string) {
    await this.page.goto('/');

    const usernameInput = this.page.locator('#username');
    if (!(await usernameInput.isVisible().catch(() => false))) {
      await this.page.getByRole('button', { name: /gerenciador/i }).click();
      await usernameInput.waitFor({ state: 'visible', timeout: 5000 });
    }

    await usernameInput.fill(email);
    await this.page.locator('#password').fill(password);
    await this.page.getByRole('button', { name: /^entrar$/i }).click();

    // Login usa `window.location.href`, então é uma navegação completa
    await this.page.waitForURL('**/dashboard', {
      timeout: TEST_CONFIG.timeouts.navigation
    });
  }

  /**
   * Login como Admin
   */
  async loginAsAdmin() {
    const { email, password } = TEST_CONFIG.users.admin;
    await this.login(email, password);
  }

  /**
   * Login como Financeiro
   */
  async loginAsFinancial() {
    const { email, password } = TEST_CONFIG.users.financial;
    await this.login(email, password);
  }

  /**
   * Login como Gestão
   */
  async loginAsManagement() {
    const { email, password } = TEST_CONFIG.users.management;
    await this.login(email, password);
  }

  /**
   * Logout
   */
  async logout() {
    // Clicar no menu do usuário (id real: layout-user-menu-trigger)
    await this.page.locator('#layout-user-menu-trigger').click();
    await this.page.waitForTimeout(300);

    // Clicar em logout (id real: layout-menu-logout / layout-mobile-logout)
    await this.page.locator('#layout-menu-logout, #layout-mobile-logout').first().click();

    // Aguardar redirect para a home pública (não existe mais rota "/login")
    await this.page.waitForURL('**/', {
      timeout: TEST_CONFIG.timeouts.medium
    });
  }

  /**
   * Verificar se está autenticado
   */
  async isAuthenticated(): Promise<boolean> {
    const url = this.page.url();
    return !url.includes('/login');
  }

  /**
   * Verificar se está na página de login
   */
  async isOnLoginPage(): Promise<boolean> {
    const url = this.page.url();
    return url.includes('/login');
  }
}

/**
 * Helper function para criar instância
 */
export function createAuthHelper(page: Page): AuthHelper {
  return new AuthHelper(page);
}