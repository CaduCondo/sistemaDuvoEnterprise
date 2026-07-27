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
  created_at: string;
  updated_at: string;
}

/**
 * Buscar todas as configurações de e-mail
 */
export async function getEmailSettings(): Promise<EmailSetting[]> {
  const { data, error } = await supabase
    .from("email_settings")
    .select("*")
    .order("email_type", { ascending: true });

  if (error) {
    console.error("Erro ao buscar configurações de e-mail:", error);
    throw error;
  }

  return (data as EmailSetting[]) || [];
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
  emailType: EmailType,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from("email_settings")
    .update({ enabled })
    .eq("email_type", emailType);

  if (error) {
    console.error(`Erro ao atualizar configuração de e-mail ${emailType}:`, error);
    throw error;
  }
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