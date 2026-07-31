-- Criar tabela de auditoria/logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'login', 'logout', 'password_change', 'status_change')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('property', 'tenant', 'rental', 'payment', 'user', 'location', 'config', 'system')),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  changes_summary TEXT,
  ip_address INET,
  user_agent TEXT,
  page_url TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  session_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices otimizados
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);

COMMENT ON TABLE audit_logs IS 'Registro de auditoria de todas as ações do sistema para rastreabilidade e compliance';
COMMENT ON COLUMN audit_logs.user_id IS 'Usuário que executou a ação (NULL para ações do sistema)';
COMMENT ON COLUMN audit_logs.action_type IS 'Tipo de ação executada';
COMMENT ON COLUMN audit_logs.entity_type IS 'Tipo de entidade afetada';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID da entidade afetada';
COMMENT ON COLUMN audit_logs.old_values IS 'Valores anteriores (para updates e deletes)';
COMMENT ON COLUMN audit_logs.new_values IS 'Valores novos (para creates e updates)';
COMMENT ON COLUMN audit_logs.changes_summary IS 'Resumo em português das mudanças';
COMMENT ON COLUMN audit_logs.ip_address IS 'Endereço IP de origem';
COMMENT ON COLUMN audit_logs.user_agent IS 'Navegador/dispositivo usado';
COMMENT ON COLUMN audit_logs.page_url IS 'URL da página onde aconteceu a ação';
COMMENT ON COLUMN audit_logs.duration_ms IS 'Tempo de execução da operação em ms';
COMMENT ON COLUMN audit_logs.error_message IS 'Mensagem de erro se a operação falhou';
COMMENT ON COLUMN audit_logs.session_id IS 'ID da sessão do usuário';
COMMENT ON COLUMN audit_logs.metadata IS 'Dados extras específicos da ação';

-- RLS policies para audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin pode ver todos os logs
CREATE POLICY "admin_view_all_logs" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Apenas sistema pode inserir logs
CREATE POLICY "system_insert_logs" ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Ninguém pode atualizar ou deletar logs (imutabilidade)
CREATE POLICY "no_updates" ON audit_logs FOR UPDATE USING (false);
CREATE POLICY "no_deletes" ON audit_logs FOR DELETE USING (false);