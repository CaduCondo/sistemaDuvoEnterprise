-- ============================================================================
-- Conserta os Recebimentos de Rescisão já gravados errado (#49)
--
-- Dois defeitos de código, os dois já corrigidos, deixaram dado ruim para trás:
--
-- 1. SINAL PERDIDO. O auto-save gravava `expected_amount: Math.abs(total)`.
--    Uma devolução de R$ 5.833,33 (dinheiro que a imobiliária PAGA ao
--    inquilino) virava +5.833,33 no banco -- uma cobrança. A lista mostrava
--    um valor e o recebimento aberto mostrava outro, com sinal trocado.
--
-- 2. COLUNAS termination_* ZERADAS. Elas só recebiam valor na criação da
--    rescisão, quando ainda são todas zero. Despesas Adicionais e Desconto
--    digitados depois nunca chegavam nelas -- e são elas que alimentam as
--    quatro colunas do Detalhamento de Cauções, que ficava zerado.
--
-- COMO A CORREÇÃO RECONSTRÓI OS VALORES
--
-- Nada é chutado: tudo sai do que já está gravado no próprio recebimento.
--   - a devolução vem da linha do breakdown cuja descrição fala de devolução
--     de caução (dois rótulos ao longo do tempo: "Devolução de Caução" e,
--     a partir da #49, "Valor Devolução Caução" -- o LIKE cobre os dois);
--   - as despesas vêm da linha de Despesas Adicionais do breakdown
--     (também com dois rótulos: com e sem asterisco no fim);
--   - o desconto vem de discount_amount, que sempre foi gravado certo;
--   - o total é a soma das linhas menos o desconto, com o sinal preservado.
--
-- É a mesma conta de montarRecebimentoRescisao() em src/lib/rentalCalculations.ts.
--
-- Mexe SOMENTE em payment_kind = 'termination'. Recebimentos de aluguel não
-- são tocados.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ANTES: o que está errado hoje
-- ----------------------------------------------------------------------------
SELECT
  'ANTES' AS momento,
  COUNT(*) FILTER (WHERE expected_amount > 0)                       AS com_sinal_invertido,
  COUNT(*) FILTER (WHERE COALESCE(termination_corrected_deposit,0) = 0
                     AND breakdown::text ILIKE '%devolu%')          AS devolucao_zerada,
  COUNT(*) FILTER (WHERE COALESCE(termination_additional_expenses,0) = 0
                     AND breakdown::text ILIKE '%despesas%')        AS despesas_zeradas,
  COUNT(*) FILTER (WHERE COALESCE(termination_discount,0) = 0
                     AND COALESCE(discount_amount,0) > 0)           AS desconto_zerado,
  COUNT(*)                                                          AS total_de_rescisoes
FROM public.payments
WHERE payment_kind = 'termination';

-- ----------------------------------------------------------------------------
-- A CORREÇÃO
-- ----------------------------------------------------------------------------
WITH linhas AS (
  SELECT
    p.id,
    COALESCE(p.discount_amount, 0) AS desconto,
    -- Devolução do caução: a linha do breakdown que fala de devolução/caução.
    COALESCE((
      SELECT ABS((item->>'amount')::numeric)
        FROM jsonb_array_elements(
               CASE jsonb_typeof(p.breakdown)
                 WHEN 'array' THEN p.breakdown
                 ELSE '[]'::jsonb
               END
             ) AS item
       WHERE item->>'description' ILIKE '%devolu%cau%'
       LIMIT 1
    ), 0) AS devolucao,
    -- Despesas adicionais: idem, na linha de despesas.
    COALESCE((
      SELECT ABS((item->>'amount')::numeric)
        FROM jsonb_array_elements(
               CASE jsonb_typeof(p.breakdown)
                 WHEN 'array' THEN p.breakdown
                 ELSE '[]'::jsonb
               END
             ) AS item
       WHERE item->>'description' ILIKE '%despesas%'
       LIMIT 1
    ), 0) AS despesas
  FROM public.payments p
  WHERE p.payment_kind = 'termination'
)
UPDATE public.payments p
   SET termination_corrected_deposit   = -l.devolucao,
       termination_additional_expenses =  l.despesas,
       termination_discount            = CASE WHEN l.desconto = 0
                                              THEN 0
                                              ELSE -ABS(l.desconto)
                                         END,
       -- Sinal PRESERVADO: negativo = a imobiliária devolve dinheiro.
       expected_amount                 = ROUND(
                                           (-l.devolucao + l.despesas - ABS(l.desconto))::numeric,
                                           2
                                         ),
       updated_at                      = NOW()
  FROM linhas l
 WHERE p.id = l.id;

-- ----------------------------------------------------------------------------
-- DEPOIS: confira que o total bate com as três colunas em toda linha
-- ----------------------------------------------------------------------------
SELECT
  p.id,
  r.id                                AS locacao,
  p.reference_month || '/' || p.reference_year AS periodo,
  p.termination_corrected_deposit     AS devolucao,
  p.termination_additional_expenses   AS despesas,
  p.termination_discount              AS desconto,
  p.expected_amount                   AS total,
  CASE
    WHEN ROUND((COALESCE(p.termination_corrected_deposit,0)
              + COALESCE(p.termination_additional_expenses,0)
              + COALESCE(p.termination_discount,0))::numeric, 2)
       = ROUND(p.expected_amount::numeric, 2)
    THEN 'ok'
    ELSE 'CONFERIR'
  END AS bate
FROM public.payments p
LEFT JOIN public.rentals r ON r.id = p.rental_id
WHERE p.payment_kind = 'termination'
ORDER BY p.reference_year DESC, p.reference_month DESC;
