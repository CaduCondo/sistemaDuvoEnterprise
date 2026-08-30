import { Given, When, Then } from '@cucumber/cucumber';
import { expect, Locator, Page } from '@playwright/test';
import { CustomWorld } from '../support/world';
import DatabaseHelper from '../helpers/database.helper';

/**
 * Steps da feature 12-rescisao-caucao.feature (issue #49 e as rodadas 2 e 3
 * de padronização das telas).
 *
 * COMO ESTES CENÁRIOS FUNCIONAM
 *
 * O setup (Dado) vai direto no banco via DatabaseHelper/CustomWorld — montar
 * locação, inquilino e histórico de parcelas de caução pela tela levaria
 * minutos por cenário e testaria cadastro, que não é o assunto aqui.
 *
 * A AÇÃO da rescisão é SEMPRE feita pela TELA de verdade (Playwright). Os
 * defeitos reais desta funcionalidade só apareciam no caminho até o banco —
 * constraints, o trigger validate_payment_status que cravava 'paid' por cima
 * do 'pending' — e nenhum deles apareceria chamando
 * processContractTermination() direto.
 *
 * As verificações de CÁLCULO leem o BANCO (DatabaseHelper): a tela já mostrou
 * valor diferente do gravado nesta funcionalidade. As de EXIBIÇÃO (etiqueta,
 * cor, coluna, aba, linha) leem a TELA, porque aí o assunto É a tela.
 *
 * ⚠️ A MULTA NÃO É MAIS DIGITADA. O campo livre `#termination-penalty-amount`
 * foi removido em 28/ago/2026 (rodada 2, item D1). A multa vem de uma das duas
 * caixas de seleção do diálogo de rescisão, e o valor é calculado pelo próprio
 * diálogo a partir do contrato (RentalTerminationDialog.tsx):
 *
 *   #termination-apply-full-penalty      "Multa Proporcional ao Tempo Restante"
 *                                        (3 aluguéis ÷ meses totais) × meses restantes
 *   #termination-apply-12months-penalty  "Multa Cláusula 12 Meses"
 *                                        (3 aluguéis ÷ 12) × meses até completar 12
 *
 * ⚠️ A caixa da cláusula de 12 meses fica DESABILITADA quando a locação já
 * passou do 12º mês contado a partir de HOJE (não da data da saída) — é assim
 * que o diálogo calcula `currentMonth`. Com a locação de teste começando em
 * 01/06/2026, isso só acontece a partir de 01/06/2027. Se o cenário da
 * cláusula de 12 meses começar a falhar dizendo que a caixa está desabilitada,
 * é isto: mova a data de início da locação de teste para mais perto de hoje.
 */

// ============================================================================
// Utilidades
// ============================================================================

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Rótulo da cláusula no Gherkin -> id da caixa de seleção no diálogo. */
const CAIXA_POR_CLAUSULA: Record<string, string> = {
  'Multa Proporcional ao Tempo Restante': '#termination-apply-full-penalty',
  'Multa Cláusula 12 Meses': '#termination-apply-12months-penalty',
};

/** "03/09/2026" -> "2026-09-03" */
function paraISO(dataBR: string): string {
  const [dia, mes, ano] = dataBR.split('/');
  return `${ano}-${mes}-${dia}`;
}

/** "1.750,00" ou "-200,00" -> 1750 / -200 */
function paraNumero(valor: string): number {
  return Number(String(valor).replace(/\./g, '').replace(',', '.'));
}

