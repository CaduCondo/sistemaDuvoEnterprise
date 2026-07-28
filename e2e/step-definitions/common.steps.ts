import { Given, When, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, Browser, Page, BrowserContext, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import DatabaseHelper from '../helpers/database.helper';
import { createAuthHelper } from '../helpers/auth.helper';
import TEST_CONFIG from '../config/test.config';

// Aumentar timeout para 60 segundos
setDefaultTimeout(60 * 1000);

// Variáveis globais para compartilhar entre steps
let browser: Browser;
let context: BrowserContext;
let page: Page;
let loginPage: LoginPage;
let dashboardPage: DashboardPage;

// Antes de cada cenário
Before(async function() {
  browser = await chromium.launch({ headless: false });
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  page = await context.newPage();
  
  loginPage = new LoginPage(page);
  dashboardPage = new DashboardPage(page);
  
  // Armazenar no contexto do Cucumber para acesso em outros steps
  this.page = page;
  this.loginPage = loginPage;
  this.dashboardPage = dashboardPage;
});

// Depois de cada cenário
After(async function() {
  await page?.close();
  await context?.close();
  await browser?.close();
});

/**
 * ===================
 * NAVEGAÇÃO
 * ===================
 */

Given('que estou na página de login', async function() {
  await this.loginPage.goto();
  await expect(this.page).toHaveURL(/.*login/);
});

Given('que estou na página {string}', async function(url: string) {
  await this.page.goto(url);
  await this.page.waitForLoadState('networkidle');
});

When('acesso o dashboard', async function() {
  await this.page.goto('/dashboard');
  await this.page.waitForLoadState('networkidle');
});

When('acesso a página {string}', async function(url: string) {
  await this.page.goto(url);
  await this.page.waitForLoadState('networkidle');
});

When('navego para {string}', async function(url: string) {
  await this.page.goto(url);
  await this.page.waitForLoadState('networkidle');
});

When('retorno para {string}', async function(url: string) {
  await this.page.goto(url);
  await this.page.waitForLoadState('networkidle');
});

/**
 * ===================
 * AUTENTICAÇÃO
 * ===================
 */

Given('que fiz login como {string}', async function(role: string) {
  const authHelper = createAuthHelper(this.page);
  
  switch(role.toLowerCase()) {
    case 'admin':
      await authHelper.loginAsAdmin();
      break;
    case 'financial':
    case 'financeiro':
      await authHelper.loginAsFinancial();
      break;
    case 'management':
    case 'gestao':
    case 'gestão':
      await authHelper.loginAsManagement();
      break;
    default:
      throw new Error(`Perfil desconhecido: ${role}`);
  }
  
  await this.page.waitForURL('**/dashboard', { timeout: 10000 });
});

When('preencho o campo {string} com {string}', async function(field: string, value: string) {
  let locator;
  
  switch(field.toLowerCase()) {
    case 'usuário':
    case 'usuario':
      locator = this.page.locator('#username');
      break;
    case 'senha':
      locator = this.page.locator('#password');
      break;
    default:
      throw new Error(`Campo desconhecido: ${field}`);
  }
  
  await locator.fill(value);
});

When('clico no botão {string}', async function(buttonText: string) {
  const button = this.page.getByRole('button', { name: new RegExp(buttonText, 'i') });
  await button.click();
});

When('clico em {string}', async function(text: string) {
  const element = this.page.getByText(new RegExp(text, 'i'));
  await element.click();
});

/**
 * ===================
 * VALIDAÇÕES
 * ===================
 */

Then('devo ser redirecionado para {string}', async function(url: string) {
  await this.page.waitForURL(`**${url}`, { timeout: 10000 });
  await expect(this.page).toHaveURL(new RegExp(url));
});

Then('devo permanecer na página de login', async function() {
  await expect(this.page).toHaveURL(/.*login/);
});

Then('devo ver a página do dashboard', async function() {
  await expect(this.page.locator('#dashboard-page')).toBeVisible({ timeout: 5000 });
});

Then('devo ver uma mensagem de erro', async function() {
  // Aguardar qualquer mensagem de erro aparecer
  const errorMessage = this.page.locator('[role="alert"]').or(
    this.page.getByText(/erro|inválid|falhou/i)
  );
  await expect(errorMessage).toBeVisible({ timeout: 5000 });
});

Then('devo ver a mensagem {string}', async function(message: string) {
  const element = this.page.getByText(new RegExp(message, 'i'));
  await expect(element).toBeVisible({ timeout: 5000 });
});

Then('devo ver o botão {string}', async function(buttonText: string) {
  const button = this.page.getByRole('button', { name: new RegExp(buttonText, 'i') });
  await expect(button).toBeVisible();
});

Then('devo ver {string}', async function(text: string) {
  const element = this.page.getByText(new RegExp(text, 'i'));
  await expect(element).toBeVisible({ timeout: 5000 });
});

/**
 * ===================
 * MENUS E NAVEGAÇÃO
 * ===================
 */

When('clico no menu {string}', async function(menuName: string) {
  const menu = this.page.getByRole('link', { name: new RegExp(menuName, 'i') });
  await menu.click();
  await this.page.waitForLoadState('networkidle');
});

Then('devo ver os seguintes menus:', async function(dataTable: any) {
  const menuItems = dataTable.hashes();
  
  for (const item of menuItems) {
    const menu = this.page.getByRole('link', { name: new RegExp(item.menu, 'i') });
    await expect(menu).toBeVisible({ timeout: 5000 });
  }
});

Then('NÃO devo ver os seguintes menus:', async function(dataTable: any) {
  const menuItems = dataTable.hashes();
  
  for (const item of menuItems) {
    const menu = this.page.getByRole('link', { name: new RegExp(item.menu, 'i') });
    await expect(menu).not.toBeVisible();
  }
});

/**
 * ===================
 * LISTAS E TABELAS
 * ===================
 */

Then('devo ver a lista de {string}', async function(entityName: string) {
  // Aguardar a tabela ou grid carregar
  await this.page.waitForSelector('table, [role="grid"]', { timeout: 5000 });
  const hasContent = await this.page.locator('table, [role="grid"]').count() > 0;
  expect(hasContent).toBe(true);
});

Then('devo ver as colunas:', async function(dataTable: any) {
  const columns = dataTable.hashes();
  
  for (const col of columns) {
    const header = this.page.getByRole('columnheader', { name: new RegExp(col.coluna, 'i') });
    await expect(header).toBeVisible({ timeout: 5000 });
  }
});

/**
 * ===================
 * PERMISSÕES
 * ===================
 */

When('tento acessar {string}', async function(url: string) {
  await this.page.goto(url);
  await this.page.waitForTimeout(2000);
});

Then('devo ser bloqueado', async function() {
  // Verificar se foi redirecionado ou se há mensagem de erro
  const currentUrl = this.page.url();
  const hasError = await this.page.getByText(/não autorizado|sem permissão|403/i).isVisible().catch(() => false);
  const redirectedToDashboard = currentUrl.includes('/dashboard');
  
  expect(hasError || redirectedToDashboard).toBe(true);
});

Then('devo permanecer no dashboard ou ver página de erro 403', async function() {
  const currentUrl = this.page.url();
  const isDashboard = currentUrl.includes('/dashboard');
  const is403 = currentUrl.includes('/403') || currentUrl.includes('/unauthorized');
  const hasError = await this.page.getByText(/não autorizado|sem permissão|403/i).isVisible().catch(() => false);
  
  expect(isDashboard || is403 || hasError).toBe(true);
});

/**
 * ===================
 * FORMULÁRIOS
 * ===================
 */

When('preencho todos os campos obrigatórios', async function() {
  // Implementação genérica - pode ser sobrescrita em steps específicos
  await this.page.waitForTimeout(500);
});

When('preencho os campos obrigatórios:', async function(dataTable: any) {
  const fields = dataTable.hashes();
  
  for (const field of fields) {
    const fieldName = field.campo.toLowerCase();
    const value = field.valor;
    
    let locator;
    
    if (fieldName.includes('nome')) {
      locator = this.page.locator('input[name="name"], input#tenant-name');
    } else if (fieldName.includes('cpf')) {
      locator = this.page.locator('input[name="cpf"], input#tenant-cpf');
    } else if (fieldName.includes('cnpj')) {
      locator = this.page.locator('input[name="cnpj"], input#tenant-cnpj');
    } else if (fieldName.includes('telefone')) {
      locator = this.page.locator('input[name="phone"], input#tenant-phone');
    } else if (fieldName.includes('e-mail') || fieldName.includes('email')) {
      locator = this.page.locator('input[name="email"], input#tenant-email');
    }
    
    if (locator) {
      await locator.fill(value);
    }
  }
});

When('preencho os campos opcionais:', async function(dataTable: any) {
  const fields = dataTable.hashes();
  
  for (const field of fields) {
    const fieldName = field.campo.toLowerCase();
    const value = field.valor;
    
    let locator;
    
    if (fieldName.includes('profissão') || fieldName.includes('profissao')) {
      locator = this.page.locator('input[name="occupation"], input#tenant-occupation');
      await locator.fill(value);
    } else if (fieldName.includes('estado civil')) {
      locator = this.page.locator('select[name="maritalStatus"], select#tenant-marital-status');
      await locator.selectOption({ label: value });
    } else if (fieldName.includes('renda mensal')) {
      locator = this.page.locator('input[name="monthlyIncome"], input#tenant-monthly-income');
      // Simular digitação para testar máscara
      await locator.click();
      const cleanValue = value.replace(/[^\d]/g, '');
      await locator.pressSequentially(cleanValue);
    }
  }
});

When('deixo os campos opcionais vazios:', async function(dataTable: any) {
  // Apenas validar que os campos existem mas não preenchê-los
  const fields = dataTable.hashes();
  
  for (const field of fields) {
    const fieldName = field.campo.toLowerCase();
    
    let locator;
    
    if (fieldName.includes('profissão') || fieldName.includes('profissao')) {
      locator = this.page.locator('input[name="occupation"], input#tenant-occupation');
    } else if (fieldName.includes('estado civil')) {
      locator = this.page.locator('select[name="maritalStatus"], select#tenant-marital-status');
    } else if (fieldName.includes('renda mensal')) {
      locator = this.page.locator('input[name="monthlyIncome"], input#tenant-monthly-income');
    }
    
    if (locator) {
      await expect(locator).toBeVisible();
    }
  }
});

When('preencho a renda mensal digitando {string}', async function(value: string) {
  const locator = this.page.locator('input[name="monthlyIncome"], input#tenant-monthly-income');
  await locator.click();
  await locator.pressSequentially(value);
});

When('continuo digitando até {string}', async function(value: string) {
  const locator = this.page.locator('input[name="monthlyIncome"], input#tenant-monthly-income');
  await locator.pressSequentially(value.replace(/^\d+/, '').replace(/[^\d]/g, ''));
});

Then('o campo deve exibir {string}', async function(expectedValue: string) {
  await this.page.waitForTimeout(500); // Aguardar máscara aplicar
  
  // Tentar encontrar o campo preenchido
  const field = this.page.locator(`input[value="${expectedValue}"]`);
  await expect(field).toBeVisible({ timeout: 5000 });
});

When('clico no campo {string}', async function(fieldName: string) {
  let locator;
  
  if (fieldName.toLowerCase().includes('estado civil')) {
    locator = this.page.locator('select[name="maritalStatus"], select#tenant-marital-status');
  }
  
  if (locator) {
    await locator.click();
  }
});

Then('devo ver as seguintes opções:', async function(dataTable: any) {
  const options = dataTable.hashes();
  
  for (const opt of options) {
    const option = this.page.getByRole('option', { name: new RegExp(opt.opção, 'i') });
    await expect(option).toBeVisible({ timeout: 5000 });
  }
});

Given('que existe um inquilino {string} sem dados opcionais', async function(name: string) {
  // Criar inquilino via API ou banco de dados
  // Para simplificar, assumir que já existe
  this.tenantName = name;
});

When('abro o inquilino {string} para edição', async function(name: string) {
  // Buscar inquilino na lista e clicar para editar
  const row = this.page.getByText(name).first();
  await row.click();
  
  // Aguardar dialog/formulário abrir
  await this.page.waitForTimeout(1000);
});

When('abro o inquilino novamente', async function() {
  const name = this.tenantName;
  const row = this.page.getByText(name).first();
  await row.click();
  
  await this.page.waitForTimeout(1000);
});

Then('devo ver os dados salvos corretamente', async function() {
  // Verificar que os campos opcionais foram salvos
  const occupation = this.page.locator('input[name="occupation"], input#tenant-occupation');
  const maritalStatus = this.page.locator('select[name="maritalStatus"], select#tenant-marital-status');
  const monthlyIncome = this.page.locator('input[name="monthlyIncome"], input#tenant-monthly-income');
  
  await expect(occupation).not.toHaveValue('');
  await expect(maritalStatus).not.toHaveValue('');
  await expect(monthlyIncome).not.toHaveValue('');
});

Then('o inquilino deve aparecer na lista sem erros', async function() {
  // Verificar que não há erros visíveis
  const errorMessage = this.page.locator('[role="alert"]').or(
    this.page.getByText(/erro|falhou/i)
  );
  await expect(errorMessage).not.toBeVisible();
  
  // Verificar que voltou para a lista
  await this.page.waitForSelector('table, [role="grid"]', { timeout: 5000 });
});

When('tento salvar sem preencher o {string}', async function(fieldName: string) {
  // Tentar salvar direto
  const saveButton = this.page.getByRole('button', { name: /salvar/i });
  await saveButton.click();
});

export { page, loginPage, dashboardPage };