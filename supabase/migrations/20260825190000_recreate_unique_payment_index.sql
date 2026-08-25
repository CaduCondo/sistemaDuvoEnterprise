-- ============================================================================
-- PASSO 2 do conserto da regra unica de recebimentos (#49)
--
-- Recria unique_payment_per_rental_period_installment, agora incluindo
-- payment_kind: continua impedindo dois recebimentos do MESMO tipo no mesmo
-- rental/mes/ano, mas passa a permitir exatamente 1 de aluguel + 1 de
-- rescisao, que e o desenho da #49.
--
-- ⚠️ SO RODA depois que as duplicatas antigas forem resolvidas. Para ver
-- quais sao: docs/sql/diagnostico-recebimentos-duplicados.sql
--
-- Se este arquivo falhar com
--   "23505: could not create unique index ... Key (...) is duplicated"
-- ainda ha duplicata. Rode o diagnostico e resolva antes.
-- ============================================================================

create unique index if not exists unique_payment_per_rental_period_installment
  on public.payments (rental_id, reference_month, reference_year, payment_kind);
