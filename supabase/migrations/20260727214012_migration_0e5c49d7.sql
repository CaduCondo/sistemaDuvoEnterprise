-- Adicionar as 3 colunas à tabela tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS occupation VARCHAR(255),
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(10,2);

-- Comentários para documentação
COMMENT ON COLUMN tenants.occupation IS 'Profissão do inquilino';
COMMENT ON COLUMN tenants.marital_status IS 'Estado civil do inquilino';
COMMENT ON COLUMN tenants.monthly_income IS 'Renda mensal do inquilino';