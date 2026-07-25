import { test, expect } from "@playwright/test";

test.describe("Sistema de Tema", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("deve carregar tema light por padrão", async ({ page }) => {
    // Login com usuário sem tema definido
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "admin@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "senha123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForURL("/dashboard");
    
    // Verificar que não tem classe dark
    const htmlElement = page.locator("html");
    await expect(htmlElement).not.toHaveClass(/dark/);
  });

  test("deve mostrar opção de tema oposto no menu", async ({ page }) => {
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "admin@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "senha123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForURL("/dashboard");
    
    // Abrir menu do perfil
    await page.click('button[aria-label="User menu"]');
    
    // Se está em light, deve mostrar opção de trocar para Dark
    const themeOption = page.locator('text=Trocar Tema');
    await expect(themeOption).toBeVisible();
    
    // Verificar que mostra "Dark" ou "Light"
    const hasLight = await page.locator('text=Trocar Tema (Light)').count();
    const hasDark = await page.locator('text=Trocar Tema (Dark)').count();
    
    expect(hasLight + hasDark).toBe(1); // Deve ter exatamente uma opção
  });

  test("deve trocar de light para dark", async ({ page }) => {
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "admin@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "senha123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForURL("/dashboard");
    
    const htmlElement = page.locator("html");
    
    // Verificar que está em light
    await expect(htmlElement).not.toHaveClass(/dark/);
    
    // Abrir menu e trocar para dark
    await page.click('button[aria-label="User menu"]');
    await page.click('text=Trocar Tema (Dark)');
    
    // Verificar que mudou para dark
    await expect(htmlElement).toHaveClass(/dark/);
    
    // Fechar e reabrir menu - deve mostrar opção de voltar para Light
    await page.click('button[aria-label="User menu"]');
    await expect(page.locator('text=Trocar Tema (Light)')).toBeVisible();
  });

  test("deve trocar de dark para light", async ({ page }) => {
    // Login com usuário que já está em dark
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "dark.user@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "senha123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForURL("/dashboard");
    
    const htmlElement = page.locator("html");
    
    // Verificar que está em dark
    await expect(htmlElement).toHaveClass(/dark/);
    
    // Trocar para light
    await page.click('button[aria-label="User menu"]');
    await page.click('text=Trocar Tema (Light)');
    
    // Verificar que mudou para light
    await expect(htmlElement).not.toHaveClass(/dark/);
  });

  test("deve persistir tema após logout e login", async ({ page }) => {
    const email = "admin@test.com";
    const password = "senha123";
    
    // Login
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', email);
    await page.fill('input[placeholder="Digite sua senha"]', password);
    await page.click('button:has-text("Entrar")');
    
    await page.waitForURL("/dashboard");
    
    // Trocar para dark
    await page.click('button[aria-label="User menu"]');
    await page.click('text=Trocar Tema (Dark)');
    
    const htmlElement = page.locator("html");
    await expect(htmlElement).toHaveClass(/dark/);
    
    // Fazer logout
    await page.click('button[aria-label="User menu"]');
    await page.click('text=Sair');
    
    await page.waitForURL("/");
    
    // Login novamente
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', email);
    await page.fill('input[placeholder="Digite sua senha"]', password);
    await page.click('button:has-text("Entrar")');
    
    await page.waitForURL("/dashboard");
    
    // Verificar que tema dark foi mantido
    await expect(htmlElement).toHaveClass(/dark/);
  });

  test("deve manter tema em diferentes dispositivos", async ({ page, context }) => {
    const email = "admin@test.com";
    const password = "senha123";
    
    // Login no primeiro dispositivo (tab)
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', email);
    await page.fill('input[placeholder="Digite sua senha"]', password);
    await page.click('button:has-text("Entrar")');
    
    await page.waitForURL("/dashboard");
    
    // Trocar para dark
    await page.click('button[aria-label="User menu"]');
    await page.click('text=Trocar Tema (Dark)');
    
    // Aguardar salvamento
    await page.waitForTimeout(1000);
    
    // Abrir nova aba simulando outro dispositivo
    const newPage = await context.newPage();
    await newPage.goto("/");
    
    // Login no "novo dispositivo"
    await newPage.click('button:has-text("Gerenciador")');
    await newPage.fill('input[placeholder="Digite seu usuário"]', email);
    await newPage.fill('input[placeholder="Digite sua senha"]', password);
    await newPage.click('button:has-text("Entrar")');
    
    await newPage.waitForURL("/dashboard");
    
    // Verificar que carregou dark
    const htmlElement = newPage.locator("html");
    await expect(htmlElement).toHaveClass(/dark/);
    
    await newPage.close();
  });

  test("deve aplicar tema imediatamente sem reload", async ({ page }) => {
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', "admin@test.com");
    await page.fill('input[placeholder="Digite sua senha"]', "senha123");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForURL("/dashboard");
    
    const htmlElement = page.locator("html");
    
    // Verificar estado inicial
    const initialHasDark = await htmlElement.evaluate(el => el.classList.contains('dark'));
    
    // Trocar tema
    await page.click('button[aria-label="User menu"]');
    const themeButton = initialHasDark 
      ? page.locator('text=Trocar Tema (Light)') 
      : page.locator('text=Trocar Tema (Dark)');
    await themeButton.click();
    
    // Verificar mudança imediata (sem reload)
    const newHasDark = await htmlElement.evaluate(el => el.classList.contains('dark'));
    expect(newHasDark).toBe(!initialHasDark);
    
    // URL não deve ter mudado
    expect(page.url()).toContain("/dashboard");
  });
});