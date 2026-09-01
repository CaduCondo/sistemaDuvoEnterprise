-- ============================================================================
-- Locação LEMOS APTO 06 (Jose Marcelio Alves Barroso) — recebimentos que
-- faltaram depois da renovação de contrato
--
-- Cole tudo no SQL Editor de PRODUÇÃO e clique em Run. Uma vez.
--
-- O QUE ACONTECEU: o corretor clicou em "Renovar Contrato" nessa locação.
-- A data fim foi para 19/07/2027 certinho, mas o sistema não criou os
-- recebimentos de aluguel dos meses novos (agosto/2026 até julho/2027) —
-- ver o ticket "Renovar Contrato não cria os recebimentos até a nova data
-- fim" no kanban/GitHub para a causa raiz e a correção no código.
--
-- É SEGURO:
--   - roda tudo numa transação só: se qualquer parte falhar, NADA é aplicado;
--   - só INSERE recebimento novo (nunca apaga, nunca muda valor de
--     recebimento existente — nem os 7 já pagos, nem os 6 pendentes antigos
--     de 2025, incluindo o de R$ 2.146,67 que já estava estranho antes disso
--     e não é assunto deste script);
--   - cada INSERT só roda se aquele mês ainda não existir para esta locação
--     (pode rodar de novo sem duplicar nada);
--   - no fim imprime um relatório com os 25 recebimentos de aluguel desta
--     locação, do mais antigo para o mais novo, para conferir visualmente.
--
-- O QUE ELE CRIA: 12 recebimentos de aluguel (parcelas 14 a 25), um por mês,
-- de agosto/2026 até julho/2027, todos vencendo dia 21 (mesmo dia dos outros
-- 13 já existentes), valor cheio de R$ 1.400,00 -- exceto o último (julho/
-- 2027), proporcional a 19 dias (o contrato termina dia 19), R$ 886,67,
-- seguindo a mesma regra que o sistema usa para o último mês de qualquer
-- contrato.
-- ============================================================================

BEGIN;

DO $rec$
DECLARE
  v_rental_id uuid := '0030620a-e8d2-47d7-baf7-8675eddfbc2f'; -- LEMOS APTO 06
