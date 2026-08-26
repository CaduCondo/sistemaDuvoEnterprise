-- ============================================================================
-- Parcelas de caucao marcadas como pagas estao com paid_amount = 0
--
-- CAUSA: markDepositInstallmentAsPaid() (src/services/depositInstallmentService.ts)
-- gravava status='paid', payment_date e payment_method, mas nunca paid_amount
-- -- que ficava no default 0 da coluna. Corrigido no codigo em 26/ago/2026.
--
-- Ninguem notava porque as telas de caucao exibem `amount` (o valor da
-- parcela), e nao `paid_amount`. O problema so apareceu na rescisao: a
-- devolucao do caucao incide sobre o que foi EFETIVAMENTE PAGO (decisao 4 do
-- ticket), somando paid_amount -- e dava 0,00 em todo contrato, como se nunca
-- houvesse o que devolver a ninguem.
--
-- Esta migration acerta o passado: para toda parcela marcada como PAGA cujo
-- paid_amount ficou zerado, o valor pago e o valor da parcela.
--
-- Nao toca em parcelas 'partial': ali o paid_amount sempre foi gravado
-- corretamente (caminho de pagamento parcial) e vale o que esta nele.
-- ============================================================================

UPDATE public.deposit_installments
   SET paid_amount = amount,
       updated_at  = NOW()
 WHERE status = 'paid'
   AND COALESCE(paid_amount, 0) = 0
   AND amount > 0;

-- Conferencia: deve voltar vazio depois do UPDATE acima.
SELECT id, rental_id, installment_number, amount, paid_amount, status
  FROM public.deposit_installments
 WHERE status = 'paid'
   AND COALESCE(paid_amount, 0) = 0;
