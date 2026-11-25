import { Page } from '@playwright/test';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** "Março" -> 3 (aceita sem acento). */
export function numeroDoMes(nome: string): number {
  const n = nome.trim().toLowerCase().replace('marco', 'março');
  const i = MESES.indexOf(n);
  if (i < 0) throw new Error(`Não reconheci o mês "${nome}".`);
  return i + 1;
}

/**
 * Escolhe o(s) mês(es) no seletor de período (#period-selector-month).
 *
 * Dois formatos existem no sistema (issue #137):
 *  - Recebimentos e Painel: lista de UM mês (opções `role="option"`);
 *  - Financeiro: combo com checkbox por mês (vários meses).
 * Este passo funciona nos dois: no combo de checkboxes, deixa marcados
 * EXATAMENTE os meses pedidos.
 */
export async function escolherMesesNoSeletor(page: Page, nomesDosMeses: string[]): Promise<void> {
  const alvo = new Set(nomesDosMeses.map(numeroDoMes));
  await page.locator('#period-selector-month').click();
  await page.waitForTimeout(300);

  const multi = await page.locator('#period-month-toggle-all').isVisible({ timeout: 1500 }).catch(() => false);
  if (!multi) {
    if (alvo.size !== 1) throw new Error('Este seletor só aceita um mês (lista simples).');
    const nome = MESES[[...alvo][0] - 1];
    await page.getByRole('option', { name: new RegExp(`^${nome}$`, 'i') }).click();
    return;
  }

  // Marca primeiro os que faltam, depois desmarca os que sobram.
  for (const querMarcado of [true, false]) {
    for (let mes = 1; mes <= 12; mes++) {
      if (alvo.has(mes) !== querMarcado) continue;
      const caixa = page.locator(`#period-month-${mes}`);
      if ((await caixa.isChecked()) !== querMarcado) {
        await caixa.click();
        await page.waitForTimeout(150);
      }
    }
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
