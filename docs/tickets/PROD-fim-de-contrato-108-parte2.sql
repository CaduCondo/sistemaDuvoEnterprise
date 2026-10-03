-- ============================================================================
-- FIM DE CONTRATO (#108) — PARTE 2: parcela regular do último mês que faltava
--
-- Cole tudo no SQL Editor de PRODUÇÃO e clique em Run. Uma vez.
--
-- O QUE A AUDITORIA DE 03/out/2026 ACHOU: das 100 locações ativas, 96 estão
-- 100% certas. Em 4 delas (dados antigos), a parcela REGULAR do último mês
-- nunca existiu — o contrato ia direto da penúltima parcela para o
-- proporcional de fim de contrato:
--   SIGNORE APTO 24 (Richardson)   — falta 05/12/2027
--   SIGNORE APTO 11 (Henry)        — falta 25/10/2027
--   LEMOS APTO 20 (Paulo Henrique) — falta 08/01/2028
--   LEMOS APTO 19 (Tamires)        — falta 10/01/2028
--
-- O QUE FAZ: cria essa parcela (valor cheio, pendente), renumera as parcelas
-- que vêm depois dela (+1) e atualiza o total de parcelas. Só nessas locações.
--
-- É SEGURO: transação única; se não achar exatamente essas 4 locações, cancela
-- tudo sem mudar nada; rodar de novo não duplica (na 2ª vez acha 0 e cancela).
-- ============================================================================

BEGIN;

CREATE TEMP TABLE fix_ultimo AS
WITH r AS (
  SELECT re.id, re.end_date, re.rent_due_day d, re.rent_value rv,
         CASE WHEN COALESCE(re.has_garage, false) THEN COALESCE(re.garage_value, 0) ELSE 0 END gar
    FROM rentals re
   WHERE re.status = 'active' AND re.end_date IS NOT NULL AND re.rent_due_day IS NOT NULL
), c AS (
  SELECT r.*,
    CASE WHEN make_date(extract(year from end_date)::int, extract(month from end_date)::int,
                least(d, extract(day from date_trunc('month', end_date) + interval '1 month - 1 day')::int)) <= end_date
      THEN make_date(extract(year from end_date)::int, extract(month from end_date)::int,
                least(d, extract(day from date_trunc('month', end_date) + interval '1 month - 1 day')::int))
      ELSE make_date(extract(year from end_date - interval '1 month')::int, extract(month from end_date - interval '1 month')::int,
                least(d, extract(day from date_trunc('month', end_date - interval '1 month') + interval '1 month - 1 day')::int))
    END ultimo
  FROM r
)
SELECT c.* FROM c
 WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.rental_id = c.id AND COALESCE(p.payment_kind, 'rent') = 'rent'
                     AND NOT p.contract_end AND date_trunc('month', p.due_date) = date_trunc('month', c.ultimo))
   AND EXISTS (SELECT 1 FROM payments p WHERE p.rental_id = c.id AND COALESCE(p.payment_kind, 'rent') = 'rent'
                     AND NOT p.contract_end AND date_trunc('month', p.due_date) = date_trunc('month', c.ultimo - interval '1 month'));

DO $$
BEGIN
  IF (SELECT count(*) FROM fix_ultimo) <> 4 THEN
    RAISE EXCEPTION 'Esperava 4 locações, achou %. Nada foi alterado.', (SELECT count(*) FROM fix_ultimo);
  END IF;
END $$;

-- abre espaço na numeração
UPDATE payments p SET installment = p.installment + 1
  FROM fix_ultimo f
 WHERE p.rental_id = f.id AND COALESCE(p.payment_kind, 'rent') = 'rent' AND p.due_date > f.ultimo;

-- cria a parcela que faltava
INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status,
                      breakdown, installment, payment_kind, contract_end)
SELECT f.id, to_char(f.ultimo, 'MM'), to_char(f.ultimo, 'YYYY'), f.ultimo, f.rv + f.gar, 'pending',
       CASE WHEN f.gar > 0
         THEN jsonb_build_array(jsonb_build_object('description','Aluguel','amount',f.rv,'type','addition'),
                                jsonb_build_object('description','Garagem','amount',f.gar,'type','addition'))
         ELSE jsonb_build_array(jsonb_build_object('description','Aluguel','amount',f.rv,'type','addition')) END,
       (SELECT max(installment) FROM payments p WHERE p.rental_id = f.id
          AND COALESCE(p.payment_kind, 'rent') = 'rent' AND p.due_date < f.ultimo) + 1,
       'rent', false
  FROM fix_ultimo f;

-- total de parcelas
UPDATE payments p SET total_installments = (
         SELECT count(*) FROM payments q WHERE q.rental_id = p.rental_id AND COALESCE(q.payment_kind, 'rent') = 'rent')
 WHERE p.rental_id IN (SELECT id FROM fix_ultimo) AND COALESCE(p.payment_kind, 'rent') = 'rent';

COMMIT;

-- Conferência: as 4 parcelas criadas
SELECT te.name AS inquilino, to_char(f.ultimo, 'DD/MM/YYYY') AS vencimento_criado, f.rv + f.gar AS valor
  FROM fix_ultimo f JOIN rentals re ON re.id = f.id JOIN tenants te ON te.id = re.tenant_id
 ORDER BY f.ultimo;
