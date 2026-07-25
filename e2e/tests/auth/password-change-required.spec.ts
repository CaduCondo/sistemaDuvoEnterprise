import { test, expect } from "@playwright/test";

test.describe("Troca Obrigatória de Senha", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("deve exibir tela de troca de senha ao fazer login com senha temporária", async ({ page }) => {
    // Login com usuário novo (senha temporária)
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "newuser@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "TempPass123");
    await page.click('button:has-text("Entrar")');
    
    // Verificar que tela de troca de senha apareceu
    await expect(page.locator('text=Criar Nova Senha')).toBeVisible();
    await expect(page.locator('text=Sua senha temporária expirou')).toBeVisible();
    
    // Verificar campos
    await expect(page.locator('input[placeholder="Digite sua nova senha"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Confirme sua nova senha"]')).toBeVisible();
    
    // Verificar requisitos
    await expect(page.locator('text=Pelo menos 1 letra maiúscula')).toBeVisible();
    await expect(page.locator('text=Pelo menos 1 letra minúscula')).toBeVisible();
    await expect(page.locator('text=Pelo menos 1 número')).toBeVisible();
    await expect(page.locator('text=No mínimo 6 caracteres')).toBeVisible();
    await expect(page.locator('text=No máximo 12 caracteres')).toBeVisible();
    await expect(page.locator('text=As senhas precisam ser idênticas')).toBeVisible();
  });

  test("deve validar requisitos em tempo real - maiúscula", async ({ page }) => {
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "newuser@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "TempPass123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForSelector('text=Criar Nova Senha');
    
    const passwordInput = page.locator('input[placeholder="Digite sua nova senha"]');
    const uppercaseReq = page.locator('text=Pelo menos 1 letra maiúscula').locator('..');
    
    // Sem maiúscula - deve estar vermelho (X)
    await passwordInput.fill("abc123");
    await expect(uppercaseReq).toHaveClass(/text-red/);
    
    // Com maiúscula - deve ficar verde (✓)
    await passwordInput.fill("Abc123");
    await expect(uppercaseReq).toHaveClass(/text-green/);
  });

  test("deve validar requisitos em tempo real - minúscula", async ({ page }) => {
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "newuser@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "TempPass123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForSelector('text=Criar Nova Senha');
    
    const passwordInput = page.locator('input[placeholder="Digite sua nova senha"]');
    const lowercaseReq = page.locator('text=Pelo menos 1 letra minúscula').locator('..');
    
    // Sem minúscula
    await passwordInput.fill("ABC123");
    await expect(lowercaseReq).toHaveClass(/text-red/);
    
    // Com minúscula
    await passwordInput.fill("ABc123");
    await expect(lowercaseReq).toHaveClass(/text-green/);
  });

  test("deve validar requisitos em tempo real - número", async ({ page }) => {
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "newuser@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "TempPass123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForSelector('text=Criar Nova Senha');
    
    const passwordInput = page.locator('input[placeholder="Digite sua nova senha"]');
    const numberReq = page.locator('text=Pelo menos 1 número').locator('..');
    
    // Sem número
    await passwordInput.fill("Abcdef");
    await expect(numberReq).toHaveClass(/text-red/);
    
    // Com número
    await passwordInput.fill("Abcdef1");
    await expect(numberReq).toHaveClass(/text-green/);
  });

  test("deve validar tamanho mínimo e máximo", async ({ page }) => {
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "newuser@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "TempPass123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForSelector('text=Criar Nova Senha');
    
    const passwordInput = page.locator('input[placeholder="Digite sua nova senha"]');
    const minLengthReq = page.locator('text=No mínimo 6 caracteres').locator('..');
    const maxLengthReq = page.locator('text=No máximo 12 caracteres').locator('..');
    
    // Menos de 6 caracteres
    await passwordInput.fill("Ab1");
    await expect(minLengthReq).toHaveClass(/text-red/);
    
    // Entre 6 e 12
    await passwordInput.fill("Ab123456");
    await expect(minLengthReq).toHaveClass(/text-green/);
    await expect(maxLengthReq).toHaveClass(/text-green/);
    
    // Mais de 12 caracteres
    await passwordInput.fill("Ab1234567890123");
    await expect(maxLengthReq).toHaveClass(/text-red/);
  });

  test("deve validar senhas idênticas ao sair do segundo campo", async ({ page }) => {
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "newuser@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "TempPass123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForSelector('text=Criar Nova Senha');
    
    const passwordInput = page.locator('input[placeholder="Digite sua nova senha"]');
    const confirmInput = page.locator('input[placeholder="Confirme sua nova senha"]');
    const matchReq = page.locator('text=As senhas precisam ser idênticas').locator('..');
    
    // Preencher primeira senha
    await passwordInput.fill("NovaSenha1");
    
    // Preencher segunda senha diferente e sair do campo
    await confirmInput.fill("Diferente1");
    await confirmInput.blur();
    
    // Deve estar vermelho
    await expect(matchReq).toHaveClass(/text-red/);
    
    // Corrigir segunda senha e sair do campo
    await confirmInput.clear();
    await confirmInput.fill("NovaSenha1");
    await confirmInput.blur();
    
    // Deve ficar verde
    await expect(matchReq).toHaveClass(/text-green/);
  });

  test("deve desabilitar botão quando requisitos não atendidos", async ({ page }) => {
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "newuser@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "TempPass123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForSelector('text=Criar Nova Senha');
    
    const saveButton = page.locator('button:has-text("Salvar Senha")');
    
    // Botão deve começar desabilitado
    await expect(saveButton).toBeDisabled();
    
    // Preencher senha incompleta
    await page.fill('input[placeholder="Digite sua nova senha"]', "abc");
    await expect(saveButton).toBeDisabled();
    
    // Preencher senha completa mas senhas não idênticas
    await page.fill('input[placeholder="Digite sua nova senha"]', "NovaSenha1");
    await page.fill('input[placeholder="Confirme sua nova senha"]', "Diferente1");
    await expect(saveButton).toBeDisabled();
    
    // Senhas idênticas e válidas - botão deve habilitar
    await page.fill('input[placeholder="Confirme sua nova senha"]', "NovaSenha1");
    await expect(saveButton).toBeEnabled();
  });

  test("deve salvar nova senha e redirecionar para dashboard", async ({ page }) => {
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "newuser@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "TempPass123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForSelector('text=Criar Nova Senha');
    
    // Preencher nova senha válida
    await page.fill('input[placeholder="Digite sua nova senha"]', "NovaSenha1");
    await page.fill('input[placeholder="Confirme sua nova senha"]', "NovaSenha1");
    
    // Salvar
    await page.click('button:has-text("Salvar Senha")');
    
    // Verificar toast de sucesso
    await expect(page.locator('[role="status"]:has-text("Senha atualizada!")')).toBeVisible();
    
    // Aguardar redirecionamento
    await page.waitForURL("/dashboard");
    
    // Verificar que está no dashboard
    await expect(page.locator('text=Painel de Gestão')).toBeVisible();
  });

  test("deve exibir loading durante salvamento", async ({ page }) => {
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "newuser@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "TempPass123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForSelector('text=Criar Nova Senha');
    
    await page.fill('input[placeholder="Digite sua nova senha"]', "NovaSenha1");
    await page.fill('input[placeholder="Confirme sua nova senha"]', "NovaSenha1");
    
    const saveButton = page.locator('button:has-text("Salvar Senha")');
    await saveButton.click();
    
    // Verificar que botão mostra loading
    await expect(saveButton).toBeDisabled();
    // Pode ter ícone de loading ou texto "Salvando..."
  });
});