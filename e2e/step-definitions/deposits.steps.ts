import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import * as os from "os";
import * as path from "path";
import * as XLSX from "xlsx";
import { CustomWorld } from "../support/world";

/**
 * Step Definitions da feature 10-caucoes.feature.
 *
 * ⚠️ O estado (locação atual, parcelas) fica em `this` (World), não em
 * variáveis de módulo — variáveis de módulo vazam entre cenários porque o
 * arquivo é carregado uma única vez pelo processo do Cucumber.
 */

Given("que existe uma locação com caução em 3x", async function (this: CustomWorld) {
  const rental = await this.createRental({
    property_id: this.propertyId,
    tenant_id: this.tenantId,
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    rent_value: 1000,
    security_deposit: 1200,
    deposit_installments: 3,
    deposit_payment_date: "2026-01-01",
    deposit_installment2_payment_date: "2026-02-01",
    deposit_installment3_payment_date: "2026-03-01",
  });

  this.rentalId = rental.id;
  this.testData.depositInstallments = await this.getDepositInstallments(this.rentalId);
});

Given("a locação tem corretor parceiro", async function (this: CustomWorld) {
  await this.updateRental(this.rentalId!, {
    has_partner_broker: true,
    partner_broker_value: 300,
  });
});

Given("que existe uma locação cancelada", async function (this: CustomWorld) {
  const rental = await this.createRental({
    property_id: this.propertyId,
    tenant_id: this.tenantId,
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    rent_value: 1000,
    security_deposit: 1200,
    deposit_installments: 1,
  });

  this.rentalId = rental.id;
  await this.updateRental(this.rentalId, { status: "terminated" });
});

Given("a locação tinha caução de {float}", async function (this: CustomWorld, amount: number) {
  const rental = await this.getRental(this.rentalId!);
  expect(Number(rental.security_deposit)).toBe(amount);
});

Given("que existem locações ativas e canceladas com caução", async function (this: CustomWorld) {
  await this.createRental({
    property_id: this.propertyId,
    tenant_id: this.tenantId,
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    rent_value: 1000,
    security_deposit: 1000,
    status: "active",
  });

  const cancelledProperty = await this.createProperty({
    location_id: this.locationId,
    complement: "Casa 2",
    value: 1000,
  });

  await this.createRental({
    property_id: cancelledProperty.id,
    tenant_id: this.tenantId,
    start_date: "2026-01-01",
    end_date: "2026-06-30",
    rent_value: 1000,
    security_deposit: 1000,
    status: "terminated",
  });
});

Given("que existem {int} locações com caução", async function (this: CustomWorld, count: number) {
  for (let i = 0; i < count; i++) {
    const property = await this.createProperty({
      location_id: this.locationId,
      complement: `Casa ${i + 1}`,
      value: 1000,
    });

    await this.createRental({
      property_id: property.id,
      tenant_id: this.tenantId,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      rent_value: 1000,
      security_deposit: 400,
      deposit_installments: 1,
    });
  }
});

Given("que existem locações com caução", async function (this: CustomWorld) {
  for (let i = 0; i < 2; i++) {
    const property = await this.createProperty({
      location_id: this.locationId,
      complement: `Casa Export ${i + 1}`,
      value: 1000,
    });

    await this.createRental({
      property_id: property.id,
      tenant_id: this.tenantId,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      rent_value: 1000,
      security_deposit: 400,
      deposit_installments: 1,
    });
  }
});

Given("{int} parcelas foram recebidas \\(total R$ {float})", async function (this: CustomWorld, count: number, total: number) {
  const installments = await this.getAllDepositInstallments();

  for (let i = 0; i < count; i++) {
    await this.updateDepositInstallment(installments[i].id, {
      pix_code: `PIX${i + 1}`,
      status: "paid",
    });
  }
});

Given("{int} parcela está pendente \\(R$ {float})", async function (this: CustomWorld, count: number, amount: number) {
  const installments = await this.getAllDepositInstallments();
  const pending = installments.filter((i: any) => i.status === "pending");
  expect(pending.length).toBeGreaterThanOrEqual(count);
});

Given("comissão total é R$ {float}", async function (this: CustomWorld, amount: number) {
  this.totalCommission = amount;
});

Given("a locação tem comissão parceiro {float}", async function (this: CustomWorld, amount: number) {
  const installments = this.testData.depositInstallments;
  for (const installment of installments) {
    await this.updateDepositInstallment(installment.id, { partner_commission: amount });
  }
  this.testData.depositInstallments = await this.getDepositInstallments(this.rentalId!);
});

