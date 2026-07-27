-- PASSO 1: Adicionar as 3 colunas como NULLABLE (opcionais)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS occupation VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(10,2) NULL;

-- Adicionar comentários
COMMENT ON COLUMN tenants.occupation IS 'Profissão do inquilino (OPCIONAL)';
COMMENT ON COLUMN tenants.marital_status IS 'Estado civil do inquilino (OPCIONAL)';
COMMENT ON COLUMN tenants.monthly_income IS 'Renda mensal do inquilino (OPCIONAL)';