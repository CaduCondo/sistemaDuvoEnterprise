-- ============================================================================
-- URGENTE — PRODUÇÃO — "Não foi possível salvar as isenções"
--
-- Cole tudo no SQL Editor de PRODUÇÃO e clique em Run. Uma vez.
-- Não precisa publicar código nenhum: o defeito está só nas permissões do
-- banco.
--
-- O QUE ESTÁ ACONTECENDO
--
--   A tabela que guarda os locais isentos de taxa ainda está em produção com
--   a PRIMEIRA regra de permissão que ela teve, lá de fevereiro:
--
--       "só pode gravar quem estiver na tabela system_users com papel admin"
--
--   O seu usuário não bate com essa regra, então o banco recusa a gravação
--   com "new row violates row-level security policy". LER continua
--   funcionando, porque a regra de leitura é outra e mais solta -- por isso a
--   tela abre e mostra tudo certinho, e só quebra na hora de salvar.
--
--   Em DEV essa regra foi trocada em 25/fev por uma mais simples ("qualquer
--   usuário logado pode gerenciar"). Em produção a troca nunca foi aplicada.
--
-- O QUE ESTE ARQUIVO FAZ
--
--   Deixa produção igual a DEV: apaga as regras antigas das duas tabelas de
--   isenção (taxa de administração e taxa de gerenciamento) e cria a regra
--   simples no lugar. Também cria a tabela de gerenciamento, se ela ainda
--   não existir aí.
--
-- É SEGURO
--
--   - não apaga, não altera e não move NENHUM dado; mexe só em permissão;
--   - pode rodar de novo sem estragar nada;
--   - no fim imprime um relatório: as 2 linhas devem dizer OK.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Isenção de taxa de ADMINISTRAÇÃO
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_fee_exempt_locations ENABLE ROW LEVEL SECURITY;

-- Todas as regras que essa tabela já teve, em todas as versões. O
-- "IF EXISTS" faz as que não existirem serem ignoradas em silêncio.
DROP POLICY IF EXISTS "Admins can manage admin fee exemptions"        ON public.admin_fee_exempt_locations;
DROP POLICY IF EXISTS "Authenticated users can view admin fee exemptions" ON public.admin_fee_exempt_locations;
DROP POLICY IF EXISTS "Users can view admin fee exemptions"           ON public.admin_fee_exempt_locations;
DROP POLICY IF EXISTS "Users can insert admin fee exemptions"         ON public.admin_fee_exempt_locations;
DROP POLICY IF EXISTS "Users can update admin fee exemptions"         ON public.admin_fee_exempt_locations;
DROP POLICY IF EXISTS "Users can delete admin fee exemptions"         ON public.admin_fee_exempt_locations;
DROP POLICY IF EXISTS "Allow all operations for authenticated users"  ON public.admin_fee_exempt_locations;
DROP POLICY IF EXISTS "Admin and financial can manage exemptions"     ON public.admin_fee_exempt_locations;
DROP POLICY IF EXISTS "admin_fee_exempt_locations_auth_access"        ON public.admin_fee_exempt_locations;

-- A mesma regra que está valendo em DEV desde 25/fev/2026.
CREATE POLICY "admin_fee_exempt_locations_auth_access"
  ON public.admin_fee_exempt_locations
  FOR ALL TO public
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);


-- ----------------------------------------------------------------------------
-- 2. Isenção de taxa de GERENCIAMENTO
--
-- Mesma tela, logo abaixo. Se a tabela ainda não existe em produção, o
-- bloco a cria; se já existe, não mexe em nada dela.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.management_fee_exempt_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(location_id)
);

ALTER TABLE public.management_fee_exempt_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_management_fee_exempt"   ON public.management_fee_exempt_locations;
DROP POLICY IF EXISTS "auth_insert_management_fee_exempt" ON public.management_fee_exempt_locations;
DROP POLICY IF EXISTS "auth_update_management_fee_exempt" ON public.management_fee_exempt_locations;
DROP POLICY IF EXISTS "auth_delete_management_fee_exempt" ON public.management_fee_exempt_locations;
DROP POLICY IF EXISTS "management_fee_exempt_locations_auth_access" ON public.management_fee_exempt_locations;

CREATE POLICY "management_fee_exempt_locations_auth_access"
  ON public.management_fee_exempt_locations
  FOR ALL TO public
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================================
-- RELATÓRIO FINAL — as 2 linhas devem dizer OK
-- ============================================================================
SELECT 'isencao de taxa de ADMINISTRACAO' AS tabela,
       CASE WHEN EXISTS (
              SELECT 1 FROM pg_policies
               WHERE schemaname = 'public'
                 AND tablename  = 'admin_fee_exempt_locations'
                 AND policyname = 'admin_fee_exempt_locations_auth_access')
            AND (SELECT COUNT(*) FROM pg_policies
                  WHERE schemaname = 'public'
                    AND tablename  = 'admin_fee_exempt_locations') = 1
            THEN 'OK' ELSE 'FALTOU' END AS resultado
UNION ALL
SELECT 'isencao de taxa de GERENCIAMENTO',
       CASE WHEN EXISTS (
              SELECT 1 FROM pg_policies
               WHERE schemaname = 'public'
                 AND tablename  = 'management_fee_exempt_locations'
                 AND policyname = 'management_fee_exempt_locations_auth_access')
            AND (SELECT COUNT(*) FROM pg_policies
                  WHERE schemaname = 'public'
                    AND tablename  = 'management_fee_exempt_locations') = 1
            THEN 'OK' ELSE 'FALTOU' END
ORDER BY 1;
