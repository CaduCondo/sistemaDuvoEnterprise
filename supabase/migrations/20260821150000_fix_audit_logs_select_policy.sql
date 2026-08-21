-- Corrige a política de SELECT de audit_logs (ticket "Logs de Auditoria
-- sempre vazio em produção" — kanban interno / GitHub issue).
--
-- Causa raiz: a política "admin_view_all_logs" (criada em
-- 20260731030614_migration_866ebc69.sql) usa `auth.uid()` para checar se
-- quem está lendo é admin. Esse sistema NÃO usa o Supabase Auth — a
-- autenticação é custom (localStorage + tabela system_users, ver
-- src/services/auditService.ts e AUTHENTICATION.md), então `auth.uid()`
-- é sempre NULL para as requisições do app. Resultado: a condição da
-- política nunca é verdadeira, e o SELECT em audit_logs sempre volta
-- vazio para todo mundo, mesmo para admins de verdade — batendo com o
-- que foi observado (tela de Logs sempre "Nenhum log encontrado").
--
-- As políticas de INSERT desta mesma tabela já passaram pelo mesmo
-- problema e foram corrigidas para não depender de auth.uid() (ver
-- migrations 20260731044642, 20260731164020, 20260731193116) — esta
-- migration aplica o mesmo raciocínio para o SELECT: o controle de quem
-- pode ver a tela de Logs já é feito na aplicação (tela dentro de
-- Configurações), então a policy de leitura no banco só precisa liberar
-- o acesso para o cliente do app (chave anon), sem tentar reimplementar
-- checagem de admin via auth.uid().

DROP POLICY IF EXISTS "admin_view_all_logs" ON audit_logs;

CREATE POLICY "app_can_read_logs" ON audit_logs
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON POLICY "app_can_read_logs" ON audit_logs
  IS 'Permite leitura dos logs de auditoria pelo cliente do app (chave anon). O controle de quem pode acessar a tela de Logs é feito na aplicação, não via auth.uid() (que não existe nesta autenticação custom).';

-- Conferir o estado final das políticas de audit_logs
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'audit_logs'
ORDER BY policyname;
