-- Reset de DEV (issue #36) -- passo 1: apaga tudo que existe no schema
-- "public" do banco de DEV (tabelas, views, sequencias, funcoes, tipos).
--
-- Roda DENTRO da mesma transacao do resto do reset (psql --single-transaction):
-- se qualquer passo seguinte falhar, este apagamento tambem e desfeito e o
-- DEV fica exatamente como estava.
--
-- O schema "public" em si NAO e apagado (so o conteudo), para manter as
-- permissoes padrao que o Supabase configura nele para anon/authenticated/
-- service_role. Objetos que pertencem a extensoes ficam de fora.
--
-- A lista de comandos e montada inteira ANTES de apagar qualquer coisa
-- (array_agg), porque um DROP ... CASCADE pode levar junto objetos que
-- ainda estariam na lista -- dai o IF EXISTS em todos.

DO $$
DECLARE
  comandos text[];
  cmd text;
BEGIN
  SELECT array_agg(c ORDER BY ordem) INTO comandos FROM (
    -- 1. views e materialized views
    SELECT 1 AS ordem,
           format('DROP %s IF EXISTS %I.%I CASCADE',
                  CASE c.relkind WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'VIEW' END,
                  n.nspname, c.relname) AS c
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
    UNION ALL
    -- 2. tabelas (normais, particionadas, externas)
    SELECT 2,
           format('DROP %s IF EXISTS %I.%I CASCADE',
                  CASE c.relkind WHEN 'f' THEN 'FOREIGN TABLE' ELSE 'TABLE' END,
                  n.nspname, c.relname)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'f')
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
    UNION ALL
    -- 3. sequencias soltas (as das colunas vao junto com as tabelas)
    SELECT 3, format('DROP SEQUENCE IF EXISTS %I.%I CASCADE', n.nspname, c.relname)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'S'
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
    UNION ALL
    -- 4. funcoes, procedures e agregados
    SELECT 4,
           format('DROP %s IF EXISTS %s CASCADE',
                  CASE p.prokind WHEN 'a' THEN 'AGGREGATE' ELSE 'ROUTINE' END,
                  p.oid::regprocedure::text)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    UNION ALL
    -- 5. tipos (enum, dominio, range, composto avulso)
    SELECT 5,
           format('DROP %s IF EXISTS %I.%I CASCADE',
                  CASE t.typtype WHEN 'd' THEN 'DOMAIN' ELSE 'TYPE' END,
                  n.nspname, t.typname)
      FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND (t.typtype IN ('e', 'd', 'r', 'm')
            OR (t.typtype = 'c' AND EXISTS (SELECT 1 FROM pg_class c WHERE c.oid = t.typrelid AND c.relkind = 'c')))
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = t.oid AND d.deptype = 'e')
  ) lista;

  FOREACH cmd IN ARRAY coalesce(comandos, '{}') LOOP
    EXECUTE cmd;
  END LOOP;

  RAISE NOTICE 'Reset DEV: schema public esvaziado (% comandos).', coalesce(array_length(comandos, 1), 0);
END $$;
