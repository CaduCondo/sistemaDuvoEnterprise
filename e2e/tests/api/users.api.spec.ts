import { test, expect } from "@playwright/test";

test.describe("API de Usuários", () => {
  const baseURL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  let authToken: string;
  let createdUserId: string;

  test.beforeAll(async ({ request }) => {
    // Login para obter token
    const response = await request.post(`${baseURL}/api/auth/login`, {
      data: {
        email: "admin@test.com",
        password: "senha123"
      }
    });

    const data = await response.json();
    authToken = data.token;
  });

  test.describe("GET /api/users", () => {
    test("deve listar todos os usuários", async ({ request }) => {
      const response = await request.get(`${baseURL}/api/users`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      
      // Verificar estrutura do usuário
      const user = data[0];
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("name");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("role");
      expect(user).toHaveProperty("active");
    });

    test("deve retornar 401 sem autenticação", async ({ request }) => {
      const response = await request.get(`${baseURL}/api/users`);

      expect(response.status()).toBe(401);
    });
  });

  test.describe("POST /api/users", () => {
    test("deve criar usuário com dados válidos", async ({ request }) => {
      const timestamp = Date.now();
      
      const response = await request.post(`${baseURL}/api/users`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        data: {
          name: `Novo Usuário ${timestamp}`,
          email: `novo${timestamp}@test.com`,
          phone: "(11) 98765-4321",
          role: "broker",
          active: true
        }
      });

      expect(response.status()).toBe(201);
      
      const data = await response.json();
      expect(data).toHaveProperty("id");
      expect(data.name).toBe(`Novo Usuário ${timestamp}`);
      expect(data.email).toBe(`novo${timestamp}@test.com`);
      expect(data.role).toBe("broker");
      expect(data.active).toBe(true);
      expect(data.requires_password_change).toBe(true);
      expect(data.temporary_password).toBe(true);
      
      createdUserId = data.id;
    });

    test("deve rejeitar email duplicado", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/users`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        data: {
          name: "Usuário Duplicado",
          email: "admin@test.com", // Email já existe
          role: "broker"
        }
      });

      expect(response.status()).toBe(409);
      
      const data = await response.json();
      expect(data.error).toContain("já existe");
    });

    test("deve rejeitar email sem @", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/users`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        data: {
          name: "Usuário Inválido",
          email: "emailinvalido",
          role: "broker"
        }
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain("@");
    });

    test("deve rejeitar telefone inválido", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/users`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        data: {
          name: "Usuário Inválido",
          email: "usuario@test.com",
          phone: "123",
          role: "broker"
        }
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain("Telefone inválido");
    });

    test("deve aceitar telefone fixo (10 dígitos)", async ({ request }) => {
      const timestamp = Date.now();
      
      const response = await request.post(`${baseURL}/api/users`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        data: {
          name: `Usuário Fixo ${timestamp}`,
          email: `fixo${timestamp}@test.com`,
          phone: "(11) 3333-4444",
          role: "broker"
        }
      });

      expect(response.status()).toBe(201);
    });

    test("deve aceitar telefone celular (11 dígitos)", async ({ request }) => {
      const timestamp = Date.now();
      
      const response = await request.post(`${baseURL}/api/users`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        data: {
          name: `Usuário Celular ${timestamp}`,
          email: `celular${timestamp}@test.com`,
          phone: "(11) 98765-4321",
          role: "broker"
        }
      });

      expect(response.status()).toBe(201);
    });

    test("deve criar usuário ativado por padrão", async ({ request }) => {
      const timestamp = Date.now();
      
      const response = await request.post(`${baseURL}/api/users`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        data: {
          name: `Usuário Padrão ${timestamp}`,
          email: `padrao${timestamp}@test.com`,
          role: "broker"
          // active não informado
        }
      });

      expect(response.status()).toBe(201);
      
      const data = await response.json();
      expect(data.active).toBe(true);
    });
  });

  test.describe("PUT /api/users/:id", () => {
    test("deve atualizar dados do usuário", async ({ request }) => {
      const response = await request.put(`${baseURL}/api/users/${createdUserId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        data: {
          name: "Nome Atualizado",
          phone: "(11) 99999-8888"
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.name).toBe("Nome Atualizado");
      expect(data.phone).toBe("(11) 99999-8888");
    });

    test("deve alterar status ativo/inativo", async ({ request }) => {
      const response = await request.put(`${baseURL}/api/users/${createdUserId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        data: {
          active: false
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.active).toBe(false);
    });

    test("deve atualizar tema do usuário", async ({ request }) => {
      const response = await request.put(`${baseURL}/api/users/${createdUserId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        data: {
          theme: "dark"
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.theme).toBe("dark");
    });

    test("deve rejeitar tema inválido", async ({ request }) => {
      const response = await request.put(`${baseURL}/api/users/${createdUserId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        data: {
          theme: "invalidTheme"
        }
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe("POST /api/users/:id/reset-password", () => {
    test("deve resetar senha do usuário", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/users/${createdUserId}/reset-password`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.temporaryPassword).toBeDefined();
      expect(data.temporaryPassword.length).toBe(12);
      
      // Verificar que senha tem requisitos
      const pass = data.temporaryPassword;
      expect(/[A-Z]/.test(pass)).toBe(true); // Maiúscula
      expect(/[a-z]/.test(pass)).toBe(true); // Minúscula
      expect(/[0-9]/.test(pass)).toBe(true); // Número
    });

    test("deve marcar requires_password_change após reset", async ({ request }) => {
      await request.post(`${baseURL}/api/users/${createdUserId}/reset-password`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      // Verificar usuário
      const userResponse = await request.get(`${baseURL}/api/users/${createdUserId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      const user = await userResponse.json();
      expect(user.requires_password_change).toBe(true);
      expect(user.temporary_password).toBe(true);
    });

    test("deve resetar tentativas de login", async ({ request }) => {
      await request.post(`${baseURL}/api/users/${createdUserId}/reset-password`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      const userResponse = await request.get(`${baseURL}/api/users/${createdUserId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      const user = await userResponse.json();
      expect(user.login_attempts).toBe(0);
      expect(user.blocked_until).toBeNull();
    });
  });

  test.describe("DELETE /api/users/:id", () => {
    test("deve excluir usuário", async ({ request }) => {
      const response = await request.delete(`${baseURL}/api/users/${createdUserId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("deve retornar 404 ao buscar usuário excluído", async ({ request }) => {
      const response = await request.get(`${baseURL}/api/users/${createdUserId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(404);
    });

    test("deve retornar 401 sem permissão de admin", async ({ request }) => {
      // Login como usuário não-admin
      const loginResponse = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "broker@test.com",
          password: "senha123"
        }
      });

      const loginData = await loginResponse.json();
      const brokerToken = loginData.token;

      const response = await request.delete(`${baseURL}/api/users/some-user-id`, {
        headers: {
          Authorization: `Bearer ${brokerToken}`
        }
      });

      expect(response.status()).toBe(403);
    });
  });
});