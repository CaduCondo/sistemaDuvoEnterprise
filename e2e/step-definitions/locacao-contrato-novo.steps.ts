import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import fs from 'fs';
import DatabaseHelper, { supabaseAdmin } from '../helpers/database.helper';
import { garantirLocadorEscolhido } from '../helpers/locacao.helper';
import type { CustomWorld } from '../support/world';

/**
 * Locação nova só é criada com todos os dados do contrato (18/nov/2026).
 * Cenários em 19-locacao-dados-do-contrato.feature.
 */

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function prepararImovelEInquilino(
  world: CustomWorld,
  opcoesInquilino: Parameters<typeof DatabaseHelper.createTenant>[0]
) {
  const sufixo = Date.now();
  const complemento = `[E2E] Contrato ${sufixo}`;
  const imovel = await DatabaseHelper.createProperty({ complement: complemento, value: 1500, status: 'available' });
  const inquilino = await DatabaseHelper.createTenant({ name: `Contrato Novo E2E ${sufixo}`, ...opcoesInquilino });
  world.tenantName = inquilino.name;
  world.testData = {
    ...world.testData,
    complementoDoImovel: complemento,
    imovelId: imovel.id,
    inquilinoId: inquilino.id,
  };
}

Given('um imóvel disponível e um inquilino de teste SEM os dados do contrato', async function (this: CustomWorld) {
  await prepararImovelEInquilino(this, { semDadosDoContrato: true });
});

Given('um imóvel disponível e um inquilino de teste SEM apenas o RG', async function (this: CustomWorld) {
  await prepararImovelEInquilino(this, { rg: '' });
});

Given('um imóvel disponível e um inquilino de teste COM todos os dados do contrato', async function (this: CustomWorld) {
  await prepararImovelEInquilino(this, {});
});

When('preencho uma nova locação para esse imóvel e esse inquilino', { timeout: 60 * 1000 }, async function (this: CustomWorld) {
  await this.page.goto('/rentals');
  await this.page.waitForLoadState('domcontentloaded');
  await this.page.getByRole('button', { name: /nova locação/i }).click();

  await this.page.locator('#rental-property').click();
  await this.page
    .getByRole('option', { name: new RegExp(escapar(this.testData.complementoDoImovel), 'i') })
    .click();

  await this.page.locator('#rental-tenant').click();
  await this.page.getByRole('option', { name: new RegExp(escapar(this.tenantName!), 'i') }).click();

  await this.page.locator('#rental-start-date').fill('2026-12-01');
  await this.page.locator('#rental-end-date').fill('2027-11-30');
  await this.page.locator('#rental-payment-day').click();
  await this.page.getByRole('option', { name: '5', exact: true }).click();

  await this.page.locator('#rental-deposit-amount').fill('1500.00');
  await this.page.locator('#rental-deposit-date').fill('2026-12-01');
});

When('clico em criar locação', { timeout: 60 * 1000 }, async function (this: CustomWorld) {
  await garantirLocadorEscolhido(this.page);
  await this.page.locator('#rental-form-submit').click();
});

Then('devo ver o aviso {string} listando {string}', async function (this: CustomWorld, titulo: string, item: string) {
  const alerta = this.page.getByRole('alertdialog');
  await expect(alerta, 'o aviso de dados faltando não apareceu').toBeVisible({ timeout: 20000 });
  await expect(alerta).toContainText(titulo);
  await expect(alerta).toContainText(item);
});

Then('o aviso também deve listar {string}', async function (this: CustomWorld, item: string) {
  await expect(this.page.getByRole('alertdialog')).toContainText(item);
});

Then('o aviso NÃO deve listar {string}', async function (this: CustomWorld, item: string) {
  await expect(this.page.getByRole('alertdialog')).not.toContainText(item);
});

async function contarLocacoesDoInquilino(world: CustomWorld): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', world.testData.inquilinoId);
  if (error) throw new Error(`Falha ao contar locações do inquilino: ${error.message}`);
  return count ?? 0;
}

Then('nenhuma locação deve existir para esse inquilino', async function (this: CustomWorld) {
  // Dá um tempinho: se o sistema criasse a locação "mesmo assim", ela já teria chegado ao banco.
  await this.page.waitForTimeout(2000);
  expect(await contarLocacoesDoInquilino(this), 'a locação foi criada mesmo faltando dados do contrato').toBe(0);
});

Then('uma locação deve existir para esse inquilino', async function (this: CustomWorld) {
  await expect
    .poll(() => contarLocacoesDoInquilino(this), { timeout: 20000, message: 'a locação não foi criada' })
    .toBe(1);
});

Then('o imóvel de teste deve continuar {string}', async function (this: CustomWorld, status: string) {
  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('status')
    .eq('id', this.testData.imovelId)
    .single();
  if (error) throw new Error(`Falha ao ler o imóvel de teste: ${error.message}`);
  expect(data?.status, 'o imóvel mudou de status mesmo sem a locação ser criada').toBe(status);
});

