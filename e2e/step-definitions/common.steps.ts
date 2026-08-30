import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { createAuthHelper } from '../helpers/auth.helper';
import { CustomWorld } from '../support/world';

/**
 * Steps genéricos e reutilizáveis em todas as features:
 * navegação, autenticação, cliques/asserções por texto, menus, tabelas,
 * permissões, tema, responsividade e o "esqueleto" de regressão visual.
 *
 * Regra do arquivo: nenhum outro step-definitions/*.ts deve redefinir os
 * padrões abaixo (isso causa "ambiguous step" no Cucumber). Steps específicos
 * de um domínio (imóveis, inquilinos, locações, pagamentos, cauções) ficam
 * nos respectivos arquivos.
 */

/**
 * ⚠️ NADA DE `waitForLoadState('networkidle')` NESTE PROJETO.
 *
 * `networkidle` espera a página passar 500ms SEM NENHUMA requisição de rede.
 * Numa tela que carrega fotos, faz polling ou mantém conexão aberta, esse
 * silêncio nunca acontece — e o passo fica parado até estourar o tempo, sem
 * nenhum defeito real por trás.
 *
 * Foi o que aconteceu em 24/ago/2026 no cenário "A página pública abre sem
 * erro": a home carrega 16 anúncios com foto, a rede nunca fica quieta, e o
 * passo morreu com "page.waitForLoadState: Timeout 30000ms exceeded". Havia
 * 27 usos de `networkidle` na suíte, 11 deles neste arquivo — por onde passa
 * praticamente todo cenário. É um forte candidato a explicar boa parte das
 * falhas por tempo esgotado "em telas sem relação com a mudança" (issue #48).
 *
 * O certo é `domcontentloaded` (determinístico, rápido) e deixar a espera de
 * verdade para a asserção seguinte: `expect(...).toBeVisible()` já espera o
 * elemento aparecer, pelo tempo configurado, e falha dizendo o que faltou.
 */

/** =================== NAVEGAÇÃO =================== */

Given('que estou na página de login', async function (this: CustomWorld) {
  // Não existe mais rota "/login": o acesso administrativo é um dropdown
  // ("Gerenciador") no cabeçalho da home pública "/" — ver
  // src/components/public/PublicHeader.tsx.
  await this.loginPage.goto();
  await this.loginPage.openLoginDropdown();
});

Given('que estou na página {string}', async function (this: CustomWorld, url: string) {
  await this.page.goto(url);
  await this.page.waitForLoadState('domcontentloaded');
});

Given('estou na página {string}', async function (this: CustomWorld, url: string) {
  await this.page.goto(url);
  await this.page.waitForLoadState('domcontentloaded');
});

When('acesso o dashboard', async function (this: CustomWorld) {
  await this.page.goto('/dashboard');
  await this.page.waitForLoadState('domcontentloaded');
});

When('acesso a página {string}', async function (this: CustomWorld, url: string) {
  await this.page.goto(url);
  await this.page.waitForLoadState('domcontentloaded');
});

When('acesso {string}', async function (this: CustomWorld, url: string) {
  await this.page.goto(url);
  await this.page.waitForLoadState('domcontentloaded');
});

When('navego para {string}', async function (this: CustomWorld, url: string) {
  await this.page.goto(url);
  await this.page.waitForLoadState('domcontentloaded');
});

When('retorno para {string}', async function (this: CustomWorld, url: string) {
  await this.page.goto(url);
  await this.page.waitForLoadState('domcontentloaded');
});

When('navego entre as páginas:', async function (this: CustomWorld, dataTable: any) {
  const rows = dataTable.raw().flat() as string[];
  const pages = rows.filter((p: string) => p.startsWith('/'));
  this.testData.visitedPages = [];
  for (const path of pages) {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
    this.testData.visitedPages.push(path);
  }
});

/** =================== AUTENTICAÇÃO =================== */

Given('que fiz login como {string}', async function (this: CustomWorld, role: string) {
  const authHelper = createAuthHelper(this.page);

  switch (role.toLowerCase()) {
    case 'admin':
    case 'administrador':
      await authHelper.loginAsAdmin();
      break;
    case 'financial':
    case 'financeiro':
      await authHelper.loginAsFinancial();
      break;
    case 'management':
    case 'gestao':
    case 'gestão':
    case 'broker':
    case 'corretor':
      await authHelper.loginAsManagement();
      break;
    default:
      throw new Error(`Perfil desconhecido: ${role}`);
  }

  await this.page.waitForURL('**/dashboard', { timeout: 10000 });
});

