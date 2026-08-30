-- ============================================================================
-- DIAGNÓSTICO — quais telas PODEM quebrar como a de isenção quebrou
--
-- NÃO ALTERA NADA. Só lê. Rode em PRODUÇÃO e me mande o resultado.
--
-- CORREÇÃO DO QUE EU DISSE ANTES
--
--   O relatório anterior escrevia "LIGADA <-- pode quebrar" em toda tabela
--   com a trava ligada. Isso foi alarmista e está errado: 21 tabelas
--   apareceram, e o sistema funciona em quase todas -- recebimentos,
--   locações, inquilinos, imóveis. Trava ligada, sozinha, não quebra nada.
--
--   O que quebra é a trava ligada MAIS uma regra que dependa do login do
--   Supabase (`auth.uid()`, `auth.role()`) ou da tabela `system_users` --
--   porque este sistema tem login próprio e nunca cria sessão no Supabase.
--   Também quebra a trava ligada SEM regra nenhuma, que barra tudo.
--
--   Foi exatamente a combinação que derrubou a isenção de taxa: a leitura
--   tinha regra livre (por isso a tela abria certinha) e a gravação tinha
--   regra amarrada ao `system_users` (por isso só quebrava ao salvar).
--
-- O QUE ESTA CONSULTA MOSTRA
--
--   Só os casos de risco de verdade, um por tabela e por operação. Se não
--   voltar nenhuma linha, está tudo certo e não há outra bomba armada.
-- ============================================================================

WITH tabelas_com_trava AS (
  SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relrowsecurity
),
regras AS (
  SELECT tablename,
         cmd,
         COALESCE(with_check, qual, 'true') AS condicao
    FROM pg_policies
   WHERE schemaname = 'public'
),
operacoes AS (
  SELECT unnest(ARRAY['INSERT','UPDATE','DELETE']) AS operacao
)
SELECT t.relname AS tabela,
       o.operacao,
       CASE
         WHEN NOT EXISTS (
                SELECT 1 FROM regras r
                 WHERE r.tablename = t.relname
                   AND (r.cmd = 'ALL' OR r.cmd = o.operacao))
           THEN 'SEM REGRA -> barra sempre'
         ELSE 'SO TEM REGRA QUE EXIGE LOGIN DO SUPABASE -> barra sempre'
       END AS problema,
       COALESCE((SELECT string_agg(DISTINCT r.condicao, ' | ')
                   FROM regras r
                  WHERE r.tablename = t.relname
                    AND (r.cmd = 'ALL' OR r.cmd = o.operacao)), '(nenhuma)') AS condicao_exigida
  FROM tabelas_com_trava t
  CROSS JOIN operacoes o
 WHERE NOT EXISTS (
         SELECT 1
           FROM regras r
          WHERE r.tablename = t.relname
            AND (r.cmd = 'ALL' OR r.cmd = o.operacao)
            AND r.condicao !~* 'auth\.(uid|role|jwt)'
            AND r.condicao !~* 'system_users')
 ORDER BY 1, 2;