Given("a locação tem comissão interno {float}", async function (this: CustomWorld, amount: number) {
  const installments = this.testData.depositInstallments;
  for (const installment of installments) {
    await this.updateDepositInstallment(installment.id, { internal_commission: amount });
  }
  this.testData.depositInstallments = await this.getDepositInstallments(this.rentalId!);
});

Given("a parcela {int} foi recebida \\(tem pix_code)", async function (this: CustomWorld, number: number) {
  const installments = this.testData.depositInstallments;
  await this.updateDepositInstallment(installments[number - 1].id, {
    pix_code: "00020126580014br.gov.bcb.pix",
    status: "paid",
  });
  this.testData.depositInstallments = await this.getDepositInstallments(this.rentalId!);
});

Given("as parcelas {int} e {int} estão pendentes", async function (this: CustomWorld, n1: number, n2: number) {
  const installments = this.testData.depositInstallments;
  expect(installments[n1 - 1].status).toBe("pending");
  expect(installments[n2 - 1].status).toBe("pending");
});

When("crio uma locação com:", async function (this: CustomWorld, dataTable: any) {
  const data = dataTable.rowsHash();

  const toISO = (br?: string) => (br ? br.split("/").reverse().join("-") : undefined);

  const rental = await this.createRental({
    property_id: this.propertyId,
    tenant_id: this.tenantId,
    start_date: toISO(data.data_início) || "2026-01-01",
    end_date: toISO(data.data_fim) || "2026-12-31",
    rent_value: parseFloat(data.aluguel),
    security_deposit: parseFloat(data.caução),
    deposit_installments: parseInt(data.parcelas_caução, 10),
    deposit_payment_date: toISO(data.data_início),
    deposit_installment2_payment_date: toISO(data.data_venc_2),
    deposit_installment3_payment_date: toISO(data.data_venc_3),
  });

  this.rentalId = rental.id;
  this.testData.depositInstallments = await this.getDepositInstallments(this.rentalId);
});

When("marco a parcela {int} como recebida:", async function (this: CustomWorld, number: number, dataTable: any) {
  const data = dataTable.rowsHash();
  const installments = this.testData.depositInstallments;

  await this.updateDepositInstallment(installments[number - 1].id, {
    pix_code: data.pix_code,
    payment_date: data.data_pagamento.split("/").reverse().join("-"),
    status: "paid",
  });

  this.testData.depositInstallments = await this.getDepositInstallments(this.rentalId!);
});

When("acesso o relatório financeiro de cauções", async function (this: CustomWorld) {
  await this.page.goto("/financial");
  await this.page.waitForLoadState("domcontentloaded");
  await this.page.getByRole("tab", { name: /parcelas de caução|cauções/i }).click();
  await this.page.waitForTimeout(500);
});

/**
 * Fotografa os números da tela ANTES de mexer neles (issue #76).
 *
 * "os KPIs são recalculados" e "o total de cauções é recalculado" não têm como
 * conferir um valor absoluto: o relatório mostra as cauções de TODAS as
 * locações do banco, não só as do cenário. O que dá para exigir com segurança
 * é que o número tenha MUDADO depois da edição -- e isso só funciona se
 * guardarmos o valor anterior aqui, antes do clique.
 */
async function fotografarNumerosDaTela(world: CustomWorld) {
  const ler = async (testId: string) => {
    const el = world.page.locator(`[data-testid="${testId}"]`).first();
    return (await el.textContent().catch(() => null))?.trim() ?? null;
  };

  world.testData.numerosAntes = {
    esperados: await ler("kpi-caucoes-esperados"),
    recebidos: await ler("kpi-caucoes-recebidos"),
    comissoes: await ler("kpi-comissoes-pagas"),
    liquida: await ler("kpi-receita-liquida"),
    linhaTotal: await ler("deposits-total-row"),
  };
}

When("clico para editar comissão parceiro", async function (this: CustomWorld) {
  await fotografarNumerosDaTela(this);
  await this.page.locator('[data-testid="edit-partner-commission"]').first().click();
});

When("clico para editar comissão interno", async function (this: CustomWorld) {
  await fotografarNumerosDaTela(this);
  await this.page.locator('[data-testid="edit-internal-commission"]').first().click();
});

When("clico para editar valor da parcela {int}", async function (this: CustomWorld, number: number) {
  await fotografarNumerosDaTela(this);
  await this.page.locator(`[data-testid="edit-amount-${number}"]`).click();
});

