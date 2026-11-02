-- Contrato de locação completo (issue #125)
--
-- 1) tenants.gender: o contrato muda o texto conforme o sexo do locatário
--    (LOCATÁRIO/LOCATÁRIA, portador/portadora, casado/casada). 'M' ou 'F'.
--    Fica opcional no banco (inquilinos antigos não têm); a TELA obriga ao
--    salvar, e o contrato avisa quando falta.
-- 2) properties.usage_type: 'residential' (padrão) ou 'commercial'. Por
--    enquanto só existe o modelo de contrato residencial.
-- 3) configs.landlord_*: dados do LOCADOR que vão em todo contrato. Ficam no
--    banco, NUNCA no código: o repositório do GitHub é público e o contrato
--    leva CPF, RG, endereço e dados bancários.
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

ALTER TABLE configs
  ADD COLUMN IF NOT EXISTS landlord_name TEXT,
  ADD COLUMN IF NOT EXISTS landlord_cpf TEXT,
  ADD COLUMN IF NOT EXISTS landlord_rg TEXT,
  ADD COLUMN IF NOT EXISTS landlord_address TEXT,
  ADD COLUMN IF NOT EXISTS landlord_city TEXT,
  ADD COLUMN IF NOT EXISTS landlord_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS landlord_bank_agency TEXT,
  ADD COLUMN IF NOT EXISTS landlord_bank_account TEXT,
  ADD COLUMN IF NOT EXISTS landlord_bank_operation TEXT,
  ADD COLUMN IF NOT EXISTS landlord_pix_key TEXT,
  ADD COLUMN IF NOT EXISTS landlord_whatsapp TEXT;

COMMENT ON COLUMN configs.landlord_name IS 'LOCADOR do contrato (issue #125). Dado pessoal: só no banco, nunca no código.';
COMMENT ON COLUMN configs.landlord_city IS 'Cidade que aparece na data de assinatura do contrato (ex.: São Paulo).';

NOTIFY pgrst, 'reload schema';
