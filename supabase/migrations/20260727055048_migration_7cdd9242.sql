-- Remover política antiga que está bloqueando
DROP POLICY IF EXISTS admin_manage_email_settings ON email_settings;

-- Criar política correta que permite leitura para admins
CREATE POLICY admin_manage_email_settings ON email_settings
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM system_users su
      INNER JOIN auth_user_mapping aum ON aum.system_user_id = su.id
      WHERE aum.auth_user_id = auth.uid()
        AND su.role = 'admin'
        AND su.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM system_users su
      INNER JOIN auth_user_mapping aum ON aum.system_user_id = su.id
      WHERE aum.auth_user_id = auth.uid()
        AND su.role = 'admin'
        AND su.active = true
    )
  );