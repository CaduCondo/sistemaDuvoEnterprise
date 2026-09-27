import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

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

When(
  'abro o Financeiro em {string} filtrado por esse local',
  { timeout: 60 * 1000 },
  async function (this: CustomWorld, periodoBR: string) {
    const dados = this.testData.isencao;
    if (!dados) throw new Error('Nenhum local de isenção foi montado antes deste passo.');
    const { nomeDoMes, ano } = lerPeriodo(periodoBR);

    await this.page.goto('/financial');
    await this.page.waitForLoadState('domcontentloaded');

    // O card só existe depois que a tela termina de buscar os dados.
    await expect(
      this.page.locator('[data-testid="kpi-receita-bruta"]'),
      'a tela Financeiro não terminou de carregar'
    ).toBeVisible({ timeout: 20000 });

    // Período (PeriodSelector, o mesmo usado em Recebimentos e no Painel).
    await this.page.locator('#period-selector-month').click();
    await this.page.getByRole('option', { name: new RegExp(`^${nomeDoMes}$`, 'i') }).click();
    await this.page.waitForTimeout(300);

    await this.page.locator('#period-selector-year').click();
    await this.page.getByRole('option', { name: new RegExp(`^${ano}$`) }).click();
    await this.page.waitForTimeout(300);

    // Filtro de local: é um painel (Popover + Command), a opção é o nome.
    await this.page.locator('#financial-location-filter').click();
    await this.page.waitForTimeout(300);
    const nomeEscapado = dados.locationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await this.page.getByText(new RegExp(nomeEscapado, 'i')).first().click();
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(800);

    await expect(
      this.page.locator('#financial-location-filter'),
      `o filtro não ficou com "${dados.locationName}" selecionado`
    ).toContainText(dados.locationName, { timeout: 10000 });
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
