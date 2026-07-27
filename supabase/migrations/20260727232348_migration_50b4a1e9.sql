-- Remover as 3 colunas da tabela tenants (DROP COLUMN manual)
ALTER TABLE tenants 
  DROP COLUMN IF EXISTS occupation,
  DROP COLUMN IF EXISTS marital_status,
  DROP COLUMN IF EXISTS monthly_income;