import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import DatabaseHelper from '../helpers/database.helper';
import { abrirFinanceiroFiltrado } from './financial.steps';
import { abrirRecebimento, formatarValorBR } from './termination.steps';

/**
 * Acordo de parcelamento do débito do inquilino (#119).
 *
 * Os dados são montados direto no banco (rápido e sem depender de outras
 * telas); o ACORDO é sempre feito pela TELA ("Parcelar débito"), e o resultado
 * é conferido no BANCO e nas telas de Recebimentos e Financeiro.
 *
 * Datas: "hoje+15" / "hoje-10" são relativas ao dia em que o teste roda (para
 * multa e juros não dependerem do calendário); "2025-11-15" é data fixa.
 */

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "hoje+15", "hoje-10", "hoje" ou uma data ISO. */
function resolverData(texto: string): string {
  const t = texto.trim();
  const m = t.match(/^hoje\s*([+-])\s*(\d+)$/);
  if (t === 'hoje' || m) {
    const d = new Date();
    if (m) d.setDate(d.getDate() + (m[1] === '+' ? 1 : -1) * Number(m[2]));
    return isoLocal(d);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) {
    const [dia, mes, ano] = t.split('/');
    return `${ano}-${mes}-${dia}`;
  }
  return t;
}

const dataBR = (iso: string) => iso.split('-').reverse().join('/');
const dinheiro = (v: number) => `R$ ${formatarValorBR(v)}`;
const arred = (n: number) => Math.round(n * 100) / 100;