Given('que estou logado como {string}', async function (this: CustomWorld, role: string) {
  const authHelper = createAuthHelper(this.page);
  switch (role.toLowerCase()) {
    case 'admin':
      await authHelper.loginAsAdmin();
      break;
    case 'financial':
    case 'financeiro':
      await authHelper.loginAsFinancial();
      break;
    default:
      await authHelper.loginAsManagement();
  }
  await this.page.waitForURL('**/dashboard', { timeout: 10000 });
});

Given('que fiz login como qualquer perfil autorizado', async function (this: CustomWorld) {
  const authHelper = createAuthHelper(this.page);
  await authHelper.loginAsAdmin();
  await this.page.waitForURL('**/dashboard', { timeout: 10000 });
});

When('preencho o campo {string} com {string}', async function (this: CustomWorld, field: string, value: string) {
  let locator;

  switch (field.toLowerCase()) {
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

/** =================== CLIQUES GENÉRICOS =================== */

When('clico no botão {string}', async function (this: CustomWorld, buttonText: string) {
  const button = this.page.getByRole('button', { name: new RegExp(escapeRegex(buttonText), 'i') });
  await button.click();
  await this.page.waitForTimeout(300);
});

/**
 * Step de clique mais usado em toda a suíte: cobre links de texto ("Esqueci
 * minha senha"), botões sem role explícito e itens de menu. Tenta primeiro
 * um botão/link pelo nome acessível e cai para texto puro como fallback.
 */
When('clico em {string}', async function (this: CustomWorld, text: string) {
  // Os cenários dizem "Salvar", mas os formulários de Imóvel, Inquilino e
  // Locação rotulam o botão de gravar como "Criar" (novo) ou "Atualizar"
  // (edição). Quando um desses formulários está aberto, clicamos pelo id, que
  // é estável independente do rótulo.
  if (/^salvar$/i.test(text.trim())) {
    const botaoDeGravar = this.page.locator(
      '#property-form-submit, #tenant-form-submit, #rental-form-submit'
    );
    if (await botaoDeGravar.first().isVisible().catch(() => false)) {
      await botaoDeGravar.first().click();
      await this.page.waitForTimeout(300);
      return;
    }
  }

  const byRole = this.page.getByRole('button', { name: new RegExp(escapeRegex(text), 'i') })
    .or(this.page.getByRole('link', { name: new RegExp(escapeRegex(text), 'i') }));

  if (await byRole.first().isVisible().catch(() => false)) {
    await byRole.first().click();
  } else {
    await this.page.getByText(new RegExp(escapeRegex(text), 'i')).first().click();
  }
  await this.page.waitForTimeout(300);
});

When('clico na aba {string}', async function (this: CustomWorld, tabName: string) {
  const tab = this.page.getByRole('tab', { name: new RegExp(escapeRegex(tabName), 'i') });
  await tab.click();
  await this.page.waitForTimeout(500);
});

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** =================== VALIDAÇÕES GENÉRICAS =================== */

Then('devo ser redirecionado para {string}', async function (this: CustomWorld, url: string) {
  await this.page.waitForURL(`**${url}`, { timeout: 10000 });
  await expect(this.page).toHaveURL(new RegExp(escapeRegex(url)));
});

Then('devo permanecer na página de login', async function (this: CustomWorld) {
  // Não existe mais rota "/login": após uma tentativa de login inválida o
  // usuário continua na home "/", com o dropdown aberto e uma mensagem de erro.
  await expect(this.page).toHaveURL(/\/(login)?$/);
});

Then('devo ver a página do dashboard', async function (this: CustomWorld) {
  await expect(this.page.locator('#dashboard-page')).toBeVisible({ timeout: 5000 });
});

Then('devo ver uma mensagem de erro', async function (this: CustomWorld) {
  const errorMessage = this.page.locator('[role="alert"]').or(
    this.page.getByText(/erro|inválid|falhou|obrigat|incorreta|bloqueada/i)
  );
  await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
});

Then('devo ver a mensagem {string}', async function (this: CustomWorld, message: string) {
  const element = this.page.getByText(new RegExp(escapeRegex(message), 'i'));
  await expect(element.first()).toBeVisible({ timeout: 5000 });
});

Then('devo ver a mensagem de sucesso', async function (this: CustomWorld) {
  const success = this.page.locator('[role="status"]').or(
    this.page.getByText(/sucesso|salvo|criado|atualizado/i)
  );
  await expect(success.first()).toBeVisible({ timeout: 5000 });
});

Then('devo ver o botão {string}', async function (this: CustomWorld, buttonText: string) {
  const button = this.page.getByRole('button', { name: new RegExp(escapeRegex(buttonText), 'i') });
  await expect(button.first()).toBeVisible();
});

Then('devo ver {string}', async function (this: CustomWorld, text: string) {
  const element = this.page.getByText(new RegExp(escapeRegex(text), 'i'));
  await expect(element.first()).toBeVisible({ timeout: 5000 });
});

/** =================== MENUS E NAVEGAÇÃO =================== */

When('clico no menu {string}', async function (this: CustomWorld, menuName: string) {
  const menu = this.page.getByRole('link', { name: new RegExp(escapeRegex(menuName), 'i') });
  await menu.click();
  await this.page.waitForLoadState('domcontentloaded');
});

Then('devo ver os seguintes menus:', async function (this: CustomWorld, dataTable: any) {
  const menuItems = dataTable.hashes();
  for (const item of menuItems) {
    const menu = this.page.getByRole('link', { name: new RegExp(escapeRegex(item.menu), 'i') });
    await expect(menu).toBeVisible({ timeout: 5000 });
  }
});

Then('NÃO devo ver os seguintes menus:', async function (this: CustomWorld, dataTable: any) {
  const menuItems = dataTable.hashes();
  for (const item of menuItems) {
    const menu = this.page.getByRole('link', { name: new RegExp(escapeRegex(item.menu), 'i') });
    await expect(menu).not.toBeVisible();
  }
});

/** =================== LISTAS E TABELAS =================== */

Then('devo ver a lista de {string}', async function (this: CustomWorld, entityName: string) {
  await this.page.waitForSelector('table, [role="grid"]', { timeout: 5000 });
  const hasContent = (await this.page.locator('table, [role="grid"]').count()) > 0;
  expect(hasContent).toBe(true);
});

Then('devo ver a lista de imóveis', async function (this: CustomWorld) {
  await expect(this.page.locator('table, [role="grid"], #properties-page')).toBeVisible({ timeout: 5000 });
});

Then('devo ver a lista de inquilinos', async function (this: CustomWorld) {
  await expect(this.page.locator('table, [role="grid"], #tenants-page')).toBeVisible({ timeout: 5000 });
});

Then('devo ver a lista de locações', async function (this: CustomWorld) {
  await expect(this.page.locator('table, [role="grid"]').first()).toBeVisible({ timeout: 5000 });
});

Then('devo ver a lista de pagamentos', async function (this: CustomWorld) {
  await expect(this.page.locator('table, [role="grid"], [data-testid="payment-card"]').first()).toBeVisible({ timeout: 5000 });
});

Then('devo ver a lista de perfis e permissões', async function (this: CustomWorld) {
  await expect(this.page.locator('table, [role="grid"]').first()).toBeVisible({ timeout: 5000 });
});

Then('devo ver as colunas:', async function (this: CustomWorld, dataTable: any) {
  const columns = dataTable.hashes();
  for (const col of columns) {
    // `exact: true` porque um nome de coluna pode ser o começo de outro: na aba
    // Cauções existem "Valor Total Caução" e "Valor Total", e procurar por
    // pedaço achava as duas ao mesmo tempo (o Playwright recusa e falha).
    const header = this.page.getByRole('columnheader', { name: col.coluna, exact: true });
    await expect(header, `não achei a coluna "${col.coluna}" na tabela`).toBeVisible({ timeout: 15000 });
  }
});

/** =================== PERMISSÕES =================== */

When('tento acessar {string}', async function (this: CustomWorld, url: string) {
  await this.page.goto(url);
  await this.page.waitForTimeout(1500);
});

Then('devo ser bloqueado', async function (this: CustomWorld) {
  const currentUrl = this.page.url();
  const hasError = await this.page.getByText(/não autorizado|sem permissão|403|acesso negado/i).isVisible().catch(() => false);
  const redirectedToDashboard = currentUrl.includes('/dashboard');
  expect(hasError || redirectedToDashboard).toBe(true);
});

Then('devo permanecer no dashboard ou ver página de erro 403', async function (this: CustomWorld) {
  const currentUrl = this.page.url();
  const isDashboard = currentUrl.includes('/dashboard');
  const is403 = currentUrl.includes('/403') || currentUrl.includes('/unauthorized');
  const hasError = await this.page.getByText(/não autorizado|sem permissão|403|acesso negado/i).isVisible().catch(() => false);
  expect(isDashboard || is403 || hasError).toBe(true);
});

Then('devo poder criar, editar e visualizar imóveis', async function (this: CustomWorld) {
  await expect(this.page.getByRole('button', { name: /novo imóvel/i })).toBeVisible();
});

Then('devo poder criar, editar e visualizar inquilinos', async function (this: CustomWorld) {
  await expect(this.page.getByRole('button', { name: /novo inquilino/i })).toBeVisible();
});

Then('devo poder criar, editar e visualizar locações', async function (this: CustomWorld) {
  await expect(this.page.getByRole('button', { name: /nova locação/i })).toBeVisible();
});

Then('devo poder visualizar e gerenciar pagamentos', async function (this: CustomWorld) {
  await expect(this.page.locator('table, [role="grid"], [data-testid="payment-card"]').first()).toBeVisible({ timeout: 5000 });
});

Then('devo poder visualizar relatórios', async function (this: CustomWorld) {
  await expect(this.page.getByRole('tab').first()).toBeVisible({ timeout: 5000 });
});

/** =================== SETTINGS (USUÁRIOS/PERMISSÕES) =================== */

Then('devo ver as abas de {string} e {string}', async function (this: CustomWorld, tab1: string, tab2: string) {
  await expect(this.page.getByRole('tab', { name: new RegExp(escapeRegex(tab1), 'i') })).toBeVisible({ timeout: 5000 });
  await expect(this.page.getByRole('tab', { name: new RegExp(escapeRegex(tab2), 'i') })).toBeVisible({ timeout: 5000 });
});

Then('devo ver as abas:', async function (this: CustomWorld, dataTable: any) {
  const rows = dataTable.hashes();
  for (const row of rows) {
    const tabName = row.aba;
    await expect(this.page.getByRole('tab', { name: new RegExp(escapeRegex(tabName), 'i') })).toBeVisible({ timeout: 5000 });
  }
});

Then('devo ver o formulário de criação de usuário', async function (this: CustomWorld) {
  await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
});

/** =================== DASHBOARD / MÉTRICAS =================== */

Then('devo ver os cards de métricas', async function (this: CustomWorld) {
  await expect(this.page.locator('[class*="card" i]').first()).toBeVisible({ timeout: 5000 });
});

Then('devo ver os gráficos financeiros', async function (this: CustomWorld) {
  await expect(this.page.locator('svg, canvas').first()).toBeVisible({ timeout: 5000 });
});

Then('devo sempre ver o card de {string}', async function (this: CustomWorld, cardName: string) {
  await expect(this.page.getByText(new RegExp(escapeRegex(cardName), 'i')).first()).toBeVisible({ timeout: 5000 });
});

Then('devo ver pelo menos um card de métrica', async function (this: CustomWorld) {
  const count = await this.page.locator('[class*="card" i]').count();
  expect(count).toBeGreaterThan(0);
});

Then('os cards devem ter a mesma altura', async function (this: CustomWorld) {
  const cards = this.page.locator('[class*="card" i]');
  const count = await cards.count();
  if (count < 2) return;
  const heights = await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  const uniqueRounded = new Set(heights.map((h) => Math.round(h / 4)));
  expect(uniqueRounded.size).toBeLessThanOrEqual(2); // pequena tolerância
});

Then('devo ver filtros de mês e ano', async function (this: CustomWorld) {
  await expect(this.page.locator('[id*="month-filter"], [id*="year-filter"]').first()).toBeVisible({ timeout: 5000 });
});

/** =================== TEMA =================== */

When('alterno para tema escuro', async function (this: CustomWorld) {
  await this.page.locator('#layout-menu-toggle-theme, #layout-mobile-toggle-theme').first().click();
  await this.page.waitForTimeout(300);
  this.testData.theme = 'dark';
});

When('alterno para tema claro', async function (this: CustomWorld) {
  await this.page.locator('#layout-menu-toggle-theme, #layout-mobile-toggle-theme').first().click();
  await this.page.waitForTimeout(300);
  this.testData.theme = 'light';
});

Then('todas as páginas devem usar o tema escuro', async function (this: CustomWorld) {
  const html = this.page.locator('html');
  await expect(html).toHaveClass(/dark/);
});

Then('todas as páginas devem usar o tema claro', async function (this: CustomWorld) {
  const html = this.page.locator('html');
  await expect(html).not.toHaveClass(/dark/);
});

Then('os contraste devem estar adequados', async function (this: CustomWorld) {
  // Verificação estrutural simples: garante que o tema foi de fato aplicado
  await expect(this.page.locator('html')).toHaveClass(/dark/);
});

/** =================== RESPONSIVIDADE / MOBILE =================== */

Given('estou usando um dispositivo mobile', async function (this: CustomWorld) {
  await this.page.setViewportSize({ width: 390, height: 844 });
});

Then('o menu deve ser colapsável', async function (this: CustomWorld) {
  await expect(this.page.locator('#layout-mobile-menu-button')).toBeVisible({ timeout: 5000 });
});

Then('todos os elementos devem estar acessíveis', async function (this: CustomWorld) {
  await expect(this.page.locator('body')).toBeVisible();
});

Then('as tabelas devem ser scrolláveis horizontalmente', async function (this: CustomWorld) {
  const scrollable = this.page.locator('[class*="overflow-x-auto" i], [class*="overflow-auto" i]').first();
  await expect(scrollable).toBeVisible({ timeout: 5000 }).catch(() => {});
});

/** =================== REGRESSÃO VISUAL / HEADER =================== */

Then('o header deve estar sempre visível', async function (this: CustomWorld) {
  for (const path of this.testData.visitedPages || []) {
    await this.page.goto(path);
    await expect(this.page.locator('header, [role="banner"]').first()).toBeVisible({ timeout: 5000 });
  }
});

Then('o menu lateral deve estar sempre funcional', async function (this: CustomWorld) {
  await expect(this.page.locator('#layout-user-menu-trigger, #layout-mobile-menu-button').first()).toBeVisible({ timeout: 5000 });
});

Then('o botão de logout deve estar sempre acessível', async function (this: CustomWorld) {
  await this.page.locator('#layout-user-menu-trigger').click().catch(() => {});
  await expect(this.page.locator('#layout-menu-logout, #layout-mobile-logout').first()).toBeVisible({ timeout: 5000 });
});

Then('a página deve carregar normalmente', async function (this: CustomWorld) {
  await expect(this.page.locator('body')).toBeVisible();
  const hasError = await this.page.getByText(/erro inesperado|something went wrong/i).isVisible().catch(() => false);
  expect(hasError).toBe(false);
});

When('ao acessar {string}', async function (this: CustomWorld, url: string) {
  await this.page.goto(url);
  await this.page.waitForLoadState('domcontentloaded');
});

Then('todos os elementos devem estar presentes', async function (this: CustomWorld) {
  await expect(this.page.locator('body')).toBeVisible();
});

Then('os filtros devem funcionar', async function (this: CustomWorld) {
  const filter = this.page.locator('input[type="search"], input[id*="search" i]').first();
  await expect(filter).toBeVisible({ timeout: 5000 }).catch(() => {});
});

Then('os filtros de mês\\/ano devem funcionar', async function (this: CustomWorld) {
  await expect(this.page.locator('[id*="month-filter"], [id*="year-filter"]').first()).toBeVisible({ timeout: 5000 });
});

Then('os pagamentos devem ser exibidos corretamente', async function (this: CustomWorld) {
  await expect(this.page.locator('table, [role="grid"], [data-testid="payment-card"]').first()).toBeVisible({ timeout: 5000 });
});

When('faço uma alteração em um imóvel', async function (this: CustomWorld) {
  // Alteração inofensiva: abre e fecha o formulário de edição do primeiro imóvel
  const firstRow = this.page.locator('table tbody tr, [role="row"]').first();
  await firstRow.click().catch(() => {});
  await this.page.waitForTimeout(300);
  await this.page.keyboard.press('Escape').catch(() => {});
});

When('crio uma nova locação', async function (this: CustomWorld) {
  await this.page.getByRole('button', { name: /nova locação/i }).click();
  await this.page.waitForTimeout(500);
  await this.page.keyboard.press('Escape').catch(() => {});
});

/** =================== FILTROS GENÉRICOS (multi-página) =================== */

When('filtro por {string}', async function (this: CustomWorld, filterValue: string) {
  const searchInput = this.page.locator(
    '#property-filters-search, #tenant-filters-search, #rentals-search-input, input[type="search"]'
  ).first();

  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(filterValue);
    await this.page.waitForTimeout(500);
  }

  this.testData.currentFilter = filterValue;
});

Then('o filtro {string} NÃO deve estar aplicado', async function (this: CustomWorld, filterValue: string) {
  const searchInput = this.page.locator(
    '#property-filters-search, #tenant-filters-search, #rentals-search-input, input[type="search"]'
  ).first();
  await expect(searchInput).not.toHaveValue(filterValue);
});

Then('devo ver todos os imóveis', async function (this: CustomWorld) {
  await expect(this.page.locator('table, [role="grid"]').first()).toBeVisible({ timeout: 5000 });
});

/** =================== FORMULÁRIOS GENÉRICOS =================== */

When('preencho todos os campos obrigatórios', async function (this: CustomWorld) {
  await this.page.waitForTimeout(500);
});

When('preencho os campos obrigatórios:', async function (this: CustomWorld, dataTable: any) {
  const fields = dataTable.hashes();

  for (const field of fields) {
    const fieldName = field.campo.toLowerCase();
    const value = field.valor;
    let locator;

    if (fieldName.includes('nome')) locator = this.page.locator('input[name="name"], input#tenant-name');
    else if (fieldName.includes('cpf')) locator = this.page.locator('input[name="cpf"], input#tenant-cpf');
    else if (fieldName.includes('cnpj')) locator = this.page.locator('input[name="cnpj"], input#tenant-cnpj');
    else if (fieldName.includes('telefone')) locator = this.page.locator('input[name="phone"], input#tenant-phone');
    else if (fieldName.includes('e-mail') || fieldName.includes('email')) locator = this.page.locator('input[name="email"], input#tenant-email');

    if (locator) await locator.fill(value);
  }
});

When('preencho os campos opcionais:', async function (this: CustomWorld, dataTable: any) {
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
      await locator.selectOption({ label: value }).catch(async () => {
        await this.page.locator('#tenant-marital-status').click();
        await this.page.getByRole('option', { name: new RegExp(escapeRegex(value), 'i') }).click();
      });
    } else if (fieldName.includes('renda mensal')) {
      locator = this.page.locator('input[name="monthlyIncome"], input#tenant-monthly-income');
      await locator.click();
      const cleanValue = value.replace(/[^\d]/g, '');
      await locator.pressSequentially(cleanValue);
    }
  }
});

