-- ============================================================================
-- PRODUÇÃO — destrava as tabelas que a varredura apontou (parte 1, a segura)
--
-- Cole tudo no SQL Editor de PRODUÇÃO e clique em Run. Uma vez.
--
-- O QUE A VARREDURA ENCONTROU
--
--   Onze casos, em quatro tabelas. Traduzindo para o que isso significa na
--   prática:
--
--   1. email_settings      -> a tela de Configurações de E-mail NÃO SALVA.
--                             Está quebrada em produção agora, do mesmo jeito
--                             que a isenção de taxa estava.
--
--   2. system_users        -> criar, editar e excluir USUÁRIO estão barrados.
--                             Também quebrado agora. Fica FORA deste arquivo,
--                             de propósito -- ver o aviso no fim.
--
--   3. rental_terminations -> nenhuma tela grava nessa tabela hoje (o sistema
--                             passou a usar a tabela `payments` com
--                             payment_kind). Destravar aqui é só para não
--                             ficar uma mina esquecida.
--
--   4. auth_user_mapping   -> idem: nenhuma tela grava nela.
--
--   Ou seja: a rescisão, os recebimentos, as locações e os inquilinos estão
--   SEGUROS. Não há mais nada armado nas telas do dia a dia.
--
-- ESTE ARQUIVO destrava as três primeiras (e-mail e as duas sem uso).
-- A tabela de usuários fica de fora até você decidir o caminho -- ver o fim.
--
-- É SEGURO: não apaga, não altera e não move NENHUM dado; mexe só em
-- permissão. Pode rodar de novo sem estragar nada.
-- ============================================================================

ALTER TABLE public.email_settings      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_terminations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_user_mapping   DISABLE ROW LEVEL SECURITY;

DO $limpa$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('email_settings', 'rental_terminations', 'auth_user_mapping')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END
$limpa$;


-- ============================================================================
-- CONFERE — deve voltar VAZIO (nenhuma linha)
--
-- É a mesma varredura do DIAG, agora só nas três tabelas deste arquivo.
-- A tabela `system_users` NÃO entra aqui: ela continua travada de propósito.
-- ============================================================================
WITH regras AS (
  SELECT tablename, cmd, COALESCE(with_check, qual, 'true') AS condicao
    FROM pg_policies WHERE schemaname = 'public'
),
tabelas AS (
  SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
     AND c.relname IN ('email_settings', 'rental_terminations', 'auth_user_mapping')
),
operacoes AS (SELECT unnest(ARRAY['INSERT','UPDATE','DELETE']) AS operacao)
SELECT t.relname AS tabela, o.operacao, 'AINDA BARRADO' AS situacao
  FROM tabelas t CROSS JOIN operacoes o
 WHERE NOT EXISTS (
         SELECT 1 FROM regras r
          WHERE r.tablename = t.relname
            AND (r.cmd = 'ALL' OR r.cmd = o.operacao)
            AND r.condicao !~* 'auth\.(uid|role|jwt)'
            AND r.condicao !~* 'system_users')
 ORDER BY 1, 2;


-- ============================================================================
-- ⚠️ POR QUE A TABELA DE USUÁRIOS FICOU DE FORA
--
-- Criar, editar e excluir usuário também estão barrados em produção. Dava
-- para destravar aqui, com uma linha, e resolveria na hora.
--
-- Só que `system_users` é a tabela dos usuários do sistema. Destravar
-- significa que qualquer pessoa que saiba usar a chave pública do site (ela
-- fica no navegador de quem abre a página) poderia criar um usuário admin
-- para si mesma. Nas outras tabelas o risco é mexer em dado; nessa, o risco
-- é entrar no sistema.
--
-- Existe o caminho certo: fazer o cadastro de usuários passar por uma rota no
-- servidor, que usa a chave secreta (essa nunca sai do servidor) e não
-- depende de destravar nada. Dá um pouco mais de trabalho e é uma mudança de
-- código, não de banco.
--
-- Converse com o Claude sobre qual dos dois caminhos você prefere antes de
-- mexer nessa tabela.
-- ============================================================================