function periodoDe(iso: string): string {
  const [ano, mes] = iso.split('-');
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

/** Mesma conta da tela de pagamento (usePaymentCalculations). */
function multaEJuros(base: number, dias: number, multaPct: number, jurosDiaPct: number) {
  return {
    multa: arred((base * multaPct) / 100),
    juros: arred(((base * jurosDiaPct) / 100) * dias),
  };
}

async function montarLocacao(world: CustomWorld) {
  const sufixo = Date.now();
  const location = await world.createLocation({ name: `Acordo E2E ${sufixo}` });
  const property = await world.createProperty({
    location_id: location.id,
    complement: `Acordo E2E ${sufixo}`,
    value: 1490,
    status: 'available',
  } as any);
  const tenant = await world.createTenant({ name: `Acordo E2E ${sufixo}` });
  const rental = await world.createRental({
    property_id: property.id,
    tenant_id: tenant.id,
    start_date: '2026-01-01',
    end_date: '2027-12-31',
    rent_due_day: 10,
    rent_value: 1490,
    security_deposit: 0,
    deposit_installments: 0,
  });
  world.rentalId = rental.id;
  world.tenantName = tenant.name;
  world.testData = {
    ...world.testData,
    acordo: { rentalId: rental.id, locationId: location.id, locationName: location.name, originais: [] as any[] },
  };
  return rental;
}

Given('uma locação com estes recebimentos em aberto:', { timeout: 60 * 1000 }, async function (this: CustomWorld, tabela: any) {
  const rental = await montarLocacao(this);
  for (const linha of tabela.hashes()) {
    const vencimento = resolverData(linha.vencimento);
    const valor = Number(linha.valor);
    const tipo = String(linha.tipo).toLowerCase();
    const breakdown = tipo.includes('multa')
      ? [
          { description: 'Aluguel Proporcional *', amount: arred(valor - 1490), type: 'addition' },
          { description: 'Multa Rescisória', amount: 1490, type: 'addition' },
        ]
      : [{ description: 'Aluguel', amount: valor, type: 'addition' }];
    const pagamento = await DatabaseHelper.insertPayment({
      rental_id: rental.id,
      reference_month: vencimento.slice(5, 7),
      reference_year: vencimento.slice(0, 4),
      due_date: vencimento,
      expected_amount: valor,
      paid_amount: Number(linha.pago || 0),
      status: Number(linha.pago || 0) > 0 ? 'partial' : 'pending',
      payment_kind: 'rent',
      breakdown,
    });
    this.testData.acordo.originais.push(pagamento);
  }
});

Given(
  'o Recebimento de Rescisão dessa locação tem caução corrigido {string}, despesas adicionais {string} e desconto {string}',
  async function (this: CustomWorld, caucao: string, despesas: string, desconto: string) {
    const vencimento = resolverData('hoje+10');
    const pagamento = await this.createTerminationPayment({
      rental_id: this.rentalId!,
      due_date: vencimento,
      reference_month: vencimento.slice(5, 7),
      reference_year: vencimento.slice(0, 4),
      termination_corrected_deposit: Number(caucao),
      termination_additional_expenses: Number(despesas),
      termination_discount: Number(desconto),
      breakdown: [{ description: 'Caução Corrigido p/ Devolução', amount: Number(caucao), type: 'deduction' }],
    });
    this.testData.acordo.originais.push(pagamento);
    this.testData.acordo.caucao = Math.abs(Number(caucao));
  }
);

When('abro "Parcelar débito" dessa locação na tela de Locações', { timeout: 60 * 1000 }, async function (this: CustomWorld) {
  await this.page.goto('/rentals');
  await this.page.waitForLoadState('domcontentloaded');
  const busca = this.page.locator('#rentals-search-input');
  await busca.waitFor({ state: 'visible', timeout: 20000 });
  await busca.fill(this.tenantName!);
  const botao = this.page.locator(`#rentals-agreement-${this.rentalId}`).first();
  await expect(botao, 'não achei o botão "Parcelar débito" na linha da locação').toBeVisible({ timeout: 20000 });
  await botao.click();
  await expect(this.page.locator('#acordo-dialog')).toBeVisible({ timeout: 10000 });
  await expect(this.page.getByText('Carregando recebimentos...')).toHaveCount(0, { timeout: 20000 });
});

Then('o total do acordo na tela deve ser {string}', async function (this: CustomWorld, valor: string) {
  await expect(this.page.locator('#acordo-total-debito')).toHaveText(valor, { timeout: 10000 });
});

Then(
  'o total do acordo na tela deve ser {string} mais multa e juros de {int} dias sobre {string}',
  async function (this: CustomWorld, valor: string, dias: number, base: string) {
    const config = await DatabaseHelper.getCompanyConfig();
    const { multa, juros } = multaEJuros(
      Number(base),
      dias,
      Number(config?.late_fee_percentage) || 0,
      Number(config?.interest_rate_percentage) || 0
    );
    const esperado = arred(Number(valor) + multa + juros);
    this.testData.acordo.multaEsperada = multa;
    this.testData.acordo.jurosEsperados = juros;
    this.testData.acordo.totalEsperado = esperado;
    await expect(this.page.locator('#acordo-total-debito')).toHaveText(dinheiro(esperado), { timeout: 10000 });
  }
);

Then('o acordo não deve listar o recebimento de {string}', async function (this: CustomWorld, data: string) {
  const dialogo = this.page.locator('#acordo-dialog');
  await expect(dialogo).not.toContainText(`Vencimento ${data}`);
});

Then('o acordo deve mostrar o aviso {string} e não deixar avançar', async function (this: CustomWorld, aviso: string) {
  await expect(this.page.locator('#acordo-erros')).toContainText(aviso, { timeout: 10000 });
  await expect(this.page.locator('#acordo-avancar')).toBeDisabled();
});

When(
  'escolho {int} parcela(s) com a primeira vencendo em {string}',
  async function (this: CustomWorld, quantidade: number, data: string) {
    await this.page.locator('#acordo-avancar').click();
    await this.page.locator(`#acordo-parcelas-${quantidade}`).click();
    await this.page.locator('#acordo-primeiro-vencimento').fill(resolverData(data));
    await expect(this.page.locator('#acordo-previa tbody tr')).toHaveCount(quantidade, { timeout: 5000 });
  }
);

When('confirmo o acordo', { timeout: 60 * 1000 }, async function (this: CustomWorld) {
  await this.page.locator('#acordo-avancar').click();
  await expect(this.page.locator('#acordo-resumo')).toBeVisible({ timeout: 5000 });
  await this.page.locator('#acordo-confirmar').click();
  await expect(this.page.locator('#acordo-dialog'), 'o assistente não fechou depois de criar o acordo').toBeHidden({
    timeout: 20000,
  });
  // A gravação é uma chamada só ao banco; espera ela aparecer.
  await expect
    .poll(async () => (await DatabaseHelper.getAgreementsByRental(this.rentalId!)).length, { timeout: 15000 })
    .toBeGreaterThan(0);
});

async function parcelasDoAcordo(rentalId: string) {
  const todos = await DatabaseHelper.getPaymentsByRental(rentalId);
  return todos.filter((p: any) => p.payment_kind === 'agreement').sort((a: any, b: any) => a.due_date.localeCompare(b.due_date));
}

Then('o acordo deve ter estas parcelas no banco:', async function (this: CustomWorld, tabela: any) {
  const parcelas = await parcelasDoAcordo(this.rentalId!);
  const esperadas = tabela.hashes();
  expect(parcelas.length, `quantidade de parcelas do acordo`).toBe(esperadas.length);
  esperadas.forEach((e: any, i: number) => {
    const p = parcelas[i];
    expect(`${p.installment}/${p.total_installments}`, `número da parcela ${i + 1}`).toBe(e.parcela);
    expect(dataBR(p.due_date), `vencimento da parcela ${e.parcela}`).toBe(e.vencimento);
    expect(Number(p.expected_amount), `valor da parcela ${e.parcela}`).toBeCloseTo(Number(e.valor), 2);
    expect(p.status, `status da parcela ${e.parcela}`).toBe('pending');
  });
  this.testData.acordo.parcelas = parcelas;
});

Then('o acordo deve ter {int} parcela(s) que somam o total com multa e juros', async function (this: CustomWorld, quantidade: number) {
  const parcelas = await parcelasDoAcordo(this.rentalId!);
  expect(parcelas.length).toBe(quantidade);
  const soma = arred(parcelas.reduce((s: number, p: any) => s + Number(p.expected_amount), 0));
  expect(soma, 'soma das parcelas = total com multa e juros').toBeCloseTo(this.testData.acordo.totalEsperado, 2);
  this.testData.acordo.parcelas = parcelas;
});

Then('os recebimentos originais devem estar "Renegociado"', async function (this: CustomWorld) {
  for (const original of this.testData.acordo.originais) {
    const atual = await DatabaseHelper.getPaymentById(original.id);
    expect(atual.status, `recebimento original de ${dataBR(original.due_date)}`).toBe('renegotiated');
    expect(atual.renegotiated_in_agreement_id, 'ligação com o acordo').toBeTruthy();
  }
});

Then('a multa e os juros do recebimento original devem ficar congelados no banco', async function (this: CustomWorld) {
  const original = await DatabaseHelper.getPaymentById(this.testData.acordo.originais[0].id);
  expect(Number(original.late_fee), 'multa congelada').toBeCloseTo(this.testData.acordo.multaEsperada, 2);
  expect(Number(original.interest), 'juros congelados').toBeCloseTo(this.testData.acordo.jurosEsperados, 2);
});

Then('o caução devolvido da locação deve ser {string}', async function (this: CustomWorld, valor: string) {
  const rental = await DatabaseHelper.getRental(this.rentalId!);
  expect(Number(rental.returned_deposit_amount), 'rentals.returned_deposit_amount (aba Cauções)').toBeCloseTo(Number(valor), 2);
});

When('abro a parcela {int} do acordo na tela de Recebimentos', { timeout: 60 * 1000 }, async function (this: CustomWorld, n: number) {
  const parcela = (await parcelasDoAcordo(this.rentalId!))[n - 1];
  expect(parcela, `parcela ${n} do acordo`).toBeTruthy();
  await abrirRecebimento(this, parcela);
  await expect(this.page.locator('#acordo-info'), 'o quadro do acordo não apareceu').toBeVisible({ timeout: 15000 });
});

When('desfaço o acordo', { timeout: 60 * 1000 }, async function (this: CustomWorld) {
  await this.page.locator('#acordo-desfazer').click();
  await this.page.locator('#acordo-desfazer-confirmar').click();
  await expect
    .poll(async () => (await parcelasDoAcordo(this.rentalId!)).length, { timeout: 20000 })
    .toBe(0);
});

Then('o acordo não deve ter mais parcelas no banco', async function (this: CustomWorld) {
  expect((await parcelasDoAcordo(this.rentalId!)).length).toBe(0);
  const [acordo] = await DatabaseHelper.getAgreementsByRental(this.rentalId!);
  expect(acordo.status, 'status do acordo').toBe('undone');
});

Then('os recebimentos originais devem voltar como estavam', async function (this: CustomWorld) {
  for (const original of this.testData.acordo.originais) {
    const atual = await DatabaseHelper.getPaymentById(original.id);
    expect(atual.status, `status do recebimento de ${dataBR(original.due_date)}`).toBe(original.status);
    expect(Number(atual.late_fee || 0), 'multa').toBeCloseTo(Number(original.late_fee || 0), 2);
    expect(Number(atual.interest || 0), 'juros').toBeCloseTo(Number(original.interest || 0), 2);
    expect(Number(atual.expected_amount), 'valor').toBeCloseTo(Number(original.expected_amount), 2);
    expect(atual.renegotiated_in_agreement_id, 'ligação com o acordo').toBeNull();
  }
});

Then('a aba "Renegociados" de Recebimentos deve mostrar os recebimentos originais', { timeout: 60 * 1000 }, async function (this: CustomWorld) {
  const primeiro = this.testData.acordo.originais[0];
  await this.page.goto('/payments');
  await this.page.waitForLoadState('domcontentloaded');
  const { selecionarPeriodo, esperarListaDeRecebimentos } = await import('./termination.steps');
  await esperarListaDeRecebimentos(this.page);
  const [ano, mes] = primeiro.due_date.split('-');
  await selecionarPeriodo(this.page, mes, ano);
  await esperarListaDeRecebimentos(this.page);
  await this.page.locator('#payments-search-input').fill(this.tenantName!);
  await this.page.waitForTimeout(1200);
  const aba = this.page.locator('#payments-tab-renegotiated');
  await aba.click();
  await expect(aba).toHaveAttribute('data-state', 'active', { timeout: 10000 });
  const doMes = this.testData.acordo.originais.filter((p: any) => p.due_date.slice(0, 7) === primeiro.due_date.slice(0, 7));
  const linhas = this.page.locator('tbody tr:visible').filter({ hasText: this.tenantName! });
  await expect(linhas).toHaveCount(doMes.length, { timeout: 15000 });
  await expect(linhas.first()).toContainText('Renegociado');
});

Then(
  'no Financeiro do mês do recebimento original ele aparece "Renegociado" com valor esperado {string}',
  { timeout: 90 * 1000 },
  async function (this: CustomWorld, valor: string) {
    const original = this.testData.acordo.originais[0];
    const { locationId, locationName } = this.testData.acordo;
    await abrirFinanceiroFiltrado(this, periodoDe(original.due_date), { locationId, locationName });
    const linha = this.page.locator('tbody tr').filter({ hasText: this.tenantName! }).filter({ hasText: 'Renegociado' }).first();
    await expect(linha, 'a linha do recebimento renegociado não está no Financeiro').toBeVisible({ timeout: 15000 });
    await expect(linha).toContainText(valor);
  }
);

Then(
  'no Financeiro do mês da parcela {int} ela aparece com valor esperado {string}',
  { timeout: 90 * 1000 },
  async function (this: CustomWorld, n: number, valor: string) {
    const parcela = (await parcelasDoAcordo(this.rentalId!))[n - 1];
    const { locationId, locationName } = this.testData.acordo;
    await abrirFinanceiroFiltrado(this, periodoDe(parcela.due_date), { locationId, locationName });
    const linha = this.page
      .locator('tbody tr')
      .filter({ hasText: this.tenantName! })
      .filter({ hasText: `Acordo ${parcela.installment}/${parcela.total_installments}` })
      .first();
    await expect(linha, `a parcela ${n} do acordo não está no Financeiro`).toBeVisible({ timeout: 15000 });
    await expect(linha).toContainText(valor);
  }
);

// ---------------------------------------------------------------------------
// Campo "Valor de Desconto" do Recebimento de Rescisão (revisto na #119)
// ---------------------------------------------------------------------------

Given('um Recebimento de Rescisão com total negativo', { timeout: 60 * 1000 }, async function (this: CustomWorld) {
  await montarLocacao(this);
  const vencimento = resolverData('hoje+10');
  const pagamento = await this.createTerminationPayment({
    rental_id: this.rentalId!,
    due_date: vencimento,
    reference_month: vencimento.slice(5, 7),
    reference_year: vencimento.slice(0, 4),
    termination_corrected_deposit: -1000,
    breakdown: [{ description: 'Caução Corrigido p/ Devolução', amount: -1000, type: 'deduction' }],
  });
  this.testData.acordo.originais.push(pagamento);
});

When('abro esse Recebimento de Rescisão', { timeout: 60 * 1000 }, async function (this: CustomWorld) {
  await abrirRecebimento(this, this.testData.acordo.originais[0]);
});

Then('o campo "Valor de Desconto" e o botão "Salvar" da Formação de Valores devem estar na tela', async function (this: CustomWorld) {
  await expect(this.page.locator('#breakdown-discount-termination'), 'campo "Valor de Desconto"').toBeVisible({ timeout: 10000 });
  await expect(this.page.locator('#breakdown-save-expenses'), 'botão "Salvar" da Formação de Valores').toBeVisible();
});
