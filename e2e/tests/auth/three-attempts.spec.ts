import { test, expect } from "@playwright/test";

test.describe("Sistema de 3 Tentativas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Gerenciador")');
  });

  test("deve mostrar mensagens decrescentes de tentativas", async ({ page }) => {
    const email = "test.attempts@test.com";
    
    // 1ª tentativa
    await page.fill('input[placeholder="Digite seu usuário"]', email);
    await page.fill('input[placeholder="Digite sua senha"]', "senhaerrada1");
    await page.click('button:has-text("Entrar")');
    await expect(page.locator('text=Você tem mais 2 tentativa')).toBeVisible();
    
    // 2ª tentativa
    await page.fill('input[placeholder="Digite sua senha"]', "senhaerrada2");
    await page.click('button:has-text("Entrar")');
    await expect(page.locator('text=Você tem mais 1 tentativa')).toBeVisible();
    
    // 3ª tentativa
    await page.fill('input[placeholder="Digite sua senha"]', "senhaerrada3");
    await page.click('button:has-text("Entrar")');
    await expect(page.locator('text=bloqueada temporariamente')).toBeVisible();
  });

  test("deve bloquear conta após 3 tentativas falhas", async ({ page }) => {
    const email = "test.block@test.com";
    
    // 3 tentativas erradas
    for (let i = 1; i <= 3; i++) {
      await page.fill('input[placeholder="Digite seu usuário"]', email);
      await page.fill('input[placeholder="Digite sua senha"]', `senhaerrada${i}`);
      await page.click('button:has-text("Entrar")');
      await page.waitForTimeout(500);
    }
    
    // Verificar mensagem de bloqueio
    await expect(page.locator('text=bloqueada')).toBeVisible();
    await expect(page.locator('text=30 minutos')).toBeVisible();
    
    // Tentar fazer login com senha correta
    await page.fill('input[placeholder="Digite sua senha"]', "senhacorreta");
    await page.click('button:has-text("Entrar")');
    
    // Deve continuar bloqueada
    await expect(page.locator('text=bloqueada')).toBeVisible();
  });

  test("deve resetar tentativas após login bem-sucedido", async ({ page }) => {
    const email = "test.reset@test.com";
    
    // 2 tentativas erradas
    await page.fill('input[placeholder="Digite seu usuário"]', email);
    await page.fill('input[placeholder="Digite sua senha"]', "senhaerrada1");
    await page.click('button:has-text("Entrar")');
    
    await page.fill('input[placeholder="Digite sua senha"]', "senhaerrada2");
    await page.click('button:has-text("Entrar")');
    
    // Login correto
    await page.fill('input[placeholder="Digite sua senha"]', "senhacorreta");
    await page.click('button:has-text("Entrar")');
    
    await page.waitForURL("/dashboard");
    
    // Fazer logout
    await page.click('button[aria-label="User menu"]');
    await page.click('text=Sair');
    
    // Tentar login errado novamente
    await page.click('button:has-text("Gerenciador")');
    await page.fill('input[placeholder="Digite seu usuário"]', email);
    await page.fill('input[placeholder="Digite sua senha"]', "senhaerrada");
    await page.click('button:has-text("Entrar")');
    
    // Deve mostrar 2 tentativas (resetou)
    await expect(page.locator('text=Você tem mais 2 tentativa')).toBeVisible();
  });

  test("deve exibir toast ao bloquear conta", async ({ page }) => {
    const email = "test.toast@test.com";
    
    // 3 tentativas erradas
    for (let i = 1; i <= 3; i++) {
      await page.fill('input[placeholder="Digite seu usuário"]', email);
      await page.fill('input[placeholder="Digite sua senha"]', `senhaerrada${i}`);
      await page.click('button:has-text("Entrar")');
      
      if (i < 3) {
        await page.waitForTimeout(500);
      }
    }
    
    // Verificar toast de bloqueio
    await expect(page.locator('[role="status"]:has-text("Conta bloqueada")')).toBeVisible();
    await expect(page.locator('text=30 minutos')).toBeVisible();
    
    // Dropdown deve fechar
    await expect(page.locator('text=Property Control System')).not.toBeVisible();
  });
});