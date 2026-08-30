-- ============================================================================
-- DIAGNÓSTICO — isenção de taxa não salva
--
-- NÃO ALTERA NADA. Só lê e mostra. Pode rodar à vontade.
--
-- UMA consulta só, de propósito: o SQL Editor do Supabase mostra apenas o
-- resultado do ÚLTIMO comando: se o arquivo tiver três consultas, você só vê
-- a terceira. Aqui tudo vem numa tabela só.
--
-- Rode nos DOIS bancos, DEV e PRODUÇÃO, e compare.
-- ============================================================================

SELECT '1. trava (RLS)' AS o_que,
       c.relname        AS tabela,
       CASE WHEN c.relrowsecurity THEN 'LIGADA' ELSE 'DESLIGADA' END AS detalhe,
       ''               AS operacao,
       ''               AS condicao_para_gravar
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('admin_fee_exempt_locations', 'management_fee_exempt_locations')

UNION ALL

SELECT '2. regra de permissao',
       p.tablename,
       p.policyname,
       p.cmd,
       COALESCE(p.with_check, p.qual, '(sem condicao)')
  FROM pg_policies p
 WHERE p.schemaname = 'public'
   AND p.tablename IN ('admin_fee_exempt_locations', 'management_fee_exempt_locations')

UNION ALL

SELECT '3. isencoes gravadas hoje',
       'admin_fee_exempt_locations',
       COUNT(*)::text, '', ''
  FROM public.admin_fee_exempt_locations

UNION ALL

SELECT '3. isencoes gravadas hoje',
       'management_fee_exempt_locations',
       COUNT(*)::text, '', ''
  FROM public.management_fee_exempt_locations

ORDER BY 1, 2, 3;