/** 4250 -> "4.250,00" (sem "R$", para casar com o texto da célula) */
function formatarValorBR(valor: number): string {
  return Math.abs(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** O breakdown vem como JSON (string) ou array, dependendo do driver. */
function linhasDoBreakdown(breakdown: any): any[] {
  if (typeof breakdown === 'string') {
    try { return JSON.parse(breakdown); } catch { return []; }
  }
  return Array.isArray(breakdown) ? breakdown : [];
}

function escapeRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lê o número de um texto de moeda exibido na tela: "- R$ 2.000,00" -> -2000 */
function extrairNumeroExibido(texto: string): number {
  const negativo = texto.trim().startsWith('-');
  const digitos = texto.replace(/[^\d,]/g, '').replace(',', '.');
  const valor = parseFloat(digitos || '0');
  return negativo ? -valor : valor;
}

/**
 * Posição (0-based) de uma coluna pelo texto do cabeçalho da tabela.
 *
 * Duas armadilhas, as duas vistas de verdade na execução de 30/ago/2026:
 *
 * 1. A tabela pode ainda não estar na tela. Antes, a função lia os cabeçalhos
 *    na hora e falhava com "Cabeçalhos vistos: []" -- que parece defeito de
 *    tela, mas era só pressa. Agora ela espera o primeiro cabeçalho aparecer.
 *
 * 2. Um nome pode ser começo de outro. A aba Cauções tem "Valor Total Caução"
 *    E "Valor Total": procurando por pedaço, "Valor Total" achava a coluna
 *    "Valor Total Caução" (e o teste comparava 500,00 com R$ 6.000,00).
 *    Agora o nome exato ganha; só se não houver exato é que vale o pedaço.
 */
async function indiceDaColuna(page: Page, nomeDaColuna: string): Promise<number> {
  await expect(
    page.getByRole('columnheader').first(),
    'a tabela não apareceu na tela'
  ).toBeVisible({ timeout: 15000 });

  const cabecalhos = (await page.getByRole('columnheader').allTextContents()).map((t) => t.trim());
  const procurado = nomeDaColuna.trim();

  const exato = cabecalhos.findIndex((texto) => texto === procurado);
  const indice = exato !== -1 ? exato : cabecalhos.findIndex((texto) => texto.includes(procurado));

  if (indice === -1) {
    throw new Error(
      `Coluna "${nomeDaColuna}" não encontrada na tabela. Cabeçalhos vistos: [${cabecalhos.join(' | ')}]`
    );
  }
  return indice;
}

/**
 * Normaliza o rótulo de uma linha da "Formação de Valores" para o nome que os
 * tickets usam, tirando o que é decoração:
 *
 *   "Aluguel Proporcional *"      -> "Aluguel Proporcional"  (o "*" é a chamada da legenda)
 *   "Aluguel Mês 9/2026"          -> "Aluguel"               (o mês fica no rótulo gravado)
 *   "Garagem - Parcela 3/12"      -> "Garagem"
 *   "Garagem (16 dias)"           -> "Garagem"
 */
function rotuloNormalizado(linha: string): string {
  return linha
    .trim()
    .replace(/\s*\*+$/, '')
    .replace(/\s*-\s*Parcela\s+\d+\/\d+/i, '')
    .replace(/\s+Mês\s+\d{1,2}\/\d{4}$/i, '')
    .replace(/\s*\(\s*\d+\s*dias?\s*\)$/i, '')
    .trim();
}

/**
 * Vocabulário das linhas da "Formação de Valores". Serve para separar as
 * linhas da conta do resto do texto do bloco (legenda do proporcional,
 * subtítulos, bloco de atraso) sem depender da estrutura do HTML.
 */
const LINHAS_CONHECIDAS = [
  'Aluguel',
  'Aluguel Proporcional',
  'Garagem',
  'Garagem Proporcional',
  'Multa Rescisória',
  'Valor de Desconto',
  'Valor Desconto',
  'Despesas Adicionais',
  'Caução Corrigido p/ Devolução',
];

// ---------------------------------------------------------------------------
// Navegação
// ---------------------------------------------------------------------------

/**
 * O seletor de período (mês/ano) não tem id — é o PeriodSelector, usado na
 * página de Recebimentos e na aba Locações do Financeiro. Localizamos o
 * combobox pelo próprio conteúdo (um nome de mês ou "Todos os meses"), que é
 * mais estável do que contar comboboxes na página.
 */
function seletorDeMes(page: Page): Locator {
  return page
    .getByRole('combobox')
    .filter({ hasText: new RegExp(`Todos os meses|${MESES_PT.join('|')}`, 'i') })
    .first();
}

function seletorDeAno(page: Page): Locator {
  return page.getByRole('combobox').filter({ hasText: /^\s*(20\d{2}|Todos os anos)\s*$/ }).first();
}

/** Página de Recebimentos: tira o filtro de mês (que nasce no mês corrente). */
async function verTodosOsMeses(page: Page) {
  await seletorDeMes(page).click();
  await page.getByRole('option', { name: 'Todos os meses' }).click();
  await page.waitForTimeout(1200);
}

/** Aba Locações do Financeiro: o seletor NÃO tem a opção "todos" (showAllOption=false). */
async function selecionarPeriodo(page: Page, mes: string, ano: string) {
  const nomeDoMes = MESES_PT[Number(mes) - 1];

  await seletorDeMes(page).click();
  await page.getByRole('option', { name: new RegExp(`^${escapeRegex(nomeDoMes)}$`, 'i') }).click();
  await page.waitForTimeout(600);

  await seletorDeAno(page).click();
  await page.getByRole('option', { name: new RegExp(`^${ano}$`) }).click();
  await page.waitForTimeout(1200);
}

async function abrirAbaFinanceiro(world: CustomWorld, nomeDaAba: string) {
  const page = world.page;

  await page.goto('/financial');
  await page.waitForLoadState('domcontentloaded');

  const aba = page.getByRole('tab', { name: new RegExp(escapeRegex(nomeDaAba), 'i') });
  await aba.click();

  // A aba troca na hora, mas a tabela dela vem do banco. Sem esperar por ela,
  // o passo seguinte lia uma tela ainda vazia.
  await expect(
    page.getByRole('columnheader').first(),
    `a tabela da aba "${nomeDaAba}" não apareceu`
  ).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(500);

  // O período só existe (e só importa) na aba Locações; a aba Cauções lista
  // todas as parcelas de caução, sem filtro de mês.
  const periodo = world.testData.periodoRescisao;
  if (/loca/i.test(nomeDaAba) && periodo) {
    await selecionarPeriodo(page, periodo.mes, periodo.ano);
  }
}

/**
 * A lista de Recebimentos só existe depois que a busca no banco termina:
 * enquanto ela não termina a tela mostra "Carregando recebimentos..." e as abas
 * nem são desenhadas. Esperar a aba aparecer é, portanto, esperar a lista.
 */
async function esperarListaDeRecebimentos(page: Page) {
  await expect(
    page.locator('#payments-tab-pending'),
    'a lista de Recebimentos não terminou de carregar'
  ).toBeVisible({ timeout: 30000 });
}

/** Página de Recebimentos, sem filtro de mês e já filtrada pelo inquilino do cenário. */
async function abrirRecebimentosDoInquilino(world: CustomWorld) {
  const page = world.page;

  await page.goto('/payments');
  await page.waitForLoadState('domcontentloaded');

  // ATENÇÃO: não mexer no filtro de mês antes da primeira carga acabar. A tela
  // nasce filtrada no mês de hoje e, se um segundo pedido chega enquanto o
  // primeiro está em andamento, ele é descartado em silêncio -- o rótulo vira
  // "Todos os meses" mas a lista continua a do mês de hoje, e o recebimento de
  // 09/2026 nunca aparece. Foi isso que derrubou dois cenários em 30/ago/2026.
  await esperarListaDeRecebimentos(page);

  await verTodosOsMeses(page);
  await esperarListaDeRecebimentos(page);

  await page.locator('#payments-search-input').fill(world.tenantName!);
  await page.waitForTimeout(1200);
}

/** A linha da tabela de Recebimentos correspondente a UM recebimento do banco. */
function linhaDoRecebimento(world: CustomWorld, pagamento: any): Locator {
  return world.page
    .locator('tbody tr')
    .filter({ hasText: world.tenantName! })
    .filter({ hasText: formatarValorBR(Number(pagamento.expected_amount)) })
    .first();
}

/** Abre a tela "Registrar Recebimento..." de um recebimento específico. */
async function abrirRecebimento(world: CustomWorld, pagamento: any) {
  await abrirRecebimentosDoInquilino(world);

  const linha = linhaDoRecebimento(world, pagamento);
  await expect(
    linha,
    `não achei na tela o recebimento de R$ ${formatarValorBR(Number(pagamento.expected_amount))} de ${world.tenantName}`
  ).toBeVisible({ timeout: 15000 });

  await linha.click();

  const dialogo = world.page.locator('#payments-manage-dialog');
  await expect(dialogo).toBeVisible({ timeout: 15000 });
  await expect(dialogo.getByText(/Formação de Valores/i).first()).toBeVisible({ timeout: 15000 });

  world.testData.recebimentoAberto = pagamento;
}

// ---------------------------------------------------------------------------
// Leitura do banco
// ---------------------------------------------------------------------------

async function pagamentosDaLocacao(world: CustomWorld) {
  return DatabaseHelper.getPaymentsByRental(world.rentalId!);
}

/**
 * O recebimento de ALUGUEL criado pela rescisão: é o que vence no dia da
 * saída. Quando a rescisão é depois do vencimento existem dois recebimentos
 * de aluguel no mês (o do mês cheio, no dia 10, e este) — por isso a data de
 * vencimento, e não o mês, é o que identifica.
 */
async function recebimentoDeAluguelDaRescisao(world: CustomWorld) {
  const todos = await pagamentosDaLocacao(world);
  const doDia = todos.filter(
    (p: any) => p.due_date === world.testData.dataRescisao && (p.payment_kind ?? 'rent') !== 'termination'
  );

  expect(
    doDia.length,
    `esperava 1 recebimento de aluguel vencendo em ${world.testData.dataRescisao}, encontrei ${doDia.length}`
  ).toBe(1);

  return doDia[0];
}

/** O Recebimento de Rescisão (payment_kind='termination') da locação. */
async function recebimentoDeRescisao(world: CustomWorld) {
  const todos = await pagamentosDaLocacao(world);
  const rescisoes = todos.filter((p: any) => p.payment_kind === 'termination');

  expect(
    rescisoes.length,
    `esperava 1 Recebimento de Rescisão, encontrei ${rescisoes.length}`
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

  // Nome único: a ação da rescisão acha a locação pela tela buscando o nome do
  // inquilino — sem um nome único por execução, dois cenários rodando em
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
  this.testData.dataInicio = paraISO(dados['data_início']);
});

Given('que o inquilino pagou todas as parcelas de caução', async function (this: CustomWorld) {
  const parcelas = await this.getDepositInstallments(this.rentalId!);

  for (const parcela of parcelas) {
    await this.updateDepositInstallment(parcela.id, {
      status: 'paid',
      paid_amount: parcela.amount,
      // Depois do início do contrato e antes de qualquer data de saída usada
      // nos cenários — é dessa data que a correção da poupança parte na tela.
      payment_date: '2026-07-15',
    });
  }
});

Given('que as parcelas de caução estão assim:', async function (this: CustomWorld, dataTable: any) {
  const linhas = dataTable.hashes();
  const parcelas = await this.getDepositInstallments(this.rentalId!);

  for (const linha of linhas) {
    const numero = Number(linha['parcela']);
    const valor = paraNumero(linha['valor']);
    const paga = /pag/i.test(linha['situação']);

    const parcela = parcelas.find((p: any) => p.installment_number === numero);
    expect(parcela, `parcela ${numero} de caução não existe na locação de teste`).toBeTruthy();

    await this.updateDepositInstallment(parcela.id, {
      amount: valor,
      status: paga ? 'paid' : 'pending',
      paid_amount: paga ? valor : null,
      payment_date: paga ? '2026-07-15' : null,
    });
  }
});

Given('que o inquilino não pagou nenhuma parcela de caução', async function (this: CustomWorld) {
  // As parcelas nascem 'pending' com paid_amount nulo em createRental — nada a
  // fazer. O step existe para o cenário dizer, em voz alta, de onde parte.
  const parcelas = await this.getDepositInstallments(this.rentalId!);
  const pagas = parcelas.filter((p: any) => p.status === 'paid');
  expect(pagas.length, 'a locação de teste nasceu com parcela de caução paga').toBe(0);
});

Given('existem recebimentos de aluguel pendentes nos meses:', async function (this: CustomWorld, dataTable: any) {
  const linhas = dataTable.hashes();
  const valorMensal = this.testData.aluguel + this.testData.garagem;
  const dia = String(this.testData.diaVencimento).padStart(2, '0');

  for (const linha of linhas) {
    await this.upsertPayment({
      rental_id: this.rentalId!,
      reference_month: linha['mês'],
      reference_year: linha['ano'],
      due_date: `${linha['ano']}-${linha['mês']}-${dia}`,
      expected_amount: valorMensal,
      status: 'pending',
    });
  }
});

Given(
  'que o recebimento de aluguel de {string} está {string} com valor de {string}',
  async function (this: CustomWorld, periodo: string, situacao: string, valorTexto: string) {
    const [mes, ano] = periodo.split('/');
    const valor = paraNumero(valorTexto);
    const pago = /pag/i.test(situacao);
    const dia = String(this.testData.diaVencimento).padStart(2, '0');

    const pagamento = await this.upsertPayment({
      rental_id: this.rentalId!,
      reference_month: mes,
      reference_year: ano,
      due_date: `${ano}-${mes}-${dia}`,
      expected_amount: valor,
      status: pago ? 'paid' : 'pending',
      paid_amount: pago ? valor : undefined,
      payment_date: pago ? `${ano}-${mes}-${dia}` : undefined,
    });

    this.testData.recebimentoDoMes = pagamento;
  }
);

Given('um Recebimento de Rescisão com:', async function (this: CustomWorld, dataTable: any) {
  const dados = dataTable.rowsHash();

  const pagamento = await this.createTerminationPayment({
    rental_id: this.rentalId!,
    due_date: '2026-09-03',
    reference_month: '09',
    reference_year: '2026',
    termination_corrected_deposit: paraNumero(dados['valor_corrigido']),
    termination_additional_expenses: paraNumero(dados['despesas_adicionais']),
    termination_discount: paraNumero(dados['valor_desconto']),
  });

  this.testData.terminationPaymentId = pagamento.id;
});

Given('que estou preenchendo o Recebimento de Rescisão', async function (this: CustomWorld) {
  const pagamento = await this.createTerminationPayment({
    rental_id: this.rentalId!,
    due_date: '2026-09-03',
    reference_month: '09',
    reference_year: '2026',
    // Total POSITIVO de propósito: quando o VALOR TOTAL é negativo (a
    // imobiliária é que paga), o campo "Valor de Desconto" some da tela —
    // rodada 3, item 6. Não haveria o que descontar de quem não está pagando.
    //   -1.000,00 (devolução) + 2.000,00 (despesas) = +1.000,00
    termination_corrected_deposit: -1000,
    termination_additional_expenses: 2000,
    breakdown: [
      { description: 'Caução Corrigido p/ Devolução', amount: -1000, type: 'deduction' },
      { description: 'Despesas Adicionais', amount: 2000, type: 'addition' },
    ],
    // Mesmo texto que terminationService grava, para a tela abrir igual à real.
    notes: 'Recebimento de Rescisão - Data de saída: 2026-09-03. Devolução de caução, despesas adicionais e desconto.',
  });

  this.testData.terminationPaymentId = pagamento.id;

  await abrirRecebimento(this, pagamento);

  await expect(
    this.page.locator('#breakdown-discount-termination'),
    'o campo "Valor de Desconto" do Recebimento de Rescisão não está na tela'
  ).toBeVisible({ timeout: 10000 });
});

// ============================================================================
// AÇÃO — a rescisão é sempre feita pela TELA
// ============================================================================

/** Abre o diálogo "Rescisão de Contrato" da locação do cenário. */
async function abrirDialogoDeRescisao(world: CustomWorld) {
  const page = world.page;

  await page.goto('/rentals');
  await page.waitForLoadState('domcontentloaded');

  // Busca pelo nome do inquilino (único por execução) para não depender de
  // paginação nem esbarrar na locação de outro cenário.
  await page.locator('#rentals-search-input').fill(world.tenantName!);
  await page.waitForTimeout(1000);

  await page.locator(`#rentals-terminate-${world.rentalId}`).click();
  await expect(page.locator('#termination-date')).toBeVisible({ timeout: 15000 });
}

When('eu abrir o diálogo de rescisão da locação', async function (this: CustomWorld) {
  await abrirDialogoDeRescisao(this);
});

When(
  /^eu registrar a rescisão em "([^"]+)" com a cláusula "([^"]+)"$/,
  async function (this: CustomWorld, dataSaidaBR: string, clausula: string) {
    const page = this.page;
    const iso = paraISO(dataSaidaBR);
    const [ano, mes] = iso.split('-');

    this.testData.dataRescisao = iso;
    this.testData.periodoRescisao = { mes, ano };
    this.testData.clausula = clausula;

    const seletorDaCaixa = CAIXA_POR_CLAUSULA[clausula];
    if (!seletorDaCaixa) {
      throw new Error(
        `Cláusula desconhecida: "${clausula}". As duas do contrato são: ${Object.keys(CAIXA_POR_CLAUSULA).join(' | ')}`
      );
    }

    await abrirDialogoDeRescisao(this);

    await page.locator('#termination-date').fill(iso);
    await page.waitForTimeout(500);

    const caixa = page.locator(seletorDaCaixa);
    await expect(
      caixa,
      `a caixa "${clausula}" está desabilitada — ver o aviso sobre o 12º mês no topo deste arquivo`
    ).toBeEnabled();

    await caixa.click();
    await expect(caixa).toHaveAttribute('aria-checked', 'true');

    // O valor da multa é calculado num useEffect: só depois dele o diálogo
    // mostra a linha "Valor da Multa". Confirmar antes disso gravaria multa 0.
    await expect(
      page.getByText(/Valor da Multa/i).first(),
      `a cláusula "${clausula}" não produziu multa nenhuma nesta locação`
    ).toBeVisible({ timeout: 10000 });

    await page.locator('#termination-confirm').click();

    // A rescisão faz várias escritas em sequência (deleta, cria, renumera);
    // o diálogo só fecha quando tudo passou.
    await expect(page.locator('#termination-date')).toBeHidden({ timeout: 45000 });
    await page.waitForTimeout(2000);
  }
);

When('eu gravar um Recebimento de Rescisão de valor 0,00 direto no banco', async function (this: CustomWorld) {
  const pagamento = await this.createTerminationPayment({
    rental_id: this.rentalId!,
    due_date: '2026-09-03',
    reference_month: '09',
    reference_year: '2026',
    termination_corrected_deposit: 0,
    termination_additional_expenses: 0,
    termination_discount: 0,
    expected_amount: 0,
  });

  this.testData.terminationPaymentId = pagamento.id;
});

When('eu abrir a aba {string} sem ter rescindido a locação', async function (this: CustomWorld, aba: string) {
  await abrirAbaFinanceiro(this, aba);
});

When('eu abrir a aba {string}', async function (this: CustomWorld, aba: string) {
  await abrirAbaFinanceiro(this, aba);
});

When('eu abrir o Recebimento de Rescisão', async function (this: CustomWorld) {
  const rescisao = await recebimentoDeRescisao(this);
  await abrirRecebimento(this, rescisao);
});

When('eu abrir o recebimento de aluguel da rescisão', async function (this: CustomWorld) {
  const aluguel = await recebimentoDeAluguelDaRescisao(this);
  await abrirRecebimento(this, aluguel);
});

When('eu abrir o recebimento de aluguel de {string}', async function (this: CustomWorld, periodo: string) {
  const [mes, ano] = periodo.split('/');
  const todos = await pagamentosDaLocacao(this);
  const doMes = todos.filter(
    (p: any) => p.reference_month === mes && p.reference_year === ano && (p.payment_kind ?? 'rent') !== 'termination'
  );

  expect(doMes.length, `esperava 1 recebimento de aluguel em ${periodo}, encontrei ${doMes.length}`).toBe(1);
  await abrirRecebimento(this, doMes[0]);
});

When('eu digitar {string} no campo {string}', async function (this: CustomWorld, valor: string, campo: string) {
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

  // Os dois campos salvam sozinhos ~1,5s depois de parar de digitar (ver
  // ManagePaymentForm.handleSaveExpensesAndDiscount) — não há botão próprio.
  await this.page.waitForTimeout(3000);
});

// ============================================================================
// VERIFICAÇÕES DE CÁLCULO — leem o BANCO
// ============================================================================

Then(/^o recebimento de aluguel da rescisão deve ter valor ([\d.,]+)$/, async function (
  this: CustomWorld,
  valorTexto: string
) {
  const esperado = paraNumero(valorTexto);
  const recebimento = await recebimentoDeAluguelDaRescisao(this);
  expect(Number(recebimento.expected_amount)).toBeCloseTo(esperado, 2);
});

Then(
  /^o recebimento de aluguel da rescisão deve detalhar "([^"]+)" com ([\d.,]+)$/,
  async function (this: CustomWorld, rotulo: string, valorTexto: string) {
    const esperado = paraNumero(valorTexto);
    const recebimento = await recebimentoDeAluguelDaRescisao(this);
    const linhas = linhasDoBreakdown(recebimento.breakdown);

    const linha = linhas.find((l: any) => rotuloNormalizado(l.description || '') === rotulo);

    expect(
      linha,
      `linha "${rotulo}" não está no detalhamento. Linhas: [${linhas.map((l: any) => l.description).join(' | ')}]`
    ).toBeTruthy();
    expect(Number(linha.amount)).toBeCloseTo(esperado, 2);
  }
);

