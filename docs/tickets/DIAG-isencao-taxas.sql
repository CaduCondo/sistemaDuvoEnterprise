-- ============================================================================
-- DIAGNÓSTICO — isenção de taxa não salva
--
-- Este arquivo NÃO ALTERA NADA. Só lê e mostra. Pode rodar à vontade.
--
-- Rode nos DOIS bancos, DEV e PRODUÇÃO, e me mande as duas respostas.
-- A diferença entre elas é a resposta.
-- ============================================================================

-- 1. A trava (RLS) está ligada ou desligada em cada tabela?
SELECT 'RLS' AS o_que,
       c.relname AS tabela,
       CASE WHEN c.relrowsecurity THEN 'LIGADA' ELSE 'DESLIGADA' END AS estado
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('admin_fee_exempt_locations', 'management_fee_exempt_locations')
 ORDER BY c.relname;

-- 2. Quais regras de permissão existem em cada tabela, e o que elas exigem?
SELECT 'REGRA' AS o_que,
       tablename AS tabela,
       policyname AS nome_da_regra,
       cmd AS operacao,
       roles::text AS para_quem,
       COALESCE(qual, '(sem condicao)') AS condicao_para_ler,
       COALESCE(with_check, '(sem condicao)') AS condicao_para_gravar
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('admin_fee_exempt_locations', 'management_fee_exempt_locations')
 ORDER BY tablename, policyname;

-- 3. Quantas isenções estão gravadas hoje?
SELECT 'CONTEUDO' AS o_que,
       'admin_fee_exempt_locations' AS tabela,
       COUNT(*)::text AS quantidade
  FROM public.admin_fee_exempt_locations
UNION ALL
SELECT 'CONTEUDO',
       'management_fee_exempt_locations',
       COUNT(*)::text
  FROM public.management_fee_exempt_locations;
