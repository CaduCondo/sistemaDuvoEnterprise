import { supabase } from "@/integrations/supabase/client";

export type EmailType =
  | "password_recovery"
  | "welcome_user"
  | "welcome_tenant"
  | "contract_expiration"
  | "payment_reminder"
  | "payment_overdue"
  | "payment_confirmed";

export interface EmailSetting {
  id: string;
  email_type: EmailType;
  enabled: boolean;
  description: string | null;
  email_subject: string | null;
  email_body: string | null;
  available_variables: string[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * Buscar todas as configurações de e-mail
 */
export async function getEmailSettings(): Promise<EmailSetting[]> {
  console.log("🔍 getEmailSettings - Iniciando busca...");
  
  const { data, error } = await supabase
    .from("email_settings")
    .select("*")
    .order("email_type", { ascending: true });

  console.log("🔍 getEmailSettings - Resposta do Supabase:");
  console.log("  - Error:", error);
  console.log("  - Data:", data);
  console.log("  - Data length:", data?.length);

  if (error) {
    console.error("❌ Erro ao buscar configurações de e-mail:", error);
    throw error;
  }

  const result = (data as EmailSetting[]) || [];
  console.log("✅ getEmailSettings - Retornando:", result.length, "registros");
  
  return result;
}

/**
 * Verificar se um tipo de e-mail está habilitado
 */
export async function isEmailEnabled(emailType: EmailType): Promise<boolean> {
  const { data, error } = await supabase
    .from("email_settings")
    .select("enabled")
    .eq("email_type", emailType)
    .single();

  if (error) {
    console.error(`Erro ao verificar status do e-mail ${emailType}:`, error);
    // Em caso de erro, retornar true (padrão: enviar)
    return true;
  }

  return data?.enabled ?? true;
}

/**
 * Atualizar status de um tipo de e-mail
 */
export async function updateEmailSetting(
  id: string,
  updates: {
    enabled?: boolean;
    email_subject?: string;
    email_body?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from("email_settings")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar configuração de e-mail:", error);
    throw error;
  }
}

export async function getEmailTemplate(emailType: EmailType): Promise<{
  subject: string;
  body: string;
  variables: string[];
} | null> {
  const { data, error } = await supabase
    .from("email_settings")
    .select("email_subject, email_body, available_variables")
    .eq("email_type", emailType)
    .single();

  if (error || !data) {
    console.error("Erro ao buscar template de e-mail:", error);
    return null;
  }

  return {
    subject: data.email_subject || "",
    body: data.email_body || "",
    variables: data.available_variables || [],
  };
}

/**
 * Nomes amigáveis para os tipos de e-mail
 */
export const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  password_recovery: "Recuperação de Senha",
  welcome_user: "Boas-Vindas Usuário",
  welcome_tenant: "Boas-Vindas Inquilino",
  contract_expiration: "Vencimento de Contrato",
  payment_reminder: "Lembrete de Pagamento",
  payment_overdue: "Pagamento Atrasado",
  payment_confirmed: "Confirmação de Pagamento",
};

/**
 * Ícones para os tipos de e-mail
 */
export const EMAIL_TYPE_ICONS: Record<EmailType, string> = {
  password_recovery: "🔐",
  welcome_user: "👋",
  welcome_tenant: "🏠",
  contract_expiration: "📅",
  payment_reminder: "⏰",
  payment_overdue: "⚠️",
  payment_confirmed: "✅",
};