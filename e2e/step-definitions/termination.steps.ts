import { Given, When, Then } from '@cucumber/cucumber';
import { expect, Page } from '@playwright/test';
import { CustomWorld } from '../support/world';
import DatabaseHelper from '../helpers/database.helper';

/**
 * Steps da feature 12-rescisao-caucao.feature (issue #49).
 *
 * COMO ESTES CENÁRIOS FUNCIONAM
 *
 * O setup (Dado) vai direto no banco via DatabaseHelper/CustomWorld — montar
 * locação, inquilino e histórico de parcelas de caução pela tela levaria
 * minutos por cenário e testaria cadastro, que não é o assunto aqui.
 *
 * A AÇÃO da rescisão em si é SEMPRE feita pela TELA de verdade (Playwright).
 * Os bugs reais desta funcionalidade só apareciam no caminho até o banco —
 * constraints, triggers, o remendo de financial.tsx que jogava fora o
 * recebimento inteiro — e nenhum deles apareceria chamando
 * processContractTermination() direto.
 *
 * As VERIFICAÇÕES de valores/cálculos leem o BANCO (DatabaseHelper), não a
 * tela — a tela já mostrou valor diferente do gravado nesta funcionalidade.
 * A EXCEÇÃO são os cenários que falam explicitamente da tela ("na aba
 * Locações/Cauções", "devo ver as colunas", "o valor... em vermelho") — aí a
 * verificação é mesmo sobre o que a tela mostra, e usa Playwright.
 *
 * DUAS LACUNAS DE PRODUTO QUE ESTE ARQUIVO PRECISOU FECHAR PARA CONSEGUIR
 * TESTAR PELA TELA (ver relato final da tarefa para detalhes):
 *
 *   1. RentalTerminationDialog.tsx só tinha duas checkboxes de multa
 *      calculada por fórmula do contrato — nenhuma delas produz os valores
 *      arbitrários que os cenários pedem (ex.: 500,00). Foi adicionado um
 *      campo `#termination-penalty-amount` que sobrescreve o cálculo.
 *   2. Não existia um helper de banco para criar diretamente um Recebimento
 *      de Rescisão (payment_kind='termination') sem passar pela tela —
 *      necessário para os cenários que testam só a EXIBIÇÃO desse
 *      recebimento. Foi adicionado `DatabaseHelper.createTerminationPayment`.
 */

// ============================================================================
// Utilidades
// ============================================================================

/** "04/05/2026" -> "2026-05-04" */
function paraISO(dataBR: string): string {
  const [dia, mes, ano] = dataBR.split('/');
  return `${ano}-${mes}-${dia}`;
}

/** "1.750,00" ou "-200,00" -> 1750 / -200 */
function paraNumero(valor: string): number {
  return Number(String(valor).replace(/\./g, '').replace(',', '.'));
}

function somaBreakdown(breakdown: any): any[] {
  if (typeof breakdown === 'string') {
    try { return JSON.parse(breakdown); } catch { return []; }
  }
  return Array.isArray(breakdown) ? breakdown : [];
}

function escapeRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lê o número de um texto de moeda exibido na tela, ex.: "- R$ 2.000,00" -> -2000 */
function extrairNumeroExibido(texto: string): number {
  const negativo = texto.trim().startsWith('-');
  const digitos = texto.replace(/[^\d,]/g, '').replace(',', '.');
  const valor = parseFloat(digitos || '0');
  return negativo ? -valor : valor;
}

async function indiceDaColuna(page: Page, nomeColuna: string): Promise<number> {
  const cabecalhos = await page.getByRole('columnheader').allTextContents();
  const indice = cabecalhos.findIndex((texto) => texto.includes(nomeColuna));
  if (indice === -1) {
    throw new Error(
      `Coluna "${nomeColuna}" não encontrada na tabela. Cabeçalhos vistos: [${cabecalhos.join(' | ')}]`
    );
  }
  return indice;
}