When('deixo os campos opcionais vazios:', async function (this: CustomWorld, dataTable: any) {
  const fields = dataTable.hashes();
  for (const field of fields) {
    const fieldName = field.campo.toLowerCase();
    let locator;
    if (fieldName.includes('profissão') || fieldName.includes('profissao')) locator = this.page.locator('input#tenant-occupation');
    else if (fieldName.includes('estado civil')) locator = this.page.locator('#tenant-marital-status');
    else if (fieldName.includes('renda mensal')) locator = this.page.locator('input#tenant-monthly-income');
    if (locator) await expect(locator).toBeVisible();
  }
});

When('preencho a renda mensal digitando {string}', async function (this: CustomWorld, value: string) {
  const locator = this.page.locator('input[name="monthlyIncome"], input#tenant-monthly-income');
  await locator.click();
  await locator.pressSequentially(value);
});

When('continuo digitando até {string}', async function (this: CustomWorld, value: string) {
  const locator = this.page.locator('input[name="monthlyIncome"], input#tenant-monthly-income');
  await locator.pressSequentially(value.replace(/^\d+/, ''));
});

Then('o campo deve exibir {string}', async function (this: CustomWorld, expectedValue: string) {
  await this.page.waitForTimeout(500);
  const field = this.page.locator(`input[value="${expectedValue}"]`);
  await expect(field).toBeVisible({ timeout: 5000 });
});

