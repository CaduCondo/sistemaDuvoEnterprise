-- Contrato de locação completo (issue #125)
--
-- 1) tenants.gender: o contrato muda o texto conforme o sexo do locatário
--    (LOCATÁRIO/LOCATÁRIA, portador/portadora, casado/casada). 'M' ou 'F'.
--    Fica opcional no banco (inquilinos antigos não têm); a TELA obriga ao
--    salvar, e o contrato avisa quando falta.
-- 2) properties.usage_type: 'residential' (padrão) ou 'commercial'. Por
--    enquanto só existe o modelo de contrato residencial.
-- 3) system_users.is_landlord + landlord_*: o LOCADOR é um usuário do
--    sistema marcado com "Também é locador" (decisão do Cadu, 05/nov/2026).
--    Nome, CPF, RG e telefone já existem no usuário; aqui entram só os
--    dados que faltam para o contrato. Ficam no banco, NUNCA no código: o
--    repositório do GitHub é público e o contrato leva CPF, RG, endereço e
--    dados bancários.
-- 4) rentals.landlord_user_id: quem é o locador daquela locação. Locações
--    antigas ficam vazias (regra do Cadu: não alterar dado que não foi o
--    Claude que criou) -- a tela escolhe o locador ao criar locação nova.
--
-- Pode rodar mais de uma vez sem estragar nada (IF NOT EXISTS).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS gender TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_gender_check') THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_gender_check CHECK (gender IS NULL OR gender IN ('M', 'F'));
  END IF;
END $$;

COMMENT ON COLUMN tenants.gender IS
  'Sexo do inquilino para o texto do contrato: M ou F (issue #125).';

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS usage_type TEXT NOT NULL DEFAULT 'residential';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_usage_type_check') THEN
    ALTER TABLE properties ADD CONSTRAINT properties_usage_type_check CHECK (usage_type IN ('residential', 'commercial'));
  END IF;
END $$;

COMMENT ON COLUMN properties.usage_type IS
  'Uso do imóvel: residential ou commercial. Define o modelo de contrato (issue #125).';

ALTER TABLE system_users
  ADD COLUMN IF NOT EXISTS is_landlord BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS landlord_address TEXT,
  ADD COLUMN IF NOT EXISTS landlord_city TEXT,
  ADD COLUMN IF NOT EXISTS landlord_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS landlord_bank_agency TEXT,
  ADD COLUMN IF NOT EXISTS landlord_bank_operation TEXT,
  ADD COLUMN IF NOT EXISTS landlord_bank_account TEXT,
  ADD COLUMN IF NOT EXISTS landlord_pix_key TEXT,
  ADD COLUMN IF NOT EXISTS landlord_whatsapp TEXT;

COMMENT ON COLUMN system_users.is_landlord IS 'Usuário também é LOCADOR nos contratos (issue #125).';
COMMENT ON COLUMN system_users.landlord_address IS 'Endereço completo do locador para o contrato. Dado pessoal: só no banco, nunca no código.';
COMMENT ON COLUMN system_users.landlord_city IS 'Cidade que aparece na data de assinatura do contrato (ex.: São Paulo).';

ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS landlord_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN rentals.landlord_user_id IS 'LOCADOR desta locação (usuário com is_landlord). Vazio nas locações antigas (issue #125).';

-- 5) locations.contract_clauses: cláusulas específicas de cada local
--    (condomínio/prédio), em ordem: [{"titulo": "...", "texto": "..."}].
--    Entram no contrato depois de "Impostos, taxas e encargos".
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS contract_clauses JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN locations.contract_clauses IS
  'Cláusulas específicas do local para o contrato: [{titulo, texto}] (issue #125).';

NOTIFY pgrst, 'reload schema';
