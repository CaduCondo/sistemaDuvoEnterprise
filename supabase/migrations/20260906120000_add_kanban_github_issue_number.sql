-- Kanban interno: ID visível espelhando o número da issue do GitHub (issue #78)
--
-- Pedido do Cadu (06/set/2026): cada card do kanban precisa de um ID fácil de
-- citar, e esse ID deve ser o MESMO número da issue espelhada no GitHub --
-- evita confusão entre os dois sistemas ("o card #75" = "a issue #75").
--
-- Coluna opcional (nem todo card do kanban tem/precisa ter issue espelhada).
-- Índice único parcial: dois cards não podem apontar pro mesmo número de
-- issue por engano, mas vários cards sem número (NULL) convivem em paz.

ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS github_issue_number INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_cards_github_issue_number
  ON kanban_cards(github_issue_number)
  WHERE github_issue_number IS NOT NULL;

COMMENT ON COLUMN kanban_cards.github_issue_number IS
  'Número da issue espelhada em github.com/CaduCondo/sistemaDuvoEnterprise -- mesmo número no card e na issue, pra citar sem ambiguidade. NULL enquanto o card não tiver issue espelhada.';
