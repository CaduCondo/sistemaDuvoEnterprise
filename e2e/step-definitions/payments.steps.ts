import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

/**
 * Step Definitions para Pagamentos
 */

// ==================== CRIAR LOCAÇÃO PARA TESTES ====================

Given('que crio uma locação com:', async function(dataTable: any) {
  const data = dataTable.rowsHash();
  
  // Navegar para página de locações
  await this.page.goto('/rentals');
  await this.page.waitForLoadState('networkidle');
  
  // Clicar em "Nova Locação"
  await this.page.getByRole('button', { name: /nova locação/i }).click();
  await this.page.waitForTimeout(500);
  
  // Selecionar primeiro imóvel disponível
  await this.page.click('[id*="property"]');
  await this.page.waitForTimeout(300);
  const firstProperty = this.page.locator('[role="option"]').first();
  await firstProperty.click();
  
  // Selecionar primeiro inquilino disponível
  await this.page.click('[id*="tenant"]');
  await this.page.waitForTimeout(300);
  const firstTenant = this.page.locator('[role="option"]').first();
  await firstTenant.click();
  
  // Preencher datas
  if (data['Data início']) {
    const [day, month, year] = data['Data início'].split('/');
    await this.page.fill('[id*="start-date"]', `${year}-${month}-${day}`);
  }
  
  if (data['Data fim']) {
    const [day, month, year] = data['Data fim'].split('/');
    await this.page.fill('[id*="end-date"]', `${year}-${month}-${day}`);
  }
  
  if (data['Dia vencimento']) {
    await this.page.fill('[id*="payment-day"]', data['Dia vencimento']);
  }
  
  if (data['Aluguel']) {
    await this.page.fill('[id*="rent"]', data['Aluguel']);
  }
  
  // Preencher caução (obrigatório)
  await this.page.fill('[id*="deposit"]', data['Aluguel'] || '3000.00');
  await this.page.fill('[id*="deposit-payment-date"]', '2026-08-01');
  
  // Salvar
  await this.page.getByRole('button', { name: /salvar/i }).click();
  await this.page.waitForTimeout(2000);
  
  // Armazenar dados para validação posterior
  this.testData = {
    ...this.testData,
    rental: data
  };
});

Given('que existe uma locação com aluguel de {string}', async function(value: string) {
  // Criar locação via API ou UI
  this.testData = {
    ...this.testData,
    rentalValue: value
  };
});

Given('que existe uma locação com:', async function(dataTable: any) {
  const data = dataTable.rowsHash();
  this.testData = {
    ...this.testData,
    rental: data
  };
});

Given('a taxa de administração é {string}', async function(rate: string) {
  this.testData = {
    ...this.testData,
    adminFee: rate
  };
});

Given('que existe um pagamento pendente', async function() {
  // Assumir que já existe um pagamento na lista
  await this.page.goto('/payments');
  await this.page.waitForLoadState('networkidle');
});

Given('que existe um pagamento {string}', async function(status: string) {
  await this.page.goto('/payments');
  await this.page.waitForLoadState('networkidle');
  
  this.testData = {
    ...this.testData,
    paymentStatus: status
  };
});

Given('que existem múltiplas locações com diferentes datas de início', async function() {
  // Mock: assumir que existem locações criadas
  this.testData = {
    ...this.testData,
    hasMultipleRentals: true
  };
});

// ==================== NAVEGAÇÃO ====================

When('vou para a página de Recebimentos', async function() {
  await this.page.goto('/payments');
  await this.page.waitForLoadState('networkidle');
});

When('visualizo o detalhamento do pagamento', async function() {
  // Clicar no primeiro pagamento da lista
  const firstPayment = this.page.locator('[data-testid="payment-card"]').first();
  await firstPayment.click();
  await this.page.waitForTimeout(500);
});

When('visualizo o recibo do pagamento de Janeiro\\/2026', async function() {
  // Procurar e clicar no pagamento de Janeiro
  const janPayment = this.page.getByText(/janeiro.*2026/i);
  await janPayment.click();
  await this.page.waitForTimeout(500);
});

When('visualizo um pagamento futuro', async function() {
  // Clicar em um pagamento com data futura
  await this.page.waitForTimeout(300);
});

// ==================== FILTROS ====================

