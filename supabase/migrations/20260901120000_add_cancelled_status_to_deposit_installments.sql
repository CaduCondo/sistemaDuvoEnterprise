-- Permite o status 'cancelled' em deposit_installments.
--
-- Motivo (01/set/2026): ao confirmar uma rescisão de contrato com o aviso de
-- que existem parcelas de caução pendentes/parciais, o sistema passou a
-- cancelar automaticamente essas parcelas (nunca pagas, nunca serão
-- cobradas). O CHECK constraint original só permitia
-- 'pending' | 'paid' | 'partial' | 'overdue' -- ver
-- 20260717204700_create_deposit_installments.sql.
--
-- Ver e2e/features (cenário de rescisão com caução pendente) e
-- src/services/terminationService.ts.

ALTER TABLE deposit_installments
  DROP CONSTRAINT IF EXISTS deposit_installments_status_check;

ALTER TABLE deposit_installments
  ADD CONSTRAINT deposit_installments_status_check
  CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'cancelled'));

COMMENT ON COLUMN deposit_installments.status IS 'Status: pending, paid, partial, overdue, cancelled (cancelada automaticamente na rescisão do contrato, quando nunca foi paga)';
