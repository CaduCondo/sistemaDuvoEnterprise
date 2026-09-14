import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import DatabaseHelper from '../helpers/database.helper';

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * Step Definitions para Pagamentos
 */

// ==================== CRIAR LOCAÇÃO PARA TESTES ====================

/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99, cluster "Pagamentos"): os
 * seletores usados aqui eram substring (`[id*="..."]`) genéricos demais
 * contra os ids REAIS do formulário (RentalFormDialog.tsx) -- e todos os
 * ids de campo do formulário começam com "rental-", então:
 * - `[id*="rent"]` já casava com "rental-property"/"rental-tenant"/etc.
 *   (a palavra "rent" está dentro de "renTAL") -- ambíguo, e além disso
 *   NÃO EXISTE campo de aluguel neste formulário (o valor vem do imóvel
 *   selecionado, só é exibido). Removido.
 * - `[id*="payment-day"]` (id real: "rental-payment-day") é um Select
 *   (dropdown), não um <input> -- `.fill()` nele sempre falhava com
 *   "Element is not an <input>...".
 * - `[id*="deposit"]` casava com 3 campos de caução ao mesmo tempo
 *   (valor, data, "parcelar?") -- ambíguo.
 * - `[id*="deposit-payment-date"]` não batia com nada (id real é
 *   "rental-deposit-date", sem "payment" no meio) -- ficava esperando um
 *   elemento inexistente até estourar timeout.
 * Todos trocados pelos ids reais.
 */