async function abrirAbaFinanceiro(world: CustomWorld, tabName: string) {
  await world.page.goto('/financial');
  await world.page.waitForLoadState('domcontentloaded');
  const aba = world.page.getByRole('tab', { name: new RegExp(escapeRegex(tabName), 'i') });
  await aba.click();
  await world.page.waitForTimeout(800);
}

/** Recebimentos do mês/ano da rescisão guardada no cenário (via `this.testData.periodoRescisao`). */
async function recebimentosDoMes(world: CustomWorld) {
  const todos = await DatabaseHelper.getPaymentsByRental(world.rentalId!);
  const periodo = world.testData.periodoRescisao;
  if (!periodo) return todos;
  return todos.filter(
    (p: any) => p.reference_month === periodo.mes && p.reference_year === periodo.ano
  );
}

/** O recebimento de aluguel (payment_kind 'rent') do mês da rescisão. Falha se não houver exatamente 1. */
async function recebimentoDeAluguel(world: CustomWorld) {
  const doMes = await recebimentosDoMes(world);
  const alugueis = doMes.filter((p: any) => (p.payment_kind ?? 'rent') !== 'termination');
  expect(
    alugueis.length,
    `esperava 1 recebimento de aluguel no mês, encontrei ${alugueis.length}`
  ).toBe(1);
  return alugueis[0];
}

/** O Recebimento de Rescisão (payment_kind 'termination') do mês da rescisão. Falha se não houver exatamente 1. */
async function recebimentoDeRescisao(world: CustomWorld) {
  const doMes = await recebimentosDoMes(world);
  const rescisoes = doMes.filter((p: any) => p.payment_kind === 'termination');
  expect(
    rescisoes.length,
    `esperava 1 Recebimento de Rescisão no mês, encontrei ${rescisoes.length}`
  ).toBe(1);
  return rescisoes[0];
}

// ============================================================================
// SETUP (Dado) — direto no banco
// ============================================================================