Then(
  /^a base de cálculo das taxas de administração e gerenciamento deve ser ([\d.,]+)$/,
  async function (this: CustomWorld, valorTexto: string) {
    const esperado = paraNumero(valorTexto);
    const recebimento = await recebimentoDeAluguelDaRescisao(this);

    // financial.tsx calcula as duas taxas sobre os recebimentos com
    // payment_kind !== 'termination'. Este cenário só REGISTRA a rescisão (o
    // recebimento nasce pendente); o valor que vai virar base assim que for
    // baixado é o expected_amount de hoje. Checar isso aqui evita ter de
    // simular também a baixa do pagamento, que não é o assunto do cenário.
    expect(recebimento.payment_kind ?? 'rent').not.toBe('termination');
    expect(Number(recebimento.expected_amount)).toBeCloseTo(esperado, 2);
  }
);

Then('a devolução do caução não deve influenciar nenhuma das duas taxas', async function (this: CustomWorld) {
  const rescisao = await recebimentoDeRescisao(this);

  // É a marcação payment_kind='termination' que tira este registro da base:
  // financial.tsx descarta esses recebimentos tanto da aba Locações quanto do
  // cálculo das taxas de adm e gerenciamento.
  expect(rescisao.payment_kind).toBe('termination');
  expect(Number(rescisao.termination_corrected_deposit)).toBeLessThan(0);
});

