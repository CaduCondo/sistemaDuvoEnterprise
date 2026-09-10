-- =====================================================================
-- FAXINA ÚNICA: apagar a massa de teste ANTIGA do banco de DEV
-- Issue #89 -- "Limpar os dados de teste sobrando no banco de DEV"
--
-- ⚠️⚠️ RODAR **SOMENTE** NO SUPABASE DE **DEV** (yrknfweilbuwrhzzwnrr).
--     NUNCA em produção (alvghyfbzrpjwhckmkwx).
--     Confira o projeto no canto superior esquerdo do Supabase antes.
--
-- POR QUE ISSO EXISTE
-- A automação passou a "selar" tudo que cria com a marca [E2E], e apaga
-- o que está selado no começo e no fim de cada rodada. Isso resolve
-- daqui pra frente. Mas o que foi criado ANTES do selo existir não tem
-- marca nenhuma -- é essa sujeira acumulada que este script remove, uma
-- vez só.
--
-- COMO USAR (3 passos, nessa ordem)
--   1) Rode só a PARTE 1. Ela não apaga nada -- só MOSTRA o que seria
--      apagado. Olhe a lista com calma.
--   2) Se aparecer alguma coisa que você reconhece como dado de verdade,
--      PARE e me avise. Não siga para a parte 2.
--   3) Se a lista só tiver lixo de teste, rode a PARTE 2.
-- =====================================================================


-- =====================================================================
-- PARTE 1 -- SÓ CONFERIR (não apaga nada)
-- =====================================================================

-- Os padrões de nome que a automação usa/usou:
--   inquilinos:    "Inquilino Teste ...", "Locacao Ativa E2E ...",
--                  "Locacao Comprovante E2E ...", "Renovacao E2E ...",
--                  "Vencida E2E ...", "Rescisao E2E ...",
--                  "E2E Temp ...", "E2E Attempts ...", "E2E Row Actions ..."
--   imóveis:       complemento "Casa Teste", "Casa N", "Casa Export N",
--                  "Apto 101", identificador "IMO-######"
--   localizações:  "Localização Teste ...", "Local Teste ..."

-- 1.1 Inquilinos que seriam apagados
SELECT id, name, document, email, created_at
FROM tenants
WHERE name ILIKE '%[E2E]%'
   OR name ILIKE 'Inquilino Teste%'
   OR name ILIKE '%E2E%'
   OR name ILIKE 'Rescisao%'
   OR name ILIKE 'Renovacao%'
   OR name ILIKE 'Vencida%'
ORDER BY created_at;

-- 1.2 Imóveis que seriam apagados
SELECT p.id, p.property_identifier, p.complement, l.name AS localizacao, p.created_at
FROM properties p
LEFT JOIN locations l ON l.id = p.location_id
WHERE p.complement ILIKE '%[E2E]%'
   OR p.complement ILIKE 'Casa Teste%'
   OR p.complement ~* '^Casa [0-9]+$'
   OR p.complement ~* '^Casa Export [0-9]+$'
   OR p.complement ILIKE 'Apto 101%'
   OR p.property_identifier ~ '^IMO-[0-9]{6}$'
ORDER BY p.created_at;

-- 1.3 Localizações que seriam apagadas
SELECT id, name, created_at
FROM locations
WHERE name ILIKE '%[E2E]%'
   OR name ILIKE 'Localização Teste%'
   OR name ILIKE 'Localizacao Teste%'
   OR name ILIKE 'Local Teste%'
ORDER BY created_at;

-- 1.4 Quantas locações/recebimentos/parcelas vão junto
SELECT
  (SELECT COUNT(*) FROM rentals r
     WHERE r.tenant_id IN (
       SELECT id FROM tenants
       WHERE name ILIKE '%[E2E]%' OR name ILIKE 'Inquilino Teste%' OR name ILIKE '%E2E%'
          OR name ILIKE 'Rescisao%' OR name ILIKE 'Renovacao%' OR name ILIKE 'Vencida%')
  ) AS locacoes,
  (SELECT COUNT(*) FROM payments pay
     WHERE pay.rental_id IN (
       SELECT r.id FROM rentals r WHERE r.tenant_id IN (
         SELECT id FROM tenants
         WHERE name ILIKE '%[E2E]%' OR name ILIKE 'Inquilino Teste%' OR name ILIKE '%E2E%'
            OR name ILIKE 'Rescisao%' OR name ILIKE 'Renovacao%' OR name ILIKE 'Vencida%'))
  ) AS recebimentos,
  (SELECT COUNT(*) FROM deposit_installments di
     WHERE di.rental_id IN (
       SELECT r.id FROM rentals r WHERE r.tenant_id IN (
         SELECT id FROM tenants
         WHERE name ILIKE '%[E2E]%' OR name ILIKE 'Inquilino Teste%' OR name ILIKE '%E2E%'
            OR name ILIKE 'Rescisao%' OR name ILIKE 'Renovacao%' OR name ILIKE 'Vencida%'))
  ) AS parcelas_caucao;


-- =====================================================================
-- PARTE 2 -- APAGAR DE VERDADE
-- Só rode depois de conferir a PARTE 1.
-- Tudo dentro de uma transação: se qualquer passo der errado, nada é
-- apagado.
-- =====================================================================

BEGIN;

-- Inquilinos e imóveis de teste, guardados em tabelas temporárias para
-- os passos seguintes usarem a MESMA lista (sem risco de a lista mudar
-- no meio do caminho).
CREATE TEMP TABLE _inq_teste AS
  SELECT id FROM tenants
  WHERE name ILIKE '%[E2E]%'
     OR name ILIKE 'Inquilino Teste%'
     OR name ILIKE '%E2E%'
     OR name ILIKE 'Rescisao%'
     OR name ILIKE 'Renovacao%'
     OR name ILIKE 'Vencida%';

CREATE TEMP TABLE _imo_teste AS
  SELECT id, location_id FROM properties
  WHERE complement ILIKE '%[E2E]%'
     OR complement ILIKE 'Casa Teste%'
     OR complement ~* '^Casa [0-9]+$'
     OR complement ~* '^Casa Export [0-9]+$'
     OR complement ILIKE 'Apto 101%'
     OR property_identifier ~ '^IMO-[0-9]{6}$';

-- Locações desses inquilinos e desses imóveis
CREATE TEMP TABLE _loc_teste AS
  SELECT id FROM rentals
  WHERE tenant_id IN (SELECT id FROM _inq_teste)
     OR property_id IN (SELECT id FROM _imo_teste);

-- Filhos primeiro (senão a chave estrangeira reclama)
DELETE FROM deposit_installments WHERE rental_id IN (SELECT id FROM _loc_teste);
DELETE FROM payments             WHERE rental_id IN (SELECT id FROM _loc_teste);
DELETE FROM rentals              WHERE id        IN (SELECT id FROM _loc_teste);

DELETE FROM properties WHERE id IN (SELECT id FROM _imo_teste);
DELETE FROM tenants    WHERE id IN (SELECT id FROM _inq_teste);

-- Localizações de teste que ficaram sem nenhum imóvel apontando pra elas
DELETE FROM locations
WHERE (name ILIKE '%[E2E]%'
    OR name ILIKE 'Localização Teste%'
    OR name ILIKE 'Localizacao Teste%'
    OR name ILIKE 'Local Teste%')
  AND id NOT IN (SELECT location_id FROM properties WHERE location_id IS NOT NULL);

-- Confira os números que aparecerem e, se estiver tudo certo, confirme.
COMMIT;

-- Se algo parecer errado ANTES de confirmar, use:
--   ROLLBACK;
