-- ============================================================================
-- KANBAN — 31/ago/2026: auditoria de docs/manual/testes/kanbans + 2 tickets
--
-- Cole tudo no SQL Editor de PRODUCAO e clique em Run. Uma vez.
--
-- Contexto: nesta sessao o Claude (a) reorganizou as tags do BDD (@smoke
-- enxuto de 12 cenarios + @sistemaCompleto cobrindo o resto, ver
-- e2e/SMOKE.md), (b) limpou documentacao desatualizada/duplicada,
-- (c) achou 1 bug de seguranca grave em producao (issue #57 do GitHub) e
-- (d) achou 4 cenarios de teste quebrados + 1 lacuna de smoke (issue #58).
-- As duas ja existem como issues no GitHub
-- (https://github.com/CaduCondo/sistemaDuvoEnterprise/issues/57 e /58) e
-- ja foram adicionadas ao Project "Sistema DUvoEnterprise" (issue #57;
-- a #58 ainda precisa ser adicionada manualmente ao Project -- a tela de
-- selecionar projeto nao teve um clique confiavel via automacao, e falta
-- so isso: abrir a issue #58 -> Projects -> marcar "Sistema DUvoEnterprise").
--
-- Este script cria o par de cada uma no kanban interno, ja com a #57 em
-- "em_andamento" (e o proximo ticket a ser trabalhado, prioridade maxima:
-- bloqueio de senha por 3 tentativas erradas esta MORTO em producao).
--
-- E SEGURO: so insere cards, e pula os que ja existirem. Pode rodar de novo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- #57 (GitHub) -- Cadastro de usuarios, troca de senha e bloqueio por
-- tentativas travados em producao. URGENTE: entra em "em_andamento" direto,
-- e o proximo ticket a ser trabalhado.
-- ----------------------------------------------------------------------------
DO $card$
DECLARE
  v_card_id UUID;
  v_posicao INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM kanban_cards WHERE title = 'Cadastro de usuarios, troca de senha e bloqueio por tentativas travados em producao') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_posicao
    FROM kanban_cards WHERE status = 'em_andamento';

  INSERT INTO kanban_cards (title, category, status, priority, module,
                            problem_description, action_plan, position)
  VALUES ('Cadastro de usuarios, troca de senha e bloqueio por tentativas travados em producao', 'bug', 'em_andamento', 'urgente', 'Autenticacao',
          'Em producao a tabela system_users esta com RLS ligado, e as regras de INSERT/UPDATE/DELETE exigem auth.uid(). Como este sistema tem login proprio (authService + AuthContext, usuario guardado no navegador) e nunca cria sessao no Supabase, auth.uid() e SEMPRE nulo -- entao essas regras bloqueiam todo mundo, inclusive o admin. Tres consequencias, todas valendo agora em producao: (1) criar/editar/excluir usuario nao funcionam; (2) quem for obrigado a trocar de senha nao consegue (changePassword lanca erro); (3) a PIOR -- o bloqueio por 3 senhas erradas esta MORTO: a contagem de tentativas nao e gravada e o erro e engolido em silencio, entao da para tentar senha infinitas vezes. Descoberto pela varredura docs/tickets/DIAG-rls-producao.sql em 30/ago/2026. Nas outras tabelas bastou desligar o RLS (controle de acesso fica na tela); aqui nao da, porque system_users e a tabela dos usuarios -- desligar deixaria qualquer pessoa com a chave publica criar um admin para si mesma.',
          'Decisao do Cadu, 30/ago/2026: passar as escritas em system_users para uma rota no servidor, que usa a chave secreta (nunca sai do servidor) e nao depende de desligar nada -- a tabela continua fechada. Call sites que gravam nessa tabela: systemUserService.ts (createUser, updateUser, deleteUser, unlockUser, reset de senha), authService.ts (contagem de tentativas e changePassword), PasswordChangeDialog.tsx, useUsers.ts, settings.tsx e public/PublicHeader.tsx. Issue no GitHub: #57.',
          v_posicao)
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position, completed) VALUES
    (v_card_id, 'Criar rota de servidor (API route) para criar/editar/excluir usuario, usando a service role key', 0, false),
    (v_card_id, 'Mover a contagem de tentativas de senha errada e o bloqueio de 30min para a rota de servidor', 1, false),
    (v_card_id, 'Mover changePassword para a rota de servidor', 2, false),
    (v_card_id, 'Atualizar systemUserService.ts, authService.ts, PasswordChangeDialog.tsx, useUsers.ts, settings.tsx e public/PublicHeader.tsx para chamar a rota nova', 3, false),
    (v_card_id, 'Testar em DEV: criar usuario, trocar senha, errar senha 3x e confirmar bloqueio de 30min', 4, false),
    (v_card_id, 'Escrever cenario BDD cobrindo o bloqueio por 3 tentativas (regressao deste bug)', 5, false),
    (v_card_id, 'Rodar em producao e confirmar que admin volta a conseguir gerenciar usuarios', 6, false);
END
$card$;

-- ----------------------------------------------------------------------------
-- #58 (GitHub) -- 4 cenarios de teste quebrados (@quebrado) + falta cenario
-- de smoke para "receber aluguel". Prioridade media: nao e bug de producao,
-- e divida tecnica de testes.
-- ----------------------------------------------------------------------------
DO $card$
DECLARE
  v_card_id UUID;
  v_posicao INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM kanban_cards WHERE title = 'BDD: 4 cenarios de teste quebrados (@quebrado) e falta cenario de smoke para receber aluguel') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_posicao
    FROM kanban_cards WHERE status = 'backlog';

  INSERT INTO kanban_cards (title, category, status, priority, module,
                            problem_description, action_plan, position)
  VALUES ('BDD: 4 cenarios de teste quebrados (@quebrado) e falta cenario de smoke para receber aluguel', 'divida_tecnica', 'backlog', 'media', 'Testes',
          'Na reorganizacao das tags do BDD de 31/ago/2026 (ver e2e/SMOKE.md), 4 cenarios ja existentes ficaram marcados @quebrado (preparo ou asserção nao bate com a tela real, fora das duas rodadas ate serem corrigidos): "Criar locacao - Caucao integral" e "Criar locacao - Gerar pagamentos automaticamente" (7-locacoes-regras.feature); "Calcular pagamento com garagem" e "Registrar pagamento como pago" (8-pagamentos-calculos.feature). Consequencia: nao existe hoje um cenario @smoke limpo para "receber aluguel" -- os dois candidatos naturais sao justamente os dois quebrados de pagamentos.',
          'Detalhe de cada causa em docs/tickets/smoke-30-ago.md e na issue #58 do GitHub. Corrigir os 4 preparos/asserções, decidir com o Cadu se cada um volta como @smoke ou @sistemaCompleto, e escrever um cenario @smoke novo de "receber aluguel" (marcar um recebimento de aluguel comum como pago).',
          v_posicao)
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position, completed) VALUES
    (v_card_id, 'Reescrever preparo de "Criar locacao - Caucao integral" (preencher imovel/inquilino/datas)', 0, false),
    (v_card_id, 'Reescrever "Criar locacao - Gerar pagamentos automaticamente" para criar a locacao pela tela', 1, false),
    (v_card_id, 'Corrigir "Calcular pagamento com garagem" (preparo + assercao real da tela)', 2, false),
    (v_card_id, 'Corrigir "Registrar pagamento como pago" (coluna Recibo, nao botao "Gerar Recibo")', 3, false),
    (v_card_id, 'Escrever cenario @smoke de "receber aluguel"', 4, false);
END
$card$;

-- ============================================================================
-- COMO FICOU
-- ============================================================================
SELECT c.priority AS prioridade, c.status AS status, c.module AS modulo, c.title AS card,
       (SELECT COUNT(*) FROM kanban_card_tasks t WHERE t.card_id = c.id)::text AS tarefas
  FROM kanban_cards c
 WHERE c.title IN (
   'Cadastro de usuarios, troca de senha e bloqueio por tentativas travados em producao',
   'BDD: 4 cenarios de teste quebrados (@quebrado) e falta cenario de smoke para receber aluguel'
 )
 ORDER BY CASE c.priority WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2
                          WHEN 'media' THEN 3 ELSE 4 END, c.title;
