import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * Carregar variáveis de ambiente do .env.local
 * CRÍTICO: Playwright NÃO carrega .env.local automaticamente
 */
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

/**
 * Configuração do Playwright para testes E2E
 * Documentação: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  
  /* Executar testes em paralelo */
  fullyParallel: true,
  
  /* IMPORTANTE: NÃO parar testes ao encontrar erros - continuar executando */
  maxFailures: 0, // 0 = nunca para, continua até o fim
  
  /* Falhar no CI se você acidentalmente deixou test.only */
  forbidOnly: !!process.env.CI,
  
  /* Retry em CI apenas */
  retries: process.env.CI ? 2 : 0,
  
  /* Workers - controla paralelismo */
  workers: process.env.CI ? 1 : 4,
  
  /* Timeout por teste */
  timeout: 60 * 1000, // 60 segundos
  
  /* Timeout de expect */
  expect: {
    timeout: 10 * 1000 // 10 segundos
  },
  
  /* Reporter com múltiplos formatos */
  reporter: [
    ['html', { outputFolder: 'e2e/reports/playwright-report' }],
    ['json', { outputFile: 'e2e/reports/test-results.json' }],
    ['junit', { outputFile: 'e2e/reports/junit.xml' }],
    ['list'] // Console output
  ],
  
  /* Configuração compartilhada para todos os projetos */
  use: {
    /* URL base da aplicação */
    baseURL: 'http://localhost:3000',
    
    /* Capturar screenshot apenas quando falhar */
    screenshot: 'only-on-failure',
    
    /* Capturar vídeo apenas quando falhar */
    video: 'retain-on-failure',
    
    /* Trace apenas quando falhar */
    trace: 'on-first-retry',
    
    /* Ignorar erros de HTTPS */
    ignoreHTTPSErrors: true,
    
    /* Viewport padrão */
    viewport: { width: 1280, height: 720 },
  },

  /* Configurar projetos para diferentes navegadores e tipos de teste */
  projects: [
    /*
     * Projeto principal: roda TODOS os arquivos *.spec.ts, com ou sem tag.
     *
     * ⚠️ Antes este projeto tinha `grep: /@ui/`, e como só 4 dos ~18 arquivos
     * de teste possuíam alguma tag (@smoke/@security/@performance/@stress),
     * os outros 14 nunca eram executados por `npm run test:e2e` — inclusive
     * em CI. Os projetos abaixo (api-tests, permissions, performance,
     * security, smoke, regression) continuam existindo para rodar subconjuntos
     * marcados por tag isoladamente (ex.: `npx playwright test --project=smoke`).
     */
    {
      name: 'all-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.spec\.ts/,
    },

    /* Testes de API */
    {
      name: 'api-tests',
      use: { ...devices['Desktop Chrome'] },
      grep: /@api/,
    },

    /* Testes de Permissões */
    {
      name: 'permissions',
      use: { ...devices['Desktop Chrome'] },
      grep: /@permissions/,
    },

    /* Testes de Performance */
    {
      name: 'performance',
      use: { ...devices['Desktop Chrome'] },
      grep: /@performance/,
      timeout: 120 * 1000, // 2 minutos
    },

    /* Testes de Segurança */
    {
      name: 'security',
      use: { ...devices['Desktop Chrome'] },
      grep: /@security/,
    },

    /* Testes de Smoke (fumaça - os mais críticos) */
    {
      name: 'smoke',
      use: { ...devices['Desktop Chrome'] },
      grep: /@smoke/,
    },

    /* Testes de Regressão */
    {
      name: 'regression',
      use: { ...devices['Desktop Chrome'] },
      grep: /@regression/,
    },
  ],

  /* Executar servidor de desenvolvimento antes dos testes */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  /* Global setup/teardown */
  globalSetup: require.resolve('./e2e/helpers/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/helpers/global-teardown.ts'),
});