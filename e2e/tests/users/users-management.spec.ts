import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";
import { DatabaseHelper } from "../../helpers/database.helper";
import TEST_CONFIG from "../../config/test.config";

/**
 * CRUD de Usuários (Configurações → Usuários) — ver
 * src/components/settings/UsersTab.tsx, UserDialog.tsx e
 * src/hooks/useUsers.ts.
 *
 * ⚠️ Reescrito em 2026-08 contra os componentes reais. Principais
 * diferenças do arquivo anterior (nunca validado contra a UI real):
 * - Login era feito numa rota "/login" inexistente com credenciais
 *   fictícias ("admin@test.com") — agora usa o dropdown real +
 *   TEST_CONFIG.users.admin (seedado por DatabaseHelper)
 * - Resultados de ações (criar/resetar/excluir usuário) aparecem em um
 *   `AlertDialog` (role="alertdialog", via src/contexts/AlertContext.tsx),
 *   NÃO em um toast `role="status"` — o arquivo antigo checava o role
 *   errado
 * - Os botões de reset de senha / excluir na tabela não têm
 *   aria-label — são ícones (Key / Trash2) sem texto acessível; localizados
 *   por posição dentro da linha
 * - O rótulo do campo é apenas "E-mail" (não "E-mail / Usuário")
 * - Mensagem real de e-mail duplicado é "Email já cadastrado" / "Já existe
 *   um usuário com este email..." (não "E-mail/Usuário já existe")
 */

