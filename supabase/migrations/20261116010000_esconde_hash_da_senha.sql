-- Impede que a chave pública do site (anon/authenticated) leia a coluna da
-- senha embaralhada (password_hash) de system_users. O servidor usa a chave
-- secreta (service_role) e continua lendo normalmente (login, troca de senha).
--
-- ORDEM IMPORTANTE: só rodar DEPOIS que o código novo (que não usa mais
-- select("*") em system_users) estiver no ar no ambiente. Código antigo +
-- esta migration = tela de Usuários quebrada.
-- Pode rodar mais de uma vez sem estragar.
REVOKE SELECT ON public.system_users FROM anon, authenticated;
GRANT SELECT (
  id, active, auth_user_id, blocked_until, cpf, created_at, email, login_attempts,
  name, phone, photo, requires_password_change, rg, role, temporary_password, theme,
  updated_at, username, is_landlord, landlord_address, landlord_city, landlord_bank_name,
  landlord_bank_agency, landlord_bank_operation, landlord_bank_savings, landlord_bank_account,
  landlord_pix_key, landlord_whatsapp, signature_url
) ON public.system_users TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