Then(/^a multa de ([\d.,]+) deve estar dentro da base das duas taxas$/, async function (
  this: CustomWorld,
  valorTexto: string
) {
  const esperado = paraNumero(valorTexto);
  const recebimento = await recebimentoDeAluguelDaRescisao(this);
  const linhas = linhasDoBreakdown(recebimento.breakdown);
  const linhaMulta = linhas.find((l: any) => (l.description || '').includes('Multa Rescisória'));

  expect(
    linhaMulta,
    `linhas: [${linhas.map((l: any) => l.description).join(' | ')}]`
  ).toBeTruthy();
  expect(Number(linhaMulta.amount)).toBeCloseTo(esperado, 2);

  // A multa "está dentro da base" porque é uma linha do MESMO recebimento que
  // forma a base (payment_kind 'rent'). Conferir o payment_kind aqui garante
  // que ela não foi parar, por engano, no Recebimento de Rescisão.
  expect(recebimento.payment_kind ?? 'rent').not.toBe('termination');
});

Then('não deve sobrar nenhuma parcela de aluguel com vencimento depois de {string}', async function (
  this: CustomWorld,
  dataBR: string
) {
  const limite = paraISO(dataBR);
  const todos = await pagamentosDaLocacao(this);
  const depois = todos.filter((p: any) => p.due_date > limite);

  expect(
    depois.length,
    `sobraram: [${depois.map((p: any) => `${p.due_date} (${p.payment_kind ?? 'rent'})`).join(', ')}]`
  ).toBe(0);
});