Then('o contrato deve abrir com o nome do inquilino e o texto do locador', async function (this: CustomWorld) {
  await expect(this.page.locator('#contrato-locacao-dialog')).toBeVisible({ timeout: 30000 });
  const documento = this.page.locator('#contrato-documento');
  await expect(documento, 'o contrato não foi montado (faltou algum dado?)').toBeVisible({ timeout: 30000 });
  await expect(documento).toContainText(this.tenantName!.replace(/ \[E2E\]$/, ''));
  await expect(documento).toContainText('LOCADOR:');
  // O texto antigo do "Comprovante" não pode aparecer mais.
  await expect(this.page.getByText('Comprovante de Registro')).toHaveCount(0);
});

Then('a assinatura do locador deve aparecer no contrato', async function (this: CustomWorld) {
  const assinatura = this.page.locator('#contrato-documento img[alt="Assinatura do locador"]');
  await expect(assinatura, 'a assinatura do locador não saiu no contrato').toBeVisible({ timeout: 15000 });
  const carregou = await assinatura.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  expect(carregou, 'a imagem da assinatura não carregou').toBe(true);
});

When('clico em {string} no contrato', { timeout: 60 * 1000 }, async function (this: CustomWorld, rotulo: string) {
  await expect(this.page.locator('#contrato-documento')).toBeVisible({ timeout: 30000 });
  const [download] = await Promise.all([
    this.page.waitForEvent('download', { timeout: 45000 }),
    this.page.getByRole('button', { name: rotulo }).click(),
  ]);
  this.testData = { ...this.testData, download };
});

Then('o arquivo baixado deve ser um PDF chamado com o nome do inquilino', async function (this: CustomWorld) {
  const download = this.testData.download;
  const nome: string = download.suggestedFilename();
  expect(nome.startsWith('Contrato - '), `nome do arquivo inesperado: ${nome}`).toBe(true);
  expect(nome.endsWith('.pdf')).toBe(true);
  const caminho = await download.path();
  const bytes = fs.readFileSync(caminho);
  expect(bytes.subarray(0, 5).toString(), 'o arquivo baixado não é um PDF').toBe('%PDF-');
  // Um contrato real tem várias páginas e algumas dezenas de KB; o defeito
  // antigo gerava 15 páginas iguais da tela errada.
  expect(bytes.length, 'PDF pequeno demais para um contrato').toBeGreaterThan(20 * 1024);
});

// ---------------------------------------------------------------- usuários

Then('a coluna {string} deve existir na lista de usuários', async function (this: CustomWorld, nome: string) {
  await expect(this.page.getByRole('columnheader', { name: nome })).toBeVisible({ timeout: 15000 });
});

Then('deve haver pelo menos um usuário com o V verde de locador', async function (this: CustomWorld) {
  await expect(this.page.locator('[aria-label="É locador"]').first()).toBeVisible({ timeout: 15000 });
});

Then('deve haver pelo menos um usuário com o X vermelho de não locador', async function (this: CustomWorld) {
  await expect(this.page.locator('[aria-label="Não é locador"]').first()).toBeVisible({ timeout: 15000 });
});

Given('um usuário de teste que ainda não é locador', async function (this: CustomWorld) {
  const sufixo = Date.now();
  const email = `locador.e2e.${sufixo}@teste.com`;
  await DatabaseHelper.ensureTestUser({
    email,
    password: 'Locador@123',
    name: `Usuario Locador E2E ${sufixo}`,
    role: 'broker',
  });
  this.testData = { ...this.testData, emailUsuarioTeste: email };
});

When('abro o cadastro desse usuário de teste', async function (this: CustomWorld) {
  await this.page.getByRole('row').filter({ hasText: this.testData.emailUsuarioTeste }).first().click();
  await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
});

When('marco a caixa {string}', async function (this: CustomWorld, _rotulo: string) {
  await this.page.locator('#is_landlord').click();
  await expect(this.page.locator('#landlord_bank_name')).toBeVisible({ timeout: 5000 });
});

Then('o campo Chave PIX deve ficar na mesma linha do campo Conta', async function (this: CustomWorld) {
  const conta = await this.page.locator('#landlord_bank_account').boundingBox();
  const pix = await this.page.locator('#landlord_pix_key').boundingBox();
  expect(conta && pix, 'não achei os campos Conta e Chave PIX').toBeTruthy();
  expect(Math.abs(conta!.y - pix!.y), 'Conta e Chave PIX não estão na mesma linha').toBeLessThan(8);
  expect(pix!.x, 'a Chave PIX deve ficar à direita da Conta').toBeGreaterThan(conta!.x);
});

When('abro o combo de Banco', async function (this: CustomWorld) {
  await this.page.locator('#landlord_bank_name').click();
  await expect(this.page.locator('#landlord_bank_name-busca')).toBeVisible({ timeout: 5000 });
});

