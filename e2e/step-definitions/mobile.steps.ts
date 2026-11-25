import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Passos de layout no celular (issues #134, #135, #136).
 *
 * ⚠️ Estes passos medem a tela DE VERDADE (posição e tamanho dos elementos).
 * O passo antigo "as tabelas devem ser scrolláveis horizontalmente" só
 * conferia que existia algum elemento com `overflow-x-auto` em qualquer lugar
 * da página -- passava mesmo com a tabela de Imóveis cortada e sem rolagem
 * (falso positivo, achado em 25/nov/2026).
 */

When('clico na visão em grade de Locações', async function (this: CustomWorld) {
  await this.page.locator('#rentals-view-grid').click();
  await this.page.waitForTimeout(500);
});

/**
 * A tabela precisa ROLAR para o lado de verdade: o contêiner tem conteúdo mais
 * largo que a área visível, e mandar rolar muda a posição. E a PÁGINA em si
 * não pode ganhar rolagem lateral (quem rola é a tabela).
 */
Then('a tabela deve rolar para o lado sem a página rolar', async function (this: CustomWorld) {
  const tabela = this.page.locator('table:visible').first();
  await expect(tabela, 'não apareceu nenhuma tabela na tela').toBeVisible({ timeout: 15000 });

  const resultado = await tabela.evaluate((el) => {
    // Sobe até achar o contêiner que realmente rola na horizontal.
    // O PRIMEIRO ancestral que corta o que passa da largura (overflow-x diferente
    // de "visible") é quem decide: se ele for "hidden", a tabela fica cortada e
    // sem rolagem (era o defeito da #134); tem que ser "auto"/"scroll".
    let pai: HTMLElement | null = el.parentElement;
    while (pai && pai !== document.body) {
      if (getComputedStyle(pai).overflowX !== 'visible') break;
      pai = pai.parentElement;
    }
    if (!pai || pai === document.body) return { achou: false } as any;
    const overflowX = getComputedStyle(pai).overflowX;
    const conteudoMaisLargo = pai.scrollWidth > pai.clientWidth + 1;
    pai.scrollLeft = 120;
    return {
      achou: overflowX === 'auto' || overflowX === 'scroll',
      conteudoMaisLargo,
      rolou: pai.scrollLeft > 0,
      paginaRola: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

  expect(resultado.achou, 'a tabela está cortada: o contêiner que a envolve tem overflow-x "hidden" em vez de "auto" (sem rolagem lateral)').toBe(true);
  expect(resultado.conteudoMaisLargo, 'a tabela coube na tela: este teste precisa de uma tabela mais larga que o celular').toBe(true);
  expect(resultado.rolou, 'mandei rolar a tabela para o lado e ela não saiu do lugar').toBe(true);
  expect(resultado.paginaRola, 'a página inteira ganhou rolagem lateral (só a tabela deveria rolar)').toBe(false);
});

/** "Imóveis Vagos", "Inquilinos Disponíveis" e "Nova Locação": um embaixo do outro. */
Then('os combos e o botão de Locações devem estar um abaixo do outro', async function (this: CustomWorld) {
  const vagos = this.page.getByText(/Imóveis Vagos/).first();
  const inquilinos = this.page.getByText(/Inquilinos Disponíveis/).first();
  const nova = this.page.getByRole('button', { name: /Nova Locação/ }).first();
  await expect(vagos).toBeVisible({ timeout: 15000 });

  const a = await vagos.boundingBox();
  const b = await inquilinos.boundingBox();
  const c = await nova.boundingBox();
  expect(a && b && c, 'não achei os três itens na tela').toBeTruthy();

  expect(b!.y, '"Inquilinos Disponíveis" deveria estar abaixo de "Imóveis Vagos"').toBeGreaterThan(a!.y + a!.height - 1);
  expect(c!.y, '"Nova Locação" deveria estar abaixo de "Inquilinos Disponíveis"').toBeGreaterThan(b!.y + b!.height - 1);

  // Nada cortado: tudo dentro da largura da tela.
  const largura = this.page.viewportSize()!.width;
  for (const [nome, caixa] of [['Imóveis Vagos', a], ['Inquilinos Disponíveis', b], ['Nova Locação', c]] as const) {
    expect(caixa!.x, `"${nome}" ficou cortado à esquerda`).toBeGreaterThanOrEqual(0);
    expect(caixa!.x + caixa!.width, `"${nome}" ficou cortado à direita`).toBeLessThanOrEqual(largura + 1);
  }
});

/** Card de locação (grade): rótulo e valor numa linha só; botões abaixo do valor. */
Then('no card da locação o valor fica em uma linha e os botões abaixo dele', async function (this: CustomWorld) {
  const id = this.testData.locacaoAtivaId;
  expect(id, 'nenhuma locação de teste foi criada antes deste passo').toBeTruthy();

  const botao = this.page.locator(`#rentals-history-${id}`);
  await expect(botao, 'o card da locação de teste não apareceu na grade').toBeVisible({ timeout: 15000 });

  // Bloco (border-t) do card que contém o rótulo e os botões.
  const bloco = botao.locator('xpath=ancestor::div[.//p[normalize-space()="Valor do Aluguel"]][1]');
  const rotulo = bloco.getByText('Valor do Aluguel');
  const valor = bloco.getByText(/^R\$\s*[\d.]+,\d{2}$/);

  const r = await rotulo.boundingBox();
  const v = await valor.boundingBox();
  const b = await botao.boundingBox();
  expect(r && v && b, 'não achei rótulo, valor e botão no card').toBeTruthy();

  // Uma linha só: altura de uma linha de texto (text-sm ≈ 20px; text-2xl ≈ 32px).
  expect(r!.height, '"Valor do Aluguel" quebrou em mais de uma linha').toBeLessThan(28);
  expect(v!.height, 'o valor "R$ X.XXX,XX" quebrou em mais de uma linha').toBeLessThan(44);
  // Botões abaixo do valor (e não ao lado).
  expect(b!.y, 'os botões de ação deveriam ficar ABAIXO do valor').toBeGreaterThanOrEqual(v!.y + v!.height - 1);
});
