import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model - Dashboard / navegação principal
 *
 * ⚠️ Atualizado em 2026-08: o menu lateral (src/components/Layout.tsx) não
 * usa ids do tipo "#nav-properties" — os itens são links de texto
 * ("Imóveis", "Inquilinos" etc.), por isso os locators abaixo usam
 * `getByRole('link', { name })`, igual ao que os step definitions já fazem.
 */
export class DashboardPage {
  readonly page: Page;

  readonly dashboardMenuItem: Locator;
  readonly propertiesMenuItem: Locator;
  readonly tenantsMenuItem: Locator;
  readonly rentalsMenuItem: Locator;
  readonly paymentsMenuItem: Locator;
  readonly financialMenuItem: Locator;
  readonly settingsMenuItem: Locator;

  readonly userMenuTrigger: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.dashboardMenuItem = page.getByRole('link', { name: /dashboard/i });
    this.propertiesMenuItem = page.getByRole('link', { name: /imóveis/i });
    this.tenantsMenuItem = page.getByRole('link', { name: /inquilinos/i });
    this.rentalsMenuItem = page.getByRole('link', { name: /locações/i });
    this.paymentsMenuItem = page.getByRole('link', { name: /pagamentos/i });
    this.financialMenuItem = page.getByRole('link', { name: /financeiro/i });
    this.settingsMenuItem = page.getByRole('link', { name: /configurações/i });

    // ids reais: layout-user-menu-trigger / layout-menu-logout (desktop) /
    // layout-mobile-logout (mobile)
    this.userMenuTrigger = page.locator('#layout-user-menu-trigger');
    this.logoutButton = page.locator('#layout-menu-logout, #layout-mobile-logout');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async isLoaded() {
    await expect(this.page).toHaveURL(/.*dashboard/);
  }

  async getVisibleMenuItems(): Promise<string[]> {
    const menus = {
      dashboard: this.dashboardMenuItem,
      properties: this.propertiesMenuItem,
      tenants: this.tenantsMenuItem,
      rentals: this.rentalsMenuItem,
      payments: this.paymentsMenuItem,
      financial: this.financialMenuItem,
      settings: this.settingsMenuItem,
    };

    const visible: string[] = [];

    for (const [name, locator] of Object.entries(menus)) {
      try {
        if (await locator.isVisible({ timeout: 1000 })) {
          visible.push(name);
        }
      } catch {
        // Menu não visível
      }
    }

    return visible;
  }

  /** Abre o dropdown do usuário (canto superior direito). */
  async openUserMenu() {
    await this.userMenuTrigger.click();
    await this.page.waitForTimeout(300);
  }

  async logout() {
    await this.openUserMenu();
    await this.logoutButton.first().click();
  }
}
