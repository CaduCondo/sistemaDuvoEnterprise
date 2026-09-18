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

/**
 * ⚠️ Consertado em 08/set/2026 (issue #95).
 *
 * Estes dois passos eram MOCK: só gravavam uma bandeirinha em `testData`
 * ("hasActiveRental: true") sem criar locação nenhuma no banco. O cenário
 * seguia como se tivesse uma locação, e o primeiro passo que precisava dela
 * de verdade explodia com:
 *
 *   Falha ao criar pagamento: null value in column "rental_id" of relation
 *   "payments" violates not-null constraint
 *
 * Derrubava 3 cenários de "Editar locação" -- todos por defeito do teste,
 * nenhum bug do sistema. Agora criam a locação de verdade e guardam o id,
 * que é o que `upsertMonthlyPayment` e os passos de edição esperam.
 */
async function criarLocacaoAtivaDeTeste(
  world: any,
  aluguel: number,
  opcoes: { fim?: string; garagem?: number } = {}
) {
  const sufixo = Date.now();
  const tenant = await world.createTenant({ name: `Locacao Ativa E2E ${sufixo}` });

  // ⚠️ Corrigido em 15/set/2026 (issue #99, cluster "Encerrar locação
  // antecipadamente"): antes não passava property_id nenhum, então
  // createRental criava um imóvel "Casa Teste" genérico sem jeito de
  // reencontrar DEPOIS -- o passo "o imóvel deve ficar {string}" tinha que
  // procurar o texto "Disponível" solto na página /properties inteira, que
  // hoje tem 73+ elementos com esse texto (outros imóveis do banco de DEV).
  // Isso é "strict mode violation" no Playwright -- nunca dava pra passar.
  // Agora cria o imóvel com um complemento único e guarda pra achar
  // exatamente ELE depois.
  //
  // ⚠️ Corrigido em 16/set/2026: o imóvel nascia SEM `value` (usando
  // qualquer valor padrão de createProperty), enquanto a locação nascia com
  // `rent_value: aluguel` (ex.: 2500). Isso não dava problema em cenários
  // que nunca editam a locação -- mas o valor do aluguel só é EXIBIDO/
  // EDITADO no formulário via `selectedProperty.value` (o valor pertence ao
  // cadastro do IMÓVEL, não ao da locação -- ver comentários em
  // rentalService.ts e nos cenários "Atualizar valor do aluguel"). Assim,
  // em QUALQUER cenário que edite e salve a locação sem primeiro igualar o
  // valor do imóvel, o sistema silenciosamente recalculava tudo em cima do
  // valor padrão do imóvel (não o `aluguel` pedido pelo cenário) --
  // confirmado como causa raiz de "Corrigir data de início recalcula
  // parcela já criada" (esperava R$ 166,67 de proporcional sobre R$ 2500,
  // recebia R$ 66,67 -- exatamente a conta batendo com o valor padrão do
  // imóvel, não com os R$ 2500 do cenário). Agora o imóvel já nasce com o
  // mesmo valor da locação.
  const complementoUnico = `Rescisao E2E ${sufixo}`;
  const property = await world.createProperty({
    complement: complementoUnico,
    status: 'available',
    value: aluguel,
  });

  const garagem = opcoes.garagem ?? 0;

  const rental = await world.createRental({
    property_id: property.id,
    start_date: '2026-01-01',
    end_date: opcoes.fim ?? '2026-12-31',
    rent_due_day: 10,
    rent_value: aluguel,
    has_garage: garagem > 0,
    garage_value: garagem,
    tenant_id: tenant.id,
  });

  world.rentalId = rental.id;
  world.propertyId = property.id;
  // ⚠️ Adicionado em 18/set/2026 (issue #99, CI run #81): o nome do inquilino
  // só estava em `testData.rental.tenantName`, e os passos da tela de
  // Recebimentos procuram em `world.tenantName` para escopar a busca na
  // locação do cenário. Sem isso, o passo "visualizo o recibo do pagamento de
  // Janeiro/2026" pegava a linha de janeiro/2026 de QUALQUER locação do banco
  // -- e quando calhava de ser uma linha sem botão de recibo, falhava com "a
  // linha não tem botão de recibo". Guardar aqui resolve para todos os
  // cenários que nascem deste helper.
  world.tenantName = tenant.name;
  world.testData = {
    ...world.testData,
    rentalId: rental.id,
    hasActiveRental: true,
    // Guardados soltos porque várias asserções precisam deles como número
    // (ex.: "não apenas o valor do aluguel", que confere aluguel + garagem).
    rentValue: aluguel,
    garageValue: garagem,
    propertyComplement: complementoUnico,
    rental: {
      id: rental.id,
      rent: String(aluguel),
      garage: String(garagem),
      endDate: opcoes.fim ?? '2026-12-31',
      tenantName: tenant.name,
    },
  };

  return rental;
}

/** "1.500,00" / "1500.00" -> 1500 */
function valorParaNumero(texto: string): number {
  const limpo = String(texto).trim();
  // Formato brasileiro ("1.500,00") tem vírgula como separador decimal.
  return limpo.includes(',')
    ? parseFloat(limpo.replace(/\./g, '').replace(',', '.'))
    : parseFloat(limpo.replace(/,/g, ''));
}

Given('que existe uma locação ativa', async function () {
  await criarLocacaoAtivaDeTeste(this, 2500);
});

// ⚠️ Corrigido em 17/set/2026 (issue #99): mesma causa raiz documentada
// em `expectPaymentAmount` mais abaixo -- "rentValue" já vem em formato de
// MÁQUINA do Gherkin ("2500.00"). O parser brasileiro
// (`.replace(/\./g,'').replace(',','.')`) apagava o ponto decimal de
// verdade e criava a locação com aluguel de R$ 250.000,00 em vez de
// R$ 2.500,00 -- 100x maior. Isso não dava erro na hora (a locação era
// criada do mesmo jeito), mas qualquer cálculo proporcional feito em cima
// desse aluguel (ex.: recalcular parcela ao corrigir a data de início)
// saía 100x maior que o esperado.
Given('que existe uma locação ativa com aluguel de {string}', async function (rentValue: string) {
  const aluguel = parseFloat(rentValue);
  await criarLocacaoAtivaDeTeste(this, aluguel);
});

/**
 * ⚠️ Corrigido em 16/set/2026 (issue #99, confirmado pelo CI run
 * 34928289217, cenário "Editar locação - Corrigir data de início
 * recalcula parcela já criada"): este passo só guardava o valor em
 * `this.testData` -- nunca escrevia no banco. A locação continuava com
 * o dia de vencimento padrão (10, fixado em `criarLocacaoAtivaDeTeste`),
 * nunca o "20" que o cenário declarava. Resultado: ao mudar a data de
 * início pra 18/06 esperando uma parcela proporcional em JUNHO (porque
 * 18 < 20), o sistema calculava certinho com base no dia de vencimento
 * REAL (10) -- e como 18 > 10, a conta dava uma parcela em JULHO, não
 * em junho. A parcela de junho criada no preparo ficava "sobrando" e
 * era apagada pela sincronização -- por isso o passo seguinte não
 * achava nenhum recebimento de referência 06/2026 (erro real:
 * "Received: undefined"). Corrigido para gravar de verdade no banco.
 */
Given('o dia de vencimento é {string}', async function (this: import('../support/world').CustomWorld, paymentDay: string) {
  expect(this.rentalId, 'nenhuma locação foi criada ainda (this.rentalId vazio)').toBeTruthy();
  await this.updateRental(this.rentalId!, { rent_due_day: parseInt(paymentDay, 10) });

  this.testData = {
    ...this.testData,
    rental: { ...this.testData?.rental, paymentDay }
  };
});

/**
 * ⚠️ Consertado em 10/set/2026 (issue #76 -- falsos positivos).
 *
 * Era um MOCK: só anotava a data num objeto em memória, sem criar locação
 * nenhuma. O cenário "Encerrar locação antecipadamente" rodava inteiro em cima
 * do nada -- e o passo final ("os pagamentos após X devem ser cancelados")
 * também não conferia nada, então ninguém percebia.
 */
