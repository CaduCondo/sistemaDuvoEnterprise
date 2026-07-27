-- Remover política antiga e criar uma nova simplificada
DROP POLICY IF EXISTS admin_manage_email_settings ON email_settings;

-- Política temporária: permitir leitura/escrita para TODOS usuários autenticados
CREATE POLICY email_settings_authenticated_access ON email_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);