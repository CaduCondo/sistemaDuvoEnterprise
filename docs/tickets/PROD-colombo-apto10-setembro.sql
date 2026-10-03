-- ============================================================================
-- Locação JD. COLOMBO APTO 10 (Kácio Willian C. Barbosa)
-- Devolve o recebimento de SETEMBRO/2026 que sumiu depois da renovação
--
-- Cole tudo no SQL Editor de PRODUÇÃO e clique em Run. Uma vez.
--
-- O QUE ACONTECEU: ao renovar o contrato (fim 29/09/2026 -> 29/09/2027), a
-- parcela 12 (que é a de setembro/2026, vencimento 05/09, valor cheio
-- R$ 2.800,00) ficou com vencimento 05/10/2026. Resultado: setembro ficou
-- sem nenhum recebimento e outubro ficou com dois (12/24 e 13/24).
--
-- O QUE ESTE SCRIPT FAZ: só move a parcela 12 de volta para setembro
-- (vencimento 05/09/2026, referência 09/2026), valor cheio R$ 2.800,00.
-- A parcela 13 continua sendo a de outubro. Nada é apagado.
--
-- É SEGURO:
--   - roda numa transação só: se qualquer conferência falhar, NADA muda;
--   - só mexe em UM recebimento, identificado pelo id, e só se ele ainda
--     estiver pendente, com vencimento 05/10/2026 (do jeito que está hoje);
--   - pode rodar de novo sem estragar nada (na 2ª vez ele avisa e não muda).
--   - no fim mostra todos os recebimentos desta locação para conferir.
-- ============================================================================

BEGIN;

-- 1) FOTO DE ANTES (o SQL Editor só mostra o resultado da última consulta;
--    esta fica aqui só para quem quiser rodar este trecho sozinho antes)
SELECT 'ANTES' AS momento, id, installment, reference_month, reference_year,
       due_date, expected_amount, status, payment_kind, notes, breakdown
  FROM payments
 WHERE rental_id = 'cd323405-8dfe-435d-9af3-40b12f1b18cf'
   AND due_date BETWEEN '2026-08-01' AND '2026-10-31'
 ORDER BY due_date, installment;

-- 2) CORREÇÃO
DO $fix$
DECLARE
  v_rental_id  uuid := 'cd323405-8dfe-435d-9af3-40b12f1b18cf'; -- JD. COLOMBO APTO 10
  v_payment_id uuid := '5174e181-907b-40e4-8cb0-f076ff83db3a'; -- parcela 12
  v_linhas int;
BEGIN
  -- Confere que a locação é mesmo essa
  IF NOT EXISTS (
    SELECT 1 FROM rentals
     WHERE id = v_rental_id
       AND start_date = '2025-09-30'
       AND end_date   = '2027-09-29'
       AND rent_due_day = 5
  ) THEN
    RAISE EXCEPTION 'A locação não bate com os dados esperados (início 30/09/2025, fim 29/09/2027, vencimento dia 5). Script cancelado, nada foi alterado.';
  END IF;

  -- Se setembro/2026 já tiver um recebimento de aluguel, não faz nada
  IF EXISTS (
    SELECT 1 FROM payments
     WHERE rental_id = v_rental_id
       AND due_date BETWEEN '2026-09-01' AND '2026-09-30'
       AND COALESCE(payment_kind, 'rent') = 'rent'
  ) THEN
    RAISE NOTICE 'Setembro/2026 já tem recebimento de aluguel. Nada foi alterado.';
    RETURN;
  END IF;

  UPDATE payments
     SET due_date        = '2026-09-05',
         reference_month = '09',
         reference_year  = '2026',
         expected_amount = 2800.00,
         breakdown       = '[{"description":"Aluguel","amount":2800,"type":"addition"}]'::jsonb
   WHERE id = v_payment_id
     AND rental_id = v_rental_id
     AND status IN ('pending', 'overdue')
     AND due_date = '2026-10-05';

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas <> 1 THEN
    RAISE EXCEPTION 'Esperava corrigir 1 recebimento, corrigiria %. Script cancelado, nada foi alterado.', v_linhas;
  END IF;

  RAISE NOTICE 'OK: parcela 12 voltou para setembro/2026 (vencimento 05/09/2026, R$ 2.800,00).';
END
$fix$;

COMMIT;

-- 3) CONFERÊNCIA: todos os recebimentos de aluguel da locação, do mais antigo ao mais novo
SELECT installment AS parcela, reference_month || '/' || reference_year AS referencia,
       to_char(due_date, 'DD/MM/YYYY') AS vencimento, expected_amount AS valor, status
  FROM payments
 WHERE rental_id = 'cd323405-8dfe-435d-9af3-40b12f1b18cf'
 ORDER BY due_date, installment;
