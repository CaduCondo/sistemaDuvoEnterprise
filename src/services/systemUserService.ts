import { SystemUser } from "@/types";
import {
  getAll as fetchAll,
  getSingle,
  createSingle,
  updateSingle,
  deleteSingle,
  getByField
} from "@/lib/supabaseHelpers";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./auditService";
import { getSessionToken } from "./authService";

const TABLE = "system_users";

/**
 * Criar/editar/excluir usuário, desbloquear e resetar senha passaram a
 * chamar rotas de servidor (31/ago/2026) -- ver o cabeçalho de
 * src/pages/api/users/index.ts para o porquê (RLS em `system_users` exige
 * `auth.uid()`, que este sistema, com login próprio, nunca tem).
 *
 * `getSystemUsers`/`getUserById`/`getUserByEmail` (leitura) continuam como
 * estavam, direto pelo cliente anônimo -- a leitura nunca foi o problema.
 */
async function chamarApi<T = any>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const token = getSessionToken();

  const resposta = await fetch(caminho, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opcoes.headers || {}),
    },
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados?.error || "Erro na requisição");
  }

  return dados as T;
}

export async function getSystemUsers(): Promise<SystemUser[]> {
  return fetchAll<SystemUser>(TABLE);
}

export async function getUserById(id: string): Promise<SystemUser> {
  const user = await getSingle<SystemUser>(TABLE, id);
  if (!user) throw new Error("Usuário não encontrado");
  return user;
}

export async function getUserByEmail(email: string): Promise<SystemUser | null> {
  return getByField<SystemUser>(TABLE, "email", email);
}

export async function createUser(userData: {
  name: string;
  email: string;
  role: string;
  password: string;
  temporary_password?: boolean;
}) {
  const { user: data } = await chamarApi<{ user: any }>("/api/users", {
    method: "POST",
    body: JSON.stringify(userData),
  });

  // ✅ Log de auditoria
  await logAudit({
    action_type: "create",
    entity_type: "user",
    entity_id: data.id,
    changes_summary: `Aba: Usuários\nNovo usuário cadastrado: ${data.name} (${data.email})`,
    new_values: {
      name: data.name,
      email: data.email,
      role: data.role,
    },
  });

  return data;
}

export async function updateUser(
  userId: string,
  updates: {
    name?: string;
    email?: string;
    role?: string;
    status?: string;
    phone?: string;
    cpf?: string;
    rg?: string;
    photo?: string;
  }
) {
  const { data: oldData } = await supabase
    .from("system_users")
    .select("name, email, role")
    .eq("id", userId)
    .single();

  const { user: data } = await chamarApi<{ user: any }>(`/api/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });

  // ✅ Log de auditoria com mudanças
  if (oldData) {
    const changes: string[] = [];
    
    if (oldData.name !== data.name) {
      changes.push(`name: de=${oldData.name} -> para=${data.name}`);
    }
    if (oldData.email !== data.email) {
      changes.push(`email: de=${oldData.email} -> para=${data.email}`);
    }
    if (oldData.role !== data.role) {
      changes.push(`role: de=${oldData.role} -> para=${data.role}`);
    }

    const changesSummary = changes.length > 0
      ? `Aba: Usuários\nUsuário editado: ${data.name}\n${changes.join('\n')}`
      : `Aba: Usuários\nUsuário editado: ${data.name}`;

    await logAudit({
      action_type: "update",
      entity_type: "user",
      entity_id: userId,
      changes_summary: changesSummary,
      old_values: {
        name: oldData.name,
        email: oldData.email,
        role: oldData.role,
      },
      new_values: {
        name: data.name,
        email: data.email,
        role: data.role,
      },
    });
  }

  return data;
}

export async function deleteUser(userId: string) {
  // ✅ Buscar dados ANTES de deletar
  const { data: userData } = await supabase
    .from("system_users")
    .select("name, email, role")
    .eq("id", userId)
    .single();

  await chamarApi(`/api/users/${userId}`, { method: "DELETE" });

  // ✅ Log de auditoria
  if (userData) {
    await logAudit({
      action_type: "delete",
      entity_type: "user",
      entity_id: userId,
      changes_summary: `Aba: Usuários\nUsuário excluído: ${userData.name} (${userData.email})`,
      old_values: {
        name: userData.name,
        email: userData.email,
        role: userData.role,
      },
    });
  }
}

/**
 * Ativa/desativa a conta (não confundir com o desbloqueio de tentativas de
 * login abaixo -- "active" é o usuário estar habilitado ou não; o bloqueio
 * por 3 senhas erradas é outro campo, `blocked_until`). Sem call site hoje
 * (a tela usa updateUser com `status` para isso), mantida por
 * compatibilidade.
 */
export async function unlockUser(userId: string, active: boolean): Promise<void> {
  await chamarApi(`/api/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: active ? "active" : "inactive" }),
  });
}

/** Desbloqueia a conta travada por 3 senhas erradas (limpa blocked_until/login_attempts). */
export async function unblockLogin(userId: string): Promise<void> {
  await chamarApi(`/api/users/${userId}/unblock`, { method: "POST" });
}

/**
 * Reseta a senha do usuário para o padrão e avisa por e-mail.
 *
 * ACHADO (02/set/2026, mesma frente do hash de senha): esta função só
 * chamava a rota de servidor e descartava a resposta -- não buscava o
 * e-mail do usuário nem mandava o aviso. Quem chamava de verdade essa ação
 * (o botão "Resetar Senha" em Configurações → Usuários, ver settings.tsx)
 * nem usava esta função: tinha uma cópia própria, mais antiga, que
 * escrevia direto em `system_users` com a chave pública -- o mesmo desenho
 * que o RLS de produção bloqueia (ver #57). Ou seja, o botão estava quebrado
 * em produção (dava erro) e, se não fosse pelo RLS, teria gravado a senha
 * nova em texto puro, por fora do hash novo (ver src/lib/passwordHash.ts).
 *
 * Agora só existe este caminho: chama a rota de servidor (que já grava o
 * hash) e manda o e-mail com a senha temporária que a rota devolve.
 */
export async function resetPassword(userId: string): Promise<{ email: string; temporaryPassword: string }> {
  const usuario = await getUserById(userId);

  const { temporaryPassword } = await chamarApi<{ success: boolean; temporaryPassword: string }>(
    `/api/users/${userId}/reset-password`,
    { method: "POST" }
  );

  try {
    await fetch("/api/send-password-recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: usuario.email,
        userId,
        name: usuario.name,
        temporaryPassword,
        isReset: true,
        isAdminReset: true,
      }),
    });
  } catch (erroEmail) {
    // A senha já foi trocada no banco; um e-mail que falhou não deve
    // impedir o admin de saber que o reset em si funcionou.
    console.error("Erro ao enviar e-mail de reset (senha já foi trocada):", erroEmail);
  }

  return { email: usuario.email, temporaryPassword };
}