Then('a última parcela de aluguel deve ser a do mês da rescisão', async function (this: CustomWorld) {
  const todos = await pagamentosDaLocacao(this); // já vem ordenado por due_date asc
  const alugueis = todos.filter((p: any) => (p.payment_kind ?? 'rent') !== 'termination');
  const ultima = alugueis[alugueis.length - 1];

  expect(ultima, 'nenhuma parcela de aluguel encontrada').toBeTruthy();

  const { mes, ano } = this.testData.periodoRescisao;
  expect(ultima.reference_month).toBe(mes);
  expect(ultima.reference_year).toBe(ano);
});

Then('o Recebimento de Rescisão deve estar no mesmo mês da última parcela de aluguel', async function (
  this: CustomWorld
) {
  const rescisao = await recebimentoDeRescisao(this);
  const aluguel = await recebimentoDeAluguelDaRescisao(this);

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

  // Corrigido pela poupança: nunca é menor que o que entrou, e não explode.
  // A conta mês a mês é do igpmService; o que este cenário protege é a BASE.
  expect(devolvido, `devolução gravada: ${devolvido}`).toBeGreaterThanOrEqual(base);
  expect(devolvido, `devolução gravada: ${devolvido}`).toBeLessThan(base * 1.5);
});

Then(/^não deve ser calculado sobre os ([\d.,]+) contratados$/, async function (
  this: CustomWorld,
  valorTexto: string
) {
  const contratado = paraNumero(valorTexto);
  const rescisao = await recebimentoDeRescisao(this);
  const devolvido = Math.abs(Number(rescisao.termination_corrected_deposit || 0));

  expect(
    devolvido,
    `devolveria ${devolvido} sobre um caução contratado de ${contratado} — está corrigindo o valor contratado`
  ).toBeLessThan(contratado);
});

