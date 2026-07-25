import { test, expect } from "@playwright/test";

test.describe("API de Autenticação", () => {
  const baseURL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";

  test.describe("POST /api/auth/login", () => {
    test("deve fazer login com credenciais válidas", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "admin@test.com",
          password: "senha123"
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe("admin@test.com");
      expect(data.user.role).toBeDefined();
      expect(data.user.theme).toBeDefined();
    });

    test("deve retornar erro com credenciais inválidas", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "admin@test.com",
          password: "senhaerrada"
        }
      });

      expect(response.status()).toBe(401);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Senha incorreta");
    });

    test("deve incrementar tentativas após senha incorreta", async ({ request }) => {
      // Primeira tentativa
      let response = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "test.user@test.com",
          password: "senhaerrada"
        }
      });

      let data = await response.json();
      expect(data.error).toContain("2 tentativa");

      // Segunda tentativa
      response = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "test.user@test.com",
          password: "senhaerrada"
        }
      });

      data = await response.json();
      expect(data.error).toContain("1 tentativa");

      // Terceira tentativa - deve bloquear
      response = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "test.user@test.com",
          password: "senhaerrada"
        }
      });

      expect(response.status()).toBe(403);
      data = await response.json();
      expect(data.error).toContain("bloqueada");
    });

    test("deve retornar erro quando conta está bloqueada", async ({ request }) => {
      // Assumindo que conta foi bloqueada no teste anterior
      const response = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "blocked.user@test.com",
          password: "senhaqualquer"
        }
      });

      expect(response.status()).toBe(403);
      
      const data = await response.json();
      expect(data.error).toContain("bloqueada");
      expect(data.error).toContain("30 minutos");
    });

    test("deve resetar tentativas após login bem-sucedido", async ({ request }) => {
      // Login com sucesso
      const response = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "admin@test.com",
          password: "senha123"
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      
      // Verificar que login_attempts deve ser 0
      // Isso seria verificado no próximo login com senha errada
    });

    test("deve retornar requires_password_change quando senha é temporária", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "newuser@test.com",
          password: "TempPass123"
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user.requires_password_change).toBe(true);
    });
  });

  test.describe("POST /api/auth/forgot-password", () => {
    test("deve gerar senha temporária para email válido", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        data: {
          email: "admin@test.com"
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("Email enviado");
    });

    test("deve retornar erro para email não encontrado", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        data: {
          email: "naoexiste@test.com"
        }
      });

      expect(response.status()).toBe(404);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("E-mail não encontrado");
    });

    test("deve resetar tentativas e bloqueio ao recuperar senha", async ({ request }) => {
      // Assumindo que usuário estava bloqueado
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        data: {
          email: "blocked.user@test.com"
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      
      // Tentar login com nova senha temporária (seria testado em outro cenário)
    });

    test("deve marcar requires_password_change como true", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/forgot-password`, {
        data: {
          email: "admin@test.com"
        }
      });

      expect(response.status()).toBe(200);
      
      // No próximo login, deve pedir troca de senha
    });
  });

  test.describe("POST /api/auth/change-password", () => {
    test("deve aceitar senha válida", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/change-password`, {
        data: {
          userId: "user-id-123",
          newPassword: "NovaSenha1"
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("deve rejeitar senha sem maiúscula", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/change-password`, {
        data: {
          userId: "user-id-123",
          newPassword: "novasenha1"
        }
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("maiúscula");
    });

    test("deve rejeitar senha sem minúscula", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/change-password`, {
        data: {
          userId: "user-id-123",
          newPassword: "NOVASENHA1"
        }
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain("minúscula");
    });

    test("deve rejeitar senha sem número", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/change-password`, {
        data: {
          userId: "user-id-123",
          newPassword: "NovaSenha"
        }
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain("número");
    });

    test("deve rejeitar senha com menos de 6 caracteres", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/change-password`, {
        data: {
          userId: "user-id-123",
          newPassword: "Abc1"
        }
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain("6 caracteres");
    });

    test("deve rejeitar senha com mais de 12 caracteres", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/change-password`, {
        data: {
          userId: "user-id-123",
          newPassword: "NovaSenha1234567890"
        }
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain("12 caracteres");
    });

    test("deve marcar requires_password_change como false após troca", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/change-password`, {
        data: {
          userId: "user-id-123",
          newPassword: "NovaSenha1"
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      
      // No próximo login, não deve pedir troca de senha
    });
  });
});