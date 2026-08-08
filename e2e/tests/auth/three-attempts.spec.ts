import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";
import { DatabaseHelper } from "../../helpers/database.helper";

/**
 * Sistema de bloqueio por 3 tentativas de senha incorreta.
 *
 * Mecânica real (src/services/authService.ts + src/components/public/
 * PublicHeader.tsx): o servidor incrementa `login_attempts` e bloqueia por
 * 30 min após a 3ª falha; o TEXTO exibido na tela ("Você tem mais N
 * tentativa(s)") é recalculado no cliente a partir de um contador React
 * local (`attempts`, começa em 0 a cada carregamento de página) — por
 * isso cada cenário usa `page.goto('/')` uma única vez no início e um
 * usuário dedicado com `login_attempts: 0`, para o contador do cliente e o
 * do banco ficarem sincronizados.
 *
 * ⚠️ Reescrito em 2026-08: usava rota "/login" inexistente, seletores por
 * placeholder que não existem na UI real, e e-mails fictícios nunca
 * seedados no banco.
 */

function freshUser(suffix: string) {
  return {
    email: `e2e.attempts.${suffix}@teste.com`,
    password: "Correta@123",
    name: `E2E Attempts ${suffix}`,
    role: "broker" as const,
  };
}

test.describe("Sistema de 3 Tentativas", () => {
  test("deve mostrar mensagens decrescentes de tentativas", async ({ page }) => {
    const user = freshUser("decrescente");
    await DatabaseHelper.ensureTestUser(user);

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.openLoginDropdown();

    await loginPage.usernameInput.fill(user.email);
    await loginPage.passwordInput.fill("senhaerrada1");
    await loginPage.submitButton.click();
    await expect(page.getByText(/você tem mais 2 tentativa/i)).toBeVisible({ timeout: 6000 });

    await loginPage.passwordInput.fill("senhaerrada2");
    await loginPage.submitButton.click();
    await expect(page.getByText(/você tem mais 1 tentativa/i)).toBeVisible({ timeout: 6000 });

    await loginPage.passwordInput.fill("senhaerrada3");
    await loginPage.submitButton.click();
    await expect(page.getByText(/bloqueada temporariamente/i).first()).toBeVisible({ timeout: 6000 });
  });

  test("deve bloquear conta após 3 tentativas falhas e continuar bloqueada mesmo com a senha certa", async ({ page }) => {
    const user = freshUser("bloqueio");
    await DatabaseHelper.ensureTestUser(user);

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.openLoginDropdown();

    for (let i = 1; i <= 3; i++) {
      await loginPage.usernameInput.fill(user.email);
      await loginPage.passwordInput.fill(`senhaerrada${i}`);
      await loginPage.submitButton.click();
      await page.waitForTimeout(600);
    }

    await expect(page.getByText(/30 minutos/i).first()).toBeVisible({ timeout: 6000 });

    // Reabrir o dropdown (a 3ª falha fecha o dropdown automaticamente) e
    // tentar com a senha CORRETA — deve continuar bloqueado.
    await loginPage.openLoginDropdown();
    await loginPage.usernameInput.fill(user.email);
    await loginPage.passwordInput.fill(user.password);
    await loginPage.submitButton.click();

    await expect(page.getByText(/bloqueada/i).first()).toBeVisible({ timeout: 6000 });
    expect(page.url()).not.toContain("/dashboard");
  });

  test("deve resetar tentativas após login bem-sucedido", async ({ page }) => {
    const user = freshUser("reset");
    await DatabaseHelper.ensureTestUser(user);

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.openLoginDropdown();

    // 2 tentativas erradas (não bloqueia)
    await loginPage.usernameInput.fill(user.email);
    await loginPage.passwordInput.fill("senhaerrada1");
    await loginPage.submitButton.click();
    await page.waitForTimeout(600);

    await loginPage.passwordInput.fill("senhaerrada2");
    await loginPage.submitButton.click();
    await page.waitForTimeout(600);

    // Login correto — reseta as tentativas no banco
    await loginPage.passwordInput.fill(user.password);
    await loginPage.submitButton.click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    // Logout e nova tentativa errada — contador do cliente reinicia junto
    // com a página, e o do banco já foi resetado no login bem-sucedido.
    await page.locator("#layout-user-menu-trigger").click();
    await page.locator("#layout-menu-logout").click();
    await page.waitForURL("/");

    await loginPage.openLoginDropdown();
    await loginPage.usernameInput.fill(user.email);
    await loginPage.passwordInput.fill("senhaerrada");
    await loginPage.submitButton.click();

    await expect(page.getByText(/você tem mais 2 tentativa/i)).toBeVisible({ timeout: 6000 });
  });
});