Then('não deve haver nada a devolver de caução', async function (this: CustomWorld) {
  const todos = await pagamentosDaLocacao(this);
  const rescisoes = todos.filter((p: any) => p.payment_kind === 'termination');

  // Ou o Recebimento de Rescisão nem chega a existir (nada a devolver, nenhuma
  // despesa, nenhum desconto), ou existe zerado. O que não pode é devolver.
  for (const rescisao of rescisoes) {
    expect(
      Math.abs(Number(rescisao.termination_corrected_deposit || 0)),
      'nasceu devolução de caução numa locação em que nada foi pago'
    ).toBeCloseTo(0, 2);
  }

  const locacao = await this.getRental(this.rentalId!);
  expect(Number(locacao.returned_deposit_amount || 0)).toBeCloseTo(0, 2);
});

Then('o Recebimento de Rescisão deve estar com status {string}', async function (
  this: CustomWorld,
  status: string
) {
  const rescisao = await recebimentoDeRescisao(this);
  expect(
    rescisao.status,
    'quem decide se o recebimento foi quitado é a aplicação, não o trigger do banco'
  ).toBe(status);
});

Then('esse recebimento deve estar com status {string}', async function (this: CustomWorld, status: string) {
  const pagamento = await this.getPaymentById(this.testData.terminationPaymentId);
  expect(
    pagamento.status,
    'o trigger validate_payment_status cravou o status por cima do que a aplicação gravou (ver passo 3 do PROD-rescisao-49.sql)'
  ).toBe(status);
});

Then('o recebimento pendente do mês deve ter sido deletado', async function (this: CustomWorld) {
  const antigo = this.testData.recebimentoDoMes;
  expect(antigo, 'o cenário não criou o recebimento do mês').toBeTruthy();

  const todos = await pagamentosDaLocacao(this);
  const aindaExiste = todos.some((p: any) => p.id === antigo.id);

  expect(
    aindaExiste,
    'o recebimento pendente do mês da rescisão continua no banco — ele deve ser deletado e substituído'
  ).toBe(false);
});

Then('o recebimento pago do mês deve continuar existindo, intocado', async function (this: CustomWorld) {
  const antigo = this.testData.recebimentoDoMes;
  expect(antigo, 'o cenário não criou o recebimento do mês').toBeTruthy();

  const todos = await pagamentosDaLocacao(this);
  const atual = todos.find((p: any) => p.id === antigo.id);

  expect(atual, 'o recebimento já pago do mês da rescisão sumiu — ele é histórico e não se mexe').toBeTruthy();
  expect(atual.status).toBe('paid');
  expect(Number(atual.expected_amount)).toBeCloseTo(Number(antigo.expected_amount), 2);
  expect(atual.due_date).toBe(antigo.due_date);
});

Then('a decisão da etiqueta deve vir de payment_kind, não do texto das observações', async function (
  this: CustomWorld
) {
  const aluguel = await recebimentoDeAluguelDaRescisao(this);
  const rescisao = await recebimentoDeRescisao(this);

  // A armadilha, em números: quem escreve "Rescisão de Contrato" nas
  // observações é o recebimento de ALUGUEL. Ler o texto para decidir a
  // etiqueta acerta justamente o registro errado — foi assim duas vezes.
  expect(String(aluguel.notes || '')).toContain('Rescisão de Contrato');
  expect(String(rescisao.notes || '')).not.toContain('Rescisão de Contrato -');

  expect(aluguel.payment_kind ?? 'rent').toBe('rent');
  expect(rescisao.payment_kind).toBe('termination');
});

