import { supabase } from "@/integrations/supabase/client";
import { logLogin, logLogout, logPasswordChange } from "./auditService";
import type { Tables } from "@/integrations/supabase/types";
import type { LoginCredentials, LoginResult } from "@/types";

type SystemUser = Tables<"system_users">;

/**
 * Local authentication service - uses ONLY system_users table
 * NO Supabase Auth integration
 */

interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
    username: string;
    role: SystemUser["role"];
    photo?: string | null;
    phone?: string | null;
    cpf?: string | null;
    rg?: string | null;
    theme?: string | null;
  };
  expiresAt: number;
  /** Token assinado pelo servidor. Sessões antigas não têm; ver getSessionToken. */
  token?: string;
}

/**
 * Login.
 *
 * A conferência da senha NÃO acontece mais aqui. Ela foi para a rota
 * `/api/auth/login`, no servidor. Motivo, em uma frase: aqui é o navegador do
 * visitante, e enquanto a comparação era feita aqui a senha de quem tentava
 * entrar precisava ser baixada até esta máquina -- e chegava a ser impressa no
 * console. Ver o cabeçalho de src/pages/api/auth/login.ts.
 *
 * Esta função virou o que deveria ter sido desde o começo: manda usuário e
 * senha para o servidor, recebe de volta o usuário (sem senha) e um token
 * assinado, e guarda a sessão.
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  try {
    const resposta = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // O campo se chama `email` no formulário, mas aceita nome de usuário
        // ou e-mail -- o servidor tenta os dois.
        identificador: credentials.email,
        senha: credentials.password,
      }),
    });

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      return { success: false, error: dados?.error || "Erro ao processar login" };
    }

    const session: UserSession = {
      user: {
        id: dados.user.id,
        email: dados.user.email,
        name: dados.user.name,
        username: dados.user.username,
        role: dados.user.role,
        photo: dados.user.photo,
        phone: dados.user.phone,
        cpf: dados.user.cpf,
        rg: dados.user.rg,
        theme: dados.user.theme || "light",
      },
      expiresAt: dados.expiresAt,
      token: dados.token,
    };

    // Limpa sessões antigas antes de gravar a nova.
    localStorage.removeItem("auth_session");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("rental_auth_user");
    localStorage.removeItem("currentUser");

    localStorage.setItem("auth_session", JSON.stringify(session));
    localStorage.setItem("auth_user", JSON.stringify(session.user));
    // `currentUser` existe por compatibilidade com o auditService.
    localStorage.setItem("currentUser", JSON.stringify(session.user));

    await logLogin(session.user.id);

    return { success: true, user: { ...session.user } as LoginResult["user"] };
  } catch (error) {
    console.error("Erro ao processar login:", error);
    return { success: false, error: "Erro ao processar login" };
  }
}

/**
 * O token assinado da sessão atual, ou null se não houver sessão.
 *
 * É ele que as rotas de servidor exigem para provar quem está chamando. Sem
 * ele, uma rota que grava com a chave secreta seria uma porta aberta.
 */
export function getSessionToken(): string | null {
  try {
    const bruto = localStorage.getItem("auth_session");
    if (!bruto) return null;

    const session: UserSession = JSON.parse(bruto);
    if (!session?.token) return null;
    if (session.expiresAt && Date.now() > session.expiresAt) return null;

    return session.token;
  } catch {
    return null;
  }
}

/**
 * Logout - clear local session
 */
export async function logout(): Promise<void> {
  // ✅ Registrar log de logout ANTES de limpar sessão
  const currentUser = getCurrentUser();
  if (currentUser?.id) {
    await logLogout(currentUser.id);
  }

  localStorage.removeItem("auth_session");
  localStorage.removeItem("auth_user");
  localStorage.removeItem("rental_auth_user");
  localStorage.removeItem("currentUser"); // ✅ CORREÇÃO: Limpar currentUser também
  localStorage.removeItem("login_attempts");
  localStorage.removeItem("locked_until");
  console.log("✅ Logout completed");
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  try {
    const sessionStr = localStorage.getItem("auth_session");
    if (!sessionStr) return false;

    const session: UserSession = JSON.parse(sessionStr);
    
    // Check if session expired
    if (Date.now() > session.expiresAt) {
      logout();
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get current user from session
 */
export function getCurrentUser(): UserSession["user"] | null {
  try {
    const userStr = localStorage.getItem("auth_user");
    if (!userStr) return null;

    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Renew session expiration
 */
export function renewSession(): boolean {
  try {
    const sessionStr = localStorage.getItem("auth_session");
    if (!sessionStr) return false;

    const session: UserSession = JSON.parse(sessionStr);
    session.expiresAt = Date.now() + (24 * 60 * 60 * 1000);
    
    localStorage.setItem("auth_session", JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export async function signOut(): Promise<void> {
  // ✅ Registrar log de logout ANTES de limpar sessão
  const currentUser = getCurrentUser();
  if (currentUser?.id) {
    await logLogout(currentUser.id);
  }

  localStorage.removeItem("currentUser");
}

/**
 * Trocar senha -- agora no servidor (31/ago/2026), mesmo motivo do login
 * (ver o cabeçalho de src/pages/api/auth/login.ts): RLS em `system_users`
 * bloqueava esta gravação. Ver src/pages/api/users/[id]/change-password.ts.
 */
export async function changePassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const token = getSessionToken();

  const resposta = await fetch(`/api/users/${userId}/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ newPassword }),
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados?.error || "Não foi possível trocar a senha");
  }

  // ✅ Registrar log de mudança de senha
  await logPasswordChange(userId, false);
}