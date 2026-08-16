-- ✅ Código público sequencial para imóveis (ex: 0001, 0002...)
-- Objetivo: URLs públicas mais curtas e fáceis de compartilhar (.../imovel/0001)
-- em vez do UUID completo (.../imovel/8006874d-b58e-45b8-a307-440018fddba8).
--
-- Importante: o ID interno (UUID) NÃO é alterado. Ele continua sendo a chave
-- que liga imóveis a locações, parcelas de caução, auditoria etc. Esta coluna
-- nova serve só para exibição e para a URL pública — mudança aditiva, sem
-- nenhum risco para dados existentes ou links já compartilhados (que continuam
-- funcionando normalmente com o UUID).

-- Sequência que gera os próximos códigos
CREATE SEQUENCE IF NOT EXISTS properties_public_code_seq;

-- Coluna nova (ainda sem valor obrigatório, para permitir o preenchimento abaixo)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS public_code INTEGER UNIQUE;

-- Preenche os imóveis que já existem, numerando na ordem em que foram criados
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM properties
  WHERE public_code IS NULL
)
UPDATE properties p
SET public_code = numbered.rn
FROM numbered
WHERE p.id = numbered.id;

-- Ajusta a sequência para continuar depois do maior código já usado
SELECT setval('properties_public_code_seq', COALESCE((SELECT MAX(public_code) FROM properties), 0) + 1, false);

-- A partir de agora, todo imóvel novo já nasce com o próximo código automaticamente
ALTER TABLE properties ALTER COLUMN public_code SET DEFAULT nextval('properties_public_code_seq');
ALTER TABLE properties ALTER COLUMN public_code SET NOT NULL;
