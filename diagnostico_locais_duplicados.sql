-- =====================================================================
-- DIAGNÓSTICO (só leitura -- não apaga nada): Locais com nome duplicado
--
-- Contexto: 16/set/2026, o Cadu encontrou vários Locais repetidos na tela
-- de Configurações > Locais (ex.: "ACÁCIAS" 4x, "São Paulo - Centro" 6x)
-- enquanto configurava as permissões do usuário Financeiro. A tela agora
-- BLOQUEIA criar/editar um Local repetindo um nome já existente (ver
-- docs/REGRAS_DE_NEGOCIO.md, seção "Locais") -- mas os duplicados que já
-- existem no banco continuam lá, e este script não decide sozinho qual
-- apagar: mistura Locais de teste antigos (sem selo "[E2E]", criados antes
-- desse selo existir) com possíveis Locais reais criados por engano.
--
-- Rode só a consulta abaixo primeiro. Ela NÃO apaga nada -- só mostra.
-- Para cada grupo de nome duplicado, decida: qual é o Local "de verdade"
-- (normalmente o que tem endereço/CEP reais e/ou tem imóveis vinculados)
-- e quais são sobra -- só migre os imóveis dos duplicados pro Local
-- correto e apague os duplicados manualmente pela própria tela
-- (Configurações > Locais > lixeira), um de cada vez, conferindo.
-- =====================================================================

SELECT
  l.name,
  COUNT(*) AS quantas_vezes,
  ARRAY_AGG(l.id ORDER BY l.created_at) AS ids,
  ARRAY_AGG(COALESCE(l.zip_code, '(sem CEP)') ORDER BY l.created_at) AS ceps,
  ARRAY_AGG(
    (SELECT COUNT(*) FROM properties p WHERE p.location_id = l.id)
    ORDER BY l.created_at
  ) AS imoveis_vinculados_por_local
FROM locations l
GROUP BY l.name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, l.name;

-- Leitura do resultado: cada linha é um NOME repetido. "ids"/"ceps"/
-- "imoveis_vinculados_por_local" estão na mesma ordem (mais antigo
-- primeiro) -- o local com CEP de verdade e/ou com imóveis vinculados é,
-- quase sempre, o de verdade; os outros (CEP vazio, 0 imóveis) são a
-- sobra a revisar.
