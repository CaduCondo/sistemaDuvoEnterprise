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
}

/**
 * TEMPORARY: Direct password comparison for debugging
 * This will be replaced with proper bcrypt after login works
 */
async function validatePassword(inputPassword: string, storedPassword: string): Promise<boolean> {
  try {
    console.log("🔐 ========== PASSWORD VALIDATION DEBUG ==========");
    console.log("📝 Input password:", inputPassword);
    console.log("📝 Input password length:", inputPassword.length);
    console.log("🔑 Stored password:", storedPassword);
    console.log("🔑 Stored password length:", storedPassword.length);
    
    // TEMPORARY: Direct string comparison
    const isValid = inputPassword === storedPassword;
    
    console.log("✅ Direct compare result:", isValid);
    console.log("🔐 ========== END PASSWORD VALIDATION ==========");
    
    return isValid;
  } catch (error) {
    console.error("❌ ========== PASSWORD VALIDATION ERROR ==========");
    console.error("❌ Error validating password:", error);
    console.error("❌ ========== END ERROR ==========");
    return false;
  }
}

/**
 * Login using system_users table only
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  try {
    console.log("🔐 ========== LOGIN PROCESS START ==========");
    console.log("📧 Login attempt with:", credentials.email);
    console.log("🔑 Password provided:", credentials.password ? "YES" : "NO");
    console.log("🔑 Password length:", credentials.password?.length || 0);

    // 1. Search for user by username OR email
    const table = supabase.from("system_users");
    
    console.log("🔍 Searching user by username:", credentials.email);
    
    // Buscar usuário (username ou email)
    let { data: users, error: queryError } = await table
      .select("*")
      .eq("username", credentials.email)
      .eq("active", true);

    console.log("📊 Query result (by username):", { found: users?.length || 0, error: queryError });

    // If not found by username, try email
    if (!users || users.length === 0) {
      console.log("🔍 Not found by username, trying email...");
      const result = await table
        .select("*")
        .eq("email", credentials.email)
        .eq("active", true);
        
      users = result.data;
      queryError = result.error;
      
      console.log("📊 Query result (by email):", { found: users?.length || 0, error: queryError });
    }
    
    const foundUsers = users as SystemUser[];

    if (queryError) {
      console.error("❌ Database error:", queryError);
      return { success: false, error: "Erro ao buscar usuário" };
    }

    if (!foundUsers || foundUsers.length === 0) {
      console.warn("⚠️ User not found or inactive");
      return { success: false, error: "Usuário não encontrado ou inativo" };
    }

    const user = foundUsers[0];
    console.log("✅ User found!");
    console.log("👤 User ID:", user.id);
    console.log("👤 Username:", user.username);
    console.log("👤 Email:", user.email);
    console.log("👤 Name:", user.name);
    console.log("👤 Role:", user.role);
    console.log("👤 Active:", user.active);
    console.log("🔐 Password hash exists:", !!user.password_hash);
    console.log("🔐 Password hash preview:", user.password_hash?.substring(0, 20) + "...");

    // 1.5 VERIFICAR SE ESTÁ BLOQUEADO
    if (user.blocked_until && new Date(user.blocked_until) > new Date()) {
      const blockedDate = new Date(user.blocked_until);
      const timeLeft = Math.ceil((blockedDate.getTime() - Date.now()) / 60000);
      console.warn(`⛔ User blocked until ${blockedDate.toLocaleString()}`);
      return { 
        success: false, 
        error: `Conta bloqueada temporariamente por muitas tentativas falhas. Tente novamente em ${timeLeft} minutos.` 
      };
    }

    // 2. Validate password using password_hash (TEMPORARY: direct comparison)
    console.log("🔐 Starting password validation...");
    
    const isPasswordValid = await validatePassword(credentials.password, user.password_hash);

    console.log("🎯 Password validation final result:", isPasswordValid);

    if (!isPasswordValid) {
      console.warn("⚠️ ========== PASSWORD VALIDATION FAILED ==========");
      
      // INCREMENTAR TENTATIVAS FALHAS
      const newAttempts = (user.login_attempts || 0) + 1;
      const updates: any = { login_attempts: newAttempts };
      
      let errorMsg = "Senha incorreta";
      
      console.log("📊 Login attempts:", newAttempts);
      
      // SE ATINGIU 3 TENTATIVAS -> BLOQUEAR POR 30 MINUTOS
      if (newAttempts >= 3) {
        const blockUntil = new Date(Date.now() + 30 * 60000);
        updates.blocked_until = blockUntil.toISOString();
        console.warn(`⛔ BLOCKING USER until ${blockUntil.toLocaleString()}`);
        errorMsg = "Muitas tentativas falhas. Conta bloqueada por 30 minutos.";
      } else {
        const remaining = 3 - newAttempts;
        errorMsg = `Senha incorreta. Você tem mais ${remaining} tentativa(s) antes do bloqueio.`;
      }
      
      // Atualizar no banco
      await supabase
        .from("system_users")
        .update(updates)
        .eq("id", user.id);
        
      console.log("🔐 ========== LOGIN PROCESS END (FAILED) ==========");
      return { success: false, error: errorMsg };
    }

    console.log("✅ Password validated successfully!");

    // 2.5 RESETAR TENTATIVAS EM CASO DE SUCESSO
    if ((user.login_attempts || 0) > 0 || user.blocked_until) {
      console.log("🔄 Resetting login attempts...");
      await supabase
        .from("system_users")
        .update({ 
          login_attempts: 0, 
          blocked_until: null 
        })
        .eq("id", user.id);
    }

    // 3. Create local session with ALL user data
    const session: UserSession = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role as "admin" | "financial" | "broker",
        photo: user.photo,
        phone: user.phone,
        cpf: user.cpf,
        rg: user.rg,
        theme: user.theme || 'light',
      },
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    };

    // 4. CLEAR ALL OLD SESSIONS
    console.log("🧹 Clearing old sessions...");
    localStorage.removeItem("auth_session");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("rental_auth_user");
    localStorage.removeItem("currentUser");

    // 5. Save NEW session
    console.log("💾 Saving new session...");
    localStorage.setItem("auth_session", JSON.stringify(session));
    localStorage.setItem("auth_user", JSON.stringify(session.user));
    
    // ✅ CORREÇÃO CRÍTICA: Salvar TAMBÉM em 'currentUser' para compatibilidade com auditService
    localStorage.setItem("currentUser", JSON.stringify(session.user));
    console.log("✅ Session saved in all keys: auth_session, auth_user, currentUser");

    // ✅ Registrar log de login APÓS salvar no localStorage
    await logLogin(user.id);
    console.log("✅ Login audit log registered");

    // 6. Return success with properly typed user
    const userResult: LoginResult["user"] = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      username: session.user.username,
      role: session.user.role as "admin" | "financial" | "broker",
      photo: session.user.photo,
      phone: session.user.phone,
      cpf: session.user.cpf,
      rg: session.user.rg,
      theme: session.user.theme,
    };

    console.log("✅ Login successful!");
    console.log("🔐 ========== LOGIN PROCESS END (SUCCESS) ==========");

    return { success: true, user: userResult };

  } catch (error) {
    console.error("❌ ========== LOGIN PROCESS ERROR ==========");
    console.error("❌ Error during login:", error);
    console.error("❌ ========== END ERROR ==========");
    return { success: false, error: "Erro ao processar login" };
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

export async function changePassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const { error } = await supabase
    .from("system_users")
    .update({
      password_hash: newPassword,
      requires_password_change: false,
      temporary_password: false,
    })
    .eq("id", userId);

  if (error) throw error;

  // ✅ Registrar log de mudança de senha
  await logPasswordChange(userId, false);
}