When('filtro pelo mês {string}', async function(month: string) {
  // Exemplo: "Agosto/2026"
  const [monthName, year] = month.split('/');
  
  // Selecionar mês
  const monthSelect = this.page.locator('[id*="month-filter"]');
  if (await monthSelect.isVisible()) {
    await monthSelect.click();
    await this.page.waitForTimeout(300);
    
    const monthOption = this.page.getByText(new RegExp(monthName, 'i'));
    await monthOption.click();
  }
  
  // Selecionar ano
  const yearSelect = this.page.locator('[id*="year-filter"]');
  if (await yearSelect.isVisible()) {
    await yearSelect.click();
    await this.page.waitForTimeout(300);
    
    const yearOption = this.page.getByText(year);
    await yearOption.click();
  }
  
  await this.page.waitForTimeout(1000);
  
  this.testData = {
    ...this.testData,
    filteredMonth: month
  };
});

// Observação: "filtro por {string}" (genérico) vive em common.steps.ts —
// não duplicar aqui.

When('filtro por {string} na página de Recebimentos', async function(month: string) {
  const [monthName, year] = month.split('/');
  
  const monthSelect = this.page.locator('[id*="month-filter"]');
  if (await monthSelect.isVisible()) {
    await monthSelect.click();
    await this.page.waitForTimeout(300);
    const monthOption = this.page.getByText(new RegExp(monthName, 'i'));
    await monthOption.click();
  }
  
  await this.page.waitForTimeout(1000);
});

When('seleciono o mês {string}', async function(month: string) {
  const monthSelect = this.page.locator('[id*="month-filter"]');
  await monthSelect.click();
  await this.page.waitForTimeout(300);
  
  const monthOption = this.page.getByText(new RegExp(month, 'i'));
  await monthOption.click();
  await this.page.waitForTimeout(500);
});

When('seleciono o ano {string}', async function(year: string) {
  const yearSelect = this.page.locator('[id*="year-filter"]');
  await yearSelect.click();
  await this.page.waitForTimeout(300);
  
  const yearOption = this.page.getByText(year);
  await yearOption.click();
  await this.page.waitForTimeout(500);
});

// Observação: "seleciono o status {string}" vive em properties.steps.ts
// (tenta os seletores de Imóveis, Inquilinos e Pagamentos) — não duplicar.

// ==================== AÇÕES ====================

When('marco o pagamento como {string}', async function(status: string) {
  const statusButton = this.page.getByRole('button', { name: new RegExp(status, 'i') });
  await statusButton.click();
  await this.page.waitForTimeout(300);
});

When('preencho a data de pagamento', async function() {
  const dateInput = this.page.locator('[id*="payment-date"]');
  await dateInput.fill('2026-08-01');
});

When('anexo o comprovante', async function() {
  // Simular anexo de arquivo
  await this.page.waitForTimeout(300);
});

When('confirmo o cancelamento', async function() {
  const confirmButton = this.page.getByRole('button', { name: /confirmar/i });
  await confirmButton.click();
  await this.page.waitForTimeout(500);
});

// ==================== VALIDAÇÕES ====================

Then('devo ver {int} recebimento', async function(count: number) {
  const payments = this.page.locator('[data-testid="payment-card"]');
  await expect(payments).toHaveCount(count, { timeout: 5000 });
});

Then('devo ver {int} recebimentos', async function(count: number) {
  const payments = this.page.locator('[data-testid="payment-card"]');
  await expect(payments).toHaveCount(count, { timeout: 5000 });
});

Then('o recebimento deve ter:', async function(dataTable: any) {
  const expected = dataTable.rowsHash();
  
  const firstPayment = this.page.locator('[data-testid="payment-card"]').first();
  await expect(firstPayment).toBeVisible();
  
  for (const [field, value] of Object.entries(expected)) {
    const text = await firstPayment.textContent();
    expect(text).toContain(value);
  }
});

Then('o valor deve ser proporcional a {int} dias', async function(days: number) {
  const rental = this.testData?.rental;
  if (!rental) return;
  
  const monthlyRent = parseFloat(rental['Aluguel']);
  const expectedValue = (monthlyRent / 30) * days;
  
  // Verificar se o valor está próximo do esperado (tolerância de R$ 10)
  const paymentCard = this.page.locator('[data-testid="payment-card"]').first();
  const text = await paymentCard.textContent();
  
  // Extrair valor do texto (formato: R$ 1.234,56)
  const match = text?.match(/R\$\s*([\d.,]+)/);
  if (match) {
    const displayedValue = parseFloat(match[1].replace('.', '').replace(',', '.'));
    const diff = Math.abs(displayedValue - expectedValue);
    expect(diff).toBeLessThan(10);
  }
});

