-- ============================================================================
-- CORREÇÃO DE DADO: 1ª parcela (Junho/2026) da locação de Diego Aparecido de
-- Almeida Pires no imóvel ACÁCIAS / APTO 22 está cobrando o mês cheio
-- (R$ 2.500,00) quando deveria ser proporcional a 2 dias (18/06 a 20/06/2026,
-- já que o Dia de Vencimento do contrato é dia 20).
--
-- Causa raiz (bug de código, corrigido separadamente em
-- src/services/rentalUpdateService.ts): quando a data de início da locação é
-- editada DEPOIS que já existe uma parcela criada para aquele mês, a rotina
-- que resincroniza as parcelas (syncPaymentsOnDateChange) atualiza vencimento
-- e outros dados, mas nunca recalcula o VALOR da parcela já existente — ela
-- fica "presa" no valor de mês cheio. Isso é o mesmo tipo de bug já visto e
-- corrigido antes nesta tabela (ver 20260817140000_fix_stale_garage_value_in_payments.sql,
-- 20260715180400_fix_historical_payment_values.sql).
--
-- Valor correto: R$ 2.500,00 / 30 dias * 2 dias = R$ 166,67 (mesma fórmula de
-- calculateFirstInstallment / buildFirstInstallmentBreakdown em
-- src/services/paymentService.ts, fonte única de verdade do sistema).
--
-- SEGURANÇA: a condição abaixo só pode acertar UM registro — é filtrada por
-- inquilino (CPF), imóvel (complemento APTO 22), mês/ano de referência
-- (Junho/2026), parcela 1, status 'pending' e o valor atual errado
-- (2500.00). Se por qualquer motivo mais de uma linha bater ou nenhuma
-- bater, o UPDATE não faz nada de errado: RAISE EXCEPTION interrompe antes
-- de aplicar.
--
-- (v2, 21/ago/2026: confirmado por consulta de diagnóstico que
-- reference_month é gravado como "06", não "6" — e que o campo
-- property_identifier deste imóvel é "Apartamento", não "ACÁCIAS"
-- [ACÁCIAS é o nome do local/prédio, guardado em outra tabela] — por isso
-- a v1 desta migration não encontrou o registro e abortou com segurança,
-- sem alterar nada. Ajustado para usar reference_month = '06' e remover o
-- filtro por property_identifier, mantendo CPF + complemento como
-- suficientes para identificar o registro com segurança.)
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM payments p
  JOIN rentals r ON r.id = p.rental_id
  JOIN properties prop ON prop.id = r.property_id
  JOIN tenants t ON t.id = r.tenant_id
  WHERE t.cpf = '430.392.488-12'
    AND prop.complement = 'APTO 22'
    AND p.reference_month = '06'
    AND p.reference_year = '2026'
    AND p.installment = 1
    AND p.status = 'pending'
    AND p.expected_amount = 2500.00;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Esperado encontrar exatamente 1 parcela para corrigir, encontrado %. Abortando sem alterar nada — confira os dados manualmente antes de rodar de novo.', v_count;
  END IF;

  UPDATE payments p
  SET
    expected_amount = 166.67,
    breakdown = jsonb_build_array(
      jsonb_build_object('description', 'Aluguel - Proporcional de 2 dia(s)', 'amount', 166.67, 'type', 'addition')
    ),
    updated_at = now()
  FROM rentals r, properties prop, tenants t
  WHERE r.id = p.rental_id
    AND prop.id = r.property_id
    AND t.id = r.tenant_id
    AND t.cpf = '430.392.488-12'
    AND prop.complement = 'APTO 22'
    AND p.reference_month = '06'
    AND p.reference_year = '2026'
    AND p.installment = 1
    AND p.status = 'pending'
    AND p.expected_amount = 2500.00;

  RAISE NOTICE '✅ Parcela de Diego Aparecido (ACÁCIAS APTO 22, Junho/2026) corrigida para R$ 166,67.';
END $$;

-- Conferir o resultado
SELECT p.id, p.reference_month, p.reference_year, p.installment, p.status,
       p.expected_amount, p.breakdown, p.due_date
FROM payments p
JOIN rentals r ON r.id = p.rental_id
JOIN properties prop ON prop.id = r.property_id
JOIN tenants t ON t.id = r.tenant_id
WHERE t.cpf = '430.392.488-12'
  AND prop.complement = 'APTO 22'
  AND p.reference_month = '06'
  AND p.reference_year = '2026';