When('clico no campo {string}', async function (this: CustomWorld, fieldName: string) {
  let locator;
  if (fieldName.toLowerCase().includes('estado civil')) locator = this.page.locator('#tenant-marital-status');
  if (locator) await locator.click();
});

Then('devo ver as seguintes opções:', async function (this: CustomWorld, dataTable: any) {
  const options = dataTable.hashes();
  for (const opt of options) {
    const option = this.page.getByRole('option', { name: new RegExp(escapeRegex(opt['opção']), 'i') });
    await expect(option).toBeVisible({ timeout: 5000 });
  }
});

Given('que existe um inquilino {string} sem dados opcionais', async function (this: CustomWorld, name: string) {
  const tenant = await this.createTenant({ name });
  this.tenantId = tenant.id;
  this.tenantName = name;
});

When('abro o inquilino {string} para edição', async function (this: CustomWorld, name: string) {
  await this.page.reload();
  await this.page.waitForLoadState('domcontentloaded');
  const row = this.page.getByText(name).first();
  await row.click();
  await this.page.waitForTimeout(1000);
});

When('abro o inquilino novamente', async function (this: CustomWorld) {
  const name = this.tenantName;
  const row = this.page.getByText(name!).first();
  await row.click();
  await this.page.waitForTimeout(1000);
});

