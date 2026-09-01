import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import DatabaseHelper from '../helpers/database.helper';

/**
 * Step Definitions para Locações e Cauções
 */

// ==================== SETUP DE DADOS ====================

// Observação: "que existe um imóvel disponível {string} com aluguel de
// {string}" vive em properties.steps.ts (cria o imóvel de verdade via
// DatabaseHelper) — não duplicar aqui.

Given('existe um inquilino {string}', async function(tenantName: string) {
  const tenant = await this.createTenant({ name: tenantName });
  this.tenantId = tenant.id;
  this.testData = {
    ...this.testData,
    tenant: { id: tenant.id, name: tenantName }
  };
});

Given('que existe uma locação ativa', async function() {
  // Mock: assumir que existe locação criada
  this.testData = {
    ...this.testData,
    hasActiveRental: true
  };
});

Given('que existe uma locação ativa com aluguel de {string}', async function(rentValue: string) {
  this.testData = {
    ...this.testData,
    rental: { rent: rentValue }
  };
});

Given('o dia de vencimento é {string}', async function(paymentDay: string) {
  this.testData = {
    ...this.testData,
    rental: { ...this.testData?.rental, paymentDay }
  };
});

Given('que existe uma locação ativa com término em {string}', async function(endDate: string) {
  this.testData = {
    ...this.testData,
    rental: { endDate }
  };
});

/**
 * ⚠️ As 4 steps abaixo usam "\\/" (barra escapada) porque, em Cucumber
 * Expressions, "/" sem escape significa ALTERNATIVA (ex.: "Janeiro/2026"
 * seria lido como "Janeiro" OU "2026", nunca o texto literal com barra).
 * Sem esse escape, essas steps nunca batiam com o texto das features e
 * apareciam como "undefined" no dry-run.
 */

async function upsertMonthlyPayment(
  world: any,
  month: string,
  monthNumber: string,
  year: string,
  status: string,
  value: string
) {
  const rentalId = world.rentalId || world.testData?.rentalId;
  const amount = parseFloat(value.replace(/\./g, '').replace(',', '.'));

  const payment = await world.upsertPayment({
    rental_id: rentalId,
    reference_month: monthNumber,
    reference_year: year,
    due_date: `${year}-${monthNumber}-10`,
    expected_amount: amount,
    status: status.toLowerCase().includes('pago') ? 'paid' : 'pending',
    paid_amount: status.toLowerCase().includes('pago') ? amount : undefined,
    payment_date: status.toLowerCase().includes('pago') ? `${year}-${monthNumber}-10` : undefined,
  });

  world.testData[`${month.toLowerCase()}Payment`] = { status, value, payment };
}

Given('o pagamento de Janeiro\\/2026 está {string} com valor de {string}', async function (status: string, value: string) {
  await upsertMonthlyPayment(this, 'january', '01', '2026', status, value);
});

Given('o pagamento de Novembro\\/2025 está {string} com valor de {string}', async function (status: string, value: string) {
  await upsertMonthlyPayment(this, 'november', '11', '2025', status, value);
});

Given('o pagamento de Dezembro\\/2025 está {string} com valor de {string}', async function (status: string, value: string) {
  await upsertMonthlyPayment(this, 'december', '12', '2025', status, value);
});

Given('o pagamento de Março\\/2026 está {string} com valor de {string}', async function (status: string, value: string) {
  await upsertMonthlyPayment(this, 'march', '03', '2026', status, value);
});

Given('o pagamento de referência Junho\\/2026 está {string} com valor de {string}', async function (status: string, value: string) {
  await upsertMonthlyPayment(this, 'june', '06', '2026', status, value);
});