test.describe("Gestão de Usuários", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    const { email, password } = TEST_CONFIG.users.admin;

    await loginPage.goto();
    await loginPage.login(email, password);
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    await page.getByRole("link", { name: /configurações/i }).click();
    await page.getByRole("tab", { name: "Usuários" }).click();
    await expect(page.getByText("Usuários do Sistema")).toBeVisible({ timeout: 10000 });
  });

  test("deve exibir tabela de usuários", async ({ page }) => {
    await expect(page.locator('button:has-text("Adicionar Usuário")')).toBeVisible();

    await expect(page.locator('th:has-text("Nome")')).toBeVisible();
    await expect(page.locator('th:has-text("E-mail")')).toBeVisible();
    await expect(page.locator('th:has-text("Perfil")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Ações")')).toBeVisible();
  });

  test("deve abrir dialog de criação ao clicar em Adicionar Usuário", async ({ page }) => {
    await page.click('button:has-text("Adicionar Usuário")');

    await expect(page.getByText("Novo Usuário")).toBeVisible();
    await expect(page.getByText(/Preencha os dados do novo usuário/)).toBeVisible();

    await expect(page.locator('label:has-text("Nome Completo")')).toBeVisible();
    await expect(page.locator('label:has-text("E-mail")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Telefone")')).toBeVisible();
    await expect(page.locator('label:has-text("Perfil")')).toBeVisible();
    await expect(page.locator('label:has-text("Status")')).toBeVisible();

    await expect(page.locator('button:has-text("Cancelar")')).toBeVisible();
    await expect(page.locator('button:has-text("Criar Usuário")')).toBeVisible();
  });

  test("deve validar email sem @", async ({ page }) => {
    await page.click('button:has-text("Adicionar Usuário")');

    const emailInput = page.locator('#email');
    await emailInput.fill("emailinvalido");

    await expect(page.getByText("E-mail inválido. Deve conter @")).toBeVisible();

    await emailInput.fill("novo@teste.com");
    await expect(page.getByText("E-mail inválido. Deve conter @")).not.toBeVisible();
  });

  test("deve aplicar máscara e validar telefone", async ({ page }) => {
    await page.click('button:has-text("Adicionar Usuário")');

    const phoneInput = page.locator('input[placeholder="(00) 00000-0000"]');

    await phoneInput.fill("11987654321");
    await expect(phoneInput).toHaveValue(/\(\d{2}\) \d{5}-\d{4}/);

    await phoneInput.fill("1198765");
    await expect(page.getByText(/Telefone inválido/)).toBeVisible();

    await phoneInput.fill("1133334444");
    await expect(page.getByText(/Telefone inválido/)).not.toBeVisible();
  });

  test("deve criar novo usuário com sucesso", async ({ page }) => {
    await page.click('button:has-text("Adicionar Usuário")');

    const timestamp = Date.now();
    const name = `E2E Novo Usuário ${timestamp}`;

    await page.fill('#name', name);
    await page.fill('#email', `e2e.novo.${timestamp}@teste.com`);
    await page.fill('input[placeholder="(00) 00000-0000"]', "11987654321");

    await page.getByRole("combobox").filter({ hasText: "Selecione um perfil" }).click();
    await page.getByRole("option", { name: "Corretor" }).click();

    await page.click('button:has-text("Criar Usuário")');

    // Resultado aparece num AlertDialog (não num toast) — ver AlertContext.tsx
    const resultDialog = page.getByRole("alertdialog");
    await expect(resultDialog).toContainText("Usuário criado com sucesso!", { timeout: 10000 });
    await resultDialog.getByRole("button", { name: "OK" }).click();

    await expect(page.getByText("Novo Usuário")).not.toBeVisible();
    await expect(page.locator(`td:has-text("${name}")`)).toBeVisible();
  });

  test("deve impedir criação com email duplicado", async ({ page }) => {
    await page.click('button:has-text("Adicionar Usuário")');

    await page.fill('#name', "Usuário Duplicado E2E");
    await page.fill('#email', TEST_CONFIG.users.admin.email); // já existe

    await page.getByRole("combobox").filter({ hasText: "Selecione um perfil" }).click();
    await page.getByRole("option", { name: "Corretor" }).click();

    await page.click('button:has-text("Criar Usuário")');

    const resultDialog = page.getByRole("alertdialog");
    await expect(resultDialog).toContainText("Email já cadastrado", { timeout: 10000 });
    await resultDialog.getByRole("button", { name: "OK" }).click();
  });

  test("deve abrir edição ao clicar na linha", async ({ page }) => {
    await page.click(`tr:has-text("${TEST_CONFIG.users.admin.email}")`);

    await expect(page.getByText("Editar Usuário")).toBeVisible();
    await expect(page.locator('button:has-text("Salvar Alterações")')).toBeVisible();

    const nameInput = page.locator('#name');
    await expect(nameInput).not.toHaveValue("");
  });

  test("deve resetar senha e excluir um usuário criado para o teste", async ({ page }) => {
    // Cria um usuário dedicado via banco para não mexer nos usuários fixos
    // compartilhados por outros specs.
    const timestamp = Date.now();
    const target = await DatabaseHelper.ensureTestUser({
      email: `e2e.rowactions.${timestamp}@teste.com`,
      password: "Original@123",
      name: `E2E Row Actions ${timestamp}`,
      role: "broker",
    });

    await page.reload();
    await page.getByRole("tab", { name: "Usuários" }).click();
    const row = page.locator("tr", { hasText: target.email as string });
    await expect(row).toBeVisible({ timeout: 10000 });

    // Resetar senha: botão com o ícone Key é o primeiro dos dois na célula de ações
    await row.locator("button").nth(0).click();
    const resetDialog = page.getByRole("alertdialog");
    await expect(resetDialog).toContainText("Senha resetada com sucesso!", { timeout: 10000 });
    await resetDialog.getByRole("button", { name: "OK" }).click();

    // Excluir: botão com o ícone Trash2 é o segundo
    await row.locator("button").nth(1).click();
    await expect(page.getByText("Confirmar Exclusão")).toBeVisible();
    await expect(page.getByText("Esta ação não pode ser desfeita")).toBeVisible();

    await page.click('button:has-text("Excluir")');

    const deleteDialog = page.getByRole("alertdialog");
    await expect(deleteDialog).toContainText("Usuário excluído com sucesso!", { timeout: 10000 });
    await deleteDialog.getByRole("button", { name: "OK" }).click();

    await expect(row).not.toBeVisible();
  });

  test("deve exibir status correto na tabela", async ({ page }) => {
    const activeStatus = page.locator("text=Ativo");
    const inactiveStatus = page.locator("text=Inativo");
    const blockedStatus = page.locator("text=Bloqueado Temporariamente");

    const activeCount = await activeStatus.count();
    const inactiveCount = await inactiveStatus.count();
    const blockedCount = await blockedStatus.count();

    expect(activeCount + inactiveCount + blockedCount).toBeGreaterThan(0);
  });
});
