-- REMOVER a política antiga que exige authenticated (Supabase Auth)
DROP POLICY IF EXISTS "authenticated_insert" ON audit_logs;

-- CRIAR nova política que permite INSERT desde que user_id seja fornecido
-- (compatível com autenticação custom via localStorage + system_users)
CREATE POLICY "allow_insert_with_user_id" ON audit_logs 
  FOR INSERT 
  WITH CHECK (user_id IS NOT NULL);

-- Documentar a mudança
COMMENT ON POLICY "allow_insert_with_user_id" ON audit_logs 
  IS 'Permite INSERT de logs de auditoria desde que user_id seja fornecido. Compatível com autenticação custom via localStorage (system_users table). O user_id deve ser um UUID válido da tabela system_users.';

-- Verificar as políticas atuais
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'audit_logs'
ORDER BY policyname;