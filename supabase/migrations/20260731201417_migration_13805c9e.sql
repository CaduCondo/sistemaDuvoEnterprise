-- ========================================
-- SOLUÇÃO DEFINITIVA PARA LOGS DE AUDITORIA
-- ========================================

-- 1. REMOVER TODAS as políticas de INSERT que estão causando problema
DROP POLICY IF EXISTS "anon_insert_with_valid_user" ON audit_logs;
DROP POLICY IF EXISTS "system_insert_logs" ON audit_logs;
DROP POLICY IF EXISTS "allow_insert_with_user_id" ON audit_logs;
DROP POLICY IF EXISTS "authenticated_insert" ON audit_logs;

-- 2. CRIAR UMA política SUPER SIMPLES que funciona com QUALQUER role
-- Permite INSERT se user_id não for nulo (sem validações complexas)
CREATE POLICY "simple_insert_logs" ON audit_logs 
  FOR INSERT 
  WITH CHECK (user_id IS NOT NULL);

-- 3. Verificar as políticas ativas
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