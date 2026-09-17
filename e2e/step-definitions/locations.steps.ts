import { Given, When } from '@cucumber/cucumber';
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
});

When('abro a aba {string} das Configurações', async function (this: CustomWorld, aba: string) {
  await this.page.goto('/settings');
  await this.page.waitForLoadState('domcontentloaded');
  const tab = this.page.getByRole('tab', { name: new RegExp(aba, 'i') });
  await tab.waitFor({ state: 'visible', timeout: 10000 });
  await tab.click();
  await this.page.waitForTimeout(300);
});

When('preencho o nome do local com o mesmo nome que já existe', async function (this: CustomWorld) {
  const nome = this.testData.nomeLocalCriado;
  if (!nome) {
    throw new Error('Nenhum local foi criado antes deste passo (testData.nomeLocalCriado vazio).');
  }
  await this.page.locator('#locationName').fill(nome);
});