Given('que existe uma locação ativa com término em {string}', async function(endDate: string) {
  const [dia, mes, ano] = endDate.split('/');
  await criarLocacaoAtivaDeTeste(this, 2500, { fim: `${ano}-${mes}-${dia}` });
});

/**
 * Cobertura do bug reportado pelo Cadu em 11/set/2026: o filtro de Status
 * da lista de Locações não filtrava direito -- "Ativo" mostrava locações
 * encerradas junto, e "Encerrado" não achava nenhuma.
 *
 * Causa raiz (ver rentalService.ts mapRentalData): a rescisão só atualiza
 * a coluna `status` da locação para "ended", nunca a coluna `is_active` --
 * que ficava travada em `true` pra sempre. A tela usava `is_active` pra
 * filtrar e `status` pra mostrar o selo colorido, então as duas coisas
 * discordavam. O cenário abaixo recria esse exato estado (status="ended"
 * com is_active forçado para `true`) pra provar que a tela agora decide
 * tudo pelo `status`, e não regride pra confiar em `is_active` de novo.
 */
Given('que existe uma locação ativa do cenário', async function (this: any) {
  const rental = await criarLocacaoAtivaDeTeste(this, 1800);
  this.testData = { ...this.testData, locacaoAtivaId: rental.id };
});

Given('que existe uma locação encerrada do cenário', async function (this: any) {
  const rental = await criarLocacaoAtivaDeTeste(this, 1900);
  await this.updateRental(rental.id, { status: 'ended', is_active: true });
  this.testData = { ...this.testData, locacaoEncerradaId: rental.id };
});

Then('o filtro de Status está com {string} selecionado', async function (this: any, opcao: string) {
  await expect(this.page.locator('#rentals-status-filter')).toContainText(opcao);
});

When('seleciono o filtro de Status {string}', async function (this: any, opcao: string) {
  await this.page.locator('#rentals-status-filter').click();
  await this.page.getByRole('option', { name: opcao, exact: true }).click();
});

Then('vejo a locação ativa do cenário na lista', async function (this: any) {
  await expect(this.page.locator(`[data-row-id="${this.testData.locacaoAtivaId}"]`)).toBeVisible();
});

Then('NÃO vejo a locação ativa do cenário na lista', async function (this: any) {
  await expect(this.page.locator(`[data-row-id="${this.testData.locacaoAtivaId}"]`)).toHaveCount(0);
});

Then('vejo a locação encerrada do cenário na lista', async function (this: any) {
  await expect(this.page.locator(`[data-row-id="${this.testData.locacaoEncerradaId}"]`)).toBeVisible();
});

