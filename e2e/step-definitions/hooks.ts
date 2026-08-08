import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import DatabaseHelper from '../helpers/database.helper';

setDefaultTimeout(60 * 1000);

// Garante que os usuários de teste (admin/financeiro/corretor) existem antes
// de qualquer cenário rodar.
BeforeAll(async function () {
  await DatabaseHelper.ensureDefaultTestUsers();
});

Before(async function (this: CustomWorld) {
  this.browser = await chromium.launch({ headless: process.env.HEADED !== 'true' });
  this.context = await this.browser.newContext({ viewport: { width: 1280, height: 720 } });
  this.page = await this.context.newPage();

  this.loginPage = new LoginPage(this.page);
  this.dashboardPage = new DashboardPage(this.page);
  this.testData = {};
});

After(async function (this: CustomWorld, { result }) {
  if (result && result.status === 'FAILED' && this.page) {
    // Guarda um screenshot para facilitar o debug de falhas
    const name = this.testData?.scenarioName || 'failure';
    await this.page.screenshot({
      path: `e2e/reports/screenshots/${Date.now()}-${name}.png`,
      fullPage: true,
    }).catch(() => {});
  }

  await this.page?.close();
  await this.context?.close();
  await this.browser?.close();
});

// Remove dados de teste (locações, imóveis, inquilinos, localizações) criados
// durante a execução. Usuários fixos de teste são mantidos.
AfterAll(async function () {
  await DatabaseHelper.cleanupAllTestData();
});
