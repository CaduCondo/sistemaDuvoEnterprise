-- ============================================================================
-- KANBAN — mais 2 cards (testes e manual)
--
-- Cole tudo no SQL Editor de PRODUÇÃO e clique em Run. Uma vez.
--
-- Complementa o KANBAN-pendencias-30-ago.sql com dois itens que ficaram de
-- fora: a reorganização do smoke (decisão sua de 30/ago) e a revisão do
-- Manual do Sistema.
--
-- É SEGURO: só insere cards, e pula os que já existirem. Pode rodar de novo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Encolher o smoke para 5 minutos e criar a suite completa separada
-- ----------------------------------------------------------------------------
DO $card$
DECLARE
  v_card_id UUID;
  v_posicao INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM kanban_cards WHERE title = 'Encolher o smoke para 5 minutos e criar a suite completa separada') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_posicao
    FROM kanban_cards WHERE status = 'backlog';

  INSERT INTO kanban_cards (title, category, status, priority, module,
                            problem_description, action_plan, position)
  VALUES ('Encolher o smoke para 5 minutos e criar a suite completa separada', 'divida_tecnica', 'backlog', 'alta', 'Testes',
          'O smoke esta com 31 cenarios e leva cerca de 3m40 -- dentro dos 5 minutos, mas so porque a suite completa nao roda. Ele foi ampliado de proposito em 29/ago para vigiar a rescisao ate a implantacao, e a implantacao ja aconteceu. Hoje ele repete regra de detalhe (18 dos 31 cenarios sao de rescisao) em vez de vigiar as funcionalidades principais. E a suite antiga continua parada: as regras que sairam do smoke nao sao testadas por ninguem.',
          'Decisao do Cadu, 30/ago/2026: o smoke fica com no MAXIMO 5 minutos e cobre so as funcionalidades principais; todo o resto vai para outra etiqueta, que testa TODAS as regras sem repetir o que o smoke ja rodou. Proposta: manter em @smoke uns 10 a 12 cenarios (entrar no sistema, criar locacao, receber aluguel, receber caucao, a rescisao gerar dois recebimentos, a devolucao nao entrar na base das taxas, excluir locacao) e criar e2e/cucumber.regressao.config.cjs com tags ''not @smoke'' -- assim a suite completa e, por definicao, tudo o que o smoke nao cobriu, sem precisar etiquetar cenario nenhum de novo. No GitHub Actions o smoke continua a cada push e a regressao roda uma vez por dia ou sob demanda.',
          v_posicao)
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
    (v_card_id, 'Escolher com o Cadu quais cenarios ficam no smoke', 0),
    (v_card_id, 'Tirar o @smoke dos demais', 1),
    (v_card_id, 'Criar o cucumber.regressao.config.cjs com ''not @smoke''', 2),
    (v_card_id, 'Consertar os cenarios da regressao que estiverem quebrados', 3),
    (v_card_id, 'Colocar a regressao no GitHub Actions', 4),
    (v_card_id, 'Atualizar o e2e/SMOKE.md', 5);
END
$card$;

-- ----------------------------------------------------------------------------
-- Revisar o Manual do Sistema depois das mudancas de agosto
-- ----------------------------------------------------------------------------
DO $card$
DECLARE
  v_card_id UUID;
  v_posicao INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM kanban_cards WHERE title = 'Revisar o Manual do Sistema depois das mudancas de agosto') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_posicao
    FROM kanban_cards WHERE status = 'backlog';

  INSERT INTO kanban_cards (title, category, status, priority, module,
                            problem_description, action_plan, position)
  VALUES ('Revisar o Manual do Sistema depois das mudancas de agosto', 'divida_tecnica', 'backlog', 'media', 'Documentacao',
          'O Manual do Sistema (botao dentro do proprio sistema) nao foi revisado depois das tres rodadas de padronizacao das telas de recebimento, da tela nova de rescisao, da mudanca de excluir locacao com recebimentos pagos e do campo de horario no recebimento de caucao. Nao se sabe o que esta desatualizado la dentro.',
          'Ler o manual inteiro comparando com as telas de hoje e atualizar o que estiver diferente. Prioridade para a parte de Recebimentos e a de Locacoes, que foram as mais mexidas.',
          v_posicao)
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
    (v_card_id, 'Ler o manual e listar o que esta desatualizado', 0),
    (v_card_id, 'Atualizar a parte de Recebimentos', 1),
    (v_card_id, 'Atualizar a parte de Locacoes', 2),
    (v_card_id, 'Incluir a rescisao, que e tela nova', 3);
END
$card$;

-- ============================================================================
-- COMO FICOU
-- ============================================================================
SELECT c.priority AS prioridade, c.module AS modulo, c.title AS card,
       (SELECT COUNT(*) FROM kanban_card_tasks t WHERE t.card_id = c.id)::text AS tarefas
  FROM kanban_cards c
 WHERE c.title IN (
   'Encolher o smoke para 5 minutos e criar a suite completa separada',
   'Revisar o Manual do Sistema depois das mudancas de agosto'
 )
 ORDER BY CASE c.priority WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2
                          WHEN 'media' THEN 3 ELSE 4 END, c.title;
