// ⚠️ 17/set/2026: o `Then` faltava neste import e derrubou a rodada #77
// inteira ("ReferenceError: Then is not defined") -- o Cucumber nem chegou a
// carregar os cenários, os dois jobs morreram em menos de 2 minutos e nenhum
// teste rodou. Toda vez que este arquivo ganhar um passo "Então", o `Then`
// precisa estar aqui.
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Step definitions da aba "Locais" em Configurações (feature 13-locais-crud).
 * Seletores baseados em src/pages/settings.tsx.
 */

Given('que existe um local {string}', async function (this: CustomWorld, nome: string) {
  const location = await this.createLocation({ name: nome });
  // ⚠️ createLocation (database.helper.ts) selo o nome com " [E2E]"
  // (comMarcaDeTeste) -- guardamos o nome REAL gravado no banco, não o
  // literal do Gherkin, para o passo de preencher o formulário reusar o
  // valor exato que já existe (ver "preencho o nome do local com o mesmo
  // nome que já existe", abaixo).
  this.testData.nomeLocalCriado = location.name;
  // O id é usado por cenários que precisam criar algo DENTRO deste local
  // (ex.: "que existe um imóvel nesse local", em properties.steps.ts).
  this.testData.idLocalCriado = location.id;
});

// ⚠️ Corrigido em 17/set/2026 (CI run #74, issue #99): lido settings.tsx --
// `handleLocationSubmit` compara o nome novo contra o array `locations` (já
// carregado em memória) para bloquear duplicado. Esse array só é preenchido
// depois que a página busca os locais no banco -- um `waitForTimeout(300)`
// fixo não garante que essa busca já terminou. Se o cenário tenta cadastrar
// o nome duplicado ANTES da lista carregar, `locations` ainda está vazio,
// `jaExiste` dá falso, e o sistema cria o local (mensagem de sucesso) em vez
// de bloquear -- exatamente o sintoma visto no CI ("Já existe um Local
// chamado" nunca aparece). Se um local foi criado por um passo anterior
// (`que existe um local`), espera ele aparecer na lista de verdade antes de
// seguir.
When('abro a aba {string} das Configurações', async function (this: CustomWorld, aba: string) {
  await this.page.goto('/settings');
  await this.page.waitForLoadState('domcontentloaded');
  const tab = this.page.getByRole('tab', { name: new RegExp(aba, 'i') });
  await tab.waitFor({ state: 'visible', timeout: 10000 });
  await tab.click();
  await this.page.waitForTimeout(300);

  if (/locais/i.test(aba) && this.testData.nomeLocalCriado) {
    await expect(
      this.page.getByText(this.testData.nomeLocalCriado, { exact: false }).first(),
      `a lista de Locais não terminou de carregar -- não achei "${this.testData.nomeLocalCriado}" na tela`
    ).toBeVisible({ timeout: 10000 });
  }

  // Mesma espera para Formas de Pagamento (17/set/2026) -- a checagem de
  // repetido também compara contra a lista já carregada.
  if (/pagamento/i.test(aba) && this.testData.nomeFormaPagamentoCriada) {
    await expect(
      this.page.getByText(this.testData.nomeFormaPagamentoCriada, { exact: false }).first(),
      `a lista de Formas de Pagamento não terminou de carregar -- não achei "${this.testData.nomeFormaPagamentoCriada}" na tela`
    ).toBeVisible({ timeout: 10000 });
  }
});

When('preencho o nome do local com o mesmo nome que já existe', async function (this: CustomWorld) {
  const nome = this.testData.nomeLocalCriado;
  if (!nome) {
    throw new Error('Nenhum local foi criado antes deste passo (testData.nomeLocalCriado vazio).');
  }
  await this.page.locator('#locationName').fill(nome);
});

/**
 * ⚠️ Criado em 17/set/2026 (issue #99): regra geral pedida pelo Cadu a partir
 * da #106 -- nenhum cadastro do sistema pode aceitar item repetido, e nenhum
 * pode aceitar a inclusão antes de conseguir CONFERIR se é repetido. A tela de
 * Formas de Pagamento não tinha checagem nenhuma (dava pra ter duas "PIX").
 */
Given('que existe uma forma de pagamento {string}', async function (this: CustomWorld, nome: string) {
  const DatabaseHelper = (await import('../helpers/database.helper')).default;
  const forma = await DatabaseHelper.createPaymentMethod({ name: nome });
  // Guarda o nome REAL gravado (com o selo " [E2E]") -- mesmo motivo
  // explicado no "que existe um local {string}", lá em cima.
  this.testData.nomeFormaPagamentoCriada = forma.name;
});

When('preencho o nome da forma de pagamento com o mesmo nome que já existe', async function (this: CustomWorld) {
  const nome = this.testData.nomeFormaPagamentoCriada;
  if (!nome) {
    throw new Error('Nenhuma forma de pagamento foi criada antes deste passo (testData.nomeFormaPagamentoCriada vazio).');
  }
  await this.page.locator('#paymentMethodName').fill(nome);
});

/**
 * O botão de salvar nasce bloqueado ("Carregando...") e só libera quando a
 * lista chega do banco -- é isso que impede a checagem de repetido de rodar
 * contra uma lista vazia. Conferir que ele LIBERA é o que prova que a trava
 * não ficou presa (um botão eternamente bloqueado também seria defeito).
 */
Then('o botão de salvar do cadastro deve estar liberado', async function (this: CustomWorld) {
  const botao = this.page.locator('#settings-location-submit');
  await expect(botao, 'o botão de salvar do cadastro de Locais não apareceu').toBeVisible({ timeout: 10000 });
  await expect(botao, 'o botão de salvar continuou bloqueado mesmo depois da lista carregar').toBeEnabled({ timeout: 15000 });
});
