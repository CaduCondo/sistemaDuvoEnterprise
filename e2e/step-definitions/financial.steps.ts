import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { escolherMesesNoSeletor } from '../helpers/periodo.helper';

/**
 * Passos da tela Financeiro (aba Locações) -- criados em 25/set/2026 pela
 * issue #110.
 *
 * Contexto de por que isto existe: o Cadu isentou um Local da Taxa de
 * Gerenciamento em produção e os cards não mudaram. A conta estava certa (o
 * local não tinha recebimento PAGO no mês, e a base da taxa é só o recebido),
 * mas a investigação revelou algo pior: NÃO HAVIA NENHUM TESTE sobre esses
 * cards, porque eles não tinham nem `id` nem `data-testid`. Se a isenção
 * quebrasse de verdade, ninguém seria avisado.
 */

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/** "Março/2026" -> { mes: 3, ano: 2026, nomeDoMes: "Março" } */
function lerPeriodo(periodoBR: string) {
  const [nomeDoMes, ano] = periodoBR.split('/');
  const mes = MESES[nomeDoMes.trim().toLowerCase()];
  if (!mes) throw new Error(`Não reconheci o mês "${nomeDoMes}" em "${periodoBR}".`);
  return { mes, ano: Number(ano), nomeDoMes: nomeDoMes.trim() };
}

/** "R$ 1.234,56" -> 1234.56 */
function lerDinheiroDaTela(texto: string): number {
  const negativo = texto.trim().startsWith('-');
  const limpo = texto.replace(/[^\d,]/g, '').replace(',', '.');
  const valor = parseFloat(limpo || '0');
  return negativo ? -valor : valor;
}

const TESTID_POR_CARD: Record<string, string> = {
  'receita bruta': 'kpi-receita-bruta',
  'taxa adm': 'kpi-taxa-adm',
  'taxa ger': 'kpi-taxa-ger',
};

/**
 * Monta a massa do cenário: um Local novo, com um imóvel, uma locação e UM
 * recebimento no mês pedido, pago ou pendente conforme o caso.
 *
 * Cria o próprio Local (não reaproveita nenhum existente) porque o cenário vai
 * isentá-lo -- e isenção é configuração global do sistema. Mexer num local
 * real afetaria as contas de outros cenários.
 */
async function montarLocalComRecebimento(
  world: CustomWorld,
  valor: number,
  periodoBR: string,
  status: 'paid' | 'pending'
) {
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  const { mes, ano } = lerPeriodo(periodoBR);
  const sufixo = Date.now();

  // Percentuais fixos, para o cenário poder falar em números redondos.
  await DatabaseHelper.setFeePercentages(5, 3);

  const location = await world.createLocation({ name: `Isencao E2E ${sufixo}` });
  const property = await world.createProperty({
    location_id: location.id,
    complement: `Isencao E2E ${sufixo}`,
    value: valor,
    status: 'available',
  });
  const tenant = await world.createTenant({ name: `Isencao E2E ${sufixo}` });
  const rental = await world.createRental({
    property_id: property.id,
    tenant_id: tenant.id,
    start_date: `${ano}-${String(mes).padStart(2, '0')}-01`,
    end_date: `${ano}-12-31`,
    rent_due_day: 10,
    rent_value: valor,
    security_deposit: 0,
    deposit_installments: 0,
  });

  await DatabaseHelper.upsertPayment({
    rental_id: rental.id,
    reference_month: String(mes).padStart(2, '0'),
    reference_year: String(ano),
    due_date: `${ano}-${String(mes).padStart(2, '0')}-10`,
    expected_amount: valor,
    status,
    paid_amount: status === 'paid' ? valor : undefined,
    payment_date: status === 'paid' ? `${ano}-${String(mes).padStart(2, '0')}-10` : undefined,
    breakdown: [{ description: 'Aluguel', amount: valor, type: 'addition' }],
  });

  world.testData = {
    ...world.testData,
    isencao: { locationId: location.id, locationName: location.name, valor },
  };
}

Given(
  'que existe um local com um recebimento PAGO de {string} em {string}',
  { timeout: 60 * 1000 },
  async function (this: CustomWorld, valor: string, periodoBR: string) {
    await montarLocalComRecebimento(this, parseFloat(valor), periodoBR, 'paid');
  }
);

Given(
  'que existe um local com um recebimento PENDENTE de {string} em {string}',
  { timeout: 60 * 1000 },
  async function (this: CustomWorld, valor: string, periodoBR: string) {
    await montarLocalComRecebimento(this, parseFloat(valor), periodoBR, 'pending');
  }
);

