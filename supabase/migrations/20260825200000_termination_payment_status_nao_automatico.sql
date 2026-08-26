-- ============================================================================
-- O Recebimento de Rescisao nasce "Pago" com valor zerado (#49)
--
-- SINTOMA: a rescisao criava o Recebimento de Rescisao com status 'pending',
-- mas ele aparecia na aba "Recebimentos Pagos" com valor R$ 0,00. Ao cancelar
-- o recebimento para devolve-lo a "Pendentes", ele voltava sozinho para
-- "Pagos" -- um laco sem fim, sem jeito de sair pela tela.
--
-- CAUSA: o trigger validate_payment_status_trigger (migration
-- 20260216223935) roda BEFORE INSERT OR UPDATE e SOBRESCREVE o status com
-- base na conta:
--
--     restante := expected_amount + multa + juros - desconto - paid_amount
--     se ABS(restante) <= 0.05  ->  'paid'
--
-- Isso vale para aluguel: restante zero significa quitado. Mas o Recebimento
-- de Rescisao comeca legitimamente ZERADO -- enquanto o caucao nao foi pago e
-- o usuario ainda nao digitou Despesas Adicionais e Desconto, o total e 0,00.
-- O trigger lia esse zero como "quitado" e cravava 'paid' em cima, inclusive
-- por cima do 'pending' que o cancelamento tinha acabado de gravar.
--
-- CORRECAO: o trigger deixa de mexer nos recebimentos de rescisao. O status
-- deles passa a ser o que a aplicacao gravar -- que e o correto, porque quem
-- decide se a rescisao foi acertada e o usuario, e nao a aritmetica: um
-- Recebimento de Rescisao pode valer 0,00 e ainda assim estar em aberto.
--
-- Os recebimentos de aluguel continuam exatamente como antes.
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  correct_status TEXT;
BEGIN
  -- ⚠️ Recebimento de Rescisao (#49): status e da aplicacao, nao do trigger.
  -- Ver o cabecalho desta migration.
  IF NEW.payment_kind = 'termination' THEN
    RETURN NEW;
  END IF;

  correct_status := calculate_correct_payment_status(
    NEW.expected_amount,
    NEW.paid_amount,
    NEW.discount,
    NEW.late_fee,
    NEW.interest,
    NEW.payment_date
  );

  NEW.status := correct_status;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Devolve para "Pendente" os Recebimentos de Rescisao que o trigger ja tinha
-- marcado como pagos sem ninguem ter pago nada.
UPDATE public.payments
   SET status = 'pending'
 WHERE payment_kind = 'termination'
   AND status = 'paid'
   AND COALESCE(paid_amount, 0) = 0
   AND payment_date IS NULL;
