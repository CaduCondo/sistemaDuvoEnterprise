import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import DatabaseHelper from '../helpers/database.helper';
import TEST_CONFIG from '../config/test.config';

/**
 * Tempo máximo de CADA passo (não do cenário inteiro).
 *
 * ⚠️ Baixado de 60s para 20s em 07/set/2026 (issue #66) -- o motivo é o
 * custo das FALHAS, não o das passagens. Um passo que passa leva 1-3s; quem
 * consome os 60s é sempre um passo que vai falhar (espera um elemento que
 * nunca aparece). Como a rodada @sistemaCompleto tem hoje dezenas de
 * cenários vermelhos, esses 60s por falha somavam mais de 30 minutos e
 * estouravam o limite do job -- o relatório nunca era gerado e ficávamos
 * sem saber o que estava falhando de verdade.
 *
 * 20s continua folgado: no smoke real, o passo mais lento (compilar +
 * navegar + login) fica bem abaixo disso.
 */
setDefaultTimeout(20 * 1000);

// Garante que os usuários de teste (admin/financeiro/corretor) existem antes
// de qualquer cenário rodar.
//
// Redundante de propósito com e2e/support/seed-test-users.ts (issue #65):
// aquele script já roda isso uma vez, fora do Cucumber, antes de qualquer
// worker subir -- é a garantia de verdade quando se roda via
// `npm run test:smoke`/`test:completo` (scripts/smoke.js). Este BeforeAll
// continua aqui como rede de segurança para quem rodar `npx cucumber-js`
// direto (sem passar pelo smoke.js) -- com `parallel: 2` ele roda uma vez
// por worker, mas como o reset é idempotente isso não causa problema, só
// reforça o mesmo valor.
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

  // Guarda os erros do navegador para a mensagem da falha (ver
  // CustomWorld.errosDoNavegador).
  this.errosDoNavegador = [];
  this.page.on('console', (msg) => {
    if (msg.type() === 'error') this.errosDoNavegador.push(`console: ${msg.text()}`);
  });
  this.page.on('pageerror', (erro) => {
    this.errosDoNavegador.push(`exceção: ${erro.message}`);
  });

  this.loginPage = new LoginPage(this.page);
  this.dashboardPage = new DashboardPage(this.page);
  this.testData = {};
});

/**
 * Rede de segurança contra o defeito que derrubou 128 dos 138 cenários em
 * 07/set/2026 (issues #65/#66).
 *
 * Alguns cenários MEXEM na senha de usuários ("Esqueci minha senha" troca a
 * senha por uma temporária; reset/troca de senha pelo admin também). Se um
 * deles pegar a conta compartilhada (admin@teste.com), todo cenário
 * seguinte falha no login -- e o motivo fica invisível, porque o erro
 * aparece em 100+ cenários que não têm nada a ver com senha.
 *
 * Todo cenário assim deve levar a tag @mexeComSenhaDeUsuario. Este hook
 * ressemeia os usuários padrão logo depois dele, devolvendo as senhas
 * conhecidas -- mesmo que o cenário tenha falhado no meio.
 */
After({ tags: '@mexeComSenhaDeUsuario' }, async function () {
  await DatabaseHelper.ensureDefaultTestUsers();
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
// 60 segundos (o padrão) não bastavam: a limpeza apaga locações, imóveis,
// inquilinos e localizações de todos os cenários da rodada, uma tabela de cada
// vez. Quando ela estoura o tempo, os dados de teste ficam para trás no banco.
AfterAll({ timeout: 300000 }, async function () {
  await DatabaseHelper.cleanupAllTestData();
});
