-- Criar tabela de configurações de e-mail
CREATE TABLE IF NOT EXISTS email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(50) UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir tipos de e-mail
INSERT INTO email_settings (email_type, enabled, description) VALUES
  ('password_recovery', true, 'E-mail de recuperação de senha com link mágico'),
  ('welcome_user', true, 'E-mail de boas-vindas para novos usuários do sistema'),
  ('welcome_tenant', true, 'E-mail de boas-vindas para novos inquilinos'),
  ('contract_expiration', true, 'Alerta de vencimento de contrato (30 dias antes)'),
  ('payment_reminder', true, 'Lembrete de pagamento pendente (5 dias antes do vencimento)'),
  ('payment_overdue', true, 'Notificação de pagamento atrasado'),
  ('payment_confirmed', true, 'Confirmação de recebimento de pagamento')
ON CONFLICT (email_type) DO NOTHING;

-- Criar política RLS
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode ver/editar configurações de e-mail
CREATE POLICY "admin_manage_email_settings" ON email_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.role = 'admin'
      AND system_users.active = true
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_email_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_settings_updated_at
  BEFORE UPDATE ON email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_email_settings_updated_at();