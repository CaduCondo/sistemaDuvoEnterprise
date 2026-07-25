-- Adicionar colunas para controle de senha temporária e troca obrigatória
ALTER TABLE system_users 
ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS temporary_password BOOLEAN DEFAULT false;

COMMENT ON COLUMN system_users.requires_password_change IS 'Indica se o usuário precisa trocar a senha no próximo login';
COMMENT ON COLUMN system_users.temporary_password IS 'Indica se a senha atual é temporária';