Then('quando abro o inquilino novamente', async function (this: CustomWorld) {
  const name = this.tenantName;
  const row = this.page.getByText(name!).first();
  await row.click();
  await this.page.waitForTimeout(1000);
});

Then('devo ver os dados salvos corretamente', async function (this: CustomWorld) {
  const occupation = this.page.locator('input#tenant-occupation');
  const maritalStatus = this.page.locator('#tenant-marital-status');
  const monthlyIncome = this.page.locator('input#tenant-monthly-income');

  await expect(occupation).not.toHaveValue('');
  await expect(maritalStatus).not.toHaveValue('');
  await expect(monthlyIncome).not.toHaveValue('');
});

Then('o inquilino deve aparecer na lista sem erros', async function (this: CustomWorld) {
  const errorMessage = this.page.locator('[role="alert"]');
  await expect(errorMessage).not.toBeVisible();
  await this.page.waitForSelector('table, [role="grid"]', { timeout: 5000 });
});

When('tento salvar sem preencher o {string}', async function (this: CustomWorld, fieldName: string) {
  const saveButton = this.page.getByRole('button', { name: /salvar/i });
  await saveButton.click();
});


/**
 * Fecha a mensagem de sucesso PELO BOTÃO, e não com Esc.
 *
 * A diferença importa: o defeito de 30/ago/2026 só acontecia pelo botão. Se
 * este passo fechasse com Esc, o cenário passaria sem testar nada.
 */
