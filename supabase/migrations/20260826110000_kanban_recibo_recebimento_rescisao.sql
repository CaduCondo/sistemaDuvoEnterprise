-- ============================================================================
-- Card do Kanban: o recibo do Recebimento de Rescisão
--
-- Pedido do Cadu em 26/ago/2026, durante os testes da #49.
--
-- O recibo de pagamento hoje foi desenhado para o recebimento de ALUGUEL:
-- fala em aluguel, parcela X/Y e um total sempre positivo. O Recebimento de
-- Rescisão não cabe nesse molde -- ele pode ter total NEGATIVO (a imobiliária
-- devolve dinheiro ao inquilino), tem linhas que o aluguel não tem (devolução
-- do caução corrigida, despesas adicionais, desconto) e é sempre parcela 1/1.
--
-- Idempotente: não cria de novo se o card já existir.
-- ============================================================================

DO $$
DECLARE
  v_card_id UUID;
  v_posicao INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM kanban_cards
     WHERE title = 'Recibo próprio para o Recebimento de Rescisão'
  ) THEN
    RAISE NOTICE 'Card já existe — nada a fazer.';
    RETURN;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_posicao
    FROM kanban_cards
   WHERE status = 'backlog';

  INSERT INTO kanban_cards (
    title, category, status, priority, module,
    problem_description, action_plan, how_to, position
  )
  VALUES (
    'Recibo próprio para o Recebimento de Rescisão',
    'melhoria',
    'backlog',
    'media',
    'Recebimentos',
    'O recibo de pagamento foi desenhado para o recebimento de aluguel e não serve para o Recebimento de Rescisão criado pela #49. '
    'Ele fala em aluguel e parcela X/Y, e assume total positivo. '
    'O Recebimento de Rescisão pode ter total NEGATIVO -- quando a devolução do caução supera o que o inquilino deve, quem paga é a imobiliária --, '
    'tem linhas que não existem no aluguel (Valor Devolução Caução corrigido pela poupança, Despesas Adicionais, Valor de Desconto) e é sempre parcela 1/1.',
    'Adaptar o recibo para reconhecer payment_kind = ''termination'' e imprimir o documento certo para esse caso.',
    E'- Distinguir pelo campo `payment_kind` do recebimento (''rent'' x ''termination''), nunca pelo texto das observações — foi assim que a etiqueta de Rescisão apareceu no recebimento errado na lista.\n'
    '- Quando o total for negativo, o documento não é um recibo de cobrança e sim um comprovante de DEVOLUÇÃO: o título e o texto precisam refletir isso, senão vira um recibo dizendo que o inquilino pagou o que na verdade recebeu.\n'
    '- Trazer as linhas do bloco Formação de Valores - Rescisão, com os mesmos sinais da tela.\n'
    '- Mostrar a memória da correção pela poupança (valor original, percentual acumulado, meses), que hoje só existe no tooltip da tela.\n'
    '- Parcela é sempre 1/1: não usar a numeração das parcelas do aluguel.\n'
    '- Ver src/services/terminationService.ts e docs/tickets/rescisao-caucao.md para as regras e os sinais de cada campo.',
    v_posicao
  )
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
  (v_card_id, 'Mapear o que o recibo atual imprime e o que não se aplica à rescisão', 0),
  (v_card_id, 'Ramificar o recibo por payment_kind (''rent'' x ''termination'')', 1),
  (v_card_id, 'Tratar o total negativo como comprovante de devolução, e não como recibo de cobrança', 2),
  (v_card_id, 'Imprimir as linhas da rescisão com os sinais corretos (devolução, despesas, desconto)', 3),
  (v_card_id, 'Incluir a memória da correção pela poupança', 4),
  (v_card_id, 'Fixar a parcela em 1/1 no recibo de rescisão', 5),
  (v_card_id, 'Conferir a impressão nos dois casos: total positivo e total negativo', 6);

  RAISE NOTICE 'Card criado: %', v_card_id;
END $$;
