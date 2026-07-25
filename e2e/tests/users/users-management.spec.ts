import { test, expect } from "@playwright/test";

test.describe("Gestão de Usuários", () => {
  test.beforeEach(async ({ page }) => {
    // Login como admin
    await page.goto("/");
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "admin@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "senha123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForURL("/dashboard");
    
    // Ir para Configurações → Usuários
    await page.click('text=Configurações');
    await page.click('text=Usuários');
  });

  test("deve exibir tabela de usuários", async ({ page }) => {
    // Verificar header da tabela
    await expect(page.locator('text=Usuários do Sistema')).toBeVisible();
    await expect(page.locator('button:has-text("Adicionar Usuário")')).toBeVisible();
    
    // Verificar colunas
    await expect(page.locator('th:has-text("Nome")')).toBeVisible();
    await expect(page.locator('th:has-text("E-mail")')).toBeVisible();
    await expect(page.locator('th:has-text("Perfil")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Ações")')).toBeVisible();
  });

  test("deve abrir dialog de criação ao clicar em Adicionar Usuário", async ({ page }) => {
    await page.click('button:has-text("Adicionar Usuário")');
    
    // Verificar dialog
    await expect(page.locator('text=Novo Usuário')).toBeVisible();
    await expect(page.locator('text=Preencha os dados do novo usuário')).toBeVisible();
    
    // Verificar campos
    await expect(page.locator('label:has-text("Nome Completo")')).toBeVisible();
    await expect(page.locator('label:has-text("E-mail / Usuário")')).toBeVisible();
    await expect(page.locator('label:has-text("Telefone")')).toBeVisible();
    await expect(page.locator('label:has-text("Perfil")')).toBeVisible();
    await expect(page.locator('label:has-text("Status")')).toBeVisible();
    
    // Verificar botões
    await expect(page.locator('button:has-text("Cancelar")')).toBeVisible();
    await expect(page.locator('button:has-text("Criar Usuário")')).toBeVisible();
  });

  test("deve validar email com @", async ({ page }) => {
    await page.click('button:has-text("Adicionar Usuário")');
    
    const emailInput = page.locator('input[type="email"]');
    
    // Email sem @
    await emailInput.fill("emailinvalido");
    await emailInput.blur();
    
    // Verificar mensagem de erro
    await expect(page.locator('text=E-mail inválido. Deve conter @')).toBeVisible();
    
    // Botão deve estar desabilitado
    const createButton = page.locator('button:has-text("Criar Usuário")');
    await expect(createButton).toBeDisabled();
    
    // Email válido
    await emailInput.fill("novo@test.com");
    await emailInput.blur();
    
    // Erro deve sumir
    await expect(page.locator('text=E-mail inválido')).not.toBeVisible();
  });

  test("deve aplicar máscara no telefone", async ({ page }) => {
    await page.click('button:has-text("Adicionar Usuário")');
    
    const phoneInput = page.locator('input[placeholder="(00) 00000-0000"]');
    
    // Digitar apenas números
    await phoneInput.fill("11987654321");
    
    // Verificar que máscara foi aplicada
    const value = await phoneInput.inputValue();
    expect(value).toMatch(/\(\d{2}\) \d{5}-\d{4}/);
  });

  test("deve validar telefone com 10 ou 11 dígitos", async ({ page }) => {
    await page.click('button:has-text("Adicionar Usuário")');
    
    const phoneInput = page.locator('input[placeholder="(00) 00000-0000"]');
    
    // Telefone com menos de 10 dígitos
    await phoneInput.fill("1198765");
    await phoneInput.blur();
    
    // Verificar erro
    await expect(page.locator('text=Telefone inválido')).toBeVisible();
    
    // Telefone fixo (10 dígitos) - válido
    await phoneInput.clear();
    await phoneInput.fill("1133334444");
    await phoneInput.blur();
    
    await expect(page.locator('text=Telefone inválido')).not.toBeVisible();
    
    // Telefone celular (11 dígitos) - válido
    await phoneInput.clear();
    await phoneInput.fill("11987654321");
    await phoneInput.blur();
    
    await expect(page.locator('text=Telefone inválido')).not.toBeVisible();
  });

  test("deve criar novo usuário com sucesso", async ({ page }) => {
    await page.click('button:has-text("Adicionar Usuário")');
    
    // Preencher dados
    await page.fill('input[id="name"]', "Novo Usuário Teste");
    await page.fill('input[type="email"]', "novo.usuario@test.com");
    await page.fill('input[placeholder="(00) 00000-0000"]', "11987654321");
    
    // Selecionar perfil
    await page.click('text=Selecione um perfil');
    await page.click('text=Corretor');
    
    // Status já vem Ativado por padrão
    
    // Criar
    await page.click('button:has-text("Criar Usuário")');
    
    // Verificar toast de sucesso
    await expect(page.locator('[role="status"]:has-text("Usuário criado!")')).toBeVisible();
    await expect(page.locator('text=Email com senha temporária enviado')).toBeVisible();
    
    // Dialog deve fechar
    await expect(page.locator('text=Novo Usuário')).not.toBeVisible();
    
    // Novo usuário deve aparecer na tabela
    await expect(page.locator('td:has-text("Novo Usuário Teste")')).toBeVisible();
  });

  test("deve impedir criação com email duplicado", async ({ page }) => {
    await page.click('button:has-text("Adicionar Usuário")');
    
    // Preencher com email que já existe
    await page.fill('input[id="name"]', "Usuário Duplicado");
    await page.fill('input[type="email"]', "admin@test.com"); // Email já existe
    
    await page.click('text=Selecione um perfil');
    await page.click('text=Corretor');
    
    await page.click('button:has-text("Criar Usuário")');
    
    // Verificar toast de erro
    await expect(page.locator('[role="status"]:has-text("Erro")')).toBeVisible();
    await expect(page.locator('text=E-mail/Usuário já existe')).toBeVisible();
  });

  test("deve abrir edição ao clicar na linha", async ({ page }) => {
    // Clicar em uma linha da tabela
    await page.click('tr:has-text("admin@test.com")');
    
    // Verificar que dialog de edição abriu
    await expect(page.locator('text=Editar Usuário')).toBeVisible();
    await expect(page.locator('button:has-text("Salvar Alterações")')).toBeVisible();
    
    // Verificar que campos estão preenchidos
    const nameInput = page.locator('input[id="name"]');
    const value = await nameInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test("deve resetar senha do usuário", async ({ page }) => {
    // Clicar no ícone de resetar senha (🔑)
    await page.click('button[aria-label="Reset password"]:first');
    
    // Verificar toast de sucesso
    await expect(page.locator('[role="status"]:has-text("Senha resetada!")')).toBeVisible();
    await expect(page.locator('text=Email enviado para')).toBeVisible();
  });

  test("deve excluir usuário com confirmação", async ({ page }) => {
    // Clicar no ícone de excluir (🗑️)
    await page.click('button[aria-label="Delete user"]:first');
    
    // Verificar dialog de confirmação
    await expect(page.locator('text=Confirmar Exclusão')).toBeVisible();
    await expect(page.locator('text=Esta ação não pode ser desfeita')).toBeVisible();
    
    // Cancelar
    await page.click('button:has-text("Cancelar")');
    await expect(page.locator('text=Confirmar Exclusão')).not.toBeVisible();
    
    // Tentar novamente e confirmar
    await page.click('button[aria-label="Delete user"]:first');
    await page.click('button:has-text("Excluir")');
    
    // Verificar sucesso
    await expect(page.locator('[role="status"]:has-text("Usuário excluído")')).toBeVisible();
  });

  test("deve alternar status entre Ativado e Desativado", async ({ page }) => {
    await page.click('button:has-text("Adicionar Usuário")');
    
    // Verificar que Status vem Ativado por padrão
    await page.click('text=🟢 Ativado');
    await expect(page.locator('text=🟢 Ativado')).toBeVisible();
    await expect(page.locator('text=🔴 Desativado')).toBeVisible();
    
    // Trocar para Desativado
    await page.click('text=🔴 Desativado');
    
    // Verificar que mudou
    // Fechar e reabrir para confirmar
    await page.click('button:has-text("Cancelar")');
    await page.click('button:has-text("Adicionar Usuário")');
    
    // Deve estar Ativado novamente (padrão)
    const statusButton = page.locator('[role="combobox"]:has-text("Ativado")');
    await expect(statusButton).toBeVisible();
  });

  test("deve exibir status correto na tabela", async ({ page }) => {
    // Verificar badges de status
    const activeStatus = page.locator('text=✅ Ativo');
    const inactiveStatus = page.locator('text=🚫 Inativo');
    const blockedStatus = page.locator('text=🔒 Bloqueado');
    
    // Pelo menos um status deve estar visível
    const activeCount = await activeStatus.count();
    const inactiveCount = await inactiveStatus.count();
    const blockedCount = await blockedStatus.count();
    
    expect(activeCount + inactiveCount + blockedCount).toBeGreaterThan(0);
  });
});