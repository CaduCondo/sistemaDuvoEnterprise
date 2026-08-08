import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";
import TEST_CONFIG from "../../config/test.config";

/**
 * Login via dropdown "Gerenciador" (src/components/public/PublicHeader.tsx).
 *
 * ⚠️ Corrigido em 2026-08: os placeholders reais são "email@exemplo.com" /
 * "Digite sua senha" (não "Digite seu usuário"), e os testes usam as
 * credenciais de e2e/config/test.config.ts em vez de e-mails fictícios que
 * nunca existiram no banco.
 */
test.describe("Login via Dropdown", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto("/");
  });

  test("deve exibir dropdown de login ao clicar em Gerenciador", async ({ page }) => {
    await loginPage.openLoginDropdown();

    // .first(): "D'Uvo Enterprise" também aparece no <h1> do header ("D'Uvo
    // Enterprise Corporation"), causando strict-mode violation sem isso.
    await expect(page.getByText("D'Uvo Enterprise").first()).toBeVisible();
    await expect(page.getByText("Property Control System")).toBeVisible();

    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();

    await expect(loginPage.forgotPasswordLink).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test("deve fazer login com credenciais válidas", async ({ page }) => {
    const { email, password } = TEST_CONFIG.users.admin;
    await loginPage.login(email, password);

    await page.waitForURL("**/dashboard", { timeout: 10000 });
    await expect(page.locator('#dashboard-page')).toBeVisible();
  });

  test("deve mostrar/ocultar senha ao clicar no ícone", async () => {
    await loginPage.openLoginDropdown();

    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");

    await loginPage.togglePasswordVisibility();
    await expect(loginPage.passwordInput).toHaveAttribute("type", "text");

    await loginPage.togglePasswordVisibility();
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  });

  test("deve validar campos obrigatórios (HTML5)", async () => {
    await loginPage.openLoginDropdown();

    const usernameValid = await loginPage.usernameInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    const passwordValid = await loginPage.passwordInput.evaluate((el: HTMLInputElement) => el.checkValidity());

    expect(usernameValid).toBe(false);
    expect(passwordValid).toBe(false);
  });

  test("deve exibir erro com credenciais inválidas", async () => {
    const { email, password } = TEST_CONFIG.users.invalid;
    await loginPage.login(email, password);

    expect(await loginPage.hasError()).toBe(true);
  });
});
