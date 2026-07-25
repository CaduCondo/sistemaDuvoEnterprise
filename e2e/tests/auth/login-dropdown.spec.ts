import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";

test.describe("Login via Dropdown", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto("/");
  });

  test("deve exibir dropdown de login ao clicar em Gerenciador", async ({ page }) => {
    // Clicar no botão Gerenciador
    await page.click('button:has-text("Gerenciador")');
    
    // Verificar que o dropdown está visível
    await expect(page.locator('text=D\'Uvo Enterprise')).toBeVisible();
    await expect(page.locator('text=Property Control System')).toBeVisible();
    
    // Verificar campos
    await expect(page.locator('input[placeholder="Digite seu usuário"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Digite sua senha"]')).toBeVisible();
    
    // Verificar botões
    await expect(page.locator('text=Esqueci minha senha')).toBeVisible();
    await expect(page.locator('button:has-text("Entrar"))')).toBeVisible();
  });

  test("deve fazer login com credenciais válidas", async ({ page }) => {
    // Abrir dropdown
    await page.click('button:has-text("Gerenciador")');
    
    // Preencher credenciais
    await page.fill('input[placeholder="Digite seu usuário"]', "admin@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "senha123");
    
    // Clicar em Entrar
    await page.click('button:has-text("Entrar")');
    
    // Aguardar redirecionamento
    await page.waitForURL("/dashboard");
    
    // Verificar que está no dashboard
    await expect(page.locator('text=Painel de Gestão')).toBeVisible();
  });

  test("deve mostrar/ocultar senha ao clicar no ícone", async ({ page }) => {
    // Abrir dropdown
    await page.click('button:has-text("Gerenciador")');
    
    const passwordInput = page.locator('input[placeholder="Digite sua senha"]');
    
    // Verificar que começa como password
    await expect(passwordInput).toHaveAttribute("type", "password");
    
    // Clicar no ícone de mostrar senha
    await page.click('button[type="button"]:near(input[placeholder="Digite sua senha"])');
    
    // Verificar que mudou para text
    await expect(passwordInput).toHaveAttribute("type", "text");
    
    // Clicar novamente
    await page.click('button[type="button"]:near(input[placeholder="Digite sua senha"])');
    
    // Verificar que voltou para password
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("deve validar campos obrigatórios", async ({ page }) => {
    // Abrir dropdown
    await page.click('button:has-text("Gerenciador")');
    
    // Tentar enviar sem preencher
    await page.click('button:has-text("Entrar")');
    
    // Verificar validação HTML5
    const usernameInput = page.locator('input[placeholder="Digite seu usuário"]');
    await expect(usernameInput).toHaveAttribute("required");
    
    const passwordInput = page.locator('input[placeholder="Digite sua senha"]');
    await expect(passwordInput).toHaveAttribute("required");
  });

  test("deve exibir erro com credenciais inválidas", async ({ page }) => {
    // Abrir dropdown
    await page.click('button:has-text("Gerenciador")');
    
    // Preencher com credenciais inválidas
    await page.fill('input[placeholder="Digite seu usuário"]', "usuario@invalido.com");
    await page.fill('input[placeholder="Digite sua senha"]', "senhaerrada");
    
    // Clicar em Entrar
    await page.click('button:has-text("Entrar")');
    
    // Verificar mensagem de erro
    await expect(page.locator('text=Senha incorreta')).toBeVisible();
  });

  test("deve carregar tema do usuário após login", async ({ page }) => {
    // Login com usuário que tem tema dark
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "dark.user@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "senha123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForURL("/dashboard");
    
    // Verificar que a classe dark foi aplicada
    const htmlElement = page.locator("html");
    await expect(htmlElement).toHaveClass(/dark/);
  });
});