-- ✅ Recebimentos de caução passam a ter histórico de pagamentos parciais e
-- recibo por pagamento, igual já funciona nos recebimentos de aluguel
-- (coluna `partial_payments` da tabela `payments`). Idempotente (seguro
-- rodar mais de uma vez).
ALTER TABLE deposit_installments
  ADD COLUMN IF NOT EXISTS partial_payments jsonb DEFAULT '[]'::jsonb;