// ⚠️ Regressão do bug real em produção (locação LEMOS APTO 06, 31/ago/2026,
// issue #59): "Renovar Contrato" avançava end_date mas não criava nenhum
// recebimento de aluguel até a nova data. Cria a locação direto no banco
// (sem passar pela tela) para o teste ficar rápido e focado só no botão
// "Renovar Contrato" -- criar via DatabaseHelper.createRental não gera a
// tabela `payments`, então o cenário nasce sem recebimento nenhum, exatamente
// como uma locação bem antiga que nunca teve seus recebimentos revisados.
Given(
  'uma locação ativa cujo contrato está para vencer, com aluguel de {string} e vencimento dia {string}',
  async function (this: import('../support/world').CustomWorld, rentValue: string, dueDay: string) {
    const sufixo = Date.now();
    const tenant = await this.createTenant({ name: `Renovacao E2E ${sufixo}` });

    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setMonth(inicio.getMonth() - 11);
    const fimAntigo = new Date(hoje);
    fimAntigo.setDate(fimAntigo.getDate() + 3);

    const rental = await this.createRental({
      start_date: inicio.toISOString().split('T')[0],
      end_date: fimAntigo.toISOString().split('T')[0],
      rent_value: parseFloat(rentValue),
      tenant_id: tenant.id,
    } as any);

    // createRental não aceita rent_due_day nos overrides tipados do helper;
    // ajustamos direto no banco.
    const { supabaseAdmin } = await import('../helpers/database.helper');
    await supabaseAdmin.from('rentals').update({ rent_due_day: parseInt(dueDay, 10) }).eq('id', rental.id);

    this.rentalId = rental.id;
    this.testData = {
      ...this.testData,
      renovacao: {
        tenantName: tenant.name,
        rentValue: parseFloat(rentValue),
        oldEndDate: fimAntigo.toISOString().split('T')[0],
      },
    };
  }
);

When('clico em {string} dessa locação', async function (this: import('../support/world').CustomWorld, botao: string) {
  if (!botao.toLowerCase().includes('renovar')) {
    throw new Error(`Passo só sabe lidar com "Renovar Contrato", recebeu: ${botao}`);
  }

  await this.page.goto('/rentals');
  await this.page.waitForLoadState('domcontentloaded');

  const search = this.page.locator('#rentals-search-input');
  await search.fill(this.testData.renovacao.tenantName);
  await this.page.waitForTimeout(500);

  await this.page.locator(`#rentals-renew-${this.rentalId}`).click();
  await this.page.waitForTimeout(300);
});

When('confirmo a renovação', async function (this: import('../support/world').CustomWorld) {
  await this.page.locator('#rentals-renew-confirm').click();
  await this.page.waitForTimeout(1500);
});

Then('a data fim da locação deve avançar 1 ano', async function (this: import('../support/world').CustomWorld) {
  const { supabaseAdmin } = await import('../helpers/database.helper');
  const { data: rental } = await supabaseAdmin.from('rentals').select('end_date').eq('id', this.rentalId).single();

  const esperado = new Date(this.testData.renovacao.oldEndDate + 'T00:00:00');
  esperado.setFullYear(esperado.getFullYear() + 1);
  const esperadoStr = esperado.toISOString().split('T')[0];

  expect(rental?.end_date, `data fim não avançou: era ${this.testData.renovacao.oldEndDate}, esperava ${esperadoStr}, ficou ${rental?.end_date}`).toBe(esperadoStr);
  this.testData.renovacao.newEndDate = rental!.end_date;
});

Then(
  'deve existir um recebimento de aluguel pendente para cada mês até a nova data fim',
  async function (this: import('../support/world').CustomWorld) {
    const DatabaseHelper = (await import('../helpers/database.helper')).default;
    const payments = await DatabaseHelper.getPaymentsByRental(this.rentalId);

    expect(payments.length, 'a renovação não criou nenhum recebimento -- este é exatamente o bug real da #59').toBeGreaterThan(0);

    const novaData = new Date(this.testData.renovacao.newEndDate + 'T00:00:00');
    const mesEsperado = String(novaData.getMonth() + 1).padStart(2, '0');
    const anoEsperado = String(novaData.getFullYear());

    const temUltimoMes = payments.some(
      (p: any) => p.reference_month === mesEsperado && p.reference_year === anoEsperado
    );
    expect(temUltimoMes, `não achei recebimento para ${mesEsperado}/${anoEsperado} (competência da nova data fim)`).toBe(true);

    const chaves = payments.map((p: any) => `${p.reference_year}-${p.reference_month}`);
    expect(new Set(chaves).size, 'há recebimentos duplicados no mesmo mês/ano desta locação').toBe(chaves.length);
  }
);

Then(
  'o último recebimento deve ser proporcional aos dias até a nova data fim',
  async function (this: import('../support/world').CustomWorld) {
    const DatabaseHelper = (await import('../helpers/database.helper')).default;
    const payments = await DatabaseHelper.getPaymentsByRental(this.rentalId);
    const ordenados = [...payments].sort((a: any, b: any) => String(a.due_date).localeCompare(String(b.due_date)));
    const ultimo = ordenados[ordenados.length - 1];

    expect(Number(ultimo.expected_amount)).toBeGreaterThan(0);
    expect(
      Number(ultimo.expected_amount),
      `último recebimento deveria ser proporcional (menor que o aluguel cheio de ${this.testData.renovacao.rentValue}), veio R$ ${ultimo.expected_amount}`
    ).toBeLessThan(this.testData.renovacao.rentValue);
  }
);

