import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SystemUser } from "@/types";
import { createUser, updateUser, deleteUser, unblockLogin } from "@/services/systemUserService";
import { useAlert } from "@/contexts/AlertContext";

export function useUsers() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showAlert } = useAlert();

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("system_users")
        .select("*")
        .order("name");

      if (error) throw error;
      
      const typedUsers: SystemUser[] = (data || []).map((user) => ({
        ...user,
        active: !!user.active,
        status: user.active ? "active" : "inactive",
        role: user.role as "admin" | "financial" | "broker",
        cpf: user.cpf || "",
        auth_user_id: user.auth_user_id || "",
        created_at: user.created_at || new Date().toISOString(),
      }));
      
      setUsers(typedUsers);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      showAlert({
        title: "Erro ao carregar usuários",
        description: "Não foi possível carregar a lista de usuários.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (userData: {
    name: string;
    email: string;
    phone?: string;
    username: string;
    role: "admin" | "broker" | "financial";
    password: string;
  }) => {
    try {
      const { data: existingUser } = await supabase
        .from("system_users")
        .select("email")
        .eq("email", userData.email)
        .maybeSingle();

      if (existingUser) {
        showAlert({
          title: "Email já cadastrado",
          description: "Já existe um usuário com este email. Por favor, use um email diferente.",
          type: "error",
        });
        return false;
      }

      const { data: existingUsername } = await supabase
        .from("system_users")
        .select("username")
        .eq("username", userData.username)
        .maybeSingle();

      if (existingUsername) {
        showAlert({
          title: "Usuário já cadastrado",
          description: "Já existe um usuário com este nome de usuário. Por favor, escolha outro.",
          type: "error",
        });
        return false;
      }

      const newUser = await createUser({
        name: userData.name,
        email: userData.email,
        role: userData.role,
        password: userData.password || "mudar123",
        temporary_password: true,
      });
      
      showAlert({
        title: "Sucesso",
        description: "Usuário criado com sucesso!",
        type: "success",
      });
      await fetchUsers();
      return true;
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error);
      
      if (error.message?.includes("duplicate key") || error.message?.includes("unique constraint")) {
        if (error.message?.includes("email")) {
          showAlert({
            title: "Email já cadastrado",
            description: "Já existe um usuário com este email no sistema.",
            type: "error",
          });
        } else if (error.message?.includes("username")) {
          showAlert({
            title: "Usuário já cadastrado",
            description: "Já existe um usuário com este nome de usuário no sistema.",
            type: "error",
          });
        } else {
          showAlert({
            title: "Dados duplicados",
            description: "Os dados informados já estão em uso. Verifique email e nome de usuário.",
            type: "error",
          });
        }
      } else {
        showAlert({
          title: "Erro ao criar usuário",
          description: error.message || "Ocorreu um erro ao criar o usuário.",
          type: "error",
        });
      }
      
      return false;
    }
  };

  const handleUpdateUser = async (id: string, userData: Partial<SystemUser> & { password?: string }) => {
    try {
      console.log("🔐 ========== UPDATE USER DEBUG ==========");
      console.log("🆔 User ID:", id);
      console.log("📋 userData recebido:", userData);
      console.log("🔑 password field:", (userData as any).password);
      console.log("🔑 password_hash field:", userData.password_hash);
      
      if (userData.email) {
        const { data: existingUser } = await supabase
          .from("system_users")
          .select("id, email")
          .eq("email", userData.email)
          .neq("id", id)
          .maybeSingle();

        if (existingUser) {
          showAlert({
            title: "Email já cadastrado",
            description: "Já existe outro usuário com este email. Por favor, use um email diferente.",
            type: "error",
          });
          return false;
        }
      }

      if (userData.username) {
        const { data: existingUsername } = await supabase
          .from("system_users")
          .select("id, username")
          .eq("username", userData.username)
          .neq("id", id)
          .maybeSingle();

        if (existingUsername) {
          showAlert({
            title: "Usuário já cadastrado",
            description: "Já existe outro usuário com este nome de usuário. Por favor, escolha outro.",
            type: "error",
          });
          return false;
        }
      }

      await updateUser(id, {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        status: userData.active ? "active" : "inactive",
      });
      
      console.log("✅ updateUser concluído com sucesso");
      showAlert({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso!",
        type: "success",
      });
      await fetchUsers();
      return true;
    } catch (error: any) {
      console.error("❌ ========== UPDATE USER ERROR ==========");
      console.error("❌ Error:", error);
      console.error("❌ Error message:", error.message);
      
      if (error.message?.includes("duplicate key") || error.message?.includes("unique constraint")) {
        if (error.message?.includes("email")) {
          showAlert({
            title: "Email já cadastrado",
            description: "Já existe outro usuário com este email no sistema.",
            type: "error",
          });
        } else if (error.message?.includes("username")) {
          showAlert({
            title: "Usuário já cadastrado",
            description: "Já existe outro usuário com este nome de usuário no sistema.",
            type: "error",
          });
        } else {
          showAlert({
            title: "Dados duplicados",
            description: "Os dados informados já estão em uso por outro usuário.",
            type: "error",
          });
        }
      } else {
        showAlert({
          title: "Erro ao atualizar usuário",
          description: error.message || "Ocorreu um erro ao atualizar o usuário.",
          type: "error",
        });
      }
      
      return false;
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteUser(id);
      showAlert({
        title: "Sucesso",
        description: "Usuário excluído com sucesso!",
        type: "success",
      });
      await fetchUsers();
      return true;
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      showAlert({
        title: "Erro ao excluir usuário",
        description: "Não foi possível excluir o usuário.",
        type: "error",
      });
      return false;
    }
  };

  const handleToggleUserStatus = async (user: SystemUser) => {
    try {
      await updateUser(user.id, { 
        status: user.active ? "inactive" : "active" 
      });
      showAlert({
        title: "Sucesso",
        description: `Usuário ${user.active ? "desativado" : "ativado"} com sucesso!`,
        type: "success",
      });
      await fetchUsers();
      return true;
    } catch (error) {
      console.error("Erro ao alterar status do usuário:", error);
      showAlert({
        title: "Erro ao alterar status do usuário",
        description: "Não foi possível alterar o status do usuário.",
        type: "error",
      });
      return false;
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      await unblockLogin(userId);

      showAlert({
        title: "Sucesso",
        description: "Usuário desbloqueado com sucesso! O usuário pode acessar o sistema novamente.",
        type: "success",
      });
      await fetchUsers();
      return true;
    } catch (error) {
      console.error("Erro ao desbloquear usuário:", error);
      showAlert({
        title: "Erro ao desbloquear usuário",
        description: "Não foi possível remover o bloqueio temporário.",
        type: "error",
      });
      return false;
    }
  };

  return {
    users,
    isLoading,
    error: null,
    refresh: fetchUsers,
    fetchUsers,
    handleCreateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleToggleUserStatus,
    handleUnblockUser,
  };
}