// ============================================================================
// VERIFICAÇÕES DE EXIBIÇÃO — leem a TELA
// ============================================================================

Then('deve existir um recebimento de aluguel na aba {string}', async function (this: CustomWorld, aba: string) {
  const recebimento = await recebimentoDeAluguelDaRescisao(this);
  await abrirAbaFinanceiro(this, aba);

  const linha = this.page
    .locator('tr')
    .filter({ hasText: this.tenantName! })
    .filter({ hasText: formatarValorBR(Number(recebimento.expected_amount)) });

  await expect(
    linha.first(),
    `a aba "${aba}" não mostra o recebimento de aluguel de R$ ${formatarValorBR(Number(recebimento.expected_amount))}`
  ).toBeVisible({ timeout: 15000 });
});

Then('deve existir um Recebimento de Rescisão na aba {string}', async function (this: CustomWorld, aba: string) {
  const rescisao = await recebimentoDeRescisao(this);
  await abrirAbaFinanceiro(this, aba);

  // Na aba Cauções o Recebimento de Rescisão aparece como as 4 colunas da
  // rescisão, mescladas por locação (não como uma linha de recebimento).
  const linha = this.page.locator('tr').filter({ hasText: this.tenantName! }).first();
  await expect(linha, `a locação de teste não aparece na aba "${aba}"`).toBeVisible({ timeout: 15000 });

  const indice = await indiceDaColuna(this.page, 'Valor Corrigido p/ Devolução');
  const celula = linha.locator('td').nth(indice);
  const exibido = extrairNumeroExibido((await celula.textContent()) || '');

  expect(exibido).toBeCloseTo(Number(rescisao.termination_corrected_deposit), 2);
});

Then('a devolução do caução NÃO deve aparecer na aba {string}', async function (this: CustomWorld, aba: string) {
  const rescisao = await recebimentoDeRescisao(this);
  await abrirAbaFinanceiro(this, aba);

  const valorDaRescisao = formatarValorBR(Number(rescisao.expected_amount));
  const devolucao = formatarValorBR(Number(rescisao.termination_corrected_deposit));

  const linhas = this.page.locator('tr').filter({ hasText: this.tenantName! });
  const quantas = await linhas.count();

  for (let i = 0; i < quantas; i++) {
    const texto = (await linhas.nth(i).textContent()) || '';
    expect(
      texto.includes(valorDaRescisao) || texto.includes(devolucao),
      `a aba "${aba}" está mostrando a devolução do caução: "${texto.trim()}"`
    ).toBe(false);
  }
});

Then('devo ver as duas cláusulas de multa', async function (this: CustomWorld) {
  await expect(this.page.locator('#termination-apply-full-penalty')).toBeVisible();
  await expect(this.page.locator('#termination-apply-12months-penalty')).toBeVisible();
  await expect(this.page.getByText('Multa Proporcional ao Tempo Restante')).toBeVisible();
  await expect(this.page.getByText('Multa Cláusula 12 Meses')).toBeVisible();
});

Then('não deve existir campo para digitar o valor da multa', async function (this: CustomWorld) {
  const dialogo = this.page.getByRole('dialog').filter({ hasText: 'Rescisão de Contrato' }).first();

  // O campo removido em 28/ago/2026 (rodada 2, D1).
  await expect(dialogo.locator('#termination-penalty-amount')).toHaveCount(0);

  // E nenhum outro campo digitável além da data da saída: as duas cláusulas
  // são caixas de seleção, e a multa sai do contrato.
  await expect(
    dialogo.locator('input:not([type="date"]):not([type="checkbox"])'),
    'apareceu um campo digitável no diálogo de rescisão além da data da saída'
  ).toHaveCount(0);
});

Then('na página de Recebimentos o Recebimento de Rescisão deve ter a etiqueta {string}', async function (
  this: CustomWorld,
  etiqueta: string
) {
  const rescisao = await recebimentoDeRescisao(this);
  await abrirRecebimentosDoInquilino(this);

  const linha = linhaDoRecebimento(this, rescisao);
  await expect(linha, 'o Recebimento de Rescisão não aparece na página de Recebimentos').toBeVisible({
    timeout: 15000,
  });

  await expect(
    linha.getByText(etiqueta, { exact: true }),
    `o Recebimento de Rescisão (R$ ${formatarValorBR(Number(rescisao.expected_amount))}) está sem a etiqueta "${etiqueta}"`
  ).toBeVisible();
});

Then('o recebimento de aluguel da rescisão NÃO deve ter a etiqueta {string}', async function (
  this: CustomWorld,
  etiqueta: string
) {
  const aluguel = await recebimentoDeAluguelDaRescisao(this);

  // A busca já está feita pelo step anterior; recarregar aqui deixaria o
  // cenário mais lento sem ganhar nada — mas garantimos a listagem certa.
  if (!(await this.page.locator('#payments-search-input').isVisible().catch(() => false))) {
    await abrirRecebimentosDoInquilino(this);
  }

  const linha = linhaDoRecebimento(this, aluguel);
  await expect(linha, 'o recebimento de aluguel da rescisão não aparece na página de Recebimentos').toBeVisible({
    timeout: 15000,
  });

  await expect(
    linha.getByText(etiqueta, { exact: true }),
    `o recebimento de ALUGUEL (R$ ${formatarValorBR(Number(aluguel.expected_amount))}) está com a etiqueta "${etiqueta}", que é do Recebimento de Rescisão`
  ).toHaveCount(0);
});

