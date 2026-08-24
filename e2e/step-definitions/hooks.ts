import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import DatabaseHelper from '../helpers/database.helper';
import TEST_CONFIG from '../config/test.config';

setDefaultTimeout(60 * 1000);

// Garante que os usuários de teste (admin/financeiro/corretor) existem antes
// de qualquer cenário rodar.
BeforeAll(async function () {
  await DatabaseHelper.ensureDefaultTestUsers();
});

Before(async function (this: CustomWorld) {
  // HEADED=true abre o navegador na tela; SLOW_MO atrasa cada acao para dar
  // tempo de acompanhar. Os dois sao ligados por `npm run test:smoke:ver`.
  this.browser = await chromium.launch({
    headless: process.env.HEADED !== 'true',
    slowMo: Number(process.env.SLOW_MO || 0),
  });
  // ✅ CORREÇÃO: sem baseURL, todo page.goto('/') (ou qualquer caminho
  // relativo) quebrava com "Cannot navigate to invalid URL" - os testes BDD
  // (cucumber) não passam por playwright.config.ts (que só vale pra
  // `npm run test:e2e`), então precisam da própria baseURL aqui.
  this.context = await this.browser.newContext({
    viewport: { width: 1280, height: 720 },
    baseURL: TEST_CONFIG.baseUrl,
  });
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