Then('a lista de bancos não deve ter o item {string}', async function (this: CustomWorld, texto: string) {
  await expect(this.page.locator('#landlord_bank_name-lista')).not.toContainText(texto);
});

When('pesquiso {string} no combo de Banco', async function (this: CustomWorld, texto: string) {
  // Clica de verdade dentro do campo (era o defeito: não aceitava clique) e digita.
  const busca = this.page.locator('#landlord_bank_name-busca');
  await busca.click();
  await busca.fill(texto);
});

Then('devo ver o banco {string} na lista', async function (this: CustomWorld, banco: string) {
  await expect(this.page.locator('#landlord_bank_name-lista').getByRole('button', { name: banco })).toBeVisible({
    timeout: 5000,
  });
});

When('escolho o banco {string}', async function (this: CustomWorld, banco: string) {
  await this.page.locator('#landlord_bank_name-lista').getByRole('button', { name: banco }).click();
});

Then('o combo de Banco deve mostrar {string}', async function (this: CustomWorld, banco: string) {
  await expect(this.page.locator('#landlord_bank_name')).toContainText(banco);
});

// 1x1 PNG
const PNG_ASSINATURA = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

When('anexo uma imagem de assinatura', { timeout: 60 * 1000 }, async function (this: CustomWorld) {
  await this.page.locator('#signature-file').setInputFiles({
    name: 'assinatura-e2e.png',
    mimeType: 'image/png',
    buffer: PNG_ASSINATURA,
  });
  await expect(this.page.locator('#signature-preview'), 'a miniatura da assinatura não apareceu').toBeVisible({
    timeout: 30000,
  });
});

Then('devo ver a miniatura da assinatura', async function (this: CustomWorld) {
  await expect(this.page.locator('#signature-preview')).toBeVisible();
});

Then('o botão {string} da assinatura não deve aparecer', async function (this: CustomWorld, _rotulo: string) {
  await expect(this.page.locator('#signature-escolher')).toHaveCount(0);
});

Then('o botão {string} da assinatura deve aparecer', async function (this: CustomWorld, _rotulo: string) {
  await expect(this.page.locator('#signature-escolher')).toBeVisible({ timeout: 5000 });
});

When('removo a assinatura pelo X vermelho', async function (this: CustomWorld) {
  // O X só aparece com o mouse em cima da imagem.
  await this.page.locator('#signature-preview').hover();
  const x = this.page.locator('#signature-remove');
  await expect(x, 'o X vermelho não apareceu ao passar o mouse na assinatura').toBeVisible({ timeout: 5000 });
  await x.click();
});

Then('a miniatura da assinatura não deve aparecer', async function (this: CustomWorld) {
  await expect(this.page.locator('#signature-preview')).toHaveCount(0);
});

// ---------------------------------------------------------------- contrato guardado sozinho

Then('o rodapé do contrato deve ter só os botões {string} e {string}', async function (this: CustomWorld, a: string, b: string) {
  const dialogo = this.page.locator('#contrato-locacao-dialog');
  await expect(dialogo.getByRole('button', { name: a })).toBeVisible({ timeout: 30000 });
  await expect(dialogo.getByRole('button', { name: b, exact: true })).toBeVisible();
  await expect(dialogo.getByRole('button', { name: /guardar nos anexos/i })).toHaveCount(0);
  await expect(dialogo.locator('#contrato-guardar')).toHaveCount(0);
});

async function contratosNosAnexos(world: CustomWorld): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from('rentals')
    .select('attachments')
    .eq('tenant_id', world.testData.inquilinoId)
    .single();
  if (error) throw new Error(`Falha ao ler os anexos da locação: ${error.message}`);
  const lista = Array.isArray(data?.attachments) ? data!.attachments : [];
  return lista.filter((a: any) => a?.category === 'contract');
}

Then('o contrato deve ser guardado sozinho nos anexos da locação em {int} arquivo PDF', async function (this: CustomWorld, qtd: number) {
  await expect
    .poll(async () => (await contratosNosAnexos(this)).length, {
      timeout: 60000,
      message: 'o contrato não foi guardado automaticamente nos anexos',
    })
    .toBe(qtd);
  const [contrato] = await contratosNosAnexos(this);
  expect(contrato.type).toBe('application/pdf');
  expect(String(contrato.url).startsWith('http'), 'o anexo deve apontar para o Storage, não para disco local').toBe(true);
});

Then('a locação deve continuar com {int} só contrato nos anexos', async function (this: CustomWorld, qtd: number) {
  await this.page.waitForTimeout(2000);
  expect((await contratosNosAnexos(this)).length, 'o contrato foi duplicado nos anexos').toBe(qtd);
});

Then('a lista de locações não deve ter botão de gerar contrato', async function (this: CustomWorld) {
  await this.page.waitForLoadState('domcontentloaded');
  await expect(this.page.locator('[id^="rentals-contract-"]')).toHaveCount(0);
  await expect(this.page.locator('button[title="Gerar contrato"]')).toHaveCount(0);
});
