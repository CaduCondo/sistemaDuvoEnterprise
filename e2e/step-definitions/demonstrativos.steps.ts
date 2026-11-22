import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { CustomWorld } from '../support/world';
import { abrirFinanceiroFiltrado } from './financial.steps';

/**
 * Passos da página Demonstrativos (issue #128, 22/nov/2026).
 *
 * Reaproveitam o preparo do Financeiro ("que existe um local com um
 * recebimento PAGO de ... em ...", em financial.steps.ts), que guarda o Local
 * criado em `testData.isencao`.
 */

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
function lerPeriodo(periodoBR: string) {
  const [nome, ano] = periodoBR.split('/');
  const mes = MESES[nome.trim().toLowerCase()];
  if (!mes) throw new Error(`Não reconheci o mês em "${periodoBR}".`);
  return { mes, ano: Number(ano), chave: `${ano}-${String(mes).padStart(2, '0')}` };
}

/** "R$ 1.234,56" (Financeiro) ou "1.235" / "(1.235)" / "-" (Demonstrativos) → número. */
function lerNumero(texto: string): number {
  const t = (texto || '').trim();
  if (t === '-' || t === '') return 0;
  const negativo = t.startsWith('-') || t.startsWith('(');
  const valor = parseFloat(t.replace(/[^\d,]/g, '').replace(',', '.') || '0');
  return negativo ? -valor : valor;
}

function localDoCenario(world: CustomWorld) {
  const dados = world.testData.isencao;
  if (!dados) throw new Error('Nenhum local foi montado antes deste passo.');
  return dados as { locationId: string; locationName: string; valor: number };
}

Given('esse local tem uma conta de {string} em {string}', async function (this: CustomWorld, valor: string, periodoBR: string) {
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  const { mes, ano } = lerPeriodo(periodoBR);
  await DatabaseHelper.createLocationExpense({
    location_id: localDoCenario(this).locationId, amount: parseFloat(valor), reference_month: mes, reference_year: ano,
  });
});

Given('esse local tem uma caução recebida de {string} em {string}', async function (this: CustomWorld, valor: string, periodoBR: string) {
  const { default: DatabaseHelper, supabaseAdmin } = await import('../helpers/database.helper');
  const { chave } = lerPeriodo(periodoBR);
  const { data, error } = await supabaseAdmin
    .from('rentals')
    .select('id, properties!rentals_property_id_fkey!inner(location_id)')
    .eq('properties.location_id', localDoCenario(this).locationId);
  if (error || !data?.length) throw new Error(`Não achei a locação do local do cenário: ${error?.message || 'nenhuma'}`);
  const parcela = await DatabaseHelper.createDepositInstallment({
    rental_id: data[0].id, installment_number: 1, installment_total: 1, amount: parseFloat(valor),
    due_date: `${chave}-05`, status: 'paid', pix_code: 'E2E-CAUCAO',
  });
  await DatabaseHelper.updateDepositInstallment(parcela.id, { paid_amount: parseFloat(valor), payment_date: `${chave}-05` });
});

Given('esse local é de uma Holding', async function (this: CustomWorld) {
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  await DatabaseHelper.setLocationRegime(localDoCenario(this).locationId, 'holding');
});

/** Abre a página, filtra o Local e fica na visão mensal do mês pedido. */
async function abrirDemonstrativos(world: CustomWorld, periodoBR: string) {
  const { mes, ano } = lerPeriodo(periodoBR);
  const { locationId } = localDoCenario(world);
  await world.page.goto('/demonstrativos');
  await world.page.waitForLoadState('domcontentloaded');
  await expect(world.page.locator('[data-testid="tabela-resumo"]'), 'os Demonstrativos não terminaram de carregar')
    .toBeVisible({ timeout: 60000 });
  await world.page.selectOption('[data-testid="filtro-local"]', locationId);
  await world.page.selectOption('[data-testid="filtro-visao"]', 'mensal');
  await world.page.selectOption('[data-testid="filtro-ano"]', String(ano));
  await world.page.selectOption('[data-testid="filtro-mes-resumo"]', String(mes));
}

When('abro os Demonstrativos em {string} filtrado por esse local', { timeout: 90 * 1000 }, async function (this: CustomWorld, periodoBR: string) {
  await abrirDemonstrativos(this, periodoBR);
});

When(
  'abro os Demonstrativos e o Financeiro com o mesmo filtro em {string}',
  { timeout: 150 * 1000 },
  async function (this: CustomWorld, periodoBR: string) {
    await abrirFinanceiroFiltrado(this, periodoBR, localDoCenario(this));
    const ler = async (id: string) => lerNumero((await this.page.locator(`[data-testid="${id}"]`).textContent()) || '');
    // Espera o card do recebido sair do zero (os dados do filtro chegam depois).
    await expect.poll(() => ler('kpi-receita-bruta'), { timeout: 15000 }).not.toBe(0);
    const financeiro = {
      recebido: await ler('kpi-receita-bruta'),
      taxaAdm: await ler('kpi-taxa-adm'),
      taxaGer: await ler('kpi-taxa-ger'),
      contas: await ler('kpi-contas'),
    };
    await abrirDemonstrativos(this, periodoBR);
    const demonstrativos = {
      recebido: await ler('resumo-recebido-financeiro'),
      taxaAdm: await ler('resumo-taxa-adm'),
      taxaGer: await ler('resumo-taxa-ger'),
      contas: await ler('resumo-contas'),
    };
    this.testData.comparacao = { financeiro, demonstrativos };
  },
);