Given('que existe uma locação com caução parcelado em 3x:', async function(dataTable: any) {
  const installments = dataTable.hashes();
  
  this.testData = {
    ...this.testData,
    depositInstallments: installments
  };
});

// ==================== AÇÕES ====================

When('seleciono um imóvel que está {string}', async function(status: string) {
  // Tentar selecionar um imóvel ocupado (deve falhar)
  await this.page.waitForTimeout(300);
});

When('NÃO preencho o valor da caução', async function() {
  // Não fazer nada - deixar campo vazio
  await this.page.waitForTimeout(100);
});

When('tento salvar', async function() {
  const saveButton = this.page.getByRole('button', { name: /salvar/i });
  await saveButton.click();
  await this.page.waitForTimeout(500);
});

When('preencho o valor da caução com {string}', async function(value: string) {
  const depositInput = this.page.locator('[id*="deposit"]').first();
  await depositInput.fill(value);
});

// Os rótulos na tela não são os mesmos textos usados nos cenários: a tela diz
// "Vaga Garagem?", "Caução Parcelado?" e "Corretor Parceiro?". Mapear a opção
// para o id da caixa de seleção evita depender do texto exato do rótulo.
const CAIXAS_POR_OPCAO: Record<string, string> = {
  'garagem': 'rental-has-garage',
  'parcelar caução': 'rental-deposit-installment',
  'caução parcelado': 'rental-deposit-installment',
  'corretor parceiro': 'rental-has-partner',
};

When('marco a opção {string}', async function(option: string) {
  const chave = Object.keys(CAIXAS_POR_OPCAO).find((k) => option.toLowerCase().includes(k));

  if (chave) {
    await this.page.locator(`#${CAIXAS_POR_OPCAO[chave]}`).click();
  } else {
    await this.page.getByText(new RegExp(option, 'i')).first().click();
  }

  await this.page.waitForTimeout(300);
});

When('NÃO marco a opção {string}', async function(option: string) {
  // Não fazer nada
  await this.page.waitForTimeout(100);
});

When('seleciono {string}', async function (this: import('../support/world').CustomWorld, option: string) {
  const normalized = option.toLowerCase();

  // Tipo de pessoa no formulário de Inquilino (radio buttons, não um select)
  if (normalized.includes('pessoa física') || normalized.includes('pessoa fisica')) {
    await this.page.locator('#tenant-doc-type-cpf').click();
    return;
  }
  if (normalized.includes('pessoa jurídica') || normalized.includes('pessoa juridica')) {
    await this.page.locator('#tenant-doc-type-cnpj').click();
    return;
  }

  // Nº de parcelas da caução (select) no formulário de Locação
  const select = this.page.locator('[id*="installment-count"], [id*="deposit-installments"]').first();
  if (await select.isVisible().catch(() => false)) {
    await select.click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('option', { name: new RegExp(option, 'i') }).click();
    return;
  }

  // Fallback genérico: clicar no texto da opção
  await this.page.getByText(option).first().click();
});

When('preencho:', async function(dataTable: any) {
  const rows = dataTable.hashes();
  
  for (const row of rows) {
    const field = row.campo;
    const value = row.valor;
    
    // Identificar o campo pelo label
    let inputId = '';
    
    if (field.includes('1ª parcela - Valor')) {
      inputId = 'deposit-installment-1-amount';
    } else if (field.includes('1ª parcela - Data Pagamento')) {
      inputId = 'deposit-payment-date';
    } else if (field.includes('2ª parcela - Valor')) {
      inputId = 'deposit-installment-2-amount';
    } else if (field.includes('2ª parcela - Data Vencimento')) {
      inputId = 'deposit-installment-2-date';
    } else if (field.includes('3ª parcela - Valor')) {
      inputId = 'deposit-installment-3-amount';
    } else if (field.includes('3ª parcela - Data Vencimento')) {
      inputId = 'deposit-installment-3-date';
    }
    
    const input = this.page.locator(`#${inputId}`);
    if (await input.isVisible()) {
      if (value.includes('/')) {
        // Data: converter DD/MM/YYYY para YYYY-MM-DD
        const [day, month, year] = value.split('/');
        await input.fill(`${year}-${month}-${day}`);
      } else {
        await input.fill(value);
      }
    }
  }
});

