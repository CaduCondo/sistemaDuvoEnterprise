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
  phone?: string | null;
  username?: string;
  role: "admin" | "broker" | "financial";
  password: string;
  active?: boolean;
  requires_password_change?: boolean;
  temporary_password?: boolean;
}): Promise<SystemUser> {
  // Converter password para password_hash
  // TODO: Em produção, usar bcrypt.hash antes de salvar
  const dbData = {
    ...userData,
    password_hash: userData.password, // TEMPORÁRIO: até bcrypt ser implementado
    active: userData.active !== undefined ? userData.active : true,
    requires_password_change: userData.requires_password_change || false,
    temporary_password: userData.temporary_password || false,
  };
  
  // Remover password do objeto (não existe mais no banco)
  delete (dbData as any).password;
  
  return createSingle<SystemUser>(TABLE, dbData as any);
}

export async function updateUser(id: string, user: Partial<SystemUser>): Promise<SystemUser> {
  // Converter camelCase → snake_case para campos do banco
  const dbUser: any = { ...user };
  
  // Mapear campos camelCase → snake_case
  if (user.birthDate !== undefined) {
    dbUser.birth_date = user.birthDate;
    delete dbUser.birthDate;
  }
  
  console.log("🔍 ===== DEBUG UPDATE USER =====");
  console.log("🆔 User ID:", id);
  console.log("📋 Dados recebidos (camelCase):", user);
  console.log("📋 Dados convertidos (snake_case):", dbUser);
  console.log("📞 Phone:", dbUser.phone);
  console.log("🆔 CPF:", dbUser.cpf);
  console.log("🆔 RG:", dbUser.rg);
  console.log("🔍 ================================");
  
  try {
    console.log("🚀 Chamando updateSingle...");
    
    const updatedUser = await updateSingle<SystemUser>(TABLE, id, dbUser);
    
    console.log("✅ Update concluído com sucesso!");
    console.log("📋 User atualizado:", updatedUser);
    
    return updatedUser;
  } catch (error) {
    console.error("❌ Erro ao atualizar usuário:", error);
    throw error;
  }
}

export async function deleteUser(id: string): Promise<void> {
  return deleteSingle(TABLE, id);
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