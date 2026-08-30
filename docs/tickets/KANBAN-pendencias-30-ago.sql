-- ============================================================================
-- KANBAN — o que ficou aberto depois da implantação de 30/ago/2026
--
-- Cole tudo no SQL Editor de PRODUÇÃO e clique em Run. Uma vez.
-- (O kanban que você usa, duvoenterprise.com.br/kanban, é o de produção.)
--
-- Cria 6 cards no BACKLOG, cada um com as tarefas dele. Já vem com a
-- prioridade sugerida; reordene no kanban como preferir.
--
-- É SEGURO: só insere cards. Se um card com o mesmo título já existir, ele é
-- pulado -- então pode rodar de novo sem duplicar nada.
--
-- No fim mostra os cards criados.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Varrer producao atras de outras telas travadas por RLS
-- ----------------------------------------------------------------------------
DO $card$
DECLARE
  v_card_id UUID;
  v_posicao INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM kanban_cards WHERE title = 'Varrer producao atras de outras telas travadas por RLS') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_posicao
    FROM kanban_cards WHERE status = 'backlog';

  INSERT INTO kanban_cards (title, category, status, priority, module,
                            problem_description, action_plan, position)
  VALUES ('Varrer producao atras de outras telas travadas por RLS', 'bug', 'backlog', 'urgente', 'Infra',
          'A tela Configuracoes > Isencao de Taxa Admin parou de salvar em producao em 30/ago/2026 com ''new row violates row-level security policy''. A tabela estava com a trava (RLS) ligada e uma politica de gravacao amarrada a auth.uid()/system_users -- e este sistema nao usa o login do Supabase, entao auth.uid() e SEMPRE nulo. A leitura passava e so a gravacao quebrava, por isso a tela abria certinha e so falhava ao salvar. Producao tem 21 tabelas com a trava ligada; qualquer outra na mesma combinacao vai quebrar do mesmo jeito, sem aviso, quando alguem tentar gravar.',
          'Rodar docs/tickets/DIAG-rls-producao.sql em PRODUCAO. Ele lista so os casos de risco de verdade (tabela + operacao). Para cada linha que voltar, desligar o RLS da tabela ou trocar a politica por uma livre, como foi feito em docs/tickets/PROD-corrige-isencao-taxas-3.sql. Se nao voltar nenhuma linha, encerrar o card.',
          v_posicao)
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
    (v_card_id, 'Rodar o DIAG em producao', 0),
    (v_card_id, 'Corrigir cada tabela que aparecer', 1),
    (v_card_id, 'Rodar o DIAG de novo e confirmar zero linhas', 2),
    (v_card_id, 'Rodar o mesmo DIAG em DEV e igualar os dois', 3);
END
$card$;

-- ----------------------------------------------------------------------------
-- Rescisao do mes PENDENTE deve gerar UM recebimento, nao dois
-- ----------------------------------------------------------------------------
DO $card$
DECLARE
  v_card_id UUID;
  v_posicao INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM kanban_cards WHERE title = 'Rescisao do mes PENDENTE deve gerar UM recebimento, nao dois') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_posicao
    FROM kanban_cards WHERE status = 'backlog';

  INSERT INTO kanban_cards (title, category, status, priority, module,
                            problem_description, action_plan, position)
  VALUES ('Rescisao do mes PENDENTE deve gerar UM recebimento, nao dois', 'melhoria', 'backlog', 'alta', 'Recebimentos',
          'Item E da rodada 2, ainda aberto. Quando a rescisao acontece depois do vencimento e o mes nao foi pago, o terminationService parte a conta em DOIS recebimentos de aluguel (o mes cheio no dia 10 e o proporcional no dia da saida). O combinado e UMA tela so, com a conta inteira: Aluguel + Aluguel Proporcional + Garagem + Garagem Proporcional + Multa + Desconto.',
          'Alterar o terminationService para gerar um unico recebimento de aluguel nesse caso, somando o mes cheio e os dias extras na mesma Formacao de Valores. O cenario de teste que cobra isso ja existe e esta pronto: ''Formacao de Valores da rescisao quando o mes estava PENDENTE'', em e2e/features/12-rescisao-caucao.feature. Ele foi tirado do smoke em 30/ago justamente por causa desta pendencia.',
          v_posicao)
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
    (v_card_id, 'Alterar o terminationService', 0),
    (v_card_id, 'Rodar o cenario sozinho ate passar', 1),
    (v_card_id, 'Devolver a etiqueta @smoke no cenario', 2),
    (v_card_id, 'Conferir na tela com uma rescisao de verdade', 3);