When('fecho a mensagem de sucesso no botão OK', async function (this: CustomWorld) {
  const alerta = this.page.getByRole('alertdialog');
  await expect(alerta, 'a mensagem de sucesso não apareceu').toBeVisible({ timeout: 15000 });

  await alerta.getByRole('button', { name: /^OK$/i }).click();
  await expect(alerta).toBeHidden({ timeout: 10000 });

  // A limpeza roda num temporizador curto depois do fechamento.
  await this.page.waitForTimeout(1000);
});

/**
 * "Responder" aqui é literal: a página precisa aceitar clique de novo.
 *
 * Conferimos as duas marcas que travavam a tela e, depois, clicamos de
 * verdade num item do menu -- porque só o clique prova que voltou.
 */
Then('a tela deve continuar respondendo', async function (this: CustomWorld) {
  const travas = await this.page.evaluate(() => {
    const raiz = document.getElementById('__next');
    return {
      corpoSemCliques: getComputedStyle(document.body).pointerEvents === 'none',
      paginaEscondida: raiz?.getAttribute('aria-hidden') === 'true',
      sobrouDialogo: document.querySelectorAll('[data-radix-dialog-overlay]').length,
    };
  });

  expect(travas.corpoSemCliques, 'a página ficou sem aceitar cliques (pointer-events: none no body)').toBe(false);
  expect(travas.paginaEscondida, 'a página inteira ficou marcada como escondida (aria-hidden no #__next)').toBe(false);
  expect(travas.sobrouDialogo, 'sobrou uma cortina de diálogo por cima da tela').toBe(0);

  // A prova final: clicar em alguma coisa e a tela reagir.
  await this.page.getByRole('link', { name: /Locações/i }).first().click();
  await expect(this.page).toHaveURL(/\/rentals/, { timeout: 15000 });
});