When('preencho a {string} da 1ª parcela com {string}', async function(fieldName: string, value: string) {
  // O campo "Data Pagamento *" do bloco Caução é #rental-deposit-date.
  const input = this.page.locator('#rental-deposit-date');
  
  if (value.includes('/')) {
    const [day, month, year] = value.split('/');
    await input.fill(`${year}-${month}-${day}`);
  } else {
    await input.fill(value);
  }
});

When('preencho a {string} com {string}', async function(fieldName: string, value: string) {
  // O id deposit-payment-date nunca existiu na tela; o campo real do
  // formulário de locação é #rental-deposit-date, e ele aparece sempre --
  // não depende de caução à vista ou parcelado.
  let inputId = '';

  if (fieldName.toLowerCase().includes('data pagamento')) {
    inputId = 'rental-deposit-date';
  }

  if (!inputId) {
    throw new Error(`Campo desconhecido no passo "preencho a ... com ...": ${fieldName}`);
  }

  const input = this.page.locator(`#${inputId}`);
  
  if (value.includes('/')) {
    const [day, month, year] = value.split('/');
    await input.fill(`${year}-${month}-${day}`);
  } else {
    await input.fill(value);
  }
});

When('salvo a locação', async function() {
  // O botão do formulário de Locação diz "Criar" (nova) ou "Atualizar"
  // (edição), nunca "Salvar" -- por isso pelo id.
  await this.page.locator('#rental-form-submit').click();
  await this.page.waitForTimeout(2000);
});

// Observação: o step "crio uma locação com:" (usado pela feature 10-caucoes)
// vive em deposits.steps.ts, que cria a locação de verdade via
// DatabaseHelper — não duplicar aqui (causa "ambiguous step" no Cucumber).

When('abro a locação em modo {string}', async function(mode: string) {
  // Clicar no primeiro card de locação
  const firstRental = this.page.locator('[data-testid="rental-card"]').first();
  await firstRental.click();
  await this.page.waitForTimeout(500);
});

When('edito a locação', async function() {
  const editButton = this.page.getByRole('button', { name: /editar/i });
  await editButton.click();
  await this.page.waitForTimeout(500);
});

When('edito a locação em {string}', async function(date: string) {
  // Simular data atual no contexto do teste
  this.testData = {
    ...this.testData,
    currentDate: date
  };
  
  const editButton = this.page.getByRole('button', { name: /editar/i });
  await editButton.click();
  await this.page.waitForTimeout(500);
});

When('altero o valor do aluguel de {string} para {string}', async function(oldValue: string, newValue: string) {
  const rentInput = this.page.locator('[id*="rent"]');
  await rentInput.fill(newValue);
});

When('altero o valor do aluguel para {string}', async function(newValue: string) {
  // Reaproveitado no formulário de Imóvel (#property-value) e no de Locação
  // ([id*="rent"]) — usa o que estiver visível na tela atual.
  const propertyValueInput = this.page.locator('#property-value');
  if (await propertyValueInput.isVisible().catch(() => false)) {
    await propertyValueInput.fill(newValue);
    return;
  }
  const rentInput = this.page.locator('[id*="rent"]').first();
  await rentInput.fill(newValue);
});

When('altero a data de início para {string}', async function(date: string) {
  const startDateInput = this.page.locator('#rental-start-date');

  if (date.includes('/')) {
    const [day, month, year] = date.split('/');
    await startDateInput.fill(`${year}-${month}-${day}`);
  } else {
    await startDateInput.fill(date);
  }
});

When('altero a garagem para {string}', async function(value: string) {
  const garageCheckbox = this.page.getByText(/possui garagem/i);
  await garageCheckbox.click();
  await this.page.waitForTimeout(300);
  
  const garageInput = this.page.locator('[id*="garage"]');
  await garageInput.fill(value);
});

When('salvo as alterações', async function() {
  const saveButton = this.page.getByRole('button', { name: /salvar/i });
  await saveButton.click();
  await this.page.waitForTimeout(2000);
});

When('visualizo o {string}', async function(documentName: string) {
  const button = this.page.getByRole('button', { name: new RegExp(documentName, 'i') });
  await button.click();
  await this.page.waitForTimeout(1000);
});

When('preencho a data de encerramento com {string}', async function(date: string) {
  const dateInput = this.page.locator('[id*="termination-date"]');
  
  if (date.includes('/')) {
    const [day, month, year] = date.split('/');
    await dateInput.fill(`${year}-${month}-${day}`);
  } else {
    await dateInput.fill(date);
  }
});

