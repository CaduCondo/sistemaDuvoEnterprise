import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";
import { DatabaseHelper } from "../../helpers/database.helper";

/**
 * Recuperação de senha ("Esqueci minha senha") — formulário embutido no
 * dropdown "Gerenciador", ver src/components/public/PublicHeader.tsx
 * (handleForgotPasswordSubmit).
 *
 * ⚠️ Reescrito em 2026-08: usava seletores de uma rota "/login" antiga
 * (`input[placeholder="Digite seu usuário"]`) e uma afirmação de texto
 * ("www.duvoenterprise.com.br") que não existe em lugar nenhum do
 * componente real.
 */

test.describe("Recuperação de Senha", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("deve exibir tela de recuperação ao clicar em 'Esqueci minha senha'", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.openLoginDropdown();
    await loginPage.openForgotPasswordModal();

    await expect(page.getByText("Recuperar Senha")).toBeVisible();
    await expect(page.getByText("Digite seu e-mail para receber uma senha temporária")).toBeVisible();
    await expect(loginPage.resetEmailInput).toBeVisible();
  });

  test("deve voltar para tela de login ao clicar em Voltar", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.openLoginDropdown();
    await loginPage.openForgotPasswordModal();

    await loginPage.resetBackButton.click();

    await expect(loginPage.usernameInput).toBeVisible();
  });

  test("deve exigir e-mail preenchido (validação HTML5)", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.openLoginDropdown();
    await loginPage.openForgotPasswordModal();

    const isValid = await loginPage.resetEmailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });

  test("deve enviar senha temporária para e-mail cadastrado", async ({ page }) => {
    const user = {
      email: "e2e.recovery.ok@teste.com",
      password: "Original@123",
      name: "E2E Recovery OK",
      role: "broker" as const,
    };
    await DatabaseHelper.ensureTestUser(user);

    const loginPage = new LoginPage(page);
    await loginPage.openLoginDropdown();
    await loginPage.openForgotPasswordModal();
    await loginPage.submitForgotPassword(user.email);

    await expect(loginPage.resetSuccessTitle).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(user.email)).toBeVisible();
    await expect(page.getByRole("button", { name: /voltar para login/i })).toBeVisible();
  });

  test("deve exibir erro com e-mail não cadastrado", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.openLoginDropdown();
    await loginPage.openForgotPasswordModal();
    await loginPage.submitForgotPassword("nao-cadastrado-recovery@teste.com");

    await expect(page.getByText(/e-mail não encontrado/i).first()).toBeVisible({ timeout: 10000 });
    // Deve permanecer no formulário de recuperação, não avançar pra tela de sucesso
    await expect(loginPage.resetEmailInput).toBeVisible();
  });
});