END
$card$;

-- ----------------------------------------------------------------------------
-- Migrar as rescisoes antigas para o formato de dois recebimentos
-- ----------------------------------------------------------------------------
DO $card$
DECLARE
  v_card_id UUID;
  v_posicao INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM kanban_cards WHERE title = 'Migrar as rescisoes antigas para o formato de dois recebimentos') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_posicao
    FROM kanban_cards WHERE status = 'backlog';

  INSERT INTO kanban_cards (title, category, status, priority, module,
                            problem_description, action_plan, position)
  VALUES ('Migrar as rescisoes antigas para o formato de dois recebimentos', 'divida_tecnica', 'backlog', 'media', 'Recebimentos',
          'As rescisoes feitas antes da #49 estao gravadas como um recebimento unico, misturando aluguel e devolucao de caucao. Isso contamina a base das taxas de administracao e gerenciamento, porque o caucao (dinheiro de terceiro) entra na conta.',
          'Roteiro de 7 passos ja escrito em docs/tickets/migracao-rescisoes-antigas.md. Combinado: rodar so depois que a producao estiver estavel com o formato novo, e deixar as migradas como PENDENTE para revisao manual.',
          v_posicao)
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
    (v_card_id, 'Revisar o roteiro', 0),
    (v_card_id, 'Rodar em DEV e conferir', 1),
    (v_card_id, 'Rodar em producao', 2),
    (v_card_id, 'Revisar manualmente as migradas', 3);
END
$card$;

-- ----------------------------------------------------------------------------
-- Reescrever os 4 cenarios de teste que sairam do smoke
-- ----------------------------------------------------------------------------
DO $card$
DECLARE
  v_card_id UUID;
  v_posicao INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM kanban_cards WHERE title = 'Reescrever os 4 cenarios de teste que sairam do smoke') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_posicao
    FROM kanban_cards WHERE status = 'backlog';

  INSERT INTO kanban_cards (title, category, status, priority, module,
                            problem_description, action_plan, position)
  VALUES ('Reescrever os 4 cenarios de teste que sairam do smoke', 'divida_tecnica', 'backlog', 'media', 'Testes',
          'Quatro cenarios sairam do smoke em 30/ago/2026 porque o preparo deles nao cria os dados que eles proprios conferem -- nao e questao de seletor, eles nao tem como passar. Sao eles: 7-locacoes ''Gerar pagamentos automaticamente'' e ''Criar locacao - Caucao integral''; 8-pagamentos ''Calcular pagamento com garagem'' e ''Registrar pagamento como pago''. O motivo de cada um esta escrito acima do cenario e detalhado em docs/tickets/smoke-30-ago.md.',
          'Reescrever o preparo de cada um para criar de verdade o que o cenario confere, rodar sozinho ate passar de forma confiavel e so entao devolver a etiqueta @smoke.',
          v_posicao)
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
    (v_card_id, '7-locacoes: Gerar pagamentos automaticamente', 0),
    (v_card_id, '7-locacoes: Criar locacao - Caucao integral', 1),
    (v_card_id, '8-pagamentos: Calcular pagamento com garagem', 2),
    (v_card_id, '8-pagamentos: Registrar pagamento como pago', 3);
END
$card$;

