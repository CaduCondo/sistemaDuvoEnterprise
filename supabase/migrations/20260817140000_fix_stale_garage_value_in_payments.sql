-- ============================================================================
-- CORREÇÃO DE DADOS: recebimentos (pending/overdue) com valor de
-- Aluguel+Garagem desatualizado em relação ao valor atual da locação.
--
-- Causa raiz (já corrigida no código nesta mesma leva de mudanças): ao editar
-- o valor da garagem (ou do aluguel) de uma locação, o sistema tentava
-- atualizar automaticamente os recebimentos futuros ainda não pagos, mas só
-- olhava para status = 'pending' — recebimentos já com status 'overdue'
-- (atrasado, mas ainda não pago) ficavam de fora e continuavam com o valor
-- antigo para sempre. Este script corrige os dados que ficaram
-- desatualizados ANTES dessa correção.
--
-- SEGURANÇA:
-- - Só mexe em recebimentos com status 'pending' ou 'overdue' (nunca em
--   'paid' ou 'partial' — esses são histórico e não devem mudar).
-- - Só mexe em parcelas "cheias" (não proporcionais). Parcelas proporcionais
--   têm "(X dias)" na descrição do breakdown e não são tocadas aqui.
-- ============================================================================

UPDATE payments p
SET
  expected_amount = r.rent_value + COALESCE(r.garage_value, 0) * (CASE WHEN r.has_garage THEN 1 ELSE 0 END),
  breakdown = (
    CASE WHEN r.has_garage AND COALESCE(r.garage_value, 0) > 0 THEN
      jsonb_build_array(
        jsonb_build_object('description', 'Aluguel', 'amount', r.rent_value, 'type', 'addition'),
        jsonb_build_object('description', 'Garagem', 'amount', r.garage_value, 'type', 'addition')
      )
    ELSE
      jsonb_build_array(
        jsonb_build_object('description', 'Aluguel', 'amount', r.rent_value, 'type', 'addition')
      )
    END
  ),
  updated_at = now()
FROM rentals r
WHERE r.id = p.rental_id
  AND p.status IN ('pending', 'overdue')
  AND NOT (p.breakdown::text ILIKE '%dias%')
  AND ABS(
    r.rent_value + COALESCE(r.garage_value, 0) * (CASE WHEN r.has_garage THEN 1 ELSE 0 END) - p.expected_amount
  ) > 0.01;
