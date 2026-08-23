import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Steps do anúncio público (e2e/features/11-anuncio-publico.feature).
 *
 * O ponto central destes steps é que eles rodam SEM login. Todo o resto da
 * suíte começa entrando no Gerenciador, e foi exatamente por isso que o bug
 * do link curto passou despercebido: logado, a página abria normalmente.
 */

Given('que existe um imóvel disponível anunciado', async function (this: CustomWorld) {
  const localizacao = await this.createLocation();
  const imovel = await this.createProperty({
    location_id: localizacao.id,
    status: 'available',
    value: 1234,
  });

  this.propertyId = imovel.id;
  this.testData.imovelAnunciado = imovel;

  // O link curto usa o código sequencial (public_code) com 4 dígitos.
  // Imóveis antigos, anteriores à migração, ainda caem no UUID.
  this.testData.linkCurto =
    imovel.public_code === undefined || imovel.public_code === null
      ? imovel.id
      : String(imovel.public_code).padStart(4, '0');
});

When('abro o link curto do anúncio sem estar logado', async function (this: CustomWorld) {
  // Garante que não existe sessão nenhuma: é este o cenário do interessado
  // que recebeu o link por WhatsApp e nunca entrou no sistema.
  await this.context.clearCookies();
  await this.page.goto('/');
  await this.page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* alguns navegadores bloqueiam; o teste segue mesmo assim */
    }
  });

  await this.page.goto(`/imovel/${this.testData.linkCurto}`);
  await this.page.waitForLoadState('networkidle');
});

Then('devo continuar na página do anúncio', async function (this: CustomWorld) {
  const urlAtual = this.page.url();
  expect(
    urlAtual,
    `O visitante foi tirado do anúncio e jogado para ${urlAtual} — era esperado continuar em /imovel/${this.testData.linkCurto}.`
  ).toContain(`/imovel/${this.testData.linkCurto}`);
});

Then('devo ver o valor do aluguel no anúncio', async function (this: CustomWorld) {
  const valor = this.testData.imovelAnunciado.value as number;
  const formatado = valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  await expect(
    this.page.getByText(new RegExp(formatado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).first()
  ).toBeVisible({ timeout: 10000 });
});