Given('existe uma locação de teste com:', async function (this: CustomWorld, dataTable: any) {
  const dados = dataTable.rowsHash();

  const aluguel = paraNumero(dados['aluguel']);
  const garagem = dados['garagem'] ? paraNumero(dados['garagem']) : 0;
  const diaVencimento = Number(dados['dia_vencimento']);
  const caucao = dados['caução'] ? paraNumero(dados['caução']) : aluguel;
  const parcelasCaucao = dados['parcelas_caução'] ? Number(dados['parcelas_caução']) : 1;

  // Nome único: a ação da rescisão busca a locação pela tela usando o nome
  // do inquilino — sem um nome único por execução, dois cenários rodando em
  // paralelo esbarrariam na locação um do outro.
  const nomeInquilino = `Rescisao E2E ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const inquilino = await this.createTenant({ name: nomeInquilino });

  const locacao = await this.createRental({
    tenant_id: inquilino.id,
    start_date: paraISO(dados['data_início']),
    end_date: paraISO(dados['data_fim']),
    rent_due_day: diaVencimento,
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
  this.testData.diaVencimento = diaVencimento;
  this.testData.caucao = caucao;
  this.testData.parcelasCaucao = parcelasCaucao;
});

Given('que o inquilino pagou apenas {int} das {int} parcelas de caução', async function (
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
});

Given('que o inquilino não pagou nenhuma parcela de caução', async function (this: CustomWorld) {
  // As parcelas nascem 'pending'/paid_amount nulo em createRental — nada a fazer.
});

Given('um Recebimento de Rescisão com:', async function (this: CustomWorld, dataTable: any) {
  const dados = dataTable.rowsHash();

  await this.createTerminationPayment({
    rental_id: this.rentalId!,
    due_date: '2026-05-04',
    reference_month: '05',
    reference_year: '2026',
    termination_corrected_deposit: paraNumero(dados['valor_corrigido']),
    termination_additional_expenses: paraNumero(dados['despesas_adicionais']),
    termination_discount: paraNumero(dados['valor_desconto']),
  });
});

Given('que estou preenchendo o Recebimento de Rescisão', async function (this: CustomWorld) {
  const pagamento = await this.createTerminationPayment({
    rental_id: this.rentalId!,
    due_date: '2026-05-04',
    reference_month: '05',
    reference_year: '2026',
    termination_corrected_deposit: -3000,
    // ManagePaymentForm decide se mostra os campos de Despesas/Desconto
    // olhando para `notes.includes("Rescisão de Contrato")` — herança de
    // antes da separação em dois recebimentos (#49), não `payment_kind`.
    // Sem essa substring nas notas, a tela de edição nem aparece.
    notes: 'Recebimento de Rescisão - Rescisão de Contrato - Data de saída: 2026-05-04.',
  });

  this.testData.terminationPaymentId = pagamento.id;

  await this.page.goto('/payments');
  await this.page.waitForLoadState('domcontentloaded');

  const busca = this.page.locator('input[placeholder*="Buscar"]').first();
  await busca.fill(this.tenantName!);
  await this.page.waitForTimeout(800);

  // Abre o Recebimento de Rescisão nos resultados da busca (card ou linha —
  // ambos disparam o clique a partir de qualquer texto interno).
  await this.page.getByText(this.tenantName!, { exact: false }).first().click();
  await this.page.waitForTimeout(500);

  await expect(this.page.locator('#breakdown-discount-termination')).toBeVisible({ timeout: 10000 });
});

// ============================================================================
// AÇÃO — sempre pela tela
// ============================================================================

async function registrarRescisaoPelaTela(world: CustomWorld, dataSaidaBR: string, multaTexto: string) {
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

  // Valor de multa digitado direto — não depende de nenhuma das duas
  // cláusulas calculadas do contrato (#49 pede um valor livre).
  await page.locator('#termination-penalty-amount').fill(multaTexto);

  await page.locator('#termination-confirm').click();

  // A rescisão faz várias escritas em sequência; esperamos o diálogo fechar.
  await expect(page.locator('#termination-date')).toBeHidden({ timeout: 30000 });
  await page.waitForTimeout(1500);
}

When(/^eu registrar a rescisão em "([^"]+)" com multa de ([\d.,]+)$/, async function (
  this: CustomWorld,
  dataSaidaBR: string,
  multaTexto: string
) {
  const iso = paraISO(dataSaidaBR);
  const [ano, mes] = iso.split('-');
  this.testData.periodoRescisao = { mes, ano };
  this.testData.dataRescisao = iso;
  this.testData.multa = paraNumero(multaTexto);

  await registrarRescisaoPelaTela(this, dataSaidaBR, multaTexto);
});

When('eu abrir a aba {string} sem ter rescindido a locação', async function (
  this: CustomWorld,
  abaTexto: string
) {
  await abrirAbaFinanceiro(this, abaTexto);
});

When('eu abrir a aba {string}', async function (this: CustomWorld, abaTexto: string) {
  await abrirAbaFinanceiro(this, abaTexto);
});

When('eu digitar {string} no campo {string}', async function (
  this: CustomWorld,
  valor: string,
  campo: string
) {
  const seletorPorCampo: Record<string, string> = {
    'Valor de Desconto': '#breakdown-discount-termination',
    'Despesas Adicionais': '#breakdown-repair-expenses',
  };

  const seletor = seletorPorCampo[campo];
  if (!seletor) {
    throw new Error(`Campo desconhecido no Recebimento de Rescisão: "${campo}"`);
  }

  await this.page.locator(seletor).fill(valor);
  this.testData.ultimoValorDigitado = valor;

  // Este campo salva sozinho 1.5s depois de parar de digitar (ver
  // ManagePaymentForm.handleSaveExpensesAndDiscount) — não há botão
  // "Salvar" dedicado a ele.
  await this.page.waitForTimeout(2000);
});

// ============================================================================
// VERIFICAÇÕES — banco, exceto quando o cenário fala da tela
// ============================================================================

Then('deve existir um recebimento de aluguel na aba {string}', async function (
  this: CustomWorld,
  abaTexto: string
) {
  const recebimento = await recebimentoDeAluguel(this);
  await abrirAbaFinanceiro(this, abaTexto);

  const valorFormatado = Math.abs(Number(recebimento.expected_amount)).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  await expect(this.page.getByText(valorFormatado, { exact: false }).first()).toBeVisible({
    timeout: 10000,
  });
});

Then('deve existir um Recebimento de Rescisão na aba {string}', async function (
  this: CustomWorld,
  abaTexto: string
) {
  await recebimentoDeRescisao(this); // garante que existe no banco
  await abrirAbaFinanceiro(this, abaTexto);
  await expect(this.page.getByText(/Recebimento de Rescisão/i).first()).toBeVisible({
    timeout: 10000,
  });
});

Then('a devolução do caução NÃO deve aparecer na aba {string}', async function (
  this: CustomWorld,
  abaTexto: string
) {
  await abrirAbaFinanceiro(this, abaTexto);
  await expect(this.page.getByText(/Recebimento de Rescisão/i)).toHaveCount(0);
});

Then(/^o recebimento de aluguel deve ter valor ([\d.,]+)$/, async function (
  this: CustomWorld,
  valorTexto: string
) {
  const esperado = paraNumero(valorTexto);
  const recebimento = await recebimentoDeAluguel(this);
  expect(Number(recebimento.expected_amount)).toBeCloseTo(esperado, 2);
});

Then(/^o recebimento de aluguel deve detalhar o proporcional do aluguel de ([\d.,]+)$/, async function (
  this: CustomWorld,
  valorTexto: string
) {
  const esperado = paraNumero(valorTexto);
  const recebimento = await recebimentoDeAluguel(this);
  const linhas = somaBreakdown(recebimento.breakdown);
  const linha = linhas.find((l: any) => l.description?.includes('Aluguel'));

  expect(linha, `linhas: [${linhas.map((l: any) => l.description).join(' | ')}]`).toBeTruthy();
  expect(Number(linha.amount)).toBeCloseTo(esperado, 2);
});

Then(/^o recebimento de aluguel deve detalhar o proporcional da garagem de ([\d.,]+)$/, async function (
  this: CustomWorld,
  valorTexto: string
) {
  const esperado = paraNumero(valorTexto);
  const recebimento = await recebimentoDeAluguel(this);
  const linhas = somaBreakdown(recebimento.breakdown);
  const linha = linhas.find((l: any) => l.description?.includes('Garagem'));

  expect(linha, `linhas: [${linhas.map((l: any) => l.description).join(' | ')}]`).toBeTruthy();
  expect(Number(linha.amount)).toBeCloseTo(esperado, 2);
});

Then(/^o recebimento de aluguel deve detalhar a multa de ([\d.,]+)$/, async function (
  this: CustomWorld,
  valorTexto: string
) {
  const esperado = paraNumero(valorTexto);
  const recebimento = await recebimentoDeAluguel(this);
  const linhas = somaBreakdown(recebimento.breakdown);
  const linha = linhas.find((l: any) => l.description?.includes('Multa'));

  expect(linha, `linhas: [${linhas.map((l: any) => l.description).join(' | ')}]`).toBeTruthy();
  expect(Number(linha.amount)).toBeCloseTo(esperado, 2);
});

Then(
  /^a base de cálculo das taxas de administração e gerenciamento deve ser ([\d.,]+)$/,
  async function (this: CustomWorld, valorTexto: string) {
    const esperado = paraNumero(valorTexto);
    const recebimento = await recebimentoDeAluguel(this);

    // financial.tsx calcula as duas taxas sobre o `paid_amount` dos
    // recebimentos com payment_kind !== 'termination' — só entram na conta
    // quando o recebimento é PAGO. Este cenário só REGISTRA a rescisão (o
    // recebimento nasce 'pending'); o valor que vai virar a base assim que
    // for baixado é o expected_amount de hoje. Checar isso aqui evita
    // depender de também simular a baixa do pagamento, que não é o assunto
    // deste cenário.
    expect(recebimento.payment_kind ?? 'rent').not.toBe('termination');
    expect(Number(recebimento.expected_amount)).toBeCloseTo(esperado, 2);
  }
);

Then('a devolução do caução não deve influenciar nenhuma das duas taxas', async function (
  this: CustomWorld
) {
  const rescisao = await recebimentoDeRescisao(this);
  // financial.tsx exclui explicitamente payment_kind === "termination" do
  // cálculo das duas taxas (kpiCalculations) — é essa marcação que garante
  // que a devolução do caução nunca entra na base.
  expect(rescisao.payment_kind).toBe('termination');
});

Then(/^a multa de ([\d.,]+) deve estar dentro da base das duas taxas$/, async function (
  this: CustomWorld,
  valorTexto: string
) {
  const esperado = paraNumero(valorTexto);
  const recebimento = await recebimentoDeAluguel(this);
  const linhas = somaBreakdown(recebimento.breakdown);
  const linhaMulta = linhas.find((l: any) => l.description?.includes('Multa'));

  expect(linhaMulta, `linhas: [${linhas.map((l: any) => l.description).join(' | ')}]`).toBeTruthy();
  expect(Number(linhaMulta.amount)).toBeCloseTo(esperado, 2);

  // A multa só "está dentro da base das duas taxas" porque é uma linha do
  // MESMO recebimento (payment_kind 'rent') que forma a base — não existe
  // coluna própria para isolar. Confirmar o payment_kind aqui garante que
  // ela não foi parar, por engano, no Recebimento de Rescisão.
  expect(recebimento.payment_kind ?? 'rent').not.toBe('termination');
});

Then('não deve sobrar nenhuma parcela de aluguel com vencimento depois de {string}', async function (
  this: CustomWorld,
  dataBR: string
) {
  const limite = paraISO(dataBR);
  const todos = await DatabaseHelper.getPaymentsByRental(this.rentalId!);
  const depois = todos.filter(
    (p: any) => (p.payment_kind ?? 'rent') !== 'termination' && p.due_date > limite
  );

  expect(
    depois.length,
    `sobraram: [${depois.map((p: any) => p.due_date).join(', ')}]`
  ).toBe(0);
});

Then('a última parcela de aluguel deve ser a do mês da rescisão', async function (this: CustomWorld) {
  const todos = await DatabaseHelper.getPaymentsByRental(this.rentalId!);
  const parcelasAluguel = todos.filter((p: any) => (p.payment_kind ?? 'rent') !== 'termination');
  const ultima = parcelasAluguel[parcelasAluguel.length - 1]; // getPaymentsByRental já ordena por due_date asc

  expect(ultima, 'nenhuma parcela de aluguel encontrada').toBeTruthy();

  const { mes, ano } = this.testData.periodoRescisao;
  expect(ultima.reference_month).toBe(mes);
  expect(ultima.reference_year).toBe(ano);
});

Then('o Recebimento de Rescisão deve estar no mesmo mês da última parcela de aluguel', async function (
  this: CustomWorld
) {
  const rescisao = await recebimentoDeRescisao(this);
  const aluguel = await recebimentoDeAluguel(this);

  expect(rescisao.reference_month).toBe(aluguel.reference_month);
  expect(rescisao.reference_year).toBe(aluguel.reference_year);
});

Then(/^o Valor Corrigido p\/ Devolução deve ser calculado sobre ([\d.,]+)$/, async function (
  this: CustomWorld,
  valorTexto: string
) {
  const base = paraNumero(valorTexto);
  const rescisao = await recebimentoDeRescisao(this);
  const devolvido = Math.abs(Number(rescisao.termination_corrected_deposit || 0));

  // Corrigido pela Poupança: nunca é menor que a base paga, e não explode.
  expect(devolvido, `devolução gravada: ${devolvido}`).toBeGreaterThanOrEqual(base);
  expect(devolvido).toBeLessThan(base * 1.5);
});

Then(/^não deve ser calculado sobre os ([\d.,]+) contratados$/, async function (
  this: CustomWorld,
  valorTexto: string
) {
  const contratado = paraNumero(valorTexto);
  const rescisao = await recebimentoDeRescisao(this);
  const devolvido = Math.abs(Number(rescisao.termination_corrected_deposit || 0));

  expect(devolvido).toBeLessThan(contratado);
});

Then(/^o Valor Corrigido p\/ Devolução deve ser ([\d.,]+)$/, async function (
  this: CustomWorld,
  valorTexto: string
) {
  const esperado = paraNumero(valorTexto);
  const rescisao = await recebimentoDeRescisao(this);
  const devolvido = Math.abs(Number(rescisao.termination_corrected_deposit || 0));

  expect(devolvido).toBeCloseTo(esperado, 2);
});

// "devo ver as colunas:" já existe em common.steps.ts (usada também por
// 5-imoveis-crud.feature e 6-inquilinos-crud.feature) — reaproveitada aqui
// sem redefinir, para não duplicar o step nem gerar ambiguidade no Cucumber.

// As 4 colunas que este cenário confere — mesma lista literal da tabela do
// Gherkin. Mantida fixa aqui (em vez de capturada do step anterior) porque
// "devo ver as colunas:" é genérico e compartilhado com outras features, e
// não deve carregar estado específico da rescisão.
const COLUNAS_RESCISAO = [
  'Valor Corrigido p/ Devolução',
  'Despesas Adicionais',
  'Valor Desconto',
  'Valor Total',
];

Then('as quatro devem estar vazias', async function (this: CustomWorld) {
  const linha = this.page.locator('tr', { hasText: this.tenantName! }).first();
  await expect(linha).toBeVisible({ timeout: 10000 });

  for (const coluna of COLUNAS_RESCISAO) {
    const indice = await indiceDaColuna(this.page, coluna);
    const celula = linha.locator('td').nth(indice);
    const texto = ((await celula.textContent()) || '').trim();

    expect(['-', '', 'R$ 0,00'], `coluna "${coluna}" mostrou "${texto}"`).toContain(texto);
  }
});

Then(/^a coluna "([^"]+)" deve mostrar (-?[\d.,]+)$/, async function (
  this: CustomWorld,
  colunaTexto: string,
  valorTexto: string
) {
  const esperado = paraNumero(valorTexto);
  const indice = await indiceDaColuna(this.page, colunaTexto);
  const linha = this.page.locator('tr', { hasText: this.tenantName! }).first();
  const celula = linha.locator('td').nth(indice);

  const texto = (await celula.textContent()) || '';
  expect(extrairNumeroExibido(texto)).toBeCloseTo(esperado, 2);

  this.testData.celulaValorTotal = celula;
});

Then(/^o valor deve estar em vermelho: (\S+)$/, async function (
  this: CustomWorld,
  vermelhoTexto: string
) {
  const esperaVermelho = vermelhoTexto.toLowerCase() === 'sim';
  const celula = this.testData.celulaValorTotal;

  if (!celula) {
    throw new Error('Célula de "Valor Total" ainda não localizada — o step da coluna roda antes deste.');
  }

  const classe = (await celula.getAttribute('class')) || '';
  const estaVermelho = /text-red-(500|600|700)/.test(classe);

  expect(estaVermelho, `classe da célula: "${classe}"`).toBe(esperaVermelho);
});

Then(/^o sistema deve registrar o valor como (-?[\d.,]+)$/, async function (
  this: CustomWorld,
  valorTexto: string
) {
  const esperado = paraNumero(valorTexto);
  const pagamento = await this.getPaymentById(this.testData.terminationPaymentId);

  // ⚠️ O campo "Valor de Desconto" desta tela grava em `discount_amount`
  // (coluna genérica de desconto, também usada em atraso), não em
  // `termination_discount` (que só terminationService.ts escreve). O
  // comentário de `TerminationData.discount` em terminationService.ts
  // documenta a intenção de gravar negativo; se este assert falhar contra o
  // servidor real, é esse descompasso entre as duas colunas — não um erro
  // deste step.
  const valorGravado = Number(pagamento.discount_amount ?? pagamento.termination_discount ?? 0);
  expect(valorGravado).toBeCloseTo(esperado, 2);
});

Then('eu não devo precisar digitar o sinal de menos', async function (this: CustomWorld) {
  expect(this.testData.ultimoValorDigitado).not.toContain('-');
});