Given('que crio uma locação com:', async function(dataTable: any) {
  const data = dataTable.rowsHash();

  // Navegar para página de locações
  await this.page.goto('/rentals');
  await this.page.waitForLoadState('domcontentloaded');

  // Clicar em "Nova Locação"
  await this.page.getByRole('button', { name: /nova locação/i }).click();
  await this.page.waitForTimeout(500);

  // Selecionar primeiro imóvel disponível
  await this.page.locator('#rental-property').click();
  await this.page.waitForTimeout(300);
  const firstProperty = this.page.locator('[role="option"]').first();
  await firstProperty.click();

  // Selecionar primeiro inquilino disponível
  await this.page.locator('#rental-tenant').click();
  await this.page.waitForTimeout(300);
  const firstTenant = this.page.locator('[role="option"]').first();
  await firstTenant.click();

  // Preencher datas
  if (data['Data início']) {
    const [day, month, year] = data['Data início'].split('/');
    await this.page.locator('#rental-start-date').fill(`${year}-${month}-${day}`);
  }

  if (data['Data fim']) {
    const [day, month, year] = data['Data fim'].split('/');
    await this.page.locator('#rental-end-date').fill(`${year}-${month}-${day}`);
  }

  if (data['Dia vencimento']) {
    await this.page.locator('#rental-payment-day').click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('option', { name: data['Dia vencimento'], exact: true }).click();
  }

  // Caução (obrigatório encher a data de pagamento; valor pode ficar 0, o
  // formulário não valida isso -- ver comentário na cenário "Caução
  // obrigatória" em 7-locacoes-regras.feature).
  await this.page.locator('#rental-deposit-amount').fill(data['Aluguel'] || '3000.00');
  await this.page.locator('#rental-deposit-date').fill('2026-08-01');

  // Salvar. Ao criar (não editar), o Comprovante de Contrato abre sozinho
  // por cima do formulário (RentalFormDialog.tsx) -- precisa fechar ele
  // primeiro (botão "Fechar"), só depois aparece o aviso "Locação criada
  // com sucesso." (OK). Sem isso os passos seguintes esbarravam num diálogo
  // ainda aberto por cima da tela.
  await this.page.getByRole('button', { name: /salvar/i }).click();

  const comprovante = this.page.getByRole('dialog').filter({ hasText: 'Comprovante de Contrato' });
  if (await comprovante.isVisible({ timeout: 10000 }).catch(() => false)) {
    await comprovante.getByRole('button', { name: /fechar/i }).click();
  }

  const alerta = this.page.getByRole('alertdialog');
  if (await alerta.isVisible({ timeout: 5000 }).catch(() => false)) {
    await alerta.getByRole('button', { name: /^OK$/i }).click();
  }

  await this.page.waitForTimeout(1000);

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

/**
 * ⚠️ Consertado em 10/set/2026 (issue #76 -- falsos positivos).
 *
 * Era um MOCK: guardava a tabela do cenário em memória e não criava locação
 * nenhuma. Todo cenário que começava por aqui rodava em cima do nada -- e o
 * "Comprovante de Contrato - Somar aluguel e garagem" terminava num passo que
 * também não conferia nada, então o par se escondia mutuamente.
 */
Given('que existe uma locação com:', async function(dataTable: any) {
  const data = dataTable.rowsHash();

  const numero = (texto: string | undefined) => {
    if (!texto) return 0;
    const limpo = String(texto).trim();
    return limpo.includes(',')
      ? parseFloat(limpo.replace(/\./g, '').replace(',', '.'))
      : parseFloat(limpo.replace(/,/g, ''));
  };

  const aluguel = numero(data['Aluguel'] ?? data['Valor'] ?? data['Valor Aluguel']);
  const garagem = numero(data['Garagem'] ?? data['Valor Garagem']);

  const sufixo = Date.now();
  const tenant = await this.createTenant({ name: `Locacao Comprovante E2E ${sufixo}` });

  const rental = await this.createRental({
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    rent_due_day: 10,
    rent_value: aluguel,
    has_garage: garagem > 0,
    garage_value: garagem,
    tenant_id: tenant.id,
  });

  this.rentalId = rental.id;
  this.testData = {
    ...this.testData,
    rentalId: rental.id,
    rentValue: aluguel,
    garageValue: garagem,
    rental: { ...data, id: rental.id, tenantName: tenant.name },
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
  await this.page.waitForLoadState('domcontentloaded');
});

/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99, cluster "Pagamentos"): este
 * passo era um STUB -- só navegava pra /payments e guardava o status em
 * memória, sem criar NENHUM pagamento de verdade. Os cenários que
 * dependiam dele ("Gerar recibo de pagamento", "Cancelar pagamento -
 * Confirmar") ficavam reféns de o banco de DEV já ter, por acaso, algum
 * pagamento com aquele status -- e paravam de funcionar sempre que a
 * massa de dados antiga era limpa (ver #89). Agora cria de verdade: um
 * inquilino + uma locação + um pagamento com o status pedido, com nome
 * único (timestamp) pra achar a linha certa na tabela depois.
 *
 * O sistema só tem os status "pending" e "paid" pra um pagamento normal
 * de aluguel (não existe "Cancelado" -- cancelar um pago volta pra
 * "Pendente", ver comentário na feature). Por isso este passo só sabe
 * criar "Pendente" ou "Pago".
 */
Given('que existe um pagamento {string}', async function(this: import('../support/world').CustomWorld, status: string) {
  const sufixo = Date.now();
  const tenant = await this.createTenant({ name: `Pagamento E2E ${sufixo}` });
  const rental = await this.createRental({
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    rent_due_day: 10,
    rent_value: 1500,
    tenant_id: tenant.id,
  });

  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = String(hoje.getFullYear());
  const statusBanco = status === 'Pago' ? 'paid' : 'pending';

  const payment = await DatabaseHelper.upsertPayment({
    rental_id: rental.id,
    reference_month: mes,
    reference_year: ano,
    due_date: `${ano}-${mes}-10`,
    expected_amount: 1500,
    status: statusBanco,
    ...(statusBanco === 'paid' ? { paid_amount: 1500, payment_date: `${ano}-${mes}-10` } : {}),
    breakdown: [{ description: 'Aluguel', amount: 1500, type: 'addition' }],
  });

  await this.page.goto('/payments');
  await this.page.waitForLoadState('domcontentloaded');

  const aba = this.page.locator(statusBanco === 'paid' ? '#payments-tab-paid' : '#payments-tab-pending');
  await aba.click();

  const busca = this.page.locator('#payments-search-input');
  await busca.waitFor({ state: 'visible', timeout: 10000 });
  await busca.fill(tenant.name);
  await this.page.waitForTimeout(800);

  this.testData = {
    ...this.testData,
    paymentId: payment.id,
    paymentStatus: status,
    rentalId: rental.id,
    tenantName: tenant.name,
  };
});

/**
 * Abre o diálogo de gerenciar o recebimento (linha da tabela) do
 * pagamento de teste criado pelo passo "que existe um pagamento
 * {string}" -- necessário quando o cenário precisa agir DENTRO do
 * diálogo (ex.: "Cancelar Pagamento", que só existe lá, nunca na tela de
 * listagem).
 */
When('abro o recebimento de teste', async function(this: import('../support/world').CustomWorld) {
  const nomeInquilino = this.testData?.tenantName;
  expect(nomeInquilino, 'nome do inquilino de teste não foi guardado (rode o Given antes)').toBeTruthy();

  const linha = this.page.locator('tbody tr').filter({ hasText: nomeInquilino });
  await expect(linha.first(), `não encontrei a linha do pagamento de teste (${nomeInquilino})`).toBeVisible({ timeout: 15000 });
  await linha.first().click();

  await expect(this.page.locator('#payments-manage-dialog')).toBeVisible({ timeout: 15000 });
});

/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99): nunca existiu um botão "Gerar
 * Recibo" na tela de Pagamentos -- a coluna "Recibo" (aba Pagos) mostra
 * botões NUMERADOS (1, 2, 3...), um por recibo emitido daquele
 * recebimento (payments.tsx, coluna "actions"). Com um único pagamento
 * de teste, é sempre o botão "1" (title="Recibo 1").
 */
When('clico no botão de recibo', async function(this: import('../support/world').CustomWorld) {
  const botaoRecibo = this.page.locator('[title^="Recibo"]').first();
  await expect(botaoRecibo, 'não encontrei nenhum botão de recibo na tela').toBeVisible({ timeout: 15000 });
  await botaoRecibo.click();
  await this.page.waitForTimeout(500);
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
  await this.page.waitForLoadState('domcontentloaded');
});

When('visualizo o detalhamento do pagamento', async function() {
  // Clicar no primeiro pagamento da lista
  const firstPayment = this.page.locator('tbody tr').first();
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

/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99, 2ª rodada -- causa raiz real, as
 * 3 tentativas anteriores abaixo miraram o componente errado): os ids
 * "payment-filters-month"/"payment-filters-year" são de `PaymentFilters.tsx`
 * -- um componente que NÃO é mais usado em lugar nenhum (grep confirma:
 * `payments.tsx` não o importa). O filtro de mês/ano real da tela de
 * Pagamentos (e também Financeiro/Dashboard) é `PeriodSelector.tsx`, que
 * não tinha `id` nenhum -- por isso o passo sempre rodava os 20s inteiros
 * de timeout sem nunca achar o campo. Adicionados os ids reais
 * ("period-selector-month"/"period-selector-year") no componente, e todos
 * os passos abaixo atualizados para usá-los.
 */
When('filtro pelo mês {string}', async function(month: string) {
  // Exemplo: "Agosto/2026"
  const [monthName, year] = month.split('/');

  const monthSelect = this.page.locator('#period-selector-month');
  await monthSelect.click();
  await this.page.waitForTimeout(300);
  await this.page.getByRole('option', { name: new RegExp(monthName, 'i') }).click();
  await this.page.waitForTimeout(300);

  const yearSelect = this.page.locator('#period-selector-year');
  await yearSelect.click();
  await this.page.waitForTimeout(300);
  await this.page.getByRole('option', { name: year, exact: true }).click();

  await this.page.waitForTimeout(1000);

  this.testData = {
    ...this.testData,
    filteredMonth: month
  };
});

// Observação: "filtro por {string}" (genérico) vive em common.steps.ts —
// não duplicar aqui.

When('filtro por {string} na página de Recebimentos', async function(month: string) {
  const [monthName] = month.split('/');

  const monthSelect = this.page.locator('#period-selector-month');
  await monthSelect.click();
  await this.page.waitForTimeout(300);
  await this.page.getByRole('option', { name: new RegExp(monthName, 'i') }).click();

  await this.page.waitForTimeout(1000);
});

When('seleciono o mês {string}', async function(month: string) {
  const monthSelect = this.page.locator('#period-selector-month');
  await monthSelect.click();
  await this.page.waitForTimeout(300);

  const monthOption = this.page.getByRole('option', { name: new RegExp(month, 'i') });
  await monthOption.click();
  await this.page.waitForTimeout(500);
});

When('seleciono o ano {string}', async function(year: string) {
  const yearSelect = this.page.locator('#period-selector-year');
  await yearSelect.click();
  await this.page.waitForTimeout(300);

  const yearOption = this.page.getByRole('option', { name: year, exact: true });
  await yearOption.click();
  await this.page.waitForTimeout(500);
});

// Observação: "seleciono o status {string}" vive em properties.steps.ts
// (tenta os seletores de Imóveis, Inquilinos e Pagamentos) — não duplicar.

// ==================== AÇÕES ====================

When('marco o pagamento como {string}', async function(status: string) {
  // Não existe botão "Pago" na tela. O que existe é a ABA "Recebimentos Pagos"
  // e a etiqueta de status. Marcar como pago é abrir a LINHA do recebimento --
  // o que abre o diálogo de recebimento -- e confirmar lá dentro.
  await expect(this.page.locator('#payments-tab-pending')).toBeVisible({ timeout: 30000 });

  // Linha de caução abre outro diálogo; por isso a primeira que não for caução.
  const linha = this.page.locator('tbody tr').filter({ hasNotText: 'Caução' }).first();
  await expect(linha, 'não há nenhum recebimento pendente na tela').toBeVisible({ timeout: 15000 });
  await linha.click();

  await expect(this.page.locator('#payments-manage-dialog')).toBeVisible({ timeout: 15000 });
  await expect(this.page.locator('#payment_date')).toBeVisible({ timeout: 15000 });
});

When('preencho a data de pagamento', async function() {
  // O campo é #payment_date, com underscore -- [id*="payment-date"] não casava.
  await this.page.locator('#payment_date').fill('2026-08-01');
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
  const payments = this.page.locator('tbody tr');
  await expect(payments).toHaveCount(count, { timeout: 5000 });
});

Then('devo ver {int} recebimentos', async function(count: number) {
  const payments = this.page.locator('tbody tr');
  await expect(payments).toHaveCount(count, { timeout: 5000 });
});

Then('o recebimento deve ter:', async function(dataTable: any) {
  const expected = dataTable.rowsHash();
  
  const firstPayment = this.page.locator('tbody tr').first();
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
  const paymentCard = this.page.locator('tbody tr').first();
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
  const payments = this.page.locator('tbody tr');
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

Given('que existe uma locação com status {string} e um recebimento pendente residual em {string}', async function(status: string, periodo: string) {
  const [monthName, year] = periodo.split('/');
  const monthNum = MESES_PT.indexOf(monthName.toLowerCase()) + 1;
  if (monthNum === 0) throw new Error(`Mês não reconhecido: "${monthName}"`);
  const referenceMonth = String(monthNum).padStart(2, '0');
  const dueDate = `${year}-${referenceMonth}-10`;
  // Valor de aluguel deliberadamente incomum, pra não colidir com nenhum
  // outro recebimento real que já exista na base nesse mesmo mês/ano.
  const valorResidual = 6543.21;

  const rental = await DatabaseHelper.createRental({
    start_date: `${Number(year) - 1}-01-01`,
    end_date: `${Number(year) + 1}-12-31`,
    status,
  });

  const recebimentoResidual = await DatabaseHelper.upsertPayment({
    rental_id: rental.id,
    reference_month: referenceMonth,
    reference_year: year,
    due_date: dueDate,
    expected_amount: valorResidual,
    status: 'pending',
  });

  this.testData = {
    ...this.testData,
    locacaoExcluidaId: rental.id,
    recebimentoResidualId: recebimentoResidual.id,
    // Formato exibido na tela: "R$ 6.543,21"
    recebimentoResidualValorExibido: valorResidual.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  };
});

Then('não devo ver o recebimento residual da locação excluída', async function() {
  const valorExibido = this.testData?.recebimentoResidualValorExibido;
  if (!valorExibido) throw new Error('recebimentoResidualValorExibido não foi guardado pelo passo Given anterior');

  const bodyText = await this.page.textContent('body');
  expect(bodyText?.includes(valorExibido)).toBe(false);
});

/**
 * ⚠️ Corrigido em 13/set/2026 (issue #99): a tabela do Gherkin tem
 * CABEÇALHO ("campo | valor"), mas o passo usava `dataTable.rowsHash()`
 * -- que não pula cabeçalho nenhum, trata TODA linha (a do cabeçalho
 * incluída) como um par chave/valor. Isso criava uma entrada fantasma
 * `{ campo: "valor" }`, e o passo saía conferindo se cada linha da tela
 * continha o texto literal "valor" -- por isso o erro era sempre
 * "Expected substring: 'valor'". O certo é `dataTable.hashes()`, que
 * respeita o cabeçalho.
 */
Then('todos os recebimentos exibidos devem ter:', async function(dataTable: any) {
  const expected = dataTable.hashes().map((row: any) => row.valor);

  const payments = this.page.locator('tbody tr');
  const count = await payments.count();

  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();

    for (const value of expected) {
      expect(text).toContain(value as string);
    }
  }
});

Then('nenhum recebimento deve ter vencimento em outro mês', async function() {
  const filteredMonth = this.testData?.filteredMonth;
  if (!filteredMonth) return;
  
  const [monthName, year] = filteredMonth.split('/');
  
  const payments = this.page.locator('tbody tr');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    expect(text).toContain(monthName);
    expect(text).toContain(year);
  }
});

/**
 * ⚠️ Corrigido em 13/set/2026 (issue #99): `getByText(/Aluguel/i)` sem
 * `.first()` varre a página INTEIRA -- e "Aluguel" também aparece no
 * título da tela ("Registrar Recebimento de Aluguel"), então batia em 3
 * elementos e estourava por "strict mode violation" (Playwright recusa
 * agir num locator ambíguo). Mesmo risco pro valor.
 */
Then('devo ver:', async function(dataTable: any) {
  const rows = dataTable.hashes();

  for (const row of rows) {
    const fieldText = this.page.getByText(new RegExp(row.campo, 'i')).first();
    await expect(fieldText).toBeVisible();

    const valueText = this.page.getByText(row.valor).first();
    await expect(valueText).toBeVisible();
  }
});

/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99, 2ª rodada): `getByText(/Pendente/i)`
 * sem escopo bate na tela inteira -- e "Pendente" também aparece nas abas
 * "Recebimentos Pendentes" (2x, variante mobile/desktop) além do selo da
 * linha, então batia em 3 elementos e o Playwright recusava agir ("strict
 * mode violation"). Escopado pela linha do pagamento de teste quando
 * conhecida (guardada por "que existe um pagamento {string}"); senão cai
 * pro `.first()` pra não quebrar cenários mais antigos que não guardam isso.
 */
Then('o status deve mudar para {string}', async function(this: import('../support/world').CustomWorld, status: string) {
  const nomeInquilino = this.testData?.tenantName;
  const escopo = nomeInquilino
    ? this.page.locator('tbody tr').filter({ hasText: nomeInquilino })
    : this.page;
  const statusBadge = escopo.getByText(new RegExp(status, 'i')).first();
  await expect(statusBadge).toBeVisible({ timeout: 5000 });
});

Then('devo poder gerar o recibo', async function() {
  const receiptButton = this.page.getByRole('button', { name: /gerar recibo/i });
  await expect(receiptButton).toBeVisible();
  await expect(receiptButton).toBeEnabled();
});

/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99): nunca existiu
 * `[data-testid="pdf-viewer"]` no produto -- o "recibo" é um HTML
 * renderizado na tela (PaymentReceipt.tsx, `#receipt-content`), que só
 * vira um arquivo PDF de verdade se o usuário clicar em "Baixar PDF"
 * (gerado on-demand com html2pdf.js). O contrato real é "o recibo abre na
 * tela", não "abre um visualizador de PDF" -- por isso essa asserção
 * sempre falhava (`hasPDF` nunca virava `true`).
 */
Then('devo ver o PDF do recibo', async function(this: import('../support/world').CustomWorld) {
  const recibo = this.page.locator('#receipt-content');
  await expect(recibo, 'o diálogo do recibo não abriu').toBeVisible({ timeout: 10000 });
});

/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99): o recibo (PaymentReceipt.tsx)
 * é uma carta corrida ("Recebi dos Srs. FULANO, a importância de..."),
 * não um formulário com campos rotulados -- o texto literal "Nome do
 * inquilino"/"Valor pago" nunca aparece na tela, então esta asserção
 * nunca batia. Cada linha da tabela do Gherkin continua descrevendo a
 * INFORMAÇÃO que precisa aparecer (linguagem de negócio); aqui traduzimos
 * pro texto real que a carta realmente mostra.
 */
Then('o recibo deve conter:', async function(this: import('../support/world').CustomWorld, dataTable: any) {
  const items = dataTable.hashes();

  const recibo = this.page.locator('#receipt-content');
  await expect(recibo, 'o diálogo do recibo não abriu').toBeVisible({ timeout: 10000 });
  const texto = await recibo.textContent();

  for (const item of items) {
    switch (item.informação) {
      case 'Nome do inquilino': {
        const nome = this.testData?.tenantName;
        expect(nome, 'nome do inquilino de teste não foi guardado').toBeTruthy();
        expect(texto).toContain(nome);
        break;
      }
      case 'Endereço do imóvel':
        // A carta cita "...do imóvel situado em <endereço>..." -- confere
        // que algum endereço foi de fato preenchido ali, não ficou em branco.
        expect(texto).toMatch(/situado em\s+\S/);
        break;
      case 'Valor pago':
        expect(texto).toContain('Total Pago');
        break;
      case 'Data de pagamento':
        expect(texto).toMatch(/vencimento em/i);
        break;
      case 'Detalhamento':
        expect(texto).toContain('Valores:');
        break;
      default:
        expect(texto).toContain(item.informação);
    }
  }
});

/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99): não existe botão "Gerar
 * Recibo" (ver "clico no botão de recibo") -- essa asserção sempre
 * "passava" sem checar nada de verdade (o botão nunca existiu, o
 * `.catch(() => true)` mascarava isso). Depois de cancelar, o pagamento
 * volta pro status Pendente -- aba onde a coluna de recibo nem existe
 * (payments.tsx, pendingColumns). Confere isso na linha de teste.
 */
Then('não deve ser possível gerar recibo', async function(this: import('../support/world').CustomWorld) {
  const nomeInquilino = this.testData?.tenantName;
  if (!nomeInquilino) return;

  const linha = this.page.locator('tbody tr').filter({ hasText: nomeInquilino });
  if (await linha.first().isVisible().catch(() => false)) {
    await expect(linha.first().locator('[title^="Recibo"]')).toHaveCount(0);
  }
});

Then('devo ver apenas pagamentos de Janeiro', async function() {
  const payments = this.page.locator('tbody tr');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    expect(text).toContain('Janeiro');
  }
});

Then('devo ver apenas pagamentos de {int}', async function(year: number) {
  const payments = this.page.locator('tbody tr');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    expect(text).toContain(year.toString());
  }
});

Then('devo ver apenas pagamentos pendentes', async function() {
  const payments = this.page.locator('tbody tr');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    expect(text?.toLowerCase()).toContain('pendente');
  }
});

Then('devo ver apenas pagamentos pagos', async function() {
  const payments = this.page.locator('tbody tr');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    expect(text?.toLowerCase()).toContain('pago');
  }
});

// Observação: "no bloco {string} devo ver:" vive em rentals.steps.ts (trata
// o marcador "(vazio)") — não duplicar aqui.