When("clico para editar valor devolvido", async function (this: CustomWorld) {
  await this.page.locator('[data-testid="edit-returned-deposit"]').click();
});

When("altero o valor para {float}", async function (this: CustomWorld, value: number) {
  await this.page.locator('input[type="text"]:visible').first().fill(value.toString());
});

When("salvo a alteração", async function (this: CustomWorld) {
  await this.page.keyboard.press("Enter");
  await this.page.waitForTimeout(500);
});

When("seleciono filtro {string}", async function (this: CustomWorld, filter: string) {
  const select = this.page.locator('[data-testid="status-filter"], [id*="status-filter"]').first();
  await select.click();
  await this.page.getByRole("option", { name: new RegExp(filter, "i") }).click();
  await this.page.waitForTimeout(500);
});

When("clico para ordenar por {string}", async function (this: CustomWorld, column: string) {
  await this.page.getByRole("columnheader", { name: new RegExp(column, "i") }).click();
});

When("clico novamente", async function (this: CustomWorld) {
  await this.page.locator("th.sorted, [aria-sort]").first().click();
});

Then("o sistema cria {int} parcela\\(s) de caução", async function (this: CustomWorld, count: number) {
  expect(this.testData.depositInstallments.length).toBe(count);
});

Then("o sistema cria {int} parcela de caução", async function (this: CustomWorld, count: number) {
  expect(this.testData.depositInstallments.length).toBe(count);
});

Then("o sistema cria {int} parcelas de caução", async function (this: CustomWorld, count: number) {
  expect(this.testData.depositInstallments.length).toBe(count);
});

Then("a parcela {int} tem valor {float}", async function (this: CustomWorld, number: number, value: number) {
  expect(Number(this.testData.depositInstallments[number - 1].amount)).toBeCloseTo(value, 2);
});

Then("a parcela {int} tem vencimento {string}", async function (this: CustomWorld, number: number, date: string) {
  const expectedDate = date.split("/").reverse().join("-");
  expect(this.testData.depositInstallments[number - 1].due_date).toBe(expectedDate);
});

Then("a parcela {int} tem status {string}", async function (this: CustomWorld, number: number, status: string) {
  expect(this.testData.depositInstallments[number - 1].status).toBe(status);
});

Then("a parcela {int} tem pix_code preenchido", async function (this: CustomWorld, number: number) {
  expect(this.testData.depositInstallments[number - 1].pix_code).toBeTruthy();
});

Then("a linha da parcela {int} fica verde na tabela", async function (this: CustomWorld, number: number) {
  const parcela = this.testData.depositInstallments[number - 1];

  // Até aqui o cenário só mexeu no banco: a tela ainda não foi aberta. A tabela
  // de cauções fica em Financeiro > aba "Cauções".
  await this.page.goto("/financial");
  await this.page.waitForLoadState("domcontentloaded");
  await this.page.locator("#financial-tab-deposits").click();
  await expect(
    this.page.getByRole("columnheader").first(),
    'a tabela da aba "Cauções" não apareceu'
  ).toBeVisible({ timeout: 20000 });

  // O verde fica em cada célula (bg-green-50 quando a parcela tem código PIX),
  // não na linha inteira. A linha é achada pelo código PIX, que é único.
  const linha = this.page
    .locator("tbody tr")
    .filter({ hasText: parcela.pix_code })
    .first();
  await expect(
    linha,
    `não achei na tabela de cauções a parcela ${number} (PIX ${parcela.pix_code})`
  ).toBeVisible({ timeout: 15000 });
  await expect(linha.locator("td.bg-green-50").first()).toBeVisible();
});

Then("todas as parcelas mostram comissão parceiro {float}", async function (this: CustomWorld, amount: number) {
  const installments = await this.getDepositInstallments(this.rentalId!);
  for (const installment of installments) {
    expect(Number(installment.partner_commission)).toBe(amount);
  }
});

Then("todas as parcelas mostram comissão interno {float}", async function (this: CustomWorld, amount: number) {
  const installments = await this.getDepositInstallments(this.rentalId!);
  for (const installment of installments) {
    expect(Number(installment.internal_commission)).toBe(amount);
  }
});

/**
 * ⚠️ Consertado em 10/set/2026 (issue #76 -- falsos positivos).
 *
 * Os dois passos abaixo eram só um `waitForTimeout(500)`: passavam SEMPRE,
 * mesmo que a tela não recalculasse nada. Agora exigem que o número tenha de
 * fato mudado em relação à foto tirada antes da edição
 * (ver fotografarNumerosDaTela).
 */