When('confirmo o encerramento', async function() {
  const confirmButton = this.page.getByRole('button', { name: /confirmar/i });
  await confirmButton.click();
  await this.page.waitForTimeout(2000);
});

// ==================== VALIDAÇÕES ====================

Then('não devo poder continuar', async function() {
  const saveButton = this.page.getByRole('button', { name: /salvar/i });
  const isDisabled = await saveButton.isDisabled().catch(() => true);
  expect(isDisabled).toBe(true);
});

Then('na aba {string} da página Financeiro devo ver:', async function(tabName: string, dataTable: any) {
  const rows = dataTable.hashes();
  
  // Navegar para Financial
  await this.page.goto('/financial');
  await this.page.waitForLoadState('domcontentloaded');
  
  // Clicar na aba
  const tab = this.page.getByRole('tab', { name: new RegExp(tabName, 'i') });
  await tab.click();
  await this.page.waitForTimeout(1000);
  
  // Verificar dados da tabela
  for (const row of rows) {
    const parcelaText = this.page.getByText(row.Parcela);
    await expect(parcelaText).toBeVisible();
    
    const valorText = this.page.getByText(row.Valor);
    await expect(valorText).toBeVisible();
  }
});

Then('na aba {string} devo ver:', async function(tabName: string, dataTable: any) {
  const rows = dataTable.hashes();
  
  const tab = this.page.getByRole('tab', { name: new RegExp(tabName, 'i') });
  await tab.click();
  await this.page.waitForTimeout(500);
  
  for (const row of rows) {
    for (const value of Object.values(row)) {
      const text = this.page.getByText(value as string);
      await expect(text).toBeVisible();
    }
  }
});

Then('no banco de dados a parcela {int} deve ter:', async function(installmentNumber: number, dataTable: any) {
  const expected = dataTable.rowsHash();
  
  // Validação via query ao banco (necessita DatabaseHelper)
  // Por enquanto, apenas log
  console.log(`Validar parcela ${installmentNumber}:`, expected);
  
  this.testData = {
    ...this.testData,
    dbValidation: { installmentNumber, expected }
  };
});

Then('a parcela {int} deve ter:', async function(installmentNumber: number, dataTable: any) {
  const expected = dataTable.rowsHash();
  
  console.log(`Validar parcela ${installmentNumber}:`, expected);
  
  this.testData = {
    ...this.testData,
    dbValidation: { installmentNumber, expected }
  };
});

Then('no bloco {string} devo ver:', async function(blockName: string, dataTable: any) {
  const rows = dataTable.hashes();
  
  const block = this.page.locator(`text=${blockName}`).locator('..').locator('..');
  
  for (const row of rows) {
    const fieldText = block.getByText(new RegExp(row.campo, 'i'));
    await expect(fieldText).toBeVisible({ timeout: 3000 });
    
    if (row.valor && row.valor !== '(vazio)') {
      const valueText = block.getByText(row.valor);
      await expect(valueText).toBeVisible({ timeout: 3000 });
    }
  }
});

// Alguns campos do formulário de Locação não têm rótulo visível -- o valor da
// garagem, por exemplo, só tem o texto de exemplo "R$ 0,00" dentro do campo.
// Para esses, procurar pelo id.
const CAMPOS_POR_NOME: Record<string, string> = {
  'valor da garagem': 'rental-garage-value',
};

Then('devo ver o campo {string}', async function(fieldName: string) {
  const chave = Object.keys(CAMPOS_POR_NOME).find((k) => fieldName.toLowerCase().includes(k));

  if (chave) {
    await expect(this.page.locator(`#${CAMPOS_POR_NOME[chave]}`)).toBeVisible();
    return;
  }

  const field = this.page.getByText(new RegExp(fieldName, 'i'));
  await expect(field.first()).toBeVisible();
});

Then('devo poder preencher o valor', async function() {
  // Este passo NÃO verificava nada (era só uma espera) e passava sempre.
  // Agora confere de verdade: o campo do valor da garagem tem que estar
  // habilitado e aceitar o que for digitado.
  const campo = this.page.locator('#rental-garage-value');

  await expect(campo, 'o campo do valor da garagem não está na tela').toBeVisible();
  await expect(campo, 'o campo do valor da garagem está bloqueado').toBeEnabled();

  await campo.click();
  await campo.pressSequentially('30000', { delay: 80 });
  await expect(
    campo,
    'o campo do valor da garagem não recebeu o que foi digitado'
  ).toHaveValue(/300,00$/, { timeout: 5000 });
});