Then('a Receita Bruta \\(recebido), as taxas e as Contas do Mês são iguais nas duas telas', function (this: CustomWorld) {
  const { financeiro, demonstrativos } = this.testData.comparacao;
  // Os Demonstrativos mostram reais inteiros (#,##0): compara arredondado.
  for (const campo of ['recebido', 'taxaAdm', 'taxaGer', 'contas'] as const) {
    expect(Math.round(demonstrativos[campo]), `${campo}: Financeiro ${financeiro[campo]} x Demonstrativos ${demonstrativos[campo]}`)
      .toBe(Math.round(financeiro[campo]));
  }
  expect(financeiro.recebido, 'o cenário precisa ter dinheiro recebido para valer').toBeGreaterThan(0);
  expect(financeiro.contas, 'o cenário precisa ter conta do mês para valer').toBeGreaterThan(0);
});

Then('o Resumo dos Demonstrativos mostra {string}', async function (this: CustomWorld, texto: string) {
  await expect(this.page.locator('[data-testid="resumo-status-balanco"]')).toHaveText(texto, { timeout: 10000 });
});

Then('a conferência do Balanço é zero em todos os meses', async function (this: CustomWorld) {
  await this.page.locator('[data-testid="aba-balanco"]').click();
  const celulas = this.page.locator('[data-testid="bal-diferenca"] td[data-periodo]');
  await expect(celulas.first()).toBeVisible({ timeout: 10000 });
  const textos = await celulas.allTextContents();
  expect(textos.length).toBeGreaterThan(0);
  for (const t of textos) expect(lerNumero(t), `conferência do Balanço: "${t}"`).toBe(0);
});

async function valorDaLinha(world: CustomWorld, aba: string, testId: string, periodoBR: string) {
  const { chave } = lerPeriodo(periodoBR);
  await world.page.locator(`[data-testid="aba-${aba}"]`).click();
  const celula = world.page.locator(`[data-testid="${testId}"] td[data-periodo="${chave}"]`);
  await expect(celula).toBeVisible({ timeout: 10000 });
  return lerNumero((await celula.textContent()) || '');
}

Then('a DRE de {string} mostra receita bruta de {string}', async function (this: CustomWorld, periodoBR: string, valor: string) {
  expect(await valorDaLinha(this, 'dre', 'dre-receita-bruta', periodoBR)).toBe(Number(valor));
});

Then('o Balanço de {string} mostra cauções de inquilinos de {string}', async function (this: CustomWorld, periodoBR: string, valor: string) {
  expect(await valorDaLinha(this, 'balanco', 'bal-caucoes', periodoBR)).toBe(Number(valor));
});

When('filtro os Demonstrativos pelo proprietário {string}', async function (this: CustomWorld, nome: string) {
  const valor = nome.toLowerCase().startsWith('holding') ? 'holding' : 'pf';
  await this.page.selectOption('[data-testid="filtro-regime"]', valor);
});

async function linhaDoPredio(world: CustomWorld) {
  await world.page.locator('[data-testid="aba-predios"]').click();
  await expect(world.page.locator('[data-testid="tabela-por-predio"]')).toBeVisible({ timeout: 10000 });
  return world.page.locator(`[data-testid="predio-${localDoCenario(world).locationName}"]`);
}

Then('a aba Por Prédio mostra esse local', async function (this: CustomWorld) {
  await expect(await linhaDoPredio(this)).toBeVisible({ timeout: 10000 });
});

Then('a aba Por Prédio não mostra esse local', async function (this: CustomWorld) {
  await expect(await linhaDoPredio(this)).toHaveCount(0, { timeout: 10000 });
});

When('exporto os Demonstrativos para Excel', { timeout: 90 * 1000 }, async function (this: CustomWorld) {
  const [download] = await Promise.all([
    this.page.waitForEvent('download', { timeout: 60000 }),
    this.page.locator('[data-testid="exportar-excel"]').click(),
  ]);
  const caminho = await download.path();
  if (!caminho) throw new Error('O download do Excel não gerou arquivo.');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  this.testData.excel = wb;
});

Then(
  'o Excel tem as abas Resumo, Premissas, Dados do sistema, Cálculos, DRE, Balanço, Fluxo de Caixa e Por Prédio',
  function (this: CustomWorld) {
    const wb: ExcelJS.Workbook = this.testData.excel;
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Resumo', 'Premissas', 'Dados do sistema', 'Cálculos', 'DRE', 'Balanço', 'Fluxo de Caixa', 'Por Prédio',
    ]);
  },
);

Then('nenhuma fórmula do Excel tem #REF!, #DIV\\/0! ou #VALUE!', function (this: CustomWorld) {
  const wb: ExcelJS.Workbook = this.testData.excel;
  const erros: string[] = [];
  let formulas = 0;
  wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => {
    const v: any = c.value;
    const texto = typeof v === 'object' && v?.formula ? (formulas++, v.formula) : String(v ?? '');
    if (/#REF!|#DIV\/0!|#VALUE!/.test(texto)) erros.push(`${ws.name}!${c.address}: ${texto}`);
  })));
  expect(formulas, 'o Excel deveria ter fórmulas vivas').toBeGreaterThan(100);
  expect(erros).toEqual([]);
});

Then('o menu {string} não aparece', async function (this: CustomWorld, nome: string) {
  await expect(this.page.locator('#layout-nav-dashboard, a[href="/dashboard"]').first()).toBeVisible({ timeout: 15000 });
  await expect(this.page.getByRole('link', { name: nome, exact: true })).toHaveCount(0);
});
