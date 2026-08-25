-- ============================================================================
-- Corrige unique_payment_per_rental_period_installment para o desmembre
-- aluguel x Recebimento de Rescisao (#49)
--
-- Essa constraint e de antes da #49, de quando so existia UM recebimento por
-- rental_id/reference_month/reference_year. Ela nao inclui payment_kind, entao
-- barra o segundo recebimento (Recebimento de Rescisao) no mesmo mes do
-- Recebimento de Aluguel -- ambos batem na mesma regra, mesmo sendo
-- registros diferentes (issue #49).
--
-- No banco ela existe como INDICE UNICO (nao como constraint de tabela) --
-- por isso "ALTER TABLE ... DROP CONSTRAINT" nao apaga: e preciso apagar
-- o indice diretamente.
--
-- Solucao: refazer o indice incluindo payment_kind. Continua impedindo
-- 2 recebimentos do MESMO tipo no mesmo rental/mes/ano, mas passa a permitir
-- exatamente 1 de aluguel + 1 de rescisao, que e o desenho da #49.
-- ============================================================================

drop index if exists public.unique_payment_per_rental_period_installment;

alter table public.payments
  drop constraint if exists unique_payment_per_rental_period_installment;

create unique index if not exists unique_payment_per_rental_period_installment
  on public.payments (rental_id, reference_month, reference_year, payment_kind);