Then("os KPIs são recalculados", async function (this: CustomWorld) {
  const antes = this.testData.numerosAntes;
  if (!antes) {
    throw new Error(
      'Nenhuma foto dos KPIs foi tirada antes da edição -- o passo "clico para editar ..." precisa rodar antes deste.'
    );
  }

  // "Comissões Pagas" e "Receita Líquida" são os dois KPIs que dependem das
  // comissões; alterar uma comissão TEM que mexer nos dois.
  await expect(
    this.page.locator('[data-testid="kpi-comissoes-pagas"]'),
    `o KPI "Comissões Pagas" continuou em ${antes.comissoes} depois de salvar a comissão -- a tela não recalculou`
  ).not.toHaveText(antes.comissoes ?? "", { timeout: 10000 });

  await expect(
    this.page.locator('[data-testid="kpi-receita-liquida"]'),
    `o KPI "Receita Líquida" continuou em ${antes.liquida} -- ele desconta as comissões, então tinha que mudar junto`
  ).not.toHaveText(antes.liquida ?? "", { timeout: 10000 });
});

Then("o total de cauções é recalculado", async function (this: CustomWorld) {
  const antes = this.testData.numerosAntes;
  if (!antes) {
    throw new Error(
      'Nenhuma foto dos totais foi tirada antes da edição -- o passo "clico para editar valor da parcela N" precisa rodar antes deste.'
    );
  }

  // O KPI "Cauções Esperados" é a soma do valor de todas as parcelas visíveis;
  // mudar o valor de uma parcela obriga ele a mudar.
  await expect(
    this.page.locator('[data-testid="kpi-caucoes-esperados"]'),
    `o KPI "Cauções Esperados" continuou em ${antes.esperados} depois de mudar o valor da parcela -- a soma não foi refeita`
  ).not.toHaveText(antes.esperados ?? "", { timeout: 10000 });

  // E a linha de TOTAL do rodapé da tabela tem que acompanhar.
  await expect(
    this.page.locator('[data-testid="deposits-total-row"]'),
    "a linha de TOTAL do rodapé da tabela não mudou depois da edição"
  ).not.toHaveText(antes.linhaTotal ?? "", { timeout: 10000 });
});

Then("o valor devolvido é {float}", async function (this: CustomWorld, amount: number) {
  const rental = await this.getRental(this.rentalId!);
  expect(Number(rental.returned_deposit_amount)).toBe(amount);
});

Then("o valor aparece em vermelho", async function (this: CustomWorld) {
  const cell = this.page.locator('[data-testid="returned-deposit-amount"]');
  await expect(cell).toHaveClass(/text-red-600/);
});

Then("vejo apenas parcelas de locações ativas", async function (this: CustomWorld) {
  const rows = await this.page.locator('tr[data-rental-status="active"]').count();
  expect(rows).toBeGreaterThan(0);

  const inactiveRows = await this.page.locator('tr[data-rental-status="cancelled"], tr[data-rental-status="terminated"]').count();
  expect(inactiveRows).toBe(0);
});

Then("não vejo a coluna {string}", async function (this: CustomWorld, columnName: string) {
  const column = this.page.getByRole("columnheader", { name: new RegExp(columnName, "i") });
  await expect(column).not.toBeVisible();
});

Then("vejo apenas parcelas de locações canceladas", async function (this: CustomWorld) {
  const rows = await this.page.locator('tr[data-rental-status="cancelled"], tr[data-rental-status="terminated"]').count();
  expect(rows).toBeGreaterThan(0);

  const activeRows = await this.page.locator('tr[data-rental-status="active"]').count();
  expect(activeRows).toBe(0);
});

Then("vejo a coluna {string}", async function (this: CustomWorld, columnName: string) {
  const column = this.page.getByRole("columnheader", { name: new RegExp(columnName, "i") });
  await expect(column).toBeVisible();
});

Then("vejo KPI {string} = {float}", async function (this: CustomWorld, kpiName: string, value: number) {
  const kpi = this.page.locator(`[data-testid="kpi-${kpiName.toLowerCase().replace(/\s+/g, "-")}"]`);
  const text = await kpi.textContent();
  expect(text).toContain(value.toFixed(2));
});

Then("vejo as comissões mescladas \\(rowspan) nas {int} parcelas", async function (this: CustomWorld, count: number) {
  const commissionCell = this.page.locator('[data-testid="commission-cell"]').first();
  const rowspan = await commissionCell.getAttribute("rowspan");
  expect(parseInt(rowspan || "0", 10)).toBe(count);
});

