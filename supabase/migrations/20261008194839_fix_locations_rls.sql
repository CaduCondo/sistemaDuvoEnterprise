-- Corrige a RLS de locations: as policies de DELETE e UPDATE exigiam
-- auth.role() = 'authenticated' (sessao real do Supabase Auth). Este
-- sistema usa login proprio (tabela system_users, ver
-- src/pages/api/auth/login.ts) e NUNCA cria sessao do Supabase Auth -- a
-- API sempre bate no banco como "anon". Isso bloqueava silenciosamente
-- toda exclusao e edicao de Local: quando o RLS barra um DELETE/UPDATE, o
-- Supabase nao retorna erro nenhum, so devolve 0 linhas afetadas. A tela
-- (settings.tsx / locationService.ts) nao conferia isso e mostrava "Local
-- excluido com sucesso" mesmo sem excluir nada -- bug relatado pelo Cadu
-- em 08/out/2026 (print do local "ACACIAS" continuando na lista depois da
-- mensagem de sucesso).
--
-- Mesma causa raiz ja corrigida antes para payment_methods, ver migration
-- 20260809163323_fix_payment_methods_rls.sql, e o mesmo padrao "publico,
-- controle de acesso fica na aplicacao" ja usado em location_expenses
-- ("Allow public select/insert/update/delete").

DROP POLICY IF EXISTS "locations_delete_policy" ON "public"."locations";
DROP POLICY IF EXISTS "locations_update_policy" ON "public"."locations";

CREATE POLICY "locations_delete_policy" ON "public"."locations" FOR DELETE USING (true);
CREATE POLICY "locations_update_policy" ON "public"."locations" FOR UPDATE USING (true) WITH CHECK (true);