Then('NÃO vejo a locação encerrada do cenário na lista', async function (this: any) {
  await expect(this.page.locator(`[data-row-id="${this.testData.locacaoEncerradaId}"]`)).toHaveCount(0);
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
  // ⚠️ Corrigido em 17/set/2026 (issue #99): "value" vem do Gherkin em
  // formato de máquina ("2500.00") -- ver comentário completo em
  // `expectPaymentAmount` mais abaixo. O parser brasileiro multiplicava
  // por 100 (virava R$ 250.000,00).
  const amount = parseFloat(value);

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

/**
 * ⚠️ Adicionado em 16/set/2026 -- os cenários de "Editar locação" que
 * testam a regra "mês presente e futuros são atualizados, meses passados
 * não" usavam meses fixos no calendário (Novembro/2025, Dezembro/2025,
 * Março/2026) mais um "edito a locação em 15/02/2026" que só existia para
 * as ASSERÇÕES do teste saberem o que é "passado" -- o sistema de verdade
 * nunca soube dessa data falsa, sempre usa a data real do relógio
 * (`new Date()`). Isso funcionava só enquanto "hoje" (no relógio real)
 * ainda fosse antes de fevereiro/2026; a partir daí os três meses viravam
 * todos passado de verdade, e o cenário ficava sempre errado -- exatamente
 * o defeito que apareceu no CI de 16/set/2026 (Março/2026 recebeu o valor
 * antigo, não o novo, porque em setembro/2026 março já é passado há
 * meses). Trocado por meses RELATIVOS ao dia em que o teste realmente
 * roda, para nunca "vencer".
 */
function mesRelativo(offsetMeses: number): { mesNumero: string; ano: string } {
  const hoje = new Date();
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + offsetMeses, 1);
  return {
    mesNumero: String(alvo.getMonth() + 1).padStart(2, '0'),
    ano: String(alvo.getFullYear()),
  };
}

Given('existe um recebimento pendente de {int} meses atrás com valor de {string}', async function (this: any, meses: number, value: string) {
  const { mesNumero, ano } = mesRelativo(-meses);
  await upsertMonthlyPayment(this, `passado${meses}`, mesNumero, ano, 'Pendente', value);
});

Given('existe um recebimento pendente do mês atual com valor de {string}', async function (this: any, value: string) {
  const { mesNumero, ano } = mesRelativo(0);
  await upsertMonthlyPayment(this, 'atual', mesNumero, ano, 'Pendente', value);
});

Given('existe um recebimento pendente daqui a {int} meses com valor de {string}', async function (this: any, meses: number, value: string) {
  const { mesNumero, ano } = mesRelativo(meses);
  await upsertMonthlyPayment(this, `futuro${meses}`, mesNumero, ano, 'Pendente', value);
});

Then('o recebimento de {int} meses atrás deve manter {string}', async function (this: any, meses: number, value: string) {
  const { mesNumero, ano } = mesRelativo(-meses);
  await expectPaymentAmount(this, mesNumero, ano, value);
});

Then('o recebimento do mês atual deve ser atualizado para {string}', async function (this: any, value: string) {
  const { mesNumero, ano } = mesRelativo(0);
  await expectPaymentAmount(this, mesNumero, ano, value);
});

Then('o recebimento de {int} meses no futuro deve ser atualizado para {string}', async function (this: any, meses: number, value: string) {
  const { mesNumero, ano } = mesRelativo(meses);
  await expectPaymentAmount(this, mesNumero, ano, value);
});

Given('existe um recebimento pendente para o mês que vem com valor de {string}', async function (this: any, value: string) {
  const { mesNumero, ano } = mesRelativo(1);
  await upsertMonthlyPayment(this, 'proximoMes', mesNumero, ano, 'Pendente', value);
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

// ⚠️ Corrigido em 16/set/2026: a asserção antiga ("o valor tem que ser
// MENOR que o aluguel cheio") parte de uma premissa falsa. O cenário usa
// "hoje + 3 dias" como data fim antiga (ver step "uma locação ativa cujo
// contrato está para vencer..."), e a nova data fim (+1 ano) herda o MESMO
// dia do mês. Quando esse dia cai no dia 30 (ou além, em mês de 31 dias),
// o valor proporcional (aluguel/30 * dias) BATE ou PASSA o valor cheio --
// matematicamente correto (cobra o mês quase inteiro/inteiro), mas fazia
// este cenário falhar sozinho dependendo só de QUANDO o CI rodava (bug no
// teste, não no produto -- ver #99). Agora a asserção calcula o valor
// esperado de verdade (mesma fórmula usada em generateExpectedPayments,
// paymentService.ts) a partir do dia real da nova data fim, em vez de
// assumir que ele nunca chega em 30.
Then(
  'o último recebimento deve ser proporcional aos dias até a nova data fim',
  async function (this: import('../support/world').CustomWorld) {
    const DatabaseHelper = (await import('../helpers/database.helper')).default;
    const payments = await DatabaseHelper.getPaymentsByRental(this.rentalId);
    const ordenados = [...payments].sort((a: any, b: any) => String(a.due_date).localeCompare(String(b.due_date)));
    const ultimo = ordenados[ordenados.length - 1];

    const novaData = new Date(this.testData.renovacao.newEndDate + 'T00:00:00');
    const diaFim = novaData.getDate();
    const rentValue = this.testData.renovacao.rentValue;
    const valorEsperado = parseFloat(((rentValue / 30) * diaFim).toFixed(2));

    expect(Number(ultimo.expected_amount)).toBeGreaterThan(0);
    expect(
      Number(ultimo.expected_amount),
      `último recebimento deveria ser proporcional a ${diaFim} dia(s) (R$ ${valorEsperado.toFixed(2)}), veio R$ ${ultimo.expected_amount}`
    ).toBeCloseTo(valorEsperado, 2);
  }
);

// ============================================================================
// LOCAÇÃO COM A DATA FIM VENCIDA (issue #91, 07/set/2026)
//
// Até 07/set/2026 existiam DUAS travas: (1) um serviço rodava sozinho e
// encerrava a locação só porque a data fim passou (liberando o imóvel sem
// ninguém conferir), e (2) a tela escondia todos os botões de ação da
// locação vencida. Estes passos protegem as duas correções de uma vez: a
// locação segue "active" no banco com o imóvel ainda "rented", e a tela
// mostra o aviso "Vencido" sem tirar nenhum botão.
// ============================================================================

Given('uma locação ativa cuja data fim já passou', async function (this: import('../support/world').CustomWorld) {
  const sufixo = Date.now();
  const tenant = await this.createTenant({ name: `Vencida E2E ${sufixo}` });

  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setFullYear(inicio.getFullYear() - 1);
  inicio.setDate(inicio.getDate() - 10);

  // 10 dias no passado: exatamente o caso real -- o contrato acabou e o
  // inquilino ainda não respondeu se renova ou desocupa.
  const fimVencido = new Date(hoje);
  fimVencido.setDate(fimVencido.getDate() - 10);

  const rental = await this.createRental({
    start_date: inicio.toISOString().split('T')[0],
    end_date: fimVencido.toISOString().split('T')[0],
    rent_value: 1500,
    tenant_id: tenant.id,
  } as any);

  // O imóvel precisa estar ocupado: o bug antigo liberava ele sozinho.
  // ⚠️ "occupied" é o status do IMÓVEL; "rented" é o do INQUILINO -- a
  // constraint properties_status_check só aceita available/occupied/
  // unavailable. Escrevi "rented" aqui na primeira versão e o CI pegou.
  const { supabaseAdmin } = await import('../helpers/database.helper');
  const { error: erroOcupar } = await supabaseAdmin
    .from('properties')
    .update({ status: 'occupied' })
    .eq('id', rental.property_id);

  if (erroOcupar) {
    throw new Error(`não consegui deixar o imóvel como ocupado: ${erroOcupar.message}`);
  }

  this.rentalId = rental.id;
  this.testData = {
    ...this.testData,
    vencida: {
      tenantName: tenant.name,
      propertyId: rental.property_id,
      endDate: fimVencido.toISOString().split('T')[0],
    },
  };
});

When('abro a tela de Locações e procuro por essa locação', async function (this: import('../support/world').CustomWorld) {
  await this.page.goto('/rentals');
  await this.page.waitForLoadState('domcontentloaded');

  const busca = this.page.locator('#rentals-search-input');
  await busca.fill(this.testData.vencida.tenantName);
  await this.page.waitForTimeout(800);
});

Then('o status dela deve aparecer como {string}', async function (this: import('../support/world').CustomWorld, statusEsperado: string) {
  await expect(
    this.page.getByText(statusEsperado, { exact: true }).first(),
    `a locação com data fim vencida deveria mostrar o aviso "${statusEsperado}" na coluna Status`
  ).toBeVisible({ timeout: 10000 });
});

Then(
  'os botões {string}, {string} e {string} devem estar disponíveis',
  async function (this: import('../support/world').CustomWorld, _b1: string, _b2: string, _b3: string) {
    // Os três botões que sumiam junto com a data fim. Os ids são fixos por
    // locação (ver src/pages/rentals.tsx).
    for (const id of ['renew', 'terminate', 'delete']) {
      await expect(
        this.page.locator(`#rentals-${id}-${this.rentalId}`),
        `o botão "${id}" sumiu da locação vencida -- é exatamente o bug da issue #91`
      ).toBeVisible({ timeout: 10000 });
    }
  }
);

Then('o status dela no banco deve continuar {string}', async function (this: import('../support/world').CustomWorld, statusEsperado: string) {
  const { supabaseAdmin } = await import('../helpers/database.helper');
  const { data: rental } = await supabaseAdmin.from('rentals').select('status').eq('id', this.rentalId).single();

  expect(
    rental?.status,
    `a locação foi encerrada sozinha só porque a data fim passou -- o encerramento automático voltou (issue #91)`
  ).toBe(statusEsperado);
});

Then('o imóvel dela deve continuar {string}', async function (this: import('../support/world').CustomWorld, statusEsperado: string) {
  const { supabaseAdmin } = await import('../helpers/database.helper');
  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('status')
    .eq('id', this.testData.vencida.propertyId)
    .single();

  expect(
    property?.status,
    'o imóvel foi liberado sozinho antes de alguém encerrar a locação de verdade -- risco de dupla ocupação (issue #91)'
  ).toBe(statusEsperado);
});

// ⚠️ Corrigido em 17/set/2026 (issue #99, cluster Locação/Pagamento): este
// passo era um STUB -- só guardava a tabela do Gherkin em `testData` e
// nunca criava locação nem parcela nenhuma no banco. O passo seguinte
// ("abro a locação em modo Visualizar") clicava num seletor
// `[data-testid="rental-card"]` que também NUNCA existiu em nenhum
// componente da tela (conferido: zero ocorrências em src/) -- ou seja, o
// clique ficava esperando um elemento que jamais apareceria até o próprio
// timeout do Playwright (30s), maior que o timeout padrão do Cucumber
// (20s), sobrando só o genérico "function timed out". Agora o passo cria
// de verdade uma locação com um inquilino identificável e substitui as
// parcelas padrão (criadas por createRental com valores genéricos) pelas
// parcelas exatas da tabela do cenário.
Given('que existe uma locação com caução parcelado em 3x:', async function (this: CustomWorld, dataTable: any) {
  const installments = dataTable.hashes();
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  const { supabaseAdmin } = await import('../helpers/database.helper');

  const tenant = await this.createTenant({ name: `Caução 3x ${Date.now()}` });
  const rental = await this.createRental({
    tenant_id: tenant.id,
    deposit_installments: installments.length,
  });
  this.rentalId = rental.id;
  this.tenantName = tenant.name;

  // Apaga as parcelas-padrão (valores/datas genéricos) e recria com os
  // valores exatos da tabela do Gherkin (Valor, Data Vencimento, Código PIX).
  await supabaseAdmin.from('deposit_installments').delete().eq('rental_id', rental.id);
  for (const row of installments) {
    const [numero, total] = row.Parcela.split('/').map(Number);
    const [dia, mes, ano] = row['Data Vencimento'].split('/');
    await DatabaseHelper.createDepositInstallment({
      rental_id: rental.id,
      installment_number: numero,
      installment_total: total,
      amount: parseFloat(row.Valor),
      due_date: `${ano}-${mes}-${dia}`,
      pix_code: row['Código PIX'] || undefined,
    });
  }

  this.testData = {
    ...this.testData,
    depositInstallments: installments,
  };
});

// ==================== AÇÕES ====================

/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99): este passo era um STUB -- só
 * um `waitForTimeout`, nunca selecionava (nem tentava selecionar) nenhum
 * imóvel. O cenário original ("seleciono um imóvel que está 'Ocupado'" +
 * "devo ver uma mensagem de erro") nunca teve como passar de verdade,
 * porque a interação que ele descreve não existe na tela: lendo
 * RentalFormDialog.tsx, `propertiesToDisplay` já usa `availableProperties`
 * (não `properties`) pra uma locação NOVA -- ou seja, um imóvel "Ocupado"
 * nem aparece como opção no dropdown pra começo de conversa. Não existe
 * "selecionar e ver erro"; a regra real é "nunca aparece pra selecionar".
 * Ver o cenário reescrito em 7-locacoes-regras.feature.
 */
Given('que existe um imóvel ocupado do cenário', async function (this: CustomWorld) {
  const identificador = `[E2E] Ocupado ${Date.now()}`;
  await this.createProperty({ complement: identificador, status: 'occupied' });
  this.testData = { ...this.testData, imovelOcupadoComplemento: identificador };
});

Then('o imóvel ocupado do cenário NÃO deve aparecer para seleção', async function (this: CustomWorld) {
  const complemento = this.testData?.imovelOcupadoComplemento;
  expect(complemento, 'nenhum imóvel ocupado foi criado pelo cenário (rode o Given antes)').toBeTruthy();

  const complementoEscapado = complemento.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await this.page.locator('#rental-property').click();
  await this.page.waitForTimeout(300);
  await expect(this.page.getByRole('option', { name: new RegExp(complementoEscapado, 'i') })).toHaveCount(0);
  await this.page.keyboard.press('Escape');
});

When('NÃO preencho o valor da caução', async function() {
  // Não fazer nada - deixar campo vazio
  await this.page.waitForTimeout(100);
});

/**
 * ⚠️ Corrigido em 16/set/2026: mesmo defeito já documentado em "não devo
 * poder continuar" (14/set/2026) -- o botão de submit do formulário de
 * Locação nunca se chama "Salvar" (é "Criar Locação"/"Atualizar Locação"),
 * então `getByRole('button', {name: /salvar/i})` nunca encontrava nada.
 * Sem `.catch()` em volta, o `.click()` ficava esperando o elemento
 * aparecer até estourar o timeout do PRÓPRIO Cucumber (20s) -- por isso o
 * erro real era só "function timed out", nunca um "elemento não encontrado"
 * mais claro. Só a irmã ("não devo poder continuar") tinha sido corrigida;
 * esta, que roda ANTES dela no mesmo cenário, tinha ficado pra trás.
 */
When('tento salvar', async function(this: import('../support/world').CustomWorld) {
  await this.page.locator('#rental-form-submit').click();
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

/**
 * ⚠️ Corrigido em 16/set/2026: os 6 ids usados aqui (`deposit-installment-1-amount`,
 * `deposit-payment-date`, `deposit-installment-2-amount`, etc.) NUNCA
 * existiram na tela -- conferido em RentalFormDialog.tsx, os campos reais são
 * `#rental-deposit-amount`, `#rental-deposit-date`, `#depositInstallment2`,
 * `#depositInstallment2PaymentDate`, `#depositInstallment3` e
 * `#depositInstallment3PaymentDate`. Como o passo só preenche quando
 * `input.isVisible()` dá certo (sem lançar erro quando não acha nada), esse
 * passo era um no-op silencioso toda vez que era chamado -- nenhum dos
 * cenários que usam "E preencho:" pra caução parcelada realmente preenchia a
 * 2ª/3ª parcela. Isso não só deixava valores errados no banco como também
 * bloqueava o próprio salvamento: RentalFormDialog.tsx recusa salvar com
 * "Preencha o valor da 2ª/3ª parcela" quando esses campos ficam vazios --
 * ou seja, "salvo a locação" nem chegava a criar a locação de verdade, e os
 * passos seguintes acabavam checando uma locação antiga qualquer (a mais
 * recente do banco), não a deste cenário.
 */
When('preencho:', async function(dataTable: any) {
  const rows = dataTable.hashes();

  for (const row of rows) {
    const field = row.campo;
    const value = row.valor;

    // Identificar o campo pelo label
    let inputId = '';

    if (field.includes('1ª parcela - Valor')) {
      inputId = 'rental-deposit-amount';
    } else if (field.includes('1ª parcela - Data Pagamento')) {
      inputId = 'rental-deposit-date';
    } else if (field.includes('2ª parcela - Valor')) {
      inputId = 'depositInstallment2';
    } else if (field.includes('2ª parcela - Data Vencimento')) {
      inputId = 'depositInstallment2PaymentDate';
    } else if (field.includes('3ª parcela - Valor')) {
      inputId = 'depositInstallment3';
    } else if (field.includes('3ª parcela - Data Vencimento')) {
      inputId = 'depositInstallment3PaymentDate';
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

/**
 * ⚠️ Corrigido em 15/set/2026 (issue #99, confirmado pelo CI run
 * 34928289217, erro real: "invalid input syntax for type uuid:
 * 'undefined'"): este passo cria a locação PELA TELA, mas nunca guardava
 * o id em `this.rentalId` -- passos seguintes que conferem dados no banco
 * (ex.: "no banco de dados a parcela 1 deve ter:") ficavam sem saber QUAL
 * locação olhar. Como o Cucumber roda um cenário de cada vez (nunca em
 * paralelo nesta suíte), a locação mais recente do banco, logo após
 * salvar, é sempre a que acabou de ser criada aqui.
 */
When('salvo a locação', async function (this: import('../support/world').CustomWorld) {
  // O botão do formulário de Locação diz "Criar" (nova) ou "Atualizar"
  // (edição), nunca "Salvar" -- por isso pelo id.
  await this.page.locator('#rental-form-submit').click();
  await this.page.waitForTimeout(2000);

  const rental = await this.getMostRecentRental();
  if (rental) {
    this.rentalId = rental.id;
  }
});

/**
 * ✅ Criado em 14/set/2026 (issue #99, decisão #2 do Cadu: caução é
 * opcional na criação). Ao criar (não editar) uma locação PELA TELA, o
 * Comprovante de Contrato (RentalContract.tsx) abre sozinho por cima do
 * formulário assim que salva com sucesso -- é esse diálogo que confirma
 * que a criação funcionou (mesmo padrão já usado em "que crio uma locação
 * com:", payments.steps.ts). Depois de fechar, confere que não sobrou
 * nenhum aviso de erro sobre caução -- a mensagem "Caução é obrigatória"
 * nunca existiu no código (RentalFormDialog.tsx só valida Imóvel,
 * Inquilino, Data início e Dia de vencimento), mas a asserção fica aqui
 * como rede de segurança caso alguém adicione essa checagem no futuro.
 */
Then('a locação deve ser criada com sucesso', async function (this: import('../support/world').CustomWorld) {
  const comprovante = this.page.getByRole('dialog').filter({ hasText: 'Comprovante de Contrato' });
  await expect(comprovante, 'a locação não foi criada -- o Comprovante de Contrato não abriu').toBeVisible({ timeout: 15000 });
  await comprovante.getByRole('button', { name: /fechar/i }).click();

  await expect(this.page.getByText(/caução é obrigatória/i)).toHaveCount(0);
});

/**
 * ✅ Criado em 15/set/2026 (issue #99, cenário "Criar locação - Corretor
 * parceiro" reescrito). Confere no banco -- não na tela -- porque o
 * formulário de Locação não mostra mais nenhum campo extra quando o
 * checkbox "Corretor Parceiro?" é marcado (ver comentário no .feature).
 */
Then('a locação criada tem corretor parceiro marcado', async function (this: import('../support/world').CustomWorld) {
  expect(this.rentalId, 'nenhuma locação foi criada neste cenário ainda (this.rentalId vazio)').toBeTruthy();
  const rental = await this.getRental(this.rentalId!);
  expect(rental.has_partner_broker, 'a locação foi criada com "Corretor Parceiro?" marcado na tela, mas o banco gravou has_partner_broker=false').toBe(true);
});

// Observação: o step "crio uma locação com:" (usado pela feature 10-caucoes)
// vive em deposits.steps.ts, que cria a locação de verdade via
// DatabaseHelper — não duplicar aqui (causa "ambiguous step" no Cucumber).

// ⚠️ Corrigido em 17/set/2026 (issue #99): ver comentário no Given "que
// existe uma locação com caução parcelado em 3x:" -- o seletor
// `[data-testid="rental-card"]` nunca existiu na tela (rentals.tsx usa
// `onRowClick`/`onClick` em `SortableTable`/cards comuns, sem esse
// testid), e clicar no "primeiro" também arriscava abrir uma locação
// qualquer em vez da criada por este cenário (o banco de DEV acumula
// locações de outros testes). Agora navega pra /rentals e clica na linha
// do INQUILINO desta locação (this.tenantName, guardado pelo Given) --
// mesmo padrão de escopo já usado em outros passos (ex.: "abro o
// inquilino {string} para edição"). Clicar na linha chama sempre
// handleViewRental -- ou seja, sempre abre em modo Visualização; o
// parâmetro "modo" existe só pra deixar o Gherkin legível.
When('abro a locação em modo {string}', async function (this: CustomWorld, _mode: string) {
  await this.page.goto('/rentals');
  await this.page.waitForLoadState('domcontentloaded');
  const nome = this.tenantName;
  if (!nome) {
    throw new Error('Nenhuma locação foi criada neste cenário ainda (this.tenantName vazio) -- não dá pra saber qual linha abrir.');
  }
  const linha = this.page.getByText(nome).first();
  await expect(linha, `não encontrei na lista de Locações nenhuma linha do inquilino "${nome}"`).toBeVisible({ timeout: 10000 });
  await linha.click();
  await this.page.waitForTimeout(500);
});

/**
 * ⚠️ Consertado em 08/set/2026 (issue #95).
 *
 * Estes passos procuravam um botão "Editar" na tela em que o navegador
 * estivesse -- sem nunca ir para Locações nem achar a locação do cenário.
 * Como o `Dado` anterior cria a locação direto no banco (rápido, sem passar
 * pela tela), o navegador continuava parado no Painel: o botão nunca
 * aparecia e o passo estourava os 20s.
 *
 * O caminho real da edição é: abrir a locação (clique na linha, que abre em
 * modo Visualizar) e então clicar em "Editar" (#rental-form-edit) dentro do
 * diálogo -- não existe botão de editar direto na listagem.
 */
async function abrirLocacaoDoCenarioParaEdicao(world: any) {
  const nomeInquilino = world.testData?.rental?.tenantName;
  if (!nomeInquilino) {
    throw new Error(
      'nenhuma locação de teste foi criada -- falta o passo "Dado que existe uma locação ativa"'
    );
  }

  await world.page.goto('/rentals');
  await world.page.waitForLoadState('domcontentloaded');

  // A locação vem do banco: filtra pelo inquilino do cenário para não
  // esbarrar em nenhum outro registro da lista.
  await world.page.locator('#rentals-search-input').fill(nomeInquilino);
  await world.page.waitForTimeout(800);

  await world.page.getByText(nomeInquilino).first().click();
  await world.page.waitForTimeout(800);

  const botaoEditar = world.page.locator('#rental-form-edit');
  await botaoEditar.click();
  await world.page.waitForTimeout(500);
}

/**
 * O valor do aluguel pertence ao IMÓVEL, não à locação -- por isso o setup
 * mexe no imóvel. A AÇÃO que o cenário testa (salvar a locação e ver os
 * recebimentos se ressincronizarem) continua sendo feita pela tela.
 */
When('o valor do imóvel dessa locação muda para {string}', async function (this: any, novoValor: string) {
  // ⚠️ Corrigido em 17/set/2026 (issue #99): "novoValor" vem do Gherkin em
  // formato de máquina ("2800.00") -- ver comentário completo em
  // `expectPaymentAmount` mais abaixo. O parser brasileiro gravava
  // R$ 280.000,00 de verdade na tabela `properties`, e a locação (de
  // verdade, pela tela) recalculava os recebimentos futuros nesse valor
  // inflado.
  const valor = parseFloat(novoValor);
  const { supabaseAdmin } = await import('../helpers/database.helper');

  const { data: locacao, error: erroBusca } = await supabaseAdmin
    .from('rentals')
    .select('property_id')
    .eq('id', this.rentalId)
    .single();

  if (erroBusca || !locacao?.property_id) {
    throw new Error(`não achei o imóvel da locação do cenário: ${erroBusca?.message ?? 'sem property_id'}`);
  }

  const { error: erroUpdate } = await supabaseAdmin
    .from('properties')
    .update({ value: valor })
    .eq('id', locacao.property_id);

  if (erroUpdate) {
    throw new Error(`não consegui mudar o valor do imóvel: ${erroUpdate.message}`);
  }

  this.testData = { ...this.testData, novoValorDoImovel: valor };
});

When('edito a locação', async function () {
  await abrirLocacaoDoCenarioParaEdicao(this);
});

When('edito a locação em {string}', async function (date: string) {
  // Guarda a data que o cenário considera "hoje" -- usada nas asserções
  // sobre quais recebimentos podem ou não ser alterados.
  this.testData = { ...this.testData, currentDate: date };
  await abrirLocacaoDoCenarioParaEdicao(this);
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

/**
 * ⚠️ Consertado em 09/set/2026 (issue #95): os dois passos usavam
 * seletores por texto/parcial que não batiam com a tela real.
 *
 *  • a garagem: `[id*="garage"]` é ambíguo e o clique ia num texto solto;
 *    os ids reais são #rental-has-garage (a caixinha) e
 *    #rental-garage-value (o campo);
 *  • salvar: procurava um botão /salvar/i, mas no formulário de Locação o
 *    botão se chama "Atualizar Locação" (ou "Criar Locação") -- id fixo
 *    #rental-form-submit. Por isso estourava os 20s.
 */
When('altero a garagem para {string}', async function (value: string) {
  const caixaGaragem = this.page.locator('#rental-has-garage');

  // Só marca se ainda não estiver marcada -- clicar de novo desmarcaria.
  const jaMarcada = await caixaGaragem.getAttribute('aria-checked');
  if (jaMarcada !== 'true') {
    await caixaGaragem.click();
    await this.page.waitForTimeout(300);
  }

  await this.page.locator('#rental-garage-value').fill(value);
});

/**
 * ⚠️ Corrigido em 13/set/2026 (issue #99, cluster "trava ao editar
 * Locação" -- afeta as 4 cenários que usam este passo).
 *
 * Causa raiz real (lida direto em RentalFormDialog.tsx, handleSubmit,
 * ramo de EDIÇÃO): salvar uma edição de Locação NÃO fecha o formulário na
 * hora. Primeiro aparece um aviso de sucesso ("Locação atualizada com
 * sucesso.") -- só quando esse aviso é fechado no botão OK (onConfirm) é
 * que o formulário fecha de verdade, 250ms depois. O passo só clicava em
 * "Atualizar Locação" e ficava esperando o botão sumir sozinho, sem nunca
 * clicar em OK -- por isso travava nos 15s esperando um fechamento que
 * dependia de um clique que nunca vinha. O mesmo padrão (achar o
 * alertdialog e clicar em OK) já existe em common.steps.ts, no passo
 * "fecho a mensagem de sucesso no botão OK" -- usado aqui porque salvar
 * uma edição de Locação SEMPRE passa por esse aviso, não é opcional.
 */
When('salvo as alterações', async function () {
  await this.page.locator('#rental-form-submit').click();

  const alerta = this.page.getByRole('alertdialog');
  await expect(alerta, 'o aviso de sucesso não apareceu depois de salvar a locação').toBeVisible({ timeout: 15000 });
  await alerta.getByRole('button', { name: /^OK$/i }).click();

  // A gravação mexe em locação + recebimentos: espera o diálogo fechar,
  // em vez de torcer por um tempo fixo.
  await expect(this.page.locator('#rental-form-submit')).toBeHidden({ timeout: 15000 });
  await this.page.waitForTimeout(1000);
});

When('visualizo o {string}', async function(documentName: string) {
  const button = this.page.getByRole('button', { name: new RegExp(documentName, 'i') });
  await button.click();
  await this.page.waitForTimeout(1000);
});

/**
 * ⚠️ Corrigido em 13/set/2026 (issue #99, cluster "Locações"): a locação do
 * cenário "Encerrar locação antecipadamente" é criada DIRETO NO BANCO
 * (criarLocacaoAtivaDeTeste), depois da página "/rentals" já ter carregado
 * no Contexto -- a lista em tela nunca foi atualizada, então o botão
 * "Rescisão de Contrato" clicado a seguir não existia (ou era de outra
 * linha). Mesma classe de bug já corrigida em outros cenários (recarregar
 * e filtrar pelo inquilino do teste antes de agir na linha).
 */
When('volto para a lista de locações', async function (this: import('../support/world').CustomWorld) {
  await this.page.goto('/rentals');
  await this.page.waitForLoadState('domcontentloaded');
  const nomeInquilino = this.testData?.rental?.tenantName;
  if (nomeInquilino) {
    await this.page.locator('#rentals-search-input').fill(nomeInquilino);
    await this.page.waitForTimeout(800);
  }
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

/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99, 2ª rodada): o clique em
 * "Confirmar Rescisão" nunca falhava, mas a data de término no banco
 * continuava a antiga -- a rescisão simplesmente não executava. Causa
 * raiz, lida em RentalTerminationDialog.tsx: TODA locação criada pelos
 * testes (DatabaseHelper.createRental) já nasce com uma parcela de
 * caução "pending" -- e quando existe caução pendente/parcial,
 * handleConfirm() não executa a rescisão na hora, abre um SEGUNDO
 * diálogo perguntando "quer mesmo continuar?" (id
 * "termination-deposit-warning-dialog", botão "Sim"). Sem responder esse
 * segundo diálogo, a rescisão nunca acontecia de verdade -- só o diálogo
 * original fechava, dando a falsa impressão de que tinha ido tudo bem.
 */
When('confirmo o encerramento', async function(this: import('../support/world').CustomWorld) {
  const confirmButton = this.page.getByRole('button', { name: /confirmar/i });
  await confirmButton.click();
  await this.page.waitForTimeout(500);

  const avisoCaucao = this.page.locator('#termination-deposit-warning-yes');
  if (await avisoCaucao.isVisible({ timeout: 3000 }).catch(() => false)) {
    await avisoCaucao.click();
  }
  await this.page.waitForTimeout(2000);
});

// ==================== VALIDAÇÕES ====================

/**
 * ⚠️ Corrigido em 14/set/2026: o botão de submit do formulário de Locação
 * (#rental-form-submit) só fica desabilitado enquanto uma requisição está
 * em andamento (`disabled={loading}` em RentalFormDialog.tsx) -- nunca por
 * causa de campo obrigatório faltando (a validação acontece DENTRO do
 * clique: mostra um alerta e não segue adiante, sem nunca desabilitar o
 * botão antes). Além disso, o botão real nunca se chama "Salvar" (é "Criar
 * Locação"/"Atualizar Locação"), então `getByRole('button', {name:
 * /salvar/i})` nunca encontrava nada -- e o `.catch(() => true)` escondia
 * isso, fazendo este passo sempre "passar" mesmo sem checar nada de
 * verdade. O jeito certo de conferir "não deixou continuar" é: o
 * formulário continua aberto (não fechou/navegou) -- ou seja, a locação
 * não foi criada.
 */
Then('não devo poder continuar', async function (this: import('../support/world').CustomWorld) {
  await expect(
    this.page.locator('#rental-form-submit'),
    'o formulário fechou -- a locação foi criada mesmo com campo obrigatório faltando'
  ).toBeVisible();
});

/**
 * ⚠️ Corrigido em 16/set/2026: buscava o texto da parcela (ex.: "1/3") solto
 * na página inteira com `getByText` -- como o banco de DEV acumula meses de
 * parcelas de caução de outras locações, "1/3" (e "2000.00", etc.) aparece em
 * dezenas de linhas da tabela, e o Playwright recusa com "strict mode
 * violation" (achou 38 elementos num teste real). Cada linha da tabela em
 * DepositInstallmentsTable.tsx já tem os atributos `data-rental` e
 * `data-installment` (colocados lá justamente pra servir de gancho de teste)
 * -- agora usamos os dois pra escopar a checagem só na parcela desta locação
 * específica, criada por este cenário (`this.rentalId`).
 */
Then('na aba {string} da página Financeiro devo ver:', async function(this: import('../support/world').CustomWorld, tabName: string, dataTable: any) {
  const rows = dataTable.hashes();

  // Navegar para Financial
  await this.page.goto('/financial');
  await this.page.waitForLoadState('domcontentloaded');

  // Clicar na aba
  const tab = this.page.getByRole('tab', { name: new RegExp(tabName, 'i') });
  await tab.click();
  await this.page.waitForTimeout(1000);

  for (const row of rows) {
    const numeroParcela = parseInt(String(row.Parcela).split('/')[0], 10);
    const linha = this.page.locator(
      `tr[data-rental="${this.rentalId}"][data-installment="${numeroParcela}"]`
    );
    await expect(
      linha,
      `não achei a linha da parcela ${row.Parcela} desta locação na aba "${tabName}"`
    ).toBeVisible({ timeout: 10000 });

    for (const [campo, valor] of Object.entries(row) as [string, string][]) {
      // Parcela já foi conferida pelo próprio data-installment usado no
      // seletor acima; "(vazio)" na tabela do Gherkin vira "-" na tela (não
      // vale a pena comparar um traço solto, ambíguo demais).
      if (campo === 'Parcela' || valor === '(vazio)') continue;

      // ⚠️ Corrigido em 16/set/2026: a coluna "Valor" no Gherkin vem em
      // formato de máquina ("2000.00"), mas a tela mostra moeda brasileira
      // ("R$ 2.000,00") -- "2000.00" nunca é substring de "2.000,00", então
      // todo cenário com Valor de 4+ dígitos falhava aqui mesmo estando
      // certo. Campos de dinheiro comparam por número; o resto, por texto.
      //
      // ⚠️ Corrigido de novo em 17/set/2026: o fix acima aplicou o parser de
      // formato BRASILEIRO (ponto = milhar, vírgula = decimal) em cima do
      // "valor" do Gherkin, que já vem em formato de MÁQUINA (ponto =
      // decimal, sem separador de milhar). `"2000.00".replace(/\./g,
      // '').replace(',', '.')` apagava o ponto decimal de verdade e virava
      // "200000" -- 100x maior que o esperado. Toda linha com valor de 4
      // dígitos (ex.: R$ 2.000,00) passava a "não bater com nada" mesmo
      // estando certa. O "valor" do Gherkin é só `parseFloat` direto; o
      // parser brasileiro continua servindo só pros números lidos da TELA
      // (textoDaLinha, que aí sim vem em "2.000,00").
      if (/valor/i.test(campo)) {
        const esperadoNumero = parseFloat(valor);
        const textoDaLinha = (await linha.textContent()) || '';
        const numerosNaLinha = [...textoDaLinha.matchAll(/-?[\d.]+,\d{2}/g)].map((m) =>
          parseFloat(m[0].replace(/\./g, '').replace(',', '.'))
        );
        expect(
          numerosNaLinha.some((n) => Math.abs(n - esperadoNumero) < 0.01),
          `linha da parcela ${row.Parcela}: nenhum valor monetário da linha bate com R$ ${esperadoNumero.toFixed(2)} (linha tem: ${textoDaLinha})`
        ).toBe(true);
        continue;
      }

      await expect(
        linha,
        `linha da parcela ${row.Parcela}: campo "${campo}" não bate com "${valor}"`
      ).toContainText(valor);
    }
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

/**
 * ⚠️ FALSO POSITIVO corrigido em 09/set/2026 (issue #76).
 *
 * O passo se chamava "no banco de dados a parcela X deve ter" e o corpo
 * era um `console.log` com o comentário "Por enquanto, apenas log". Ou
 * seja: prometia conferir o banco e não conferia nada -- passava sempre,
 * mesmo que a parcela de caução estivesse com data ou valor errado.
 *
 * Agora lê a parcela de verdade e compara campo a campo. Aceita data em
 * dd/mm/aaaa (como o cenário escreve) ou aaaa-mm-dd (como o banco guarda),
 * e "NULL"/"(preenchido)" para quando o cenário só quer saber se o campo
 * está vazio ou não.
 */
async function conferirParcelaDeCaucao(
  world: any,
  numeroDaParcela: number,
  esperado: Record<string, string>
) {
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  const parcelas = await DatabaseHelper.getDepositInstallments(world.rentalId);

  const parcela = parcelas.find((p: any) => p.installment_number === numeroDaParcela);
  expect(
    parcela,
    `não existe parcela ${numeroDaParcela} de caução nesta locação (achei ${parcelas.length})`
  ).toBeTruthy();

  const paraISO = (valor: string) => {
    const brasileira = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return brasileira ? `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}` : valor;
  };

  for (const [campo, valorEsperado] of Object.entries(esperado)) {
    const valorNoBanco = (parcela as any)[campo];

    if (/^null$/i.test(valorEsperado)) {
      expect(valorNoBanco, `parcela ${numeroDaParcela}: ${campo} deveria estar vazio`).toBeFalsy();
      continue;
    }

    if (/^\(preenchido\)$/i.test(valorEsperado)) {
      expect(valorNoBanco, `parcela ${numeroDaParcela}: ${campo} deveria estar preenchido`).toBeTruthy();
      continue;
    }

    // Campos de dinheiro comparam por número; o resto, por texto.
    if (/amount|valor|commission/i.test(campo)) {
      const esperadoNumero = parseFloat(valorEsperado.replace(/\./g, '').replace(',', '.'));
      expect(
        Number(valorNoBanco),
        `parcela ${numeroDaParcela}: ${campo} está R$ ${valorNoBanco}, esperava R$ ${esperadoNumero}`
      ).toBeCloseTo(esperadoNumero, 2);
    } else {
      expect(
        String(valorNoBanco ?? ''),
        `parcela ${numeroDaParcela}: ${campo} está "${valorNoBanco}", esperava "${valorEsperado}"`
      ).toContain(paraISO(valorEsperado));
    }
  }
}

/**
 * ⚠️ Corrigido em 16/set/2026 -- mesmo defeito já corrigido em
 * payments.steps.ts em 13/set/2026 (issue #99), só que aqui ninguém tinha
 * aplicado ainda: a tabela do Gherkin tem CABEÇALHO ("campo | valor"), mas
 * `dataTable.rowsHash()` não pula cabeçalho nenhum -- trata a própria linha
 * do cabeçalho como um par chave/valor, criando uma entrada fantasma
 * `{ campo: "valor" }`. Isso fazia este passo falhar SEMPRE (não às vezes)
 * com "campo está 'undefined', esperava 'valor'" -- nem chegava a comparar
 * due_date/payment_date de verdade. `dataTable.hashes()` + reduzir por
 * `campo`/`valor` respeita o cabeçalho corretamente.
 */
function paresCampoValor(dataTable: any): Record<string, string> {
  return Object.fromEntries(
    dataTable.hashes().map((row: any) => [row.campo, row.valor])
  );
}

Then('no banco de dados a parcela {int} deve ter:', async function (this: any, installmentNumber: number, dataTable: any) {
  await conferirParcelaDeCaucao(this, installmentNumber, paresCampoValor(dataTable));
});

Then('a parcela {int} deve ter:', async function (this: any, installmentNumber: number, dataTable: any) {
  await conferirParcelaDeCaucao(this, installmentNumber, paresCampoValor(dataTable));
});

// ⚠️ Adicionado em 17/set/2026 (issue #99): passo dedicado pro bloco
// "Informações do Caução" de RentalFormDialog.tsx -- diferente de "no
// bloco {string} devo ver:" (mais abaixo, usado por "Informações do
// Contrato"/"Formação de Valores"), aqui os valores estão dentro de
// campos de FORMULÁRIO (<input>), não em texto solto na tela -- por isso
// confere `.inputValue()` de cada id, em vez de `getByText`.
Then('no formulário da locação devo ver os campos de caução:', async function (this: CustomWorld, dataTable: any) {
  const rows = dataTable.hashes();
  for (const row of rows) {
    const campo = this.page.locator(`#${row.campo}`);
    await expect(campo, `campo #${row.campo} não está na tela`).toBeVisible({ timeout: 5000 });
    // toHaveValue tenta de novo por conta própria -- os campos são
    // preenchidos por um useEffect assíncrono (busca em deposit_installments,
    // ver useRentalForm.ts) que pode não ter terminado no instante do clique.
    await expect(campo, `campo #${row.campo} não tem o valor esperado`).toHaveValue(row.valor, { timeout: 10000 });
  }
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

/**
 * ⚠️ FALSO POSITIVO corrigido em 09/set/2026 (issue #76).
 *
 * Estes dois passos NÃO VERIFICAVAM NADA: o primeiro só guardava o valor
 * numa variável e o segundo só esperava meio segundo. Passavam sempre --
 * inclusive se o sistema não atualizasse recebimento nenhum, ou pior, se
 * ele estragasse os já pagos.
 *
 * E são justamente os passos que protegem a regra do reajuste de aluguel
 * (ver REGRAS_DE_NEGOCIO.md 2.3): ao salvar a locação, os recebimentos
 * pendentes/futuros passam a valer o valor novo, e os já pagos ficam
 * intocados, guardando o valor da época.
 */
Then('os pagamentos futuros devem ser atualizados para {string}', async function (this: any, value: string) {
  // ⚠️ Corrigido em 17/set/2026 (issue #99) -- mesma causa raiz de
  // `expectPaymentAmount` mais abaixo: "value" já vem em formato de
  // máquina do Gherkin.
  const esperado = parseFloat(value);
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  const recebimentos = await DatabaseHelper.getPaymentsByRental(this.rentalId);

  const pendentes = recebimentos.filter((p: any) => p.status !== 'paid');

  expect(
    pendentes.length,
    'a locação não tem nenhum recebimento pendente para conferir -- o cenário não provou nada'
  ).toBeGreaterThan(0);

  for (const recebimento of pendentes) {
    expect(
      Number(recebimento.expected_amount),
      `recebimento ${recebimento.reference_month}/${recebimento.reference_year} continuou em ` +
        `R$ ${recebimento.expected_amount} -- deveria ter passado para R$ ${esperado}`
    ).toBeCloseTo(esperado, 2);
  }

  this.testData = { ...this.testData, expectedFutureValue: value };
});

Then('os pagamentos já pagos devem manter o valor original', async function (this: any) {
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  const recebimentos = await DatabaseHelper.getPaymentsByRental(this.rentalId);

  const pagos = recebimentos.filter((p: any) => p.status === 'paid');
  // ⚠️ Corrigido em 17/set/2026 (issue #99): mesma causa raiz de
  // `expectPaymentAmount` mais abaixo (valor em formato de máquina).
  const valorNovo = this.testData?.expectedFutureValue
    ? parseFloat(String(this.testData.expectedFutureValue))
    : null;

  for (const pago of pagos) {
    // O que importa é que o valor da época NÃO foi trocado pelo novo.
    if (valorNovo !== null) {
      expect(
        Number(pago.expected_amount),
        `o recebimento JÁ PAGO de ${pago.reference_month}/${pago.reference_year} foi alterado para ` +
          `o valor novo (R$ ${pago.expected_amount}) -- pagamento pago é histórico e não pode mudar`
      ).not.toBeCloseTo(valorNovo, 2);
    }

    if (pago.paid_amount != null) {
      expect(
        Number(pago.paid_amount),
        `o valor efetivamente pago de ${pago.reference_month}/${pago.reference_year} não bate mais ` +
          'com o que estava registrado'
      ).toBeCloseTo(Number(pago.expected_amount), 2);
    }
  }
});

// ⚠️ Corrigido em 17/set/2026 (issue #99, mesma causa raiz do fix em
// "na aba {string} da página Financeiro devo ver:" logo acima): o "valor"
// que vem do Gherkin aqui já é formato de MÁQUINA ("166.67", ponto =
// decimal), não formato brasileiro de tela ("166,67"). Rodar o parser
// brasileiro (`.replace(/\./g, '').replace(',', '.')`, que serve pra ler
// texto tipo "2.000,00" DA TELA) em cima de "166.67" apagava o ponto
// decimal de verdade e virava 16667 -- 100x maior que o esperado. Todo
// cenário que comparava um valor com casas decimais (proporcional,
// parcela recalculada) falhava aqui mesmo quando o valor gravado no banco
// estava certo. O valor esperado, vindo do Gherkin, é só `parseFloat`
// direto.
async function expectPaymentAmount(world: any, monthNumber: string, year: string, expectedValue: string) {
  const rentalId = world.rentalId || world.testData?.rentalId;
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  const rows = await DatabaseHelper.getPaymentsByRental(rentalId);
  const payment = rows.find((p: any) => p.reference_month === monthNumber && p.reference_year === year);
  expect(payment).toBeTruthy();
  const expected = parseFloat(expectedValue);
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

/**
 * ⚠️ Consertado em 10/set/2026 (issue #76 -- falsos positivos).
 *
 * Este passo só guardava o valor esperado numa variável e ia embora: passava
 * sempre, mesmo que NENHUM recebimento futuro tivesse sido atualizado. Agora
 * ele confere de verdade, no banco.
 *
 * "Futuro" = com vencimento DEPOIS do mês em que a edição foi feita (a data
 * que o cenário chamou de "hoje", guardada por "edito a locação em ...").
 */
Then('pagamentos futuros devem ter {string}', async function(value: string) {
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  const recebimentos = await DatabaseHelper.getPaymentsByRental(this.rentalId);

  expect(
    recebimentos.length,
    'a locação do cenário não tem recebimento nenhum -- não dá para afirmar que os futuros foram atualizados'
  ).toBeGreaterThan(0);

  const hoje = this.testData?.currentDate;
  if (!hoje) {
    throw new Error(
      'O cenário não disse qual data considerar como "hoje" -- use o passo "edito a locação em {data}" antes deste.'
    );
  }
  const [, mesHoje, anoHoje] = hoje.split('/').map(Number);
  const corte = anoHoje * 12 + mesHoje; // mês da edição, em número contínuo

  const esperado = parseFloat(value.replace(/\./g, '').replace(',', '.'));

  const futuros = recebimentos.filter((p: any) => {
    const ordem = Number(p.reference_year) * 12 + Number(p.reference_month);
    return ordem > corte && p.status !== 'paid';
  });

  expect(
    futuros.length,
    `nenhum recebimento com vencimento depois de ${hoje} foi encontrado -- ` +
      'sem eles o cenário não prova nada (a locação foi criada com recebimentos suficientes?)'
  ).toBeGreaterThan(0);

  for (const recebimento of futuros) {
    expect(
      Number(recebimento.expected_amount),
      `o recebimento de ${recebimento.reference_month}/${recebimento.reference_year} continuou em ` +
        `R$ ${recebimento.expected_amount} -- deveria ter passado para R$ ${esperado} junto com o aluguel novo`
    ).toBeCloseTo(esperado, 2);
  }
});

Then('no campo {string} devo ver {string}', async function(fieldName: string, value: string) {
  const field = this.page.getByText(new RegExp(fieldName, 'i'));
  await expect(field).toBeVisible();
  
  const valueElement = this.page.getByText(value);
  await expect(valueElement).toBeVisible();
});

/**
 * ⚠️ Consertado em 10/set/2026 (issue #76 -- falsos positivos).
 *
 * Era só um `waitForTimeout(200)` com o comentário "validação implícita".
 * Não validava nada: o cenário passaria com o comprovante mostrando só o
 * aluguel, que é exatamente o bug que ele deveria pegar.
 *
 * A regra: no Comprovante de Contrato, o "Valor Total" é aluguel + garagem.
 * Então o comprovante NÃO pode mostrar o valor do aluguel sozinho como total.
 */
Then('não apenas o valor do aluguel', async function() {
  const aluguel = this.testData?.rentValue;
  const garagem = this.testData?.garageValue;

  if (aluguel == null || garagem == null) {
    throw new Error(
      'O cenário não guardou os valores de aluguel e garagem -- o passo ' +
        '"existe uma locação com:" precisa registrá-los em testData antes deste.'
    );
  }

  const formatar = (n: number) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const total = Number(aluguel) + Number(garagem);

  // O total correto tem que estar na tela...
  await expect(
    this.page.getByText(new RegExp(formatar(total).replace(/[.]/g, '\\.'))).first(),
    `o comprovante não mostra o valor total de R$ ${formatar(total)} (aluguel + garagem)`
  ).toBeVisible({ timeout: 5000 });

  // ...e o aluguel sozinho NÃO pode estar aparecendo como "Valor Total".
  const rotuloTotal = this.page
    .locator('*', { hasText: /valor total/i })
    .filter({ hasText: new RegExp(formatar(Number(aluguel)).replace(/[.]/g, '\\.')) });

  expect(
    await rotuloTotal.count(),
    `o comprovante está mostrando R$ ${formatar(Number(aluguel))} como "Valor Total" -- ` +
      'esse é só o aluguel, a garagem ficou de fora da soma'
  ).toBe(0);
});

/**
 * ⚠️ Corrigido em 14/set/2026 (issue #99, cluster "Locações"): depois de
 * confirmar a rescisão, o diálogo fecha e a tela volta pra LISTA de
 * locações -- não existe nenhum `[id*="end-date"]` visível ali (esse campo
 * só existe dentro do formulário de Locação, que já foi fechado). O
 * locator nunca resolvia, e `.inputValue()` ficava esperando os 20s
 * inteiros do passo até estourar. Corrigido pra checar direto no banco,
 * mesmo padrão já usado no passo vizinho ("os pagamentos após... devem ser
 * cancelados").
 */
Then('a data de término deve ser atualizada para {string}', async function(this: CustomWorld, date: string) {
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  const rental = await DatabaseHelper.getRental(this.rentalId!);

  const [day, month, year] = date.split('/');
  const expectedValue = `${year}-${month}-${day}`;

  expect(rental.end_date).toBe(expectedValue);
});

/**
 * ⚠️ Consertado em 10/set/2026 (issue #76 -- falsos positivos).
 *
 * Era só uma anotação em memória; passava sempre. Agora confere no banco.
 *
 * O que a rescisão faz de verdade (src/services/terminationService.ts, PASSO
 * 7): APAGA todo recebimento com vencimento a partir do dia 1º do mês SEGUINTE
 * ao da rescisão. Então "cancelado", aqui, significa "não existe mais".
 */
Then('os pagamentos após {string} devem ser cancelados', async function(date: string) {
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  const recebimentos = await DatabaseHelper.getPaymentsByRental(this.rentalId);

  const [, mes, ano] = date.split('/').map(Number);
  // Dia 1º do mês seguinte ao da rescisão -- o mesmo corte usado pelo sistema.
  const corte = new Date(Date.UTC(ano, mes, 1));

  const sobraram = recebimentos.filter((p: any) => p.due_date && new Date(p.due_date) >= corte);

  expect(
    sobraram.length,
    `depois da rescisão em ${date} ainda existem ${sobraram.length} recebimento(s) com vencimento ` +
      `a partir de ${corte.toISOString().split('T')[0]}: ` +
      sobraram.map((p: any) => `${p.reference_month}/${p.reference_year} (${p.due_date})`).join(', ')
  ).toBe(0);

  // Rede contra o próprio teste passar por engano: se a locação ficou SEM
  // nenhum recebimento, o "zero acima" não prova que os futuros foram apagados
  // -- prova que nunca houve recebimento nenhum.
  expect(
    recebimentos.length,
    'a locação ficou sem recebimento nenhum -- o cenário não consegue provar que só os futuros foram apagados'
  ).toBeGreaterThan(0);
});

/**
 * ⚠️ Corrigido em 15/set/2026 (issue #99, CI run 34928289217): confirmado
 * pelo log real -- "strict mode violation: getByText(/Disponível/i)
 * resolved to 73 elements". O passo procurava o texto do status solto na
 * página /properties inteira, que hoje acumula dezenas de imóveis de
 * outras rodadas de teste -- nunca dava pra saber QUAL "Disponível"
 * pertencia ao imóvel deste cenário. Agora escopa pela linha do imóvel
 * específico criado em criarLocacaoAtivaDeTeste (pelo complemento único).
 */
Then('o imóvel deve ficar {string}', async function(status: string) {
  const complemento = this.testData?.propertyComplement;
  expect(
    complemento,
    'nenhum imóvel único foi criado pelo cenário (this.testData.propertyComplement vazio) -- ' +
      'o passo "que existe uma locação ativa..." precisa rodar antes deste.'
  ).toBeTruthy();

  await this.page.goto('/properties');
  await this.page.waitForLoadState('domcontentloaded');

  const complementoEscapado = complemento.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linhaDoImovel = this.page
    .locator('tr, [role="row"]')
    .filter({ hasText: new RegExp(complementoEscapado) });

  await expect(
    linhaDoImovel.getByText(new RegExp(status, 'i')),
    `o imóvel "${complemento}" não está mostrando o status "${status}" na tela`
  ).toBeVisible({ timeout: 10000 });
});