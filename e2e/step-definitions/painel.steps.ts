import { Given, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import DatabaseHelper from '../helpers/database.helper';

/**
 * Painel de Gestão x Financeiro (#120, #121): o Painel (useDashboardData.ts
 * / FinancialCharts.tsx) somava o Recebimento de Rescisão (devolução de
 * caução) na Receita/Esperado/Taxas -- a mesma contaminação que o
 * Financeiro já tinha corrigido na #49. Período isolado próprio
 * (fevereiro/2030): não existe limpeza entre cenários na mesma execução
 * (só ao final, pelo selo [E2E]) -- reaproveitar dezembro/2030 (já usado
 * pelo cenário "Taxa de administração", em 8-pagamentos-calculos.feature)
 * poluiria os dois. ⚠️ Corrigido em 07/out/2026 (CI run #99): tinha usado
 * 2031 antes, mas o seletor de Ano (PeriodSelector.tsx) só lista 10 anos
 * (ano atual -5 a +4) -- 2031 não aparecia na lista, e o clique no "option"
 * ficava girando até estourar o timeout do step (20s). O ano isolado
 * precisa estar sempre dentro dessa janela.
 */
Given(
  'um aluguel {string} de {string} e um Recebimento de Rescisão {string} de {string}, isolados no mesmo período de teste',
  async function (this: CustomWorld, statusAluguel: string, valorAluguelTexto: string, statusRescisao: string, valorRescisaoTexto: string) {
    const valorAluguel = parseFloat(valorAluguelTexto);
    const valorRescisao = parseFloat(valorRescisaoTexto);
    const mes = '02';
    const ano = '2030';
    const sufixo = Date.now();

    const criarPagamento = async (nomeInquilino: string, valor: number, status: string, kind: string) => {
      const tenant = await this.createTenant({ name: `${nomeInquilino} ${sufixo}` });
      const rental = await this.createRental({
        start_date: '2020-01-01',
        end_date: '2031-12-31',
        rent_due_day: 10,
        rent_value: valor,
        tenant_id: tenant.id,
      });
      const statusBanco = status === 'Pago' ? 'paid' : 'pending';
      return DatabaseHelper.insertPayment({
        rental_id: rental.id,
        reference_month: mes,
        reference_year: ano,
        due_date: `${ano}-${mes}-10`,
        expected_amount: valor,
        status: statusBanco,
        payment_kind: kind,
        ...(statusBanco === 'paid' ? { paid_amount: valor, payment_date: `${ano}-${mes}-10` } : {}),
      });
    };

    await criarPagamento('Painel Aluguel E2E', valorAluguel, statusAluguel, 'rent');
    await criarPagamento('Painel Rescisao E2E', valorRescisao, statusRescisao, 'termination');

    this.testData = {
      ...this.testData,
      isolatedPeriodMonth: mes,
      isolatedPeriodYear: ano,
    };
  }
);

/** Lê o valor de um card de métrica do Painel (FinancialMetricCard.tsx -- sem id/data-testid, só título + valor em "R$ X,XX"). */
Then('o card {string} do Painel deve mostrar {string}', async function (this: CustomWorld, titulo: string, valorTexto: string) {
  const esperado = parseFloat(valorTexto);
  const card = this.page.locator('.border-l-4').filter({ hasText: titulo }).first();
  await expect(card, `não encontrei o card "${titulo}" no Painel`).toBeVisible({ timeout: 15000 });

  const texto = await card.textContent();
  const match = texto?.match(/R\$\s*([\d.,]+)/);
  expect(match, `não consegui ler o valor do card "${titulo}" (texto: "${texto}")`).toBeTruthy();

  const valorExibido = parseFloat(match![1].replace(/\./g, '').replace(',', '.'));
  const diff = Math.abs(valorExibido - esperado);
  expect(diff, `esperado R$ ${esperado.toFixed(2)}, mas o card "${titulo}" do Painel mostrou R$ ${valorExibido.toFixed(2)} -- Recebimento de Rescisão pode estar contaminando o total (#120)`).toBeLessThan(0.05);
});

/** Mesma leitura, para os cards ".card"/".card-value" do Financeiro (financial.tsx). */
Then('o card {string} do Financeiro deve mostrar {string}', async function (this: CustomWorld, titulo: string, valorTexto: string) {
  const esperado = parseFloat(valorTexto);
  const card = this.page.locator('.card').filter({ hasText: titulo }).first();
  await expect(card, `não encontrei o card "${titulo}" no Financeiro`).toBeVisible({ timeout: 15000 });

  const texto = await card.locator('.card-value').first().textContent();
  const match = texto?.match(/([\d.,]+)/);
  expect(match, `não consegui ler o valor do card "${titulo}" (texto: "${texto}")`).toBeTruthy();

  const valorExibido = parseFloat(match![1].replace(/\./g, '').replace(',', '.'));
  const diff = Math.abs(valorExibido - esperado);
  expect(diff, `esperado R$ ${esperado.toFixed(2)}, mas o card "${titulo}" do Financeiro mostrou R$ ${valorExibido.toFixed(2)} -- Recebimento de Rescisão pode estar contaminando o total (#49/#120)`).toBeLessThan(0.05);
});
