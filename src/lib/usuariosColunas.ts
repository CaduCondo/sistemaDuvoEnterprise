/**
 * Colunas de `system_users` que a tela pode ler. De propósito NÃO inclui
 * `password_hash` (a senha embaralhada): nenhuma tela precisa dela, e quem lê
 * a tabela com a chave pública não deve conseguir baixá-la (auditoria
 * 16/nov/2026). Nunca usar `select("*")` nessa tabela.
 */
export const COLUNAS_USUARIO =
  "id, active, auth_user_id, blocked_until, cpf, created_at, email, login_attempts, name, phone, photo, " +
  "requires_password_change, rg, role, temporary_password, theme, updated_at, username, " +
  "is_landlord, landlord_address, landlord_city, landlord_bank_name, landlord_bank_agency, " +
  "landlord_bank_operation, landlord_bank_savings, landlord_bank_account, landlord_pix_key, " +
  "landlord_whatsapp, signature_url";
