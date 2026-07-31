-- Adicionar política de INSERT para permitir que usuários autenticados criem logs
CREATE POLICY "authenticated_insert" ON audit_logs 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);