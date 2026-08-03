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

const TABLE = "system_users";

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
  const { data, error } = await supabase
    .from("system_users")
    .insert([
      {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        password_hash: userData.password,
        temporary_password: userData.temporary_password || false,
        requires_password_change: userData.temporary_password || false,
      },
    ])
    .select()
    .single();

  if (error) throw error;

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
  }
) {
  // ✅ CORREÇÃO: Remover 'status' da query - campo NÃO EXISTE na tabela system_users
  // A tabela tem 'active' (boolean), NÃO 'status' (string)
  const { data: oldData } = await supabase
    .from("system_users")
    .select("name, email, role")
    .eq("id", userId)
    .single();

  // ✅ CORREÇÃO: Filtrar 'status' do objeto updates - converter para 'active' se necessário
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  
  // Se status foi passado, converter para active (boolean)
  if (updates.status !== undefined) {
    dbUpdates.active = updates.status === "active" || updates.status === "ativo";
  }

  const { data, error } = await supabase
    .from("system_users")
    .update(dbUpdates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;

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

  const { error } = await supabase.from("system_users").delete().eq("id", userId);

  if (error) throw error;

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

export async function unlockUser(userId: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from("system_users")
    .update({ active })
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
}

export async function resetPassword(userId: string): Promise<void> {
  // Resetar senha para "mudar123"
  // TODO: Em produção, usar bcrypt.hash antes de salvar
  const { error } = await supabase
    .from("system_users")
    .update({ password_hash: "mudar123" })
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
}