import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import DatabaseHelper from '../helpers/database.helper';

/**
 * Steps da rescisão de contrato (issue #49).
 *
 * COMO ESTES CENÁRIOS FUNCIONAM
 *
 * O setup vai direto no banco pelo DatabaseHelper. Montar locação, caução e
 * histórico de pagamentos pela tela levaria minutos por cenário e testaria
 * cadastro, que não é o assunto aqui.
 *
 * A rescisão em si é SEMPRE feita pela tela. Todos os defeitos graves desta
 * issue apareceram no caminho real até o banco — 409 de constraint única,
 * PGRST116 de "multiple rows returned", trigger de status sobrescrevendo
 * 'pending' — e nenhum deles apareceria chamando processContractTermination()
 * direto.
 *
 * As verificações leem o BANCO, não a tela. O que importa é o que ficou
 * gravado: a tela já mostrou valor diferente do gravado mais de uma vez nesta
 * issue, e um teste que só olha a tela teria passado nas duas vezes.
 */

// ============================================================================
// Utilidades
// ============================================================================

/** "27/08/2026" -> "2026-08-27" */
function paraISO(dataBR: string): string {
  const [dia, mes, ano] = dataBR.split('/');
  return `${ano}-${mes}-${dia}`;
}

/** "3000,00" -> 3000 */
function paraNumero(valor: string): number {
  return Number(String(valor).replace(/\./g, '').replace(',', '.'));
}

function somaBreakdown(breakdown: any): any[] {
  if (typeof breakdown === 'string') {
    try { return JSON.parse(breakdown); } catch { return []; }
  }
  return Array.isArray(breakdown) ? breakdown : [];
}

/** Recebimentos do mês/ano da rescisão guardada no cenário. */
async function recebimentosDoMes(world: CustomWorld) {
  const todos = await DatabaseHelper.getPaymentsByRental(world.rentalId!);
  const { mes, ano } = world.testData.periodoRescisao;
  return todos.filter(
    (p: any) => p.reference_month === mes && p.reference_year === ano
  );
}

/** O único recebimento de um tipo no mês. Falha se houver mais de um. */
async function recebimentoUnicoDoTipo(world: CustomWorld, tipo: string) {
  const doMes = await recebimentosDoMes(world);
  const daVez = doMes.filter((p: any) => (p.payment_kind || 'rent') === tipo);
  expect(
    daVez.length,
    `esperava 1 recebimento "${tipo}" no mês, encontrei ${daVez.length}`
  ).toBe(1);
  return daVez[0];
}

// ============================================================================
// SETUP
// ============================================================================

