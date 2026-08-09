-- Checklist de tarefas granulares dentro de cada card do kanban.
-- Permite quebrar uma história grande em passos pequenos e marcáveis.

CREATE TABLE IF NOT EXISTS kanban_card_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kanban_card_tasks_card_id ON kanban_card_tasks(card_id, position);

ALTER TABLE kanban_card_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access" ON kanban_card_tasks FOR ALL USING (true);