Then('devo ver a linha {string} com a soma dos recebimentos que vencem em {string}', async function (
  this: CustomWorld,
  rotuloDaLinha: string,
  dataBR: string
) {
  const vencimento = paraISO(dataBR);
  const todos = await pagamentosDaLocacao(this);
  const doMesmoDia = todos.filter((p: any) => p.due_date === vencimento);

  expect(
    doMesmoDia.length,
    `a linha "${rotuloDaLinha}" só faz sentido com mais de um recebimento vencendo em ${dataBR}; encontrei ${doMesmoDia.length}`
  ).toBeGreaterThan(1);

  const soma = doMesmoDia.reduce((total: number, p: any) => total + Number(p.expected_amount || 0), 0);

  const dialogo = this.page.locator('#payments-manage-dialog');
  const rotulo = dialogo.getByText(rotuloDaLinha, { exact: true });
  await expect(rotulo, `a linha "${rotuloDaLinha}" não está na tela`).toBeVisible({ timeout: 10000 });

  const valorTexto = (await rotulo.locator('xpath=following-sibling::span[1]').textContent()) || '';

  expect(
    extrairNumeroExibido(valorTexto),
    `a tela mostra "${valorTexto.trim()}" e a soma dos recebimentos de ${dataBR} no banco é ${soma.toFixed(2)}`
  ).toBeCloseTo(Math.round(soma * 100) / 100, 2);
});

Then('a {string} deve mostrar, nesta ordem:', async function (this: CustomWorld, bloco: string, dataTable: any) {
  const esperado = dataTable.hashes().map((linha: any) => linha['linha']);

  const dialogo = this.page.locator('#payments-manage-dialog');
  await expect(dialogo).toBeVisible({ timeout: 10000 });

  // Lemos o texto do bloco em vez de caçar a estrutura do HTML: o que o
  // cenário protege é a COMPOSIÇÃO das linhas, e o texto é justamente o que o
  // Cadu confere na tela. O bloco vai do título até o VALOR TOTAL.
  const textoDoDialogo = await dialogo.innerText();
  const inicio = textoDoDialogo.indexOf(bloco);
  expect(inicio, `o bloco "${bloco}" não está na tela`).toBeGreaterThanOrEqual(0);

  const fim = textoDoDialogo.indexOf('VALOR TOTAL', inicio);
  const trecho = textoDoDialogo.slice(inicio, fim === -1 ? undefined : fim);

  const encontradas = trecho
    .split('\n')
    .map((l) => rotuloNormalizado(l))
    .filter((l) => LINHAS_CONHECIDAS.includes(l));

  expect(
    encontradas,
    `bloco "${bloco}" na tela:\n${trecho.trim()}`
  ).toEqual(esperado);
});

// "devo ver as colunas:" já existe em common.steps.ts (usada também por
// 5-imoveis-crud.feature e 6-inquilinos-crud.feature) — reaproveitada aqui sem
// redefinir, para não duplicar o step nem gerar ambiguidade no Cucumber.

// As 4 colunas que o cenário confere — mesma lista literal da tabela do
// Gherkin. Mantida fixa aqui (em vez de capturada do step anterior) porque
// "devo ver as colunas:" é genérico e compartilhado com outras features, e não
// deve carregar estado específico da rescisão.
const COLUNAS_RESCISAO = [
  'Valor Corrigido p/ Devolução',
  'Despesas Adicionais',
  'Valor Desconto',
  'Valor Total',
];

Then('as quatro devem estar vazias', async function (this: CustomWorld) {
  const linha = this.page.locator('tr').filter({ hasText: this.tenantName! }).first();
  await expect(linha).toBeVisible({ timeout: 15000 });

  for (const coluna of COLUNAS_RESCISAO) {
    const indice = await indiceDaColuna(this.page, coluna);
    const celula = linha.locator('td').nth(indice);
    const texto = ((await celula.textContent()) || '').trim();

    expect(['-', '', 'R$ 0,00'], `coluna "${coluna}" mostrou "${texto}"`).toContain(texto);
  }
});

Then(/^a coluna "([^"]+)" deve mostrar (-?[\d.,]+)$/, async function (
  this: CustomWorld,
  coluna: string,
  valorTexto: string
) {
  const esperado = paraNumero(valorTexto);
  const indice = await indiceDaColuna(this.page, coluna);
  const linha = this.page.locator('tr').filter({ hasText: this.tenantName! }).first();
  const celula = linha.locator('td').nth(indice);

  const texto = (await celula.textContent()) || '';
  expect(extrairNumeroExibido(texto), `a coluna "${coluna}" mostrou "${texto.trim()}"`).toBeCloseTo(esperado, 2);

  this.testData.celulaValorTotal = celula;
});

Then(/^o valor deve estar em vermelho: (\S+)$/, async function (this: CustomWorld, vermelhoTexto: string) {
  const esperaVermelho = vermelhoTexto.toLowerCase() === 'sim';
  const celula: Locator = this.testData.celulaValorTotal;

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

  // O campo grava em `discount_amount` (coluna genérica de desconto, também
  // usada no abatimento de atraso); `termination_discount` é escrita pelo
  // terminationService. Aceitamos as duas para que o cenário fale de REGRA
  // (grava negativo sem o usuário digitar o sinal) e não de qual coluna.
  const gravado = Number(pagamento.discount_amount ?? pagamento.termination_discount ?? 0);
  expect(gravado).toBeCloseTo(esperado, 2);
});

Then('eu não devo precisar digitar o sinal de menos', async function (this: CustomWorld) {
  expect(this.testData.ultimoValorDigitado).not.toContain('-');
});
