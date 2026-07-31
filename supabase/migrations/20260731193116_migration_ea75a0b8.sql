-- REMOVER a política antiga que não funciona com role anon
DROP POLICY IF EXISTS "allow_insert_with_user_id" ON audit_logs;

-- CRIAR nova política que permite INSERT para role ANON
-- desde que user_id seja fornecido E exista em system_users
CREATE POLICY "anon_insert_with_valid_user" ON audit_logs 
  FOR INSERT 
  TO anon
  WITH CHECK (
    user_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM system_users WHERE id = user_id
    )
  );

-- Verificar política criada
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