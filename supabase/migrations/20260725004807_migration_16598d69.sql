-- Adicionar coluna theme na tabela system_users
ALTER TABLE system_users 
ADD COLUMN IF NOT EXISTS theme VARCHAR(10) DEFAULT 'light' CHECK (theme IN ('light', 'dark'));

COMMENT ON COLUMN system_users.theme IS 'Tema preferido do usuário (light ou dark)';