BEGIN
  -- Confere que a locação é mesmo essa, antes de mexer em qualquer coisa.
  IF NOT EXISTS (
    SELECT 1 FROM rentals
     WHERE id = v_rental_id
       AND start_date = '2025-07-20'
       AND end_date   = '2027-07-19'
       AND rent_value  = 1400
  ) THEN
    RAISE EXCEPTION 'A locação % não bate com os dados esperados (start 20/07/2025, end 19/07/2027, aluguel R$1.400) — script cancelado por segurança. Confira antes de rodar de novo.', v_rental_id;
  END IF;

  -- 14: agosto/2026
  INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status, breakdown, installment, payment_kind)
  SELECT v_rental_id, '08', '2026', '2026-08-21', 1400.00, 'pending',
         '[{"description":"Aluguel","amount":1400,"type":"addition"}]'::jsonb, 14, 'rent'
   WHERE NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = v_rental_id AND reference_month = '08' AND reference_year = '2026');

  -- 15: setembro/2026
  INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status, breakdown, installment, payment_kind)
  SELECT v_rental_id, '09', '2026', '2026-09-21', 1400.00, 'pending',
         '[{"description":"Aluguel","amount":1400,"type":"addition"}]'::jsonb, 15, 'rent'
   WHERE NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = v_rental_id AND reference_month = '09' AND reference_year = '2026');

  -- 16: outubro/2026
  INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status, breakdown, installment, payment_kind)
  SELECT v_rental_id, '10', '2026', '2026-10-21', 1400.00, 'pending',
         '[{"description":"Aluguel","amount":1400,"type":"addition"}]'::jsonb, 16, 'rent'
   WHERE NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = v_rental_id AND reference_month = '10' AND reference_year = '2026');

  -- 17: novembro/2026
  INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status, breakdown, installment, payment_kind)
  SELECT v_rental_id, '11', '2026', '2026-11-21', 1400.00, 'pending',
         '[{"description":"Aluguel","amount":1400,"type":"addition"}]'::jsonb, 17, 'rent'
   WHERE NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = v_rental_id AND reference_month = '11' AND reference_year = '2026');

  -- 18: dezembro/2026
  INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status, breakdown, installment, payment_kind)
  SELECT v_rental_id, '12', '2026', '2026-12-21', 1400.00, 'pending',
         '[{"description":"Aluguel","amount":1400,"type":"addition"}]'::jsonb, 18, 'rent'
   WHERE NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = v_rental_id AND reference_month = '12' AND reference_year = '2026');

  -- 19: janeiro/2027
  INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status, breakdown, installment, payment_kind)
  SELECT v_rental_id, '01', '2027', '2027-01-21', 1400.00, 'pending',
         '[{"description":"Aluguel","amount":1400,"type":"addition"}]'::jsonb, 19, 'rent'
   WHERE NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = v_rental_id AND reference_month = '01' AND reference_year = '2027');

  -- 20: fevereiro/2027
  INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status, breakdown, installment, payment_kind)
  SELECT v_rental_id, '02', '2027', '2027-02-21', 1400.00, 'pending',
         '[{"description":"Aluguel","amount":1400,"type":"addition"}]'::jsonb, 20, 'rent'
   WHERE NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = v_rental_id AND reference_month = '02' AND reference_year = '2027');

  -- 21: março/2027
  INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status, breakdown, installment, payment_kind)
  SELECT v_rental_id, '03', '2027', '2027-03-21', 1400.00, 'pending',
         '[{"description":"Aluguel","amount":1400,"type":"addition"}]'::jsonb, 21, 'rent'
   WHERE NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = v_rental_id AND reference_month = '03' AND reference_year = '2027');

  -- 22: abril/2027
  INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status, breakdown, installment, payment_kind)
  SELECT v_rental_id, '04', '2027', '2027-04-21', 1400.00, 'pending',
         '[{"description":"Aluguel","amount":1400,"type":"addition"}]'::jsonb, 22, 'rent'
   WHERE NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = v_rental_id AND reference_month = '04' AND reference_year = '2027');

  -- 23: maio/2027
  INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status, breakdown, installment, payment_kind)
  SELECT v_rental_id, '05', '2027', '2027-05-21', 1400.00, 'pending',
         '[{"description":"Aluguel","amount":1400,"type":"addition"}]'::jsonb, 23, 'rent'
   WHERE NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = v_rental_id AND reference_month = '05' AND reference_year = '2027');

  -- 24: junho/2027
  INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status, breakdown, installment, payment_kind)
  SELECT v_rental_id, '06', '2027', '2027-06-21', 1400.00, 'pending',
         '[{"description":"Aluguel","amount":1400,"type":"addition"}]'::jsonb, 24, 'rent'
   WHERE NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = v_rental_id AND reference_month = '06' AND reference_year = '2027');

  -- 25: julho/2027 — ÚLTIMO recebimento do contrato, proporcional a 19 dias
  -- (o contrato termina dia 19/07/2027; vencimento continua no dia 21, que é
  -- o dia de pagamento normal desta locação — só o VALOR é proporcional).
  INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status, breakdown, installment, payment_kind)
  SELECT v_rental_id, '07', '2027', '2027-07-21', 886.67, 'pending',
         '[{"description":"Aluguel (19 dias)","amount":886.67,"type":"addition"}]'::jsonb, 25, 'rent'
   WHERE NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = v_rental_id AND reference_month = '07' AND reference_year = '2027');

  -- Atualiza "X de Y parcelas" em TODOS os recebimentos de aluguel desta
  -- locação (os 13 antigos e os 12 novos) para refletir o total certo: 25.
  UPDATE payments
     SET total_installments = 25
   WHERE rental_id = v_rental_id
     AND payment_kind = 'rent';
END
$rec$;

COMMIT;

-- ============================================================================
-- RELATÓRIO FINAL — confira: 25 linhas, parcela 1 a 25, sem buracos nem
-- repetição de mês, e o total de "esperado" pendente bate com 11 meses
-- cheios + 1 proporcional (11 × 1.400 + 886,67 = R$ 16.286,67)
-- ============================================================================
SELECT installment AS parcela,
       reference_month || '/' || reference_year AS competencia,
       due_date AS vencimento,
       status,
       expected_amount AS valor_esperado,
       total_installments AS total_parcelas
  FROM payments
 WHERE rental_id = '0030620a-e8d2-47d7-baf7-8675eddfbc2f'
   AND payment_kind = 'rent'
 ORDER BY installment;
