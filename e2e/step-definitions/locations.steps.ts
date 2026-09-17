import { Given, When } from '@cucumber/cucumber';
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
});

When('preencho o nome do local com o mesmo nome que já existe', async function (this: CustomWorld) {
  const nome = this.testData.nomeLocalCriado;
  if (!nome) {
    throw new Error('Nenhum local foi criado antes deste passo (testData.nomeLocalCriado vazio).');
  }
  await this.page.locator('#locationName').fill(nome);
});
