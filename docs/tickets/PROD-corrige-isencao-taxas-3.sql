-- ============================================================================
-- PRODUÇÃO — isenção de taxa não salva — VERSÃO 3, A CERTA
--
-- Cole tudo no SQL Editor de PRODUÇÃO e clique em Run. Uma vez.
--
-- POR QUE AS VERSÕES 1 E 2 NÃO RESOLVERAM
--
--   As duas criaram a regra "quem estiver logado pode gravar", escrita no
--   banco como `auth.uid() IS NOT NULL`.
--
--   Só que `auth.uid()` é o login DO SUPABASE -- e este sistema não usa o
--   login do Supabase. Ele tem o login próprio dele (authService +
--   AuthContext, que guardam o usuário no navegador). Não existe em lugar
--   nenhum do código uma chamada de `signInWithPassword` ou `getSession`.
--
--   Ou seja: para o banco, TODA visita ao sistema é anônima, sempre. O
--   `auth.uid()` nunca tem valor. A regra que eu criei nunca poderia passar,
--   nem para você, nem para ninguém.
--
--   É por isso que "essas regras deram tanto trabalho" e vocês decidiram
--   deixar o controle na tela: com login próprio, qualquer regra de banco
--   baseada em `auth.uid()` bloqueia todo mundo. A decisão de vocês estava
--   certa; foi o banco de produção que saiu dela em algum momento.
--
-- O QUE ESTE ARQUIVO FAZ
--
--   Desliga a trava (RLS) nas duas tabelas de isenção e apaga as regras que
--   sobraram, deixando produção igual ao DEV -- onde a tela sempre funcionou.
--   É a mesma coisa que a migration 20260202191645 fez em fev/2026.
--
-- O QUE VOCÊ PRECISA SABER, EM UMA FRASE
--
--   Com a trava desligada, quem controla o acesso é a tela de Configurações
--   (só admin chega lá) -- exatamente como vocês decidiram. O preço é que a
--   proteção fica só no sistema, não no banco. Isso já vale para o resto do
--   sistema hoje; esta tabela é que estava fora do padrão.
--
-- É SEGURO
--   - não apaga, não altera e não move NENHUM dado; mexe só em permissão;
--   - pode rodar de novo sem estragar nada;
--   - no fim mostra TODAS as tabelas que ainda estão com a trava ligada --
--     leia esse relatório, ele previne o próximo susto.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Desliga a trava nas duas tabelas de isenção
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_fee_exempt_locations      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_fee_exempt_locations DISABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 2. Apaga as regras que sobraram (com a trava desligada elas não valem
--    nada, mas ficam ali para confundir quem olhar depois)
-- ----------------------------------------------------------------------------
DO $limpa$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('admin_fee_exempt_locations',
                         'management_fee_exempt_locations')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END
$limpa$;


-- ============================================================================
-- RELATÓRIO — leia com atenção
--
-- As duas primeiras linhas devem dizer DESLIGADA. Se aparecer mais alguma
-- tabela na lista, ela está com a trava LIGADA e, como o sistema não usa o
-- login do Supabase, é uma tela que pode quebrar do mesmo jeito quando
-- alguém tentar gravar nela. Me mande a lista inteira.
-- ============================================================================
SELECT c.relname AS tabela,
       CASE WHEN c.relrowsecurity THEN 'LIGADA  <-- pode quebrar' ELSE 'DESLIGADA' END AS trava,
       COALESCE((SELECT COUNT(*)::text FROM pg_policies p
                  WHERE p.schemaname = 'public' AND p.tablename = c.relname), '0') AS regras
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND (c.relrowsecurity
        OR c.relname IN ('admin_fee_exempt_locations', 'management_fee_exempt_locations'))
 ORDER BY c.relrowsecurity DESC, c.relname;