/**
 * Abre o Financeiro num mês/ano e filtra por UM local (pelo id e nome).
 * Exportado para outros cenários (acordo de parcelamento, #119) usarem o mesmo
 * caminho, com as mesmas esperas já acertadas aqui.
 */
export async function abrirFinanceiroFiltrado(
  world: CustomWorld,
  periodoBR: string,
  dados: { locationId: string; locationName: string },
  nomesDosMeses?: string[]
) {
  const { nomeDoMes, ano } = lerPeriodo(periodoBR);
  const self = world;
    await self.page.goto('/financial');
    await self.page.waitForLoadState('domcontentloaded');

    // O card só existe depois que a tela termina de buscar os dados.
    await expect(
      self.page.locator('[data-testid="kpi-receita-bruta"]'),
      'a tela Financeiro não terminou de carregar'
    ).toBeVisible({ timeout: 20000 });

    // Período (PeriodSelector, o mesmo usado em Recebimentos e no Painel).
    // No Financeiro o mês é um combo de checkboxes (#137); a ajuda escolhe os meses pedidos.
    await escolherMesesNoSeletor(self.page, nomesDosMeses ?? [nomeDoMes]);
    await self.page.waitForTimeout(300);

    await self.page.locator('#period-selector-year').click();
    await self.page.getByRole('option', { name: new RegExp(`^${ano}$`) }).click();
    await self.page.waitForTimeout(300);

    // Filtro de local: é um painel (Popover + Command) com a lista inteira de
    // Locais do banco.
    //
    // ⚠️ 29/set/2026 (CI run #87): a primeira versão clicava em
    // `getByText(nome).first()` -- o primeiro pedaço de texto da PÁGINA que
    // batesse com o nome, que pode estar fora do painel ou fora da área
    // visível da lista. O clique não selecionava nada e o filtro continuava em
    // "Todos os Locais". Agora digita o nome na busca do próprio painel (o que
    // deixa uma opção só) e clica na opção pelo seu identificador próprio.
    // ⚠️ 05/out/2026 (CI runs #88, #90, #92 -- intermitente): a lista de
    // locais do filtro é montada a partir dos recebimentos do PERÍODO. Logo
    // depois de trocar o mês, a tela ainda está buscando os dados do mês novo;
    // abrir o painel nesse meio-tempo mostra os locais do mês ANTERIOR, e o
    // local do cenário não está lá. Agora o painel é reaberto até a lista do
    // mês certo chegar (até ~25s), em vez de uma tentativa só.
    const opcao = self.page.locator(`[data-testid="financial-location-option-${dados.locationId}"]`);
    let achou = false;
    for (let tentativa = 0; tentativa < 8 && !achou; tentativa++) {
      await self.page.locator('#financial-location-filter').click();
      const busca = self.page.getByPlaceholder(/Buscar local/i);
      await busca.waitFor({ state: 'visible', timeout: 10000 });
      await busca.fill(dados.locationName);
      achou = await opcao.isVisible({ timeout: 3000 }).catch(() => false);
      if (!achou) {
        await self.page.keyboard.press('Escape');
        await self.page.waitForTimeout(1500);
      }
    }
    await expect(
      opcao,
      `o local "${dados.locationName}" não apareceu na lista do filtro do Financeiro (nem depois de esperar o período carregar)`
    ).toBeVisible({ timeout: 2000 });
    await opcao.click();
    await self.page.keyboard.press('Escape');

    await expect(
      self.page.locator('#financial-location-filter'),
      `o filtro não ficou com "${dados.locationName}" selecionado`
    ).toContainText(dados.locationName, { timeout: 10000 });
}

When(
  'abro o Financeiro em {string} filtrado por esse local',
  { timeout: 60 * 1000 },
  async function (this: CustomWorld, periodoBR: string) {
    const dados = this.testData.isencao;
    if (!dados) throw new Error('Nenhum local de isenção foi montado antes deste passo.');
    await abrirFinanceiroFiltrado(this, periodoBR, dados);
  }
);

