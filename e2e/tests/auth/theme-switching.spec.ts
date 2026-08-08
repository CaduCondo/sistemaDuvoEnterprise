import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";
import { DatabaseHelper } from "../../helpers/database.helper";

/**
 * Sistema de Tema (light/dark), persistido em `system_users.theme` e
 * aplicado via next-themes (classe "dark" no <html>) — ver
 * src/components/Layout.tsx (handleToggleTheme, useEffect de
 * authUser?.theme) e src/contexts/AuthContext.tsx.
 *
 * ⚠️ Reescrito em 2026-08: usava rota "/login" e seletores
 * `input[placeholder="Digite seu usuário"]`/`button[aria-label="User menu"]`
 * que não existem na UI real, além de usuários fictícios nunca seedados
 * ("admin@test.com", "dark.user@test.com"). Usa um usuário dedicado
 * (não o admin compartilhado) para não interferir com outros specs
 * rodando em paralelo.
 */

const themeUser = {
  email: "e2e.theme@teste.com",
  password: "Theme@123",
  name: "E2E Theme Tester",
  role: "admin" as const,
};

test.describe("Sistema de Tema", () => {
  test.beforeEach(async () => {
    // Sempre começa em "light" — os testes que precisam de "dark" trocam
    // explicitamente dentro do próprio teste.
    await DatabaseHelper.ensureTestUser({ ...themeUser, theme: "light" });
  });

  test("deve carregar tema light por padrão", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(themeUser.email, themeUser.password);
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("deve mostrar opção de tema oposto no menu", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(themeUser.email, themeUser.password);
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    await page.locator("#layout-user-menu-trigger").click();

    const themeOption = page.locator("#layout-menu-toggle-theme");
    await expect(themeOption).toBeVisible();
    await expect(themeOption).toContainText(/Trocar Tema \((Light|Dark)\)/);
  });

  test("deve trocar de light para dark e voltar", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(themeUser.email, themeUser.password);
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    const htmlElement = page.locator("html");
    await expect(htmlElement).not.toHaveClass(/dark/);

    await page.locator("#layout-user-menu-trigger").click();
    await page.locator("#layout-menu-toggle-theme").click();

    await expect(htmlElement).toHaveClass(/dark/);

    // Reabrir menu deve mostrar a opção oposta agora ("Light")
    await page.locator("#layout-user-menu-trigger").click();
    await expect(page.locator("#layout-menu-toggle-theme")).toContainText("Trocar Tema (Light)");

    // Trocar de volta para light
    await page.locator("#layout-menu-toggle-theme").click();
    await expect(htmlElement).not.toHaveClass(/dark/);
  });

  test("deve persistir tema após logout e login", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(themeUser.email, themeUser.password);
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    await page.locator("#layout-user-menu-trigger").click();
    await page.locator("#layout-menu-toggle-theme").click();

    const htmlElement = page.locator("html");
    await expect(htmlElement).toHaveClass(/dark/);

    // Logout
    await page.locator("#layout-user-menu-trigger").click();
    await page.locator("#layout-menu-logout").click();
    await page.waitForURL("/");

    // Login novamente
    await loginPage.login(themeUser.email, themeUser.password);
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    await expect(htmlElement).toHaveClass(/dark/);
  });

  test("deve aplicar tema imediatamente sem reload", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(themeUser.email, themeUser.password);
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    const htmlElement = page.locator("html");
    const initialHasDark = await htmlElement.evaluate((el) => el.classList.contains("dark"));

    await page.locator("#layout-user-menu-trigger").click();
    await page.locator("#layout-menu-toggle-theme").click();

    const newHasDark = await htmlElement.evaluate((el) => el.classList.contains("dark"));
    expect(newHasDark).toBe(!initialHasDark);

    // URL não deve ter mudado (troca de tema não navega)
    expect(page.url()).toContain("/dashboard");
  });
});