-- ----------------------------------------------------------------------------
-- Tela do recebimento as vezes abre sem os dados
-- ----------------------------------------------------------------------------
DO $card$
DECLARE
  v_card_id UUID;
  v_posicao INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM kanban_cards WHERE title = 'Tela do recebimento as vezes abre sem os dados') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_posicao
    FROM kanban_cards WHERE status = 'backlog';

  INSERT INTO kanban_cards (title, category, status, priority, module,
                            problem_description, action_plan, position)
  VALUES ('Tela do recebimento as vezes abre sem os dados', 'bug', 'backlog', 'media', 'Recebimentos',
          'Durante a estabilizacao do smoke em 30/ago/2026, a tela ''Registrar Recebimento'' foi vista abrindo com todos os cartoes em ''Nao informado'', aluguel R$ 0,00 e a Formacao de Valores vazia -- ou seja, a busca dos dados no banco nao voltou. Nao foi descoberto o porque. O teste passou a tentar uma segunda vez e passa, mas o defeito pode acontecer com o usuario tambem.',
          'Reproduzir e descobrir a causa. Os testes ja guardam os erros do navegador (CustomWorld.errosDoNavegador) e a mensagem de falha traz o texto da tela junto -- da proxima vez que acontecer na esteira, a explicacao vem junto.',
          v_posicao)
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
    (v_card_id, 'Reproduzir o problema', 0),
    (v_card_id, 'Descobrir a causa', 1),
    (v_card_id, 'Corrigir', 2),
    (v_card_id, 'Tirar a segunda tentativa do teste', 3);
END
$card$;

-- ----------------------------------------------------------------------------
-- Limpar os dados de teste sobrando no banco de DEV
-- ----------------------------------------------------------------------------
DO $card$
DECLARE
  v_card_id UUID;
  v_posicao INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM kanban_cards WHERE title = 'Limpar os dados de teste sobrando no banco de DEV') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_posicao
    FROM kanban_cards WHERE status = 'backlog';

  INSERT INTO kanban_cards (title, category, status, priority, module,
                            problem_description, action_plan, position)
  VALUES ('Limpar os dados de teste sobrando no banco de DEV', 'divida_tecnica', 'backlog', 'baixa', 'Infra',
          'O gancho de limpeza dos testes estourava o limite de 1 minuto e parava no meio (corrigido em 30/ago, agora sao 5 minutos). Ficaram para tras dezenas de locacoes ''Rescisao E2E ...'', inquilinos ''Joao Silva'' e localizacoes repetidas em DEV. Nao atrapalham nada, mas poluem as telas e ja causaram uma falha de teste por localizacao duplicada.',
          'Escrever uma limpeza unica que apague os registros de teste de DEV pelo padrao do nome. Rodar SO em DEV, nunca em producao.',
          v_posicao)
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
    (v_card_id, 'Escrever a limpeza', 0),
    (v_card_id, 'Conferir o que ela apagaria', 1),
    (v_card_id, 'Rodar em DEV', 2);
END
$card$;

-- ============================================================================
-- COMO FICOU
-- ============================================================================
SELECT c.priority AS prioridade,
       c.category AS tipo,
       c.module   AS modulo,
       c.title    AS card,
       (SELECT COUNT(*) FROM kanban_card_tasks t WHERE t.card_id = c.id)::text AS tarefas
  FROM kanban_cards c
 WHERE c.title IN (
   'Varrer producao atras de outras telas travadas por RLS',
   'Rescisao do mes PENDENTE deve gerar UM recebimento, nao dois',
   'Migrar as rescisoes antigas para o formato de dois recebimentos',
   'Reescrever os 4 cenarios de teste que sairam do smoke',
   'Tela do recebimento as vezes abre sem os dados',
   'Limpar os dados de teste sobrando no banco de DEV'
 )
 ORDER BY CASE c.priority WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2
                          WHEN 'media' THEN 3 ELSE 4 END, c.title;