// Frase propositalmente específica ("o card X deve mostrar Y"): um passo
// genérico do tipo "a X deve ser Y" colidiria com qualquer outro cenário que
// quisesse comparar dois valores, e o Cucumber recusaria por ambiguidade.
Then('o card {string} deve mostrar {string}', async function (this: CustomWorld, nomeDoCard: string, valorEsperado: string) {
  const testId = TESTID_POR_CARD[nomeDoCard.trim().toLowerCase()];
  if (!testId) {
    throw new Error(
      `Não sei ler o card "${nomeDoCard}". Conhecidos: ${Object.keys(TESTID_POR_CARD).join(', ')}.`
    );
  }

  const card = this.page.locator(`[data-testid="${testId}"]`);
  const esperado = parseFloat(valorEsperado);

  await expect
    .poll(async () => lerDinheiroDaTela((await card.textContent()) || ''), {
      timeout: 10000,
      message: `o card "${nomeDoCard}" deveria mostrar R$ ${esperado.toFixed(2)}`,
    })
    .toBeCloseTo(esperado, 2);
});

When(
  'marco esse local como isento de Taxa de Gerenciamento',
  { timeout: 60 * 1000 },
  async function (this: CustomWorld) {
    const dados = this.testData.isencao;
    if (!dados) throw new Error('Nenhum local de isenção foi montado antes deste passo.');

    await this.page.goto('/settings');
    await this.page.waitForLoadState('domcontentloaded');

    const aba = this.page.getByRole('tab', { name: /permiss/i });
    await aba.waitFor({ state: 'visible', timeout: 15000 });
    await aba.click();

    // ⚠️ Cuidado com o nome do botão: até 25/set/2026 os ids dos dois cartões
    // de isenção estavam TROCADOS (o de Gerenciamento se chamava
    // "...admin-fee-exemption"). Foi acertado junto com este teste -- se algum
    // dia este passo abrir a tela errada, é o primeiro lugar a conferir.
    const botao = this.page.locator('#permissions-management-fee-exemption');
    await botao.waitFor({ state: 'visible', timeout: 15000 });
    await botao.click();

    const caixa = this.page.locator(`#location-${dados.locationId}`);
    await expect(
      caixa,
      `o local "${dados.locationName}" não apareceu na lista de isenção`
    ).toBeVisible({ timeout: 15000 });
    await caixa.click();
    // Confere que a marcação ficou (CI #94: ela se perdia quando a lista de
    // isenções salvas terminava de carregar depois do clique).
    await expect(caixa, `o local "${dados.locationName}" não ficou marcado como isento`).toBeChecked({ timeout: 5000 });

    await this.page.getByRole('button', { name: /Salvar Isenções/i }).click();

    // A gravação é no banco; sem esperar, o passo seguinte abre o Financeiro
    // antes de a isenção existir e o teste acusa um erro que não é real.
    await expect(
      this.page.getByRole('button', { name: /Salvar Isenções/i }),
      'o diálogo de isenção não fechou depois de salvar'
    ).toBeHidden({ timeout: 15000 });
    await this.page.waitForTimeout(500);
  }
);


/** =================== Filtro de vários meses (#137) =================== */

Given(
  'que existe um local com recebimentos PAGOS de {string} em {string} e de {string} em {string}',
  { timeout: 60 * 1000 },
  async function (this: CustomWorld, valorA: string, periodoA: string, valorB: string, periodoB: string) {
    const DatabaseHelper = (await import('../helpers/database.helper')).default;
    const a = lerPeriodo(periodoA);
    const b = lerPeriodo(periodoB);
    const sufixo = Date.now();
    await DatabaseHelper.setFeePercentages(5, 3);

    const location = await this.createLocation({ name: `Meses E2E ${sufixo}` });
    const property = await this.createProperty({
      location_id: location.id, complement: `Meses E2E ${sufixo}`, value: parseFloat(valorA), status: 'available',
    });
    const tenant = await this.createTenant({ name: `Meses E2E ${sufixo}` });
    const primeiro = a.ano * 100 + a.mes <= b.ano * 100 + b.mes ? a : b;
    const rental = await this.createRental({
      property_id: property.id, tenant_id: tenant.id,
      start_date: `${primeiro.ano}-${String(primeiro.mes).padStart(2, '0')}-01`,
      end_date: `${Math.max(a.ano, b.ano)}-12-31`,
      rent_due_day: 10, rent_value: parseFloat(valorA), security_deposit: 0, deposit_installments: 0,
    });

    for (const [valor, p] of [[valorA, a], [valorB, b]] as const) {
      const mm = String(p.mes).padStart(2, '0');
      await DatabaseHelper.upsertPayment({
        rental_id: rental.id,
        reference_month: mm, reference_year: String(p.ano),
        due_date: `${p.ano}-${mm}-10`,
        expected_amount: parseFloat(valor), status: 'paid', paid_amount: parseFloat(valor),
        payment_date: `${p.ano}-${mm}-10`,
        breakdown: [{ description: 'Aluguel', amount: parseFloat(valor), type: 'addition' }],
      });
    }
    this.testData = { ...this.testData, isencao: { locationId: location.id, locationName: location.name, valor: parseFloat(valorA) } };
  }
);

