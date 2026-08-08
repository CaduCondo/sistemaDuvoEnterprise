import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";
import { DatabaseHelper } from "../../helpers/database.helper";

/**
 * Troca obrigatória de senha no primeiro login (usuário com senha
 * temporária) — ver src/components/PasswordChangeDialog.tsx, renderizado
 * inline no dropdown por src/components/public/PublicHeader.tsx quando
 * `system_users.requires_password_change` é true.
 *
 * ⚠️ Reescrito em 2026-08 contra o componente real. Diferenças do arquivo
 * anterior (nunca validado contra a UI real):
 * - Título real é "Alterar Senha" (não "Criar Nova Senha")
 * - Subtítulo real é "Por segurança, você precisa criar uma nova senha"
 *   (não "Sua senha temporária expirou")
 * - Requisito de tamanho real é "No mínimo 8 caracteres" (não 6) — e não
 *   existe um item visível de "No máximo 12 caracteres" (o limite de 12 é
 *   só um `maxLength` HTML no input, sem mensagem própria)
 * - Placeholder do campo de confirmação é "Digite novamente sua nova senha"
 *   (não "Confirme sua nova senha")
 * - Usuário "newuser@test.com" nunca existiu — usa
 *   DatabaseHelper.ensureTemporaryPasswordUser para seedar um usuário real
 *   com requires_password_change=true
 */

function tempUser(suffix: string) {
  return {
    email: `e2e.temppass.${suffix}@teste.com`,
    password: "TempPass123",
    name: `E2E Temp ${suffix}`,
    role: "broker" as const,
  };
}

async function loginWithTempPassword(page: import("@playwright/test").Page, loginPage: LoginPage, user: ReturnType<typeof tempUser>) {
  await loginPage.goto();
  await loginPage.openLoginDropdown();
  await loginPage.usernameInput.fill(user.email);
  await loginPage.passwordInput.fill(user.password);
  await loginPage.submitButton.click();
  await page.locator("#newPassword").waitFor({ state: "visible", timeout: 10000 });
}

test.describe("Troca Obrigatória de Senha", () => {
  test("deve exibir tela de troca de senha ao fazer login com senha temporária", async ({ page }) => {
    const user = tempUser("exibir");
    await DatabaseHelper.ensureTemporaryPasswordUser(user);
    const loginPage = new LoginPage(page);
    await loginWithTempPassword(page, loginPage, user);

    await expect(page.getByText("Alterar Senha")).toBeVisible();
    await expect(page.getByText("Por segurança, você precisa criar uma nova senha")).toBeVisible();

    await expect(page.locator("#newPassword")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();

    await expect(page.getByText("Pelo menos 1 letra maiúscula")).toBeVisible();
    await expect(page.getByText("Pelo menos 1 letra minúscula")).toBeVisible();
    await expect(page.getByText("Pelo menos 1 número")).toBeVisible();
    await expect(page.getByText("No mínimo 8 caracteres")).toBeVisible();
    await expect(page.getByText("As senhas precisam ser idênticas")).toBeVisible();
  });

  test("deve validar requisitos em tempo real", async ({ page }) => {
    const user = tempUser("realtime");
    await DatabaseHelper.ensureTemporaryPasswordUser(user);
    const loginPage = new LoginPage(page);
    await loginWithTempPassword(page, loginPage, user);

    const passwordInput = page.locator("#newPassword");
    const upperReq = page.getByText("Pelo menos 1 letra maiúscula").locator("..");
    const lowerReq = page.getByText("Pelo menos 1 letra minúscula").locator("..");
    const numberReq = page.getByText("Pelo menos 1 número").locator("..");
    const minLenReq = page.getByText("No mínimo 8 caracteres").locator("..");

    await passwordInput.fill("abc");
    await expect(upperReq).toHaveClass(/text-red/);
    await expect(lowerReq).toHaveClass(/text-green/);
    await expect(numberReq).toHaveClass(/text-red/);
    await expect(minLenReq).toHaveClass(/text-red/);

    await passwordInput.fill("Abcdefg1");
    await expect(upperReq).toHaveClass(/text-green/);
    await expect(lowerReq).toHaveClass(/text-green/);
    await expect(numberReq).toHaveClass(/text-green/);
    await expect(minLenReq).toHaveClass(/text-green/);
  });

  test("deve validar senhas idênticas", async ({ page }) => {
    const user = tempUser("match");
    await DatabaseHelper.ensureTemporaryPasswordUser(user);
    const loginPage = new LoginPage(page);
    await loginWithTempPassword(page, loginPage, user);

    const passwordInput = page.locator("#newPassword");
    const confirmInput = page.locator("#confirmPassword");
    const matchReq = page.getByText("As senhas precisam ser idênticas").locator("..");

    await passwordInput.fill("NovaSenha1");
    await confirmInput.fill("Diferente1");
    await expect(matchReq).toHaveClass(/text-red/);

    await confirmInput.fill("NovaSenha1");
    await expect(matchReq).toHaveClass(/text-green/);
  });

  test("deve desabilitar botão quando requisitos não atendidos", async ({ page }) => {
    const user = tempUser("disabled");
    await DatabaseHelper.ensureTemporaryPasswordUser(user);
    const loginPage = new LoginPage(page);
    await loginWithTempPassword(page, loginPage, user);

    const saveButton = page.locator('button:has-text("Salvar Senha")');
    await expect(saveButton).toBeDisabled();

    await page.locator("#newPassword").fill("abc");
    await expect(saveButton).toBeDisabled();

    await page.locator("#newPassword").fill("NovaSenha1");
    await page.locator("#confirmPassword").fill("Diferente1");
    await expect(saveButton).toBeDisabled();

    await page.locator("#confirmPassword").fill("NovaSenha1");
    await expect(saveButton).toBeEnabled();
  });

  test("deve salvar nova senha e redirecionar para dashboard", async ({ page }) => {
    const user = tempUser("salvar");
    await DatabaseHelper.ensureTemporaryPasswordUser(user);
    const loginPage = new LoginPage(page);
    await loginWithTempPassword(page, loginPage, user);

    await page.locator("#newPassword").fill("NovaSenha1");
    await page.locator("#confirmPassword").fill("NovaSenha1");
    await page.locator('button:has-text("Salvar Senha")').click();

    // Tela de sucesso interna do PasswordChangeDialog (3s) antes do toast +
    // redirecionamento (mais 1.5s) — ver PasswordChangeDialog.tsx e
    // PublicHeader.handlePasswordChangeSuccess.
    await expect(page.getByText("Senha Alterada com Sucesso!")).toBeVisible({ timeout: 5000 });
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    await expect(page.locator("#dashboard-page")).toBeVisible();
  });
});
