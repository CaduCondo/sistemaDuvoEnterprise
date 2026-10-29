-- Endereço manual por imóvel, para o local "Outros" (issue #34)
--
-- CONTEXTO: o endereço que aparece no anúncio público de um imóvel
-- (src/pages/imovel/[id].tsx) vem hoje inteiramente da tabela `locations`
-- (street/number/neighborhood/city/state/zip_code) -- nunca da própria
-- `properties`. Isso funciona bem para locais de verdade (condomínios
-- cadastrados), mas "Outros" é um local coringa, sem endereço fixo nenhum
-- (usado para imóveis que não pertencem a nenhum condomínio cadastrado --
-- ver o mesmo tratamento especial já existente em PaymentReceipt.tsx,
-- linha ~667, "Se o local é Outros, usar endereço do inquilino"). Sem
-- nenhum campo próprio, um imóvel com local "Outros" nunca tinha como
-- mostrar endereço nenhum no anúncio.
--
-- Colunas OPCIONAIS (NULL para todo imóvel que não é "Outros" -- a tela só
-- preenche isso quando o local selecionado é "Outros"). Mesmos nomes e
-- tipos das colunas equivalentes em `locations`, prefixados com `manual_`
-- para deixar claro que é um endereço digitado à mão para ESTE imóvel, não
-- herdado do local.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS manual_street TEXT,
  ADD COLUMN IF NOT EXISTS manual_number TEXT,
  ADD COLUMN IF NOT EXISTS manual_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS manual_city TEXT,
  ADD COLUMN IF NOT EXISTS manual_state TEXT,
  ADD COLUMN IF NOT EXISTS manual_zip_code TEXT;

COMMENT ON COLUMN properties.manual_street IS
  'Endereço digitado à mão para este imóvel, só usado quando o local (locations.name) é "Outros". NULL nos demais casos -- ver issue #34.';
COMMENT ON COLUMN properties.manual_number IS
  'Número do endereço manual -- ver properties.manual_street.';
COMMENT ON COLUMN properties.manual_neighborhood IS
  'Bairro do endereço manual -- ver properties.manual_street.';
COMMENT ON COLUMN properties.manual_city IS
  'Cidade do endereço manual -- ver properties.manual_street.';
COMMENT ON COLUMN properties.manual_state IS
  'Estado (UF) do endereço manual -- ver properties.manual_street.';
COMMENT ON COLUMN properties.manual_zip_code IS
  'CEP do endereço manual -- ver properties.manual_street.';