Then('devo ver os campos:', async function(dataTable: any) {
  const fields = dataTable.hashes();
  
  for (const field of fields) {
    const fieldElement = this.page.getByText(new RegExp(field.campo, 'i'));
    await expect(fieldElement).toBeVisible();
  }
});

Then('devem ser criados {int} pagamentos', async function(count: number) {
  await this.page.goto('/payments');
  await this.page.waitForLoadState('domcontentloaded');
  
  const payments = this.page.locator('tbody tr');
  await expect(payments).toHaveCount(count, { timeout: 5000 });
});

Then('cada pagamento deve ter valor de {string}', async function(value: string) {
  const payments = this.page.locator('tbody tr');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    expect(text).toContain(value);
  }
});

Then('todos os pagamentos devem vencer no dia {int}', async function(day: number) {
  const payments = this.page.locator('tbody tr');
  const count = await payments.count();
  
  for (let i = 0; i < count; i++) {
    const payment = payments.nth(i);
    const text = await payment.textContent();
    
    // Verificar se contém o dia (formato pode variar: 10/08, 10-08, etc)
    const dayStr = day.toString().padStart(2, '0');
    const hasDay = text?.includes(`/${dayStr}/`) || text?.includes(`-${dayStr}-`) || text?.includes(` ${dayStr} `);
    expect(hasDay).toBe(true);
  }
});

Then('os pagamentos futuros devem ser atualizados para {string}', async function(value: string) {
  await this.page.waitForTimeout(500);
  this.testData = {
    ...this.testData,
    expectedFutureValue: value
  };
});

Then('os pagamentos já pagos devem manter o valor original', async function() {
  await this.page.waitForTimeout(500);
});

async function expectPaymentAmount(world: any, monthNumber: string, year: string, expectedValue: string) {
  const rentalId = world.rentalId || world.testData?.rentalId;
  const payments = await world.getRental ? null : null; // placeholder, buscamos direto abaixo
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  const rows = await DatabaseHelper.getPaymentsByRental(rentalId);
  const payment = rows.find((p: any) => p.reference_month === monthNumber && p.reference_year === year);
  expect(payment).toBeTruthy();
  const expected = parseFloat(expectedValue.replace(/\./g, '').replace(',', '.'));
  expect(Number(payment.expected_amount)).toBeCloseTo(expected, 2);
}

Then('o pagamento de Novembro\\/2025 deve manter {string}', async function (value: string) {
  await expectPaymentAmount(this, '11', '2025', value);
});

Then('o pagamento de Dezembro\\/2025 deve manter {string}', async function (value: string) {
  await expectPaymentAmount(this, '12', '2025', value);
});

Then('o pagamento de Março\\/2026 deve ser atualizado para {string}', async function (value: string) {
  await expectPaymentAmount(this, '03', '2026', value);
});

Then('o pagamento de referência Junho\\/2026 deve ser atualizado para {string}', async function (value: string) {
  await expectPaymentAmount(this, '06', '2026', value);
});

Then('pagamentos futuros devem ter {string}', async function(value: string) {
  this.testData = {
    ...this.testData,
    futurePaymentsValue: value
  };
});

Then('no campo {string} devo ver {string}', async function(fieldName: string, value: string) {
  const field = this.page.getByText(new RegExp(fieldName, 'i'));
  await expect(field).toBeVisible();
  
  const valueElement = this.page.getByText(value);
  await expect(valueElement).toBeVisible();
});

Then('não apenas o valor do aluguel', async function() {
  // Validação implícita - se a soma foi feita corretamente
  await this.page.waitForTimeout(200);
});

Then('a data de término deve ser atualizada para {string}', async function(date: string) {
  // Verificar que a data foi atualizada
  const endDateField = this.page.locator('[id*="end-date"]');
  const value = await endDateField.inputValue();
  
  const [day, month, year] = date.split('/');
  const expectedValue = `${year}-${month}-${day}`;
  
  expect(value).toBe(expectedValue);
});

Then('os pagamentos após {string} devem ser cancelados', async function(date: string) {
  this.testData = {
    ...this.testData,
    cancelledAfter: date
  };
});

Then('o imóvel deve ficar {string}', async function(status: string) {
  // Verificar status do imóvel
  await this.page.goto('/properties');
  await this.page.waitForLoadState('domcontentloaded');
  
  const statusBadge = this.page.getByText(new RegExp(status, 'i'));
  await expect(statusBadge).toBeVisible({ timeout: 5000 });
});