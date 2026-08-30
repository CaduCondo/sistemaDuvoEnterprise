-- ============================================================================
-- Horário do recebimento nas parcelas de caução
--
-- A tela "Registrar Recebimento de Caução" não tinha o campo "Horário do
-- Recebimento", que existe nas outras três telas de recebimento (aluguel,
-- rescisão) desde a migration 20260213044047. A coluna simplesmente nunca
-- foi criada nesta tabela.
--
-- Mesmo tipo e mesmo formato de `payments.payment_time`: TEXT, "HH:MM:SS".
-- Registros antigos ficam NULL, e a tela mostra o campo vazio.
--
-- Seguro: só acrescenta coluna, não altera nem apaga nada.
-- ============================================================================

ALTER TABLE public.deposit_installments
  ADD COLUMN IF NOT EXISTS payment_time TEXT;

COMMENT ON COLUMN public.deposit_installments.payment_time IS
  'Horario do recebimento da parcela de caucao, formato HH:MM:SS. Espelha payments.payment_time.';

-- Relatório
SELECT 'coluna payment_time em deposit_installments' AS etapa,
       CASE WHEN EXISTS (
              SELECT 1 FROM information_schema.columns
               WHERE table_name = 'deposit_installments'
                 AND column_name = 'payment_time')
            THEN 'OK' ELSE 'FALTOU' END AS resultado;