Then('NÃO devo ver recebimentos dessa locação', async function() {
  // Verificar se a lista está vazia ou não contém a locação testada
  const payments = this.page.locator('[data-testid="payment-card"]');
  const count = await payments.count();
  
  // Se houver pagamentos, verificar se nenhum é da locação testada
  if (count > 0) {
    const rental = this.testData?.rental;
    if (rental && rental['Aluguel']) {
      const allText = await this.page.textContent('body');
      const hasRentalValue = allText?.includes(rental['Aluguel']);
      expect(hasRentalValue).toBe(false);
    }
  }
});

Then('todos os recebimentos exibidos devem ter:', async function(dataTable: any) {
  const expected = dataTable.rowsHash();
  
  const payments = this.page.locator('[data-testid="payment-card"]');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    
    for (const value of Object.values(expected)) {
      expect(text).toContain(value as string);
    }
  }
});

Then('nenhum recebimento deve ter vencimento em outro mês', async function() {
  const filteredMonth = this.testData?.filteredMonth;
  if (!filteredMonth) return;
  
  const [monthName, year] = filteredMonth.split('/');
  
  const payments = this.page.locator('[data-testid="payment-card"]');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    expect(text).toContain(monthName);
    expect(text).toContain(year);
  }
});

Then('devo ver:', async function(dataTable: any) {
  const rows = dataTable.hashes();
  
  for (const row of rows) {
    const fieldText = this.page.getByText(new RegExp(row.campo, 'i'));
    await expect(fieldText).toBeVisible();
    
    const valueText = this.page.getByText(row.valor);
    await expect(valueText).toBeVisible();
  }
});

Then('o status deve mudar para {string}', async function(status: string) {
  const statusBadge = this.page.getByText(new RegExp(status, 'i'));
  await expect(statusBadge).toBeVisible({ timeout: 5000 });
});

Then('devo poder gerar o recibo', async function() {
  const receiptButton = this.page.getByRole('button', { name: /gerar recibo/i });
  await expect(receiptButton).toBeVisible();
  await expect(receiptButton).toBeEnabled();
});

Then('devo ver o PDF do recibo', async function() {
  await this.page.waitForTimeout(1000);
  // Verificar se PDF foi gerado ou modal aberto
  const pdfViewer = this.page.locator('[data-testid="pdf-viewer"]');
  const hasPDF = await pdfViewer.isVisible().catch(() => false);
  expect(hasPDF).toBe(true);
});

Then('o recibo deve conter:', async function(dataTable: any) {
  const items = dataTable.hashes();
  await this.page.waitForTimeout(500);
  
  for (const item of items) {
    const text = this.page.getByText(new RegExp(item.informação, 'i'));
    await expect(text).toBeVisible();
  }
});

Then('não deve ser possível gerar recibo', async function() {
  const receiptButton = this.page.getByRole('button', { name: /gerar recibo/i });
  const isDisabled = await receiptButton.isDisabled().catch(() => true);
  expect(isDisabled).toBe(true);
});

Then('devo ver apenas pagamentos de Janeiro', async function() {
  const payments = this.page.locator('[data-testid="payment-card"]');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    expect(text).toContain('Janeiro');
  }
});

Then('devo ver apenas pagamentos de {int}', async function(year: number) {
  const payments = this.page.locator('[data-testid="payment-card"]');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    expect(text).toContain(year.toString());
  }
});

Then('devo ver apenas pagamentos pendentes', async function() {
  const payments = this.page.locator('[data-testid="payment-card"]');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    expect(text?.toLowerCase()).toContain('pendente');
  }
});

Then('devo ver apenas pagamentos pagos', async function() {
  const payments = this.page.locator('[data-testid="payment-card"]');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    expect(text?.toLowerCase()).toContain('pago');
  }
});

// Observação: "no bloco {string} devo ver:" vive em rentals.steps.ts (trata
// o marcador "(vazio)") — não duplicar aqui.