When(
  'abro o Financeiro de {string} com os meses {string} filtrado por esse local',
  { timeout: 90 * 1000 },
  async function (this: CustomWorld, ano: string, meses: string) {
    const dados = this.testData.isencao;
    if (!dados) throw new Error('Nenhum local foi montado antes deste passo.');
    const nomes = meses.split(',').map((m) => m.trim()).filter(Boolean);
    await abrirFinanceiroFiltrado(this, `${nomes[0]}/${ano}`, dados, nomes);
  }
);

When('clico em {string} no filtro de meses', async function (this: CustomWorld, rotulo: string) {
  // Abre o combo só se estiver fechado (um passo anterior pode tê-lo deixado aberto;
  // clicar de novo no botão do combo fecharia e o item nunca apareceria).
  const aberto = await this.page.locator('#period-month-toggle-all').isVisible().catch(() => false);
  if (!aberto) await this.page.locator('#period-selector-month').click();
  await this.page.getByRole('button', { name: rotulo, exact: true }).click();
  await this.page.waitForTimeout(500);
});

Then('o filtro de meses deve oferecer {string}', async function (this: CustomWorld, rotulo: string) {
  const aberto = await this.page.locator('#period-month-toggle-all').isVisible().catch(() => false);
  if (!aberto) await this.page.locator('#period-selector-month').click();
  await expect(
    this.page.locator('#period-month-toggle-all'),
    `o primeiro item do filtro de meses deveria ser "${rotulo}"`
  ).toHaveText(rotulo, { timeout: 5000 });
});

Then('os {int} meses devem estar marcados no filtro', async function (this: CustomWorld, quantos: number) {
  const aberto = await this.page.locator('#period-month-toggle-all').isVisible().catch(() => false);
  if (!aberto) await this.page.locator('#period-selector-month').click();
  let marcados = 0;
  for (let mes = 1; mes <= 12; mes++) {
    if (await this.page.locator(`#period-month-${mes}`).isChecked()) marcados++;
  }
  expect(marcados, 'quantidade de meses marcados no filtro').toBe(quantos);
});

/** =================== Código PIX por linha (#138) =================== */

/**
 * Recebimento pago em 2 partes: no Financeiro vira 1 locação com 2 LINHAS que têm o
 * mesmo id (cada uma com sua data e valor) -- o caso em que o campo do Código PIX
 * abria nas duas linhas ao mesmo tempo e salvava sozinho.
 */
Given(
  'que existe um local com um recebimento pago em 2 partes de {string} e {string} em {string}',
  { timeout: 60 * 1000 },
  async function (this: CustomWorld, valorA: string, valorB: string, periodoBR: string) {
    const DatabaseHelper = (await import('../helpers/database.helper')).default;
    const { mes, ano } = lerPeriodo(periodoBR);
    const mm = String(mes).padStart(2, '0');
    const a = parseFloat(valorA);
    const b = parseFloat(valorB);
    const sufixo = Date.now();
    await DatabaseHelper.setFeePercentages(5, 3);

    const location = await this.createLocation({ name: `Pix E2E ${sufixo}` });
    const property = await this.createProperty({
      location_id: location.id, complement: `Pix E2E ${sufixo}`, value: a + b, status: 'available',
    });
    const nomeInquilino = `Pix E2E ${sufixo}`;
    const tenant = await this.createTenant({ name: nomeInquilino });
    const rental = await this.createRental({
      property_id: property.id, tenant_id: tenant.id,
      start_date: `${ano}-${mm}-01`, end_date: `${ano}-12-31`,
      rent_due_day: 10, rent_value: a + b, security_deposit: 0, deposit_installments: 0,
    });
    const pagamento = await DatabaseHelper.upsertPayment({
      rental_id: rental.id, reference_month: mm, reference_year: String(ano),
      due_date: `${ano}-${mm}-10`, expected_amount: a + b, status: 'paid', paid_amount: a + b,
      payment_date: `${ano}-${mm}-23`,
      breakdown: [{ description: 'Aluguel', amount: a + b, type: 'addition' }],
      pix_code: null,
      partial_payments: [
        { amount: a, expected_amount: a + b, payment_date: `${ano}-${mm}-06`, payment_time: '09:18:30', payment_method: 'pix', notes: '', attachments: [], registered_at: new Date().toISOString() },
        { amount: b, expected_amount: b, payment_date: `${ano}-${mm}-23`, payment_time: '06:10:33', payment_method: 'pix', notes: '', attachments: [], registered_at: new Date().toISOString() },
      ],
    });
    this.testData = {
      ...this.testData,
      isencao: { locationId: location.id, locationName: location.name, valor: a + b },
      pix: { paymentId: pagamento.id, inquilino: nomeInquilino },
    };
  }
);

