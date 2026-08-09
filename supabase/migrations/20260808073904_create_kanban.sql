-- Kanban interno (backlog de bugs e features do Duvo Enterprise)
-- Acessível dentro do próprio sistema para os perfis admin e broker (corretor).
--
-- OBS sobre RLS: o app não usa Supabase Auth (login customizado contra
-- system_users, sem sessão auth.uid()). Por isso a política aqui segue o
-- mesmo padrão já usado em properties/tenants/system_users ("Public Access"
-- via anon key) — o controle de quem vê/edita é feito na aplicação
-- (menu + guarda de página por role), não no banco. Isso é uma limitação
-- conhecida do projeto como um todo, não específica deste recurso.

CREATE TABLE IF NOT EXISTS kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'feature' CHECK (category IN ('bug', 'feature', 'melhoria', 'divida_tecnica')),
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('urgente', 'alta', 'media', 'baixa')),
  module TEXT, -- área do sistema: Recebimentos, Locações, Caução, Email, Boleto, Área do Inquilino, Infra, Refatoração...
  problem_description TEXT, -- o que está acontecendo / contexto do problema
  action_plan TEXT, -- o que fazer
  how_to TEXT, -- como fazer (orientação técnica)
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  assigned_to UUID REFERENCES system_users(id) ON DELETE SET NULL,
  assigned_to_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  author_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  author_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_status ON kanban_cards(status);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_position ON kanban_cards(status, position);
CREATE INDEX IF NOT EXISTS idx_kanban_card_comments_card_id ON kanban_card_comments(card_id);

ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_card_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access" ON kanban_cards FOR ALL USING (true);
CREATE POLICY "Public Access" ON kanban_card_comments FOR ALL USING (true);

CREATE TRIGGER update_kanban_cards_updated_at
  BEFORE UPDATE ON kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
