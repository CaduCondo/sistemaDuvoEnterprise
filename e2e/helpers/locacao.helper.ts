import { expect, type Page } from '@playwright/test';

/**
 * No formulário de Nova Locação o campo "Quem é o Locador?" é obrigatório.
 * Com um único locador cadastrado ele já vem escolhido, mas só depois que a
 * lista carrega -- por isso os passos que criam locação pela tela chamam isto
 * antes de clicar em "Criar Locação": espera a lista carregar e, se o campo
 * ainda estiver vazio, escolhe o primeiro locador.
 */
export async function garantirLocadorEscolhido(page: Page): Promise<void> {
  const combo = page.locator('#rental-landlord');
  await expect(combo, 'o campo "Quem é o Locador?" não apareceu no formulário').toBeVisible({ timeout: 10000 });

  // Espera o carregamento da lista: o texto deixa de ser "Selecione"/"Nenhum..."
  // (se continuar assim, é porque ninguém foi escolhido e escolhemos abaixo).
  await page.waitForTimeout(1500);
  const texto = ((await combo.innerText()) || '').trim();
  if (/selecione|nenhum/i.test(texto)) {
    await combo.click();
    const opcao = page.getByRole('option').first();
    await expect(opcao, 'não há nenhum usuário marcado "Também é locador" para escolher').toBeVisible({ timeout: 5000 });
    await opcao.click();
  }
}

export async function escolherLocadorPeloNome(page: Page, nome: string): Promise<void> {
  await page.locator('#rental-landlord').click();
  await page.getByRole('option', { name: nome }).click();
}