Given('uma locação para rescisão com:', async function (this: CustomWorld, tabela: any) {
  const dados = tabela.rowsHash();

  const aluguel = paraNumero(dados['aluguel'] || '3000,00');
  const garagem = dados['garagem'] ? paraNumero(dados['garagem']) : 0;
  const caucao = dados['caução'] ? paraNumero(dados['caução']) : aluguel;
  const parcelasCaucao = dados['parcelas_caução'] ? Number(dados['parcelas_caução']) : 1;

  // Nome único: os cenários rodam 2 em paralelo e cada um precisa achar a
  // SUA locação na busca da tela, sem esbarrar na do vizinho.
  const nomeInquilino = `Rescisao E2E ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const inquilino = await this.createTenant({ name: nomeInquilino });

  const locacao = await this.createRental({
    tenant_id: inquilino.id,
    start_date: paraISO(dados['data_início'] || '01/10/2025'),
    end_date: paraISO(dados['data_fim'] || '31/12/2026'),
    rent_due_day: Number(dados['dia_vencimento'] || 5),
    rent_value: aluguel,
    has_garage: garagem > 0,
    garage_value: garagem > 0 ? garagem : undefined,
    security_deposit: caucao,
    deposit_installments: parcelasCaucao,
  });

  this.rentalId = locacao.id;
  this.tenantId = inquilino.id;
  this.tenantName = nomeInquilino;
  this.testData.aluguel = aluguel;
  this.testData.garagem = garagem;
  this.testData.caucao = caucao;
  this.testData.parcelasCaucao = parcelasCaucao;
  this.testData.diaVencimento = Number(dados['dia_vencimento'] || 5);
});

Given('o recebimento do mês da rescisão está {string}', async function (
  this: CustomWorld,
  situacao: string
) {
  // O mês só é conhecido no "Quando"; guardamos a intenção e aplicamos lá.
  this.testData.situacaoRecebimentoDoMes = situacao;
});

Given('o inquilino pagou {int} das {int} parcelas de caução', async function (
  this: CustomWorld,
  pagas: number,
  _total: number
) {
  const parcelas = await this.getDepositInstallments(this.rentalId!);

  for (let i = 0; i < pagas && i < parcelas.length; i++) {
    await this.updateDepositInstallment(parcelas[i].id, {
      status: 'paid',
      paid_amount: parcelas[i].amount,
      payment_date: '2026-01-15',
    });
  }

  this.testData.caucaoPago = parcelas
    .slice(0, pagas)
    .reduce((soma: number, p: any) => soma + Number(p.amount || 0), 0);
});

Given('o inquilino não pagou nenhuma parcela de caução', async function (this: CustomWorld) {
  this.testData.caucaoPago = 0;
});

/**
 * Recebimentos mensais em aberto de `mês/ano da rescisão` até dezembro.
 *
 * Sem isto o cenário das parcelas futuras passava de graça: o DatabaseHelper
 * cria a locação e as parcelas de caução, mas nenhum recebimento de aluguel —
 * não havia futuro nenhum para a rescisão apagar.
 */
Given('existem recebimentos em aberto até {string}', async function (
  this: CustomWorld,
  ateMesAno: string
) {
  const [mesTexto, anoTexto] = ateMesAno.split('/');
  const mesFinal = Number(mesTexto);
  const anoFinal = Number(anoTexto);
  const dia = String(this.testData.diaVencimento).padStart(2, '0');

  for (let mes = 1; mes <= mesFinal; mes++) {
    const mm = String(mes).padStart(2, '0');
    await this.upsertPayment({
      rental_id: this.rentalId!,
      reference_month: mm,
      reference_year: String(anoFinal),
      due_date: `${anoFinal}-${mm}-${dia}`,
      expected_amount: this.testData.aluguel + this.testData.garagem,
      status: 'pending',
      paid_amount: 0,
    });
  }
});

// ============================================================================
// AÇÃO — sempre pela tela
// ============================================================================

async function rescindirPelaTela(world: CustomWorld, dataSaidaBR: string) {
  const page = world.page;

  await page.goto('/rentals');
  await page.waitForLoadState('domcontentloaded');

  // Achar A locação do cenário pelo nome do inquilino (único por execução).
  const busca = page.locator('input[placeholder*="Buscar"]').first();
  await busca.fill(world.tenantName!);
  await page.waitForTimeout(800);

  await page.locator('[title="Rescisão de Contrato"]').first().click();
  await expect(page.locator('#termination-date')).toBeVisible({ timeout: 10000 });

  await page.locator('#termination-date').fill(paraISO(dataSaidaBR));

  // Multa proporcional ao tempo restante — a opção padrão do contrato.
  const multa = page.locator('#termination-apply-full-penalty');
  if (await multa.isVisible().catch(() => false)) {
    await multa.check().catch(() => {});
  }

  await page.locator('#termination-confirm').click();

  // A rescisão faz várias escritas em sequência; esperamos o diálogo fechar.
  await expect(page.locator('#termination-date')).toBeHidden({ timeout: 30000 });
  await page.waitForTimeout(1500);
}

When('eu rescindir o contrato em {string}', async function (
  this: CustomWorld,
  dataSaidaBR: string
) {
  const iso = paraISO(dataSaidaBR);
  const [ano, mes] = iso.split('-');
  this.testData.periodoRescisao = { mes, ano };
  this.testData.dataRescisao = iso;

  // O recebimento do mês, na situação que o cenário pediu, precisa existir
  // ANTES da rescisão — é ele que decide se o mês cheio entra ou não.
  const situacao = this.testData.situacaoRecebimentoDoMes;
  if (situacao) {
    const pago = situacao === 'pago';
    await this.upsertPayment({
      rental_id: this.rentalId!,
      reference_month: mes,
      reference_year: ano,
      due_date: `${ano}-${mes}-${String(this.testData.diaVencimento).padStart(2, '0')}`,
      expected_amount: this.testData.aluguel + this.testData.garagem,
      status: pago ? 'paid' : 'pending',
      paid_amount: pago ? this.testData.aluguel + this.testData.garagem : 0,
      payment_date: pago ? `${ano}-${mes}-06` : undefined,
    });
  }

  await rescindirPelaTela(this, dataSaidaBR);
});

When('eu rescindir o contrato novamente em {string}', async function (
  this: CustomWorld,
  dataSaidaBR: string
) {
  await rescindirPelaTela(this, dataSaidaBR);
});

// ============================================================================
// VERIFICAÇÕES — sempre no banco
// ============================================================================

Then('devem existir {int} recebimentos no mês da rescisão', async function (
  this: CustomWorld,
  quantidade: number
) {
  const doMes = await recebimentosDoMes(this);
  const resumo = doMes
    .map((p: any) => `${p.payment_kind}/${p.status}/${p.expected_amount}`)
    .join(', ');
  expect(doMes.length, `recebimentos no mês: [${resumo}]`).toBe(quantidade);
});

Then('deve existir {int} recebimento do tipo {string} no mês da rescisão', async function (
  this: CustomWorld,
  quantidade: number,
  tipo: string
) {
  const doMes = await recebimentosDoMes(this);
  const daVez = doMes.filter((p: any) => (p.payment_kind || 'rent') === tipo);
  expect(daVez.length).toBe(quantidade);
});

Then('os dois recebimentos devem estar no mesmo grupo de rescisão', async function (
  this: CustomWorld
) {
  const doMes = await recebimentosDoMes(this);
  const grupos = new Set(doMes.map((p: any) => p.termination_group_id));

  expect(grupos.size, 'os dois deveriam compartilhar um termination_group_id').toBe(1);
  expect([...grupos][0]).toBeTruthy();
});

Then('o recebimento {string} deve ser a parcela {int} de {int}', async function (
  this: CustomWorld,
  tipo: string,
  parcela: number,
  total: number
) {
  const recebimento = await recebimentoUnicoDoTipo(this, tipo);
  expect(recebimento.installment).toBe(parcela);
  expect(recebimento.total_installments).toBe(total);
});

Then('o recebimento {string} deve cobrar {int} dias extras', async function (
  this: CustomWorld,
  tipo: string,
  dias: number
) {
  const recebimento = await recebimentoUnicoDoTipo(this, tipo);
  const linhas = somaBreakdown(recebimento.breakdown);
  const comNota = linhas.find((l: any) => l.nota);

  expect(comNota, 'nenhuma linha do breakdown tem a nota do período').toBeTruthy();
  expect(
    comNota.nota,
    `nota encontrada: "${comNota.nota}"`
  ).toContain(`${dias} Dias Extras`);
});

Then('o recebimento {string} deve conter a linha {string}', async function (
  this: CustomWorld,
  tipo: string,
  descricao: string
) {
  const recebimento = await recebimentoUnicoDoTipo(this, tipo);
  const linhas = somaBreakdown(recebimento.breakdown);
  const descricoes = linhas.map((l: any) => l.description);

  expect(descricoes.some((d: string) => d?.includes(descricao)),
    `linhas: [${descricoes.join(' | ')}]`).toBe(true);
});

Then('o recebimento {string} NÃO deve conter a linha {string}', async function (
  this: CustomWorld,
  tipo: string,
  descricao: string
) {
  const recebimento = await recebimentoUnicoDoTipo(this, tipo);
  const linhas = somaBreakdown(recebimento.breakdown);
  const descricoes = linhas.map((l: any) => l.description);

  expect(descricoes.some((d: string) => d?.includes(descricao)),
    `linhas: [${descricoes.join(' | ')}]`).toBe(false);
});

Then('o recebimento {string} pendente NÃO deve conter a linha {string}', async function (
  this: CustomWorld,
  tipo: string,
  descricao: string
) {
  const doMes = await recebimentosDoMes(this);
  const pendente = doMes.find(
    (p: any) => (p.payment_kind || 'rent') === tipo && p.status !== 'paid'
  );

  expect(pendente, `nenhum recebimento "${tipo}" pendente no mês`).toBeTruthy();

  const descricoes = somaBreakdown(pendente.breakdown).map((l: any) => l.description);
  expect(descricoes.some((d: string) => d?.includes(descricao)),
    `linhas: [${descricoes.join(' | ')}]`).toBe(false);
});

Then('o recebimento pago do mês deve continuar intacto', async function (this: CustomWorld) {
  const doMes = await recebimentosDoMes(this);
  const pago = doMes.find((p: any) => p.status === 'paid');
  const esperado = this.testData.aluguel + this.testData.garagem;

  expect(pago, 'o recebimento pago do mês sumiu').toBeTruthy();
  expect(Number(pago.expected_amount)).toBeCloseTo(esperado, 2);
  expect(Number(pago.paid_amount)).toBeCloseTo(esperado, 2);
});

Then('a devolução do caução deve ser calculada sobre {string}', async function (
  this: CustomWorld,
  baseTexto: string
) {
  const base = paraNumero(baseTexto);
  const rescisao = await recebimentoUnicoDoTipo(this, 'termination');
  const devolvido = Math.abs(Number(rescisao.termination_corrected_deposit || 0));

  // Corrigido pela poupança: nunca é menor que a base, e não explode.
  expect(devolvido, `devolução gravada: ${devolvido}`).toBeGreaterThanOrEqual(base);
  expect(devolvido).toBeLessThan(base * 2);
});

Then('a devolução do caução deve estar gravada com sinal negativo', async function (
  this: CustomWorld
) {
  const rescisao = await recebimentoUnicoDoTipo(this, 'termination');
  expect(Number(rescisao.termination_corrected_deposit)).toBeLessThan(0);
});

Then('a devolução do caução deve ser {string}', async function (
  this: CustomWorld,
  valorTexto: string
) {
  const valor = paraNumero(valorTexto);
  const rescisao = await recebimentoUnicoDoTipo(this, 'termination');
  expect(Number(rescisao.termination_corrected_deposit || 0)).toBeCloseTo(valor, 2);
});

Then('o recebimento {string} deve estar com status {string}', async function (
  this: CustomWorld,
  tipo: string,
  status: string
) {
  const recebimento = await recebimentoUnicoDoTipo(this, tipo);
  expect(recebimento.status).toBe(status);
});

Then('não deve sobrar nenhum recebimento com vencimento depois de {string}', async function (
  this: CustomWorld,
  dataBR: string
) {
  const limite = paraISO(dataBR);
  const todos = await DatabaseHelper.getPaymentsByRental(this.rentalId!);
  const depois = todos.filter((p: any) => p.due_date > limite);

  expect(
    depois.length,
    `sobraram: [${depois.map((p: any) => p.due_date).join(', ')}]`
  ).toBe(0);
});
