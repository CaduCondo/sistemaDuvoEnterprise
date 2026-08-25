-- ============================================================================
-- Corrige unique_payment_per_rental_period_installment para o desmembre
-- aluguel x Recebimento de Rescisao (#49)
--
-- A regra e de antes da #49, de quando so existia UM recebimento por
-- rental_id/reference_month/reference_year. Ela nao inclui payment_kind, entao
-- barrava o segundo recebimento (Recebimento de Rescisao) no mesmo mes do
-- Recebimento de Aluguel -- os dois batiam na mesma regra, mesmo sendo
-- registros diferentes.
--
-- No banco ela existe como INDICE UNICO (nao como constraint de tabela) --
-- por isso "ALTER TABLE ... DROP CONSTRAINT" nao apaga: e preciso apagar
-- o indice diretamente.
--
-- PASSO 1 (rodar agora): apaga a regra antiga. Isso ja destrava a rescisao.
-- PASSO 2 (rodar DEPOIS de limpar as duplicatas antigas): recria a regra
--         incluindo payment_kind. Ver a segunda migration
--         (20260825190000_recreate_unique_payment_index.sql) e o passo de
--         limpeza que ela exige.
--
-- ⚠️ O PASSO 2 NAO roda enquanto houver dois recebimentos de ALUGUEL no mesmo
-- rental/mes/ano. Essas duplicatas sao das rescisoes ANTIGAS, feitas antes do
-- commit 1388dfaf, quando a rescisao criava dois recebimentos de aluguel (mes
-- cheio + proporcional) em vez de um so. Precisam ser fundidas em um antes.
-- ============================================================================

drop index if exists public.unique_payment_per_rental_period_installment;

alter table public.payments
  drop constraint if exists unique_payment_per_rental_period_installment;
