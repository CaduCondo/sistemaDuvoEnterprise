-- Reset de DEV (issue #36) -- passo 4: tira TODAS as permissoes dos papeis
-- de acesso do Supabase (anon, authenticated, service_role) nas tabelas,
-- sequencias e funcoes do schema public. Logo em seguida o reset reaplica
-- exatamente as permissoes que existem em PRODUCAO (as linhas GRANT/REVOKE
-- da copia).
--
-- Por que: ao recriar as tabelas no DEV, o Postgres da a elas as permissoes
-- "padrao" do schema (que liberam tudo para anon/authenticated). A copia de
-- PROD so diz o que foi DADO a mais, nao o que foi TIRADO -- entao uma
-- restricao de PROD (ex.: anon sem acesso a system_users) se perderia e o
-- DEV ficaria mais aberto que PROD. Confirmado em teste local (30/out/2026).
--
-- PUBLIC nas funcoes fica como esta: por padrao do Postgres toda funcao pode
-- ser executada por PUBLIC, e a copia de PROD so traz o REVOKE quando PROD
-- tirou isso de alguma funcao.

DO $$
DECLARE
  papeis text;
  r record;
BEGIN
  SELECT string_agg(quote_ident(rolname), ', ') INTO papeis
    FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role');
  IF papeis IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT format('%I.%I', n.nspname, c.relname) AS nome,
           CASE WHEN c.relkind = 'S' THEN 'SEQUENCE' ELSE 'TABLE' END AS tipo
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON %s %s FROM PUBLIC, %s', r.tipo, r.nome, papeis);
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure::text AS nome,
           CASE WHEN p.prokind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END AS tipo
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p', 'w')
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON %s %s FROM %s', r.tipo, r.nome, papeis);
  END LOOP;
END $$;
