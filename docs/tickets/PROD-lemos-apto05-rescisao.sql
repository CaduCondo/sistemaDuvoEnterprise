-- ============================================================================
-- LEMOS APTO 05 (Jeane Bispo dos Santos) — rescisão cobrou o mês já pago
--
-- Cole tudo no SQL Editor de PRODUÇÃO e clique em Run. Uma vez.
--
-- O QUE ACONTECEU: a parcela 10 (05/10/2026, R$ 1.500,00) já estava PAGA.
-- A rescisão (saída 10/10/2026) criou mesmo assim outro recebimento cobrando
-- o aluguel cheio de outubro (05/10/2026, R$ 1.500,00, pendente) e numerou
-- todos os recebimentos juntos, inclusive o de caução (ficou 11/13, 12/13,
-- 13/13).
--
-- O QUE ESTE SCRIPT FAZ:
--   1) APAGA o recebimento duplicado (05/10/2026, R$ 1.500,00, pendente);
--   2) tira o número de parcela do recebimento de proporcional + multa
--      (10/10/2026, R$ 2.820,00) e do Recebimento de Rescisão (caução) —
--      eles não são parcelas de aluguel (passam a aparecer com parcela "-");
--   3) as parcelas 1 a 10 passam de "x/13" para "x/10".
--   Não mexe em valor nenhum dos recebimentos que ficam.
--
-- É SEGURO: transação única; cada passo confere o registro pelo id E pelos
-- dados esperados — se algo não bater, cancela tudo sem mudar nada.
-- ============================================================================

BEGIN;

DO $fix$
DECLARE
  v_rental uuid;
  v_n int;
BEGIN
  SELECT rental_id INTO v_rental FROM payments WHERE id = 'ca4dc0fc-f88b-4d58-b2f3-e102d3b7f3b9';

  -- confere que a parcela 10 (05/10/2026) está mesmo paga
  IF NOT EXISTS (SELECT 1 FROM payments WHERE id = 'ca4dc0fc-f88b-4d58-b2f3-e102d3b7f3b9'
                   AND due_date = '2026-10-05' AND status = 'paid') THEN
    RAISE EXCEPTION 'A parcela 10 de 05/10/2026 não está como esperado (paga). Nada foi alterado.';
  END IF;

  -- 1) apaga o duplicado (só se ainda estiver pendente e do mesmo contrato)
  DELETE FROM payments
   WHERE id = '50edeee5-65e6-48d6-9f16-57e56da1f466'
     AND rental_id = v_rental AND due_date = '2026-10-05'
     AND status = 'pending' AND expected_amount = 1500;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Esperava apagar 1 recebimento duplicado, apagaria %. Nada foi alterado.', v_n;
  END IF;

  -- 2) proporcional + multa e Recebimento de Rescisão: sem número de parcela
  UPDATE payments SET installment = NULL, total_installments = NULL
   WHERE id IN ('50214b20-1b29-4156-9c74-de615c26ae84', '7894ce8b-a648-4096-b6f9-8af23951e3d3')
     AND rental_id = v_rental;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'Esperava ajustar 2 recebimentos da rescisão, ajustaria %. Nada foi alterado.', v_n;
  END IF;

  -- 3) parcelas de aluguel 1 a 10 -> x/10
  UPDATE payments SET total_installments = 10
   WHERE rental_id = v_rental AND installment BETWEEN 1 AND 10
     AND COALESCE(payment_kind, 'rent') = 'rent';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 10 THEN
    RAISE EXCEPTION 'Esperava 10 parcelas de aluguel, achou %. Nada foi alterado.', v_n;
  END IF;
END
$fix$;

COMMIT;

-- Conferência: todos os recebimentos da locação
SELECT to_char(p.due_date, 'DD/MM/YYYY') AS vencimento,
       COALESCE(p.installment || '/' || p.total_installments, '-') AS parcela,
       p.expected_amount AS valor, p.status, p.payment_kind AS tipo
  FROM payments p
 WHERE p.rental_id = (SELECT rental_id FROM payments WHERE id = 'ca4dc0fc-f88b-4d58-b2f3-e102d3b7f3b9')
 ORDER BY p.due_date, p.installment NULLS LAST;
