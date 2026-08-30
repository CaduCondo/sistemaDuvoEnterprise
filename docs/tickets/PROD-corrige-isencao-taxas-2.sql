-- ============================================================================
-- PRODUÇÃO — isenção de taxa não salva — VERSÃO 2, À PROVA DE NOME
--
-- Cole tudo no SQL Editor de PRODUÇÃO e clique em Run. Uma vez.
--
-- POR QUE UMA VERSÃO 2
--
--   A primeira versão apagava as regras de permissão UMA A UMA, pelo nome.
--   Isso só funciona se a gente souber todos os nomes que a tabela já teve --
--   e se sobrar uma regra com nome que não estava na lista, ela continua
--   valendo e continua barrando. Existe ainda um tipo de regra ("restritiva")
--   que barra mesmo quando há outra permitindo: nesse caso, acrescentar uma
--   regra boa não resolve, é preciso tirar a ruim.
--
--   Esta versão não depende de nome nenhum: ela varre a tabela de regras do
--   banco e apaga TODAS as que existirem nessas duas tabelas, quaisquer que
--   sejam. Depois cria UMA regra só, simples:
--
--       "qualquer usuário logado pode ler e gravar"
--
--   É o que você descreveu: quem chegou na tela de Configurações pode
--   alterar. Não exige papel, não consulta system_users, não tem como
--   desencontrar.
--
-- É SEGURO
--   - não apaga, não altera e não move NENHUM dado; mexe só em permissão;
--   - pode rodar de novo sem estragar nada;
--   - no fim mostra como as duas tabelas ficaram.
--
-- ATENÇÃO AO RESULTADO: o SQL Editor mostra só o resultado do ÚLTIMO comando.
-- O relatório do fim é esse último comando, então é ele que vai aparecer.
-- Me mande essa tabelinha.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Apaga TODAS as regras das duas tabelas, sem depender do nome
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
    RAISE NOTICE 'regra apagada: % (tabela %)', r.policyname, r.tablename;
  END LOOP;
END
$limpa$;


-- ----------------------------------------------------------------------------
-- 2. Garante que a tabela de gerenciamento existe (não mexe se já existir)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.management_fee_exempt_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(location_id)
);


-- ----------------------------------------------------------------------------
-- 3. Uma regra só em cada tabela: usuário logado lê e grava
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_fee_exempt_locations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_fee_exempt_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "isencao_taxa_admin_usuario_logado"
  ON public.admin_fee_exempt_locations
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "isencao_taxa_gerenciamento_usuario_logado"
  ON public.management_fee_exempt_locations
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================================
-- COMO FICOU — mande esta tabelinha para mim
--
-- O esperado é exatamente 4 linhas:
--   trava LIGADA nas duas tabelas
--   + 1 regra PERMISSIVA em cada, para ALL, com a condicao auth.uid()
-- ============================================================================
SELECT '1. trava (RLS)'        AS o_que,
       c.relname               AS tabela,
       CASE WHEN c.relrowsecurity THEN 'LIGADA' ELSE 'DESLIGADA' END AS nome_ou_estado,
       ''                      AS tipo,
       ''                      AS operacao,
       ''                      AS condicao_para_gravar
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('admin_fee_exempt_locations', 'management_fee_exempt_locations')

UNION ALL

SELECT '2. regra de permissao',
       p.tablename,
       p.policyname,
       CASE WHEN p.permissive = 'PERMISSIVE' THEN 'permissiva' ELSE 'RESTRITIVA' END,
       p.cmd,
       COALESCE(p.with_check, p.qual, '(sem condicao)')
  FROM pg_policies p
 WHERE p.schemaname = 'public'
   AND p.tablename IN ('admin_fee_exempt_locations', 'management_fee_exempt_locations')

ORDER BY 1, 2, 3;