Then("o valor total de comissões é {float}", async function (this: CustomWorld, amount: number) {
  const total = this.page.locator('[data-testid="total-commissions"]');
  const text = await total.textContent();
  expect(text).toContain(amount.toFixed(2));
});

Then("a linha da parcela {int} tem fundo verde", async function (this: CustomWorld, number: number) {
  const row = this.page.locator(`tr[data-installment="${number}"]`);
  await expect(row).toHaveClass(/bg-green-50/);
});

Then("as linhas das parcelas {int} e {int} têm fundo vermelho", async function (this: CustomWorld, n1: number, n2: number) {
  const row1 = this.page.locator(`tr[data-installment="${n1}"]`);
  const row2 = this.page.locator(`tr[data-installment="${n2}"]`);

  await expect(row1).toHaveClass(/bg-red-50/);
  await expect(row2).toHaveClass(/bg-red-50/);
});

Then("as locações são ordenadas alfabeticamente", async function (this: CustomWorld) {
  const cells = await this.page.locator('td[data-testid="location-name"]').allTextContents();
  const sorted = [...cells].sort();
  expect(cells).toEqual(sorted);
});

Then("a ordem é invertida", async function (this: CustomWorld) {
  const cells = await this.page.locator('td[data-testid="location-name"]').allTextContents();
  const sorted = [...cells].sort().reverse();
  expect(cells).toEqual(sorted);
});

Then("um arquivo XLSX é baixado", async function (this: CustomWorld) {
  const download = await this.page.waitForEvent("download");
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);

  // Guarda o arquivo em disco para os dois passos seguintes conseguirem ABRIR
  // a planilha (issue #76): antes eles não conferiam nada.
  const destino = path.join(
    os.tmpdir(),
    `e2e-caucoes-${Date.now()}-${download.suggestedFilename()}`
  );
  await download.saveAs(destino);
  this.testData.xlsxBaixado = destino;
});

/** Abre a planilha baixada e devolve as linhas como objetos. */
function lerPlanilhaBaixada(world: CustomWorld): Record<string, unknown>[] {
  const caminho = world.testData.xlsxBaixado;
  if (!caminho) {
    throw new Error('Nenhuma planilha foi guardada -- o passo "um arquivo XLSX é baixado" precisa rodar antes deste.');
  }
  const wb = XLSX.readFile(caminho);
  const aba = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(aba, { defval: "" });
}

Then("o arquivo contém todas as parcelas visíveis", async function (this: CustomWorld) {
  const linhas = lerPlanilhaBaixada(this);
  // A última linha é o TOTAL (ver o passo seguinte); as demais são parcelas.
  const parcelas = linhas.filter((l) => String(l["Local"]).trim() !== "TOTAL");

  const naTela = await this.page.locator("tbody tr[data-installment]").count();
  const visiveisNaTela = naTela > 0
    ? naTela
    // Fallback: a tabela agrupa por locação; se o atributo não existir, conta
    // as linhas que não são a de TOTAL.
    : (await this.page.locator("tbody tr").count()) - 1;

  expect(
    parcelas.length,
    `a planilha veio com ${parcelas.length} parcela(s), mas a tela mostrava ${visiveisNaTela}. ` +
      "Isso costuma significar que a exportação ignorou o filtro da tela."
  ).toBe(visiveisNaTela);

  // E cada parcela exportada precisa ter os campos que dão sentido à planilha.
  for (const linha of parcelas) {
    expect(String(linha["Parcela"])).toMatch(/^\d+\/\d+$/);
    expect(linha["Inquilino"]).toBeTruthy();
  }
});

Then("o arquivo contém a linha de totais", async function (this: CustomWorld) {
  const linhas = lerPlanilhaBaixada(this);
  const total = linhas[linhas.length - 1];

  expect(
    String(total?.["Local"]).trim(),
    "a última linha da planilha não é a linha de TOTAL"
  ).toBe("TOTAL");

  // O total do valor das parcelas tem que bater com a soma das linhas acima.
  const parcelas = linhas.slice(0, -1);
  const somaEsperada = parcelas.reduce((soma, l) => soma + Number(l["Valor Parcela"] || 0), 0);
  expect(
    Number(total["Valor Parcela"]),
    "o TOTAL da coluna 'Valor Parcela' não bate com a soma das parcelas da própria planilha"
  ).toBeCloseTo(somaEsperada, 2);
});
