import { test, expect } from "@playwright/test";

test.describe("Recuperação de Senha", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Gerenciador")');
  });

  test("deve exibir tela de recuperação ao clicar em 'Esqueci minha senha'", async ({ page }) => {
    // Clicar em "Esqueci minha senha"
    await page.click('text=Esqueci minha senha');
    
    // Verificar que tela de recuperação apareceu
    await expect(page.locator('text=Recuperar Senha')).toBeVisible();
    await expect(page.locator('text=Digite seu e-mail para receber uma senha temporária')).toBeVisible();
    
    // Verificar campo de email
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    // Verificar informações
    await expect(page.locator('text=Você receberá:')).toBeVisible();
    await expect(page.locator('text=www.duvoenterprise.com.br')).toBeVisible();
    await expect(page.locator('text=Senha temporária de 12 caracteres')).toBeVisible();
    
    // Verificar botões
    await expect(page.locator('button:has-text("Voltar")')).toBeVisible();
    await expect(page.locator('button:has-text("Enviar Email")')).toBeVisible();
  });

  test("deve voltar para tela de login ao clicar em Voltar", async ({ page }) => {
    await page.click('text=Esqueci minha senha');
    await page.click('button:has-text("Voltar")');
    
    // Verificar que voltou para tela de login
    await expect(page.locator('input[placeholder="Digite seu usuário"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Digite sua senha"]')).toBeVisible();
  });

  test("deve enviar email de recuperação com email válido", async ({ page }) => {
    const email = "usuario@test.com";
    
    // Ir para tela de recuperação
    await page.click('text=Esqueci minha senha');
    
    // Preencher email
    await page.fill('input[type="email"]', email);
    
    // Enviar
    await page.click('button:has-text("Enviar Email")');
    
    // Verificar toast de sucesso
    await expect(page.locator('[role="status"]:has-text("Email enviado!")')).toBeVisible();
    await expect(page.locator('text=Verifique sua caixa de entrada')).toBeVisible();
    
    // Deve voltar para tela de login
    await expect(page.locator('input[placeholder="Digite seu usuário"]')).toBeVisible();
  });

  test("deve exibir erro com email não cadastrado", async ({ page }) => {
    const email = "naoexiste@test.com";
    
    await page.click('text=Esqueci minha senha');
    await page.fill('input[type="email"]', email);
    await page.click('button:has-text("Enviar Email")');
    
    // Verificar toast de erro
    await expect(page.locator('[role="status"]:has-text("Erro")')).toBeVisible();
    await expect(page.locator('text=E-mail não encontrado')).toBeVisible();
  });

  test("deve desabilitar botão durante envio", async ({ page }) => {
    await page.click('text=Esqueci minha senha');
    await page.fill('input[type="email"]', "usuario@test.com");
    
    // Clicar em enviar
    const button = page.locator('button:has-text("Enviar Email")');
    await button.click();
    
    // Verificar que botão ficou desabilitado e mostra "Enviando..."
    await expect(button).toBeDisabled();
    await expect(page.locator('text=Enviando...')).toBeVisible();
  });

  test("deve validar formato de email", async ({ page }) => {
    await page.click('text=Esqueci minha senha');
    
    const emailInput = page.locator('input[type="email"]');
    
    // Email inválido
    await emailInput.fill("emailinvalido");
    await page.click('button:has-text("Enviar Email")');
    
    // Validação HTML5 deve impedir envio
    await expect(emailInput).toHaveAttribute("required");
  });
});