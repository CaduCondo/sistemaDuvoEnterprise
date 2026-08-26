-- ============================================================================
-- #49 EM PRODUÇÃO — RODE ESTE ARQUIVO INTEIRO, DE UMA VEZ SÓ
--
-- Cole tudo no SQL Editor de PRODUÇÃO e clique em Run. Uma vez.
--
-- Faz as 5 migrations da #49 na ordem certa. Você não precisa abrir nem
-- entender os arquivos individuais.
--
-- É SEGURO:
--   - roda tudo numa transação só: se qualquer parte falhar, NADA é aplicado;
--   - pode rodar de novo sem estragar nada (é idempotente);
--   - no fim imprime um relatório dizendo se deu tudo certo.
--
-- O QUE ELE FAZ, em uma linha cada:
--   1. cria as colunas que o código novo lê (sem isso, o site quebra)
--   2. remove o índice que impedia a rescisão de gerar 2 recebimentos
--   3. faz o trigger não mexer no status do Recebimento de Rescisão
--   4. conserta parcelas de caução gravadas como "pagas por R$ 0,00"
--   5. cria o card do recibo no Kanban
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Colunas novas em `payments`
-- ----------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_kind text NOT NULL DEFAULT 'rent',
  ADD COLUMN IF NOT EXISTS termination_group_id uuid,
  ADD COLUMN IF NOT EXISTS termination_corrected_deposit numeric(12,2),
  ADD COLUMN IF NOT EXISTS termination_additional_expenses numeric(12,2),
  ADD COLUMN IF NOT EXISTS termination_discount numeric(12,2);

COMMENT ON COLUMN public.payments.payment_kind IS
  '"rent" = recebimento comum de aluguel, entra na base das taxas de adm e gerenciamento. "termination" = Recebimento de Rescisao, NAO entra (devolucao de caucao e dinheiro de terceiro). Issue #49.';

COMMENT ON COLUMN public.payments.termination_group_id IS
  'Liga os dois recebimentos gerados por uma mesma rescisao.';

CREATE INDEX IF NOT EXISTS idx_payments_termination_group
  ON public.payments (termination_group_id)
  WHERE termination_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_kind_rental
  ON public.payments (rental_id, payment_kind);

UPDATE public.payments SET payment_kind = 'rent' WHERE payment_kind IS NULL;


-- ----------------------------------------------------------------------------
-- 2. Fora o índice único que barrava o segundo recebimento
--
-- Ele é de antes da #49, de quando só existia UM recebimento por
-- rental/mês/ano. Não volta: com a regra do mês cheio, dois recebimentos de
-- aluguel no mesmo mês passaram a ser um resultado correto.
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.unique_payment_per_rental_period_installment;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS unique_payment_per_rental_period_installment;


-- ----------------------------------------------------------------------------
-- 3. O trigger deixa de mexer no status do Recebimento de Rescisão
--
-- Ele nasce legitimamente zerado (enquanto o caução não foi pago e ninguém
-- digitou Despesas/Desconto). O trigger lia esse zero como "quitado" e cravava
-- 'paid' por cima do 'pending' — um laço sem saída pela tela.
--
-- Da linha do total_expected para baixo é EXATAMENTE o que já roda em
-- produção hoje: recebimentos de aluguel não mudam em nada.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_payment_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $funcao$
DECLARE
  total_expected NUMERIC;
  remaining NUMERIC;
BEGIN
  IF NEW.payment_kind = 'termination' THEN
    RETURN NEW;
  END IF;

  total_expected := COALESCE(NEW.expected_amount, 0) +
                    COALESCE(NEW.late_fee, 0) +
                    COALESCE(NEW.interest, 0) -
                    COALESCE(NEW.discount_amount, 0);

  remaining := total_expected - COALESCE(NEW.paid_amount, 0);

  IF ABS(remaining) <= 0.05 THEN
    NEW.status := 'paid';
  END IF;

  RETURN NEW;
END;
$funcao$;

UPDATE public.payments
   SET status = 'pending'
 WHERE payment_kind = 'termination'
   AND status = 'paid'
   AND COALESCE(paid_amount, 0) = 0
   AND payment_date IS NULL;


-- ----------------------------------------------------------------------------
-- 4. Parcelas de caução marcadas como pagas com paid_amount = 0
--
-- markDepositInstallmentAsPaid() gravava o status e a data, mas nunca o valor
-- pago. Como a rescisão devolve sobre o que foi EFETIVAMENTE pago, a devolução
-- dava R$ 0,00 em qualquer contrato.
-- ----------------------------------------------------------------------------
UPDATE public.deposit_installments
   SET paid_amount = amount,
       updated_at  = NOW()
 WHERE status = 'paid'
   AND COALESCE(paid_amount, 0) = 0
   AND amount > 0;


-- ----------------------------------------------------------------------------
-- 5. Card do recibo da rescisão no Kanban
-- ----------------------------------------------------------------------------
DO $card$
DECLARE
  v_card_id UUID;
  v_posicao INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM kanban_cards
              WHERE title = 'Recibo próprio para o Recebimento de Rescisão') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_posicao
    FROM kanban_cards WHERE status = 'backlog';

  INSERT INTO kanban_cards (
    title, category, status, priority, module,
    problem_description, action_plan, position
  )
  VALUES (
    'Recibo próprio para o Recebimento de Rescisão',
    'melhoria', 'backlog', 'media', 'Recebimentos',
    'O recibo foi desenhado para o recebimento de aluguel e nao serve para o Recebimento de Rescisao criado pela #49. '
    'Ele fala em aluguel e parcela X/Y, e assume total positivo. O Recebimento de Rescisao pode ter total NEGATIVO '
    '(quando a devolucao do caucao supera o que o inquilino deve, quem paga e a imobiliaria), tem linhas que nao existem '
    'no aluguel (Valor Devolucao Caucao, Despesas Adicionais, Valor de Desconto) e e sempre parcela 1/1.',
    'Ramificar o recibo por payment_kind e tratar o total negativo como comprovante de DEVOLUCAO, nao como recibo de cobranca.',
    v_posicao
  )
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
  (v_card_id, 'Ramificar o recibo por payment_kind (rent x termination)', 0),
  (v_card_id, 'Tratar total negativo como comprovante de devolucao', 1),
  (v_card_id, 'Imprimir as linhas da rescisao com os sinais corretos', 2),
  (v_card_id, 'Incluir a memoria da correcao pela poupanca', 3),
  (v_card_id, 'Fixar a parcela em 1/1', 4);
END
$card$;


-- ============================================================================
-- RELATÓRIO FINAL — todas as linhas devem dizer OK
-- ============================================================================
SELECT '1. colunas novas' AS etapa,
       CASE WHEN (SELECT COUNT(*) FROM information_schema.columns
                   WHERE table_name = 'payments'
                     AND column_name IN ('payment_kind','termination_group_id',
                         'termination_corrected_deposit','termination_additional_expenses',
                         'termination_discount')) = 5
            THEN 'OK' ELSE 'FALTOU' END AS resultado
UNION ALL
SELECT '2. indice antigo removido',
       CASE WHEN NOT EXISTS (SELECT 1 FROM pg_indexes
                              WHERE tablename = 'payments'
                                AND indexname = 'unique_payment_per_rental_period_installment')
            THEN 'OK' ELSE 'FALTOU' END
UNION ALL
SELECT '3. trigger com o desvio da rescisao',
       CASE WHEN pg_get_functiondef('validate_payment_status()'::regprocedure) LIKE '%payment_kind%'
            THEN 'OK' ELSE 'FALTOU' END
UNION ALL
SELECT '4. caucoes com paid_amount zerado',
       CASE WHEN NOT EXISTS (SELECT 1 FROM deposit_installments
                              WHERE status = 'paid' AND COALESCE(paid_amount,0) = 0 AND amount > 0)
            THEN 'OK' ELSE 'FALTOU' END
UNION ALL
SELECT '5. card do Kanban',
       CASE WHEN EXISTS (SELECT 1 FROM kanban_cards
                          WHERE title = 'Recibo próprio para o Recebimento de Rescisão')
            THEN 'OK' ELSE 'FALTOU' END
ORDER BY 1;