/** Linha N (1, 2...) do recebimento de teste: a 1ª tem o nome do inquilino; as seguintes vêm logo abaixo. */
function linhaDoRecebimento(world: CustomWorld, posicao: number) {
  const primeira = world.page.locator('tbody tr').filter({ hasText: world.testData.pix.inquilino }).first();
  return posicao === 1 ? primeira : primeira.locator(`xpath=following-sibling::tr[${posicao - 1}]`);
}

When('clico no Código PIX da {int}ª linha desse recebimento', async function (this: CustomWorld, posicao: number) {
  const linha = linhaDoRecebimento(this, posicao);
  await expect(linha, `não achei a linha ${posicao} do recebimento de teste`).toBeVisible({ timeout: 20000 });
  await linha.locator('td').last().locator('span').click();
});

Then('só {int} campo de texto de Código PIX deve estar aberto na tabela', async function (this: CustomWorld, quantos: number) {
  // Espera um instante: o defeito aparecia logo depois do clique (campo abre e fecha sozinho).
  await this.page.waitForTimeout(800);
  await expect(
    this.page.locator('tbody input[type="text"]'),
    `deveria haver ${quantos} campo(s) de PIX aberto(s) (antes do conserto abriam todos os da mesma locação)`
  ).toHaveCount(quantos, { timeout: 5000 });
});

When('digito {string} no Código PIX sem confirmar', async function (this: CustomWorld, texto: string) {
  const campo = this.page.locator('tbody input[type="text"]').first();
  await campo.pressSequentially(texto, { delay: 120 });
  // O defeito salvava e fechava o campo logo no começo; dá tempo para ele aparecer.
  await this.page.waitForTimeout(1200);
  this.testData.pixDigitado = texto;
});

Then('o campo de Código PIX deve continuar aberto com o texto digitado', async function (this: CustomWorld) {
  const campo = this.page.locator('tbody input[type="text"]');
  await expect(campo, 'o campo de Código PIX fechou antes de eu terminar de digitar').toHaveCount(1);
  await expect(campo.first()).toHaveValue(this.testData.pixDigitado);
});

Then('nenhuma mensagem de sucesso deve ter aparecido', async function (this: CustomWorld) {
  await expect(
    this.page.getByRole('alertdialog'),
    'apareceu uma mensagem antes de eu confirmar o código (o sistema salvou sozinho)'
  ).toHaveCount(0);
});

When('aperto Enter no Código PIX', async function (this: CustomWorld) {
  await this.page.locator('tbody input[type="text"]').first().press('Enter');
});

Then('devo ver o aviso {string} e fecho no OK', async function (this: CustomWorld, mensagem: string) {
  const alerta = this.page.getByRole('alertdialog');
  await expect(alerta, `a mensagem "${mensagem}" não apareceu`).toBeVisible({ timeout: 15000 });
  await expect(alerta).toContainText(mensagem);
  await alerta.getByRole('button', { name: /^OK$/i }).click();
  await expect(alerta).toBeHidden({ timeout: 10000 });
});

Then('o Código PIX {string} deve estar gravado nesse recebimento', async function (this: CustomWorld, esperado: string) {
  const { supabaseAdmin } = await import('../helpers/database.helper');
  await expect
    .poll(async () => {
      const { data } = await supabaseAdmin.from('payments').select('pix_code').eq('id', this.testData.pix.paymentId).single();
      return data?.pix_code ?? null;
    }, { timeout: 15000, message: 'o Código PIX não foi gravado no banco' })
    .toBe(esperado);
});

When('clico fora do campo de Código PIX', async function (this: CustomWorld) {
  await this.page.getByRole('heading', { name: /Financeiro/i }).first().click();
  await this.page.waitForTimeout(1500);
});

Then('nenhum Código PIX deve estar gravado nesse recebimento', async function (this: CustomWorld) {
  const { supabaseAdmin } = await import('../helpers/database.helper');
  const { data } = await supabaseAdmin.from('payments').select('pix_code').eq('id', this.testData.pix.paymentId).single();
  expect(data?.pix_code ?? null, 'o sistema gravou um Código PIX sem eu digitar nada').toBeNull();
});
