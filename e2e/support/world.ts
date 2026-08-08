import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import { Browser, BrowserContext, Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import DatabaseHelper from '../helpers/database.helper';

/**
 * World customizado do Cucumber.
 *
 * Expõe `this.page`/`this.context`/`this.browser` (preenchidos pelos hooks em
 * `e2e/step-definitions/hooks.ts`) e atalhos para o DatabaseHelper, para que os
 * step definitions possam fazer setup de dados diretamente no banco
 * (`this.createRental(...)`, `this.getDepositInstallments(...)`, etc.) sem
 * precisar importar o helper em cada arquivo.
 */
export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  loginPage!: LoginPage;
  dashboardPage!: DashboardPage;

  // Fixtures compartilhadas entre steps de um mesmo cenário
  locationId?: string;
  propertyId?: string;
  tenantId?: string;
  rentalId?: string;
  tenantName?: string;
  totalCommission?: number;

  // Bag genérico usado pelos steps mais antigos (payments/rentals.steps.ts)
  testData: Record<string, any> = {};

  constructor(options: IWorldOptions) {
    super(options);
  }

  // ---- Atalhos para DatabaseHelper (mantêm compatibilidade com os steps
  // já escritos que chamam `this.createRental(...)` etc.) ----

  async createLocation(...args: Parameters<typeof DatabaseHelper.createLocation>) {
    return DatabaseHelper.createLocation(...args);
  }

  async createProperty(...args: Parameters<typeof DatabaseHelper.createProperty>) {
    return DatabaseHelper.createProperty(...args);
  }

  async createTenant(...args: Parameters<typeof DatabaseHelper.createTenant>) {
    return DatabaseHelper.createTenant(...args);
  }

  async createRental(...args: Parameters<typeof DatabaseHelper.createRental>) {
    return DatabaseHelper.createRental(...args);
  }

  async getRental(id: string) {
    return DatabaseHelper.getRental(id);
  }

  async updateRental(id: string, updates: Record<string, any>) {
    return DatabaseHelper.updateRental(id, updates);
  }

  async getDepositInstallments(rentalId: string) {
    return DatabaseHelper.getDepositInstallments(rentalId);
  }

  async getAllDepositInstallments() {
    return DatabaseHelper.getAllDepositInstallments();
  }

  async updateDepositInstallment(id: string, updates: Record<string, any>) {
    return DatabaseHelper.updateDepositInstallment(id, updates);
  }

  async findLocationByName(name: string) {
    return DatabaseHelper.findLocationByName(name);
  }

  async findPropertyByIdentifier(identifier: string) {
    return DatabaseHelper.findPropertyByIdentifier(identifier);
  }

  async findTenantByName(name: string) {
    return DatabaseHelper.findTenantByName(name);
  }

  async upsertPayment(...args: Parameters<typeof DatabaseHelper.upsertPayment>) {
    return DatabaseHelper.upsertPayment(...args);
  }
}

setWorldConstructor(CustomWorld);
