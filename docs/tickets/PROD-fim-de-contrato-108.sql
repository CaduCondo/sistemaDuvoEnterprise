-- ============================================================================
-- FIM DE CONTRATO (#108) — tudo o que precisa rodar em PRODUÇÃO, num arquivo só
--
-- COMO USAR (SQL Editor do Supabase de PRODUÇÃO):
--   1ª vez: cole tudo e clique em Run, SEM mudar nada. Ele só cria a coluna
--           nova (passo 1), corrige setembro do JD. COLOMBO APTO 10 (passo 2)
--           e mostra a lista do que FARIA em cada locação ativa — sem
--           alterar nenhum outro recebimento.
--   Confira a lista. Se estiver tudo certo:
--   2ª vez: troque  v_aplicar boolean := false  por  true  (linha marcada
--           com <<<<<), cole de novo e clique em Run. Agora ele aplica e
--           mostra a mesma lista, já como "feito".
--
-- ⚠️ ORDEM: rode este arquivo ANTES de dar o push do código novo. O código
-- novo grava a coluna `contract_end`, que só passa a existir com o passo 1.
-- (Rode também no banco de DEV, para os testes automáticos.)
--
-- O QUE FAZ, em cada locação ATIVA (inclusive as vencidas que ainda
-- aguardam renovar/rescindir) — sempre só em recebimento NÃO pago:
--   a) a última parcela regular (no dia de vencimento, até a data fim) que
--      a regra antiga deixava PROPORCIONAL volta para o valor CHEIO;
--   b) parcela regular pendente com vencimento DEPOIS da data fim é apagada
--      (pela regra antiga, quando a data fim caía antes do dia de vencimento,
--      a última parcela vencia depois do fim do contrato);
--   c) cria o PROPORCIONAL de fim de contrato, vencendo na data fim
--      (dias entre o último vencimento e a data fim, sem contar o dia do
--      vencimento) — se ainda não existir e se tiver pelo menos 1 dia;
--   d) cria o recebimento de FIM DE CONTRATO (devolução do caução + despesas
--      + desconto), vencendo na data fim, com R$ 0,00 — o valor do caução
--      corrigido é calculado pelo sistema na hora de mostrar.
--   Recebimentos PAGOS ou PARCIAIS nunca são tocados.
--
-- É SEGURO: tudo numa transação só; pode rodar de novo sem duplicar nada.
-- ============================================================================

BEGIN;

-- 1) Coluna nova (marca o proporcional final e o Fim de Contrato)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS contract_end boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.payments.contract_end IS
  'true = recebimento de fim de contrato (proporcional final ou Fim de Contrato/caução), vence na data fim da locação. Ver src/lib/contractEnd.ts';
CREATE INDEX IF NOT EXISTS payments_rental_contract_end_idx
  ON public.payments (rental_id) WHERE contract_end;

-- 2) Correção JD. COLOMBO APTO 10 (parcela de 05/09/2026 que foi parar em
--    05/10/2026). Se você já rodou o PROD-colombo-apto10-setembro.sql, este
--    trecho percebe e não faz nada.
UPDATE payments
   SET due_date = '2026-09-05', reference_month = '09', reference_year = '2026',
       expected_amount = 2800.00,
       breakdown = '[{"description":"Aluguel","amount":2800,"type":"addition"}]'::jsonb
 WHERE id = '5174e181-907b-40e4-8cb0-f076ff83db3a'
   AND rental_id = 'cd323405-8dfe-435d-9af3-40b12f1b18cf'
   AND status IN ('pending', 'overdue')
   AND due_date = '2026-10-05'
   AND NOT EXISTS (
     SELECT 1 FROM payments
      WHERE rental_id = 'cd323405-8dfe-435d-9af3-40b12f1b18cf'
        AND due_date BETWEEN '2026-09-01' AND '2026-09-30'
        AND COALESCE(payment_kind, 'rent') = 'rent');

-- 3) Plano + aplicação
CREATE TEMP TABLE plano_fim_contrato (
  locacao text, data_fim date, acao text, vencimento date, valor numeric, situacao text
);

DO $plano$
DECLARE
  v_aplicar boolean := false;   -- <<<<< troque para true na 2ª vez
  r record;
  p record;
  v_dia int; v_venc_mes date; v_ultimo_venc date; v_dias int;
  v_garagem numeric; v_cheio numeric; v_prop_alug numeric; v_prop_gar numeric;
  v_prox_parcela int; v_situacao text;
BEGIN
  v_situacao := CASE WHEN v_aplicar THEN 'feito' ELSE 'só simulação' END;

  FOR r IN
    SELECT re.id, re.end_date, re.rent_value, re.rent_due_day,
           COALESCE(re.has_garage, false) AS has_garage, COALESCE(re.garage_value, 0) AS garage_value,
           COALESCE(lo.name, '?') || ' ' || COALESCE(pr.complement, '') || ' — ' || COALESCE(te.name, '?') AS locacao
      FROM rentals re
      LEFT JOIN properties pr ON pr.id = re.property_id
      LEFT JOIN locations  lo ON lo.id = pr.location_id
      LEFT JOIN tenants    te ON te.id = re.tenant_id
     WHERE re.status = 'active'
       AND re.end_date IS NOT NULL
       AND re.rent_due_day IS NOT NULL
       AND COALESCE(re.rent_value, 0) > 0
     ORDER BY re.end_date
  LOOP
    v_dia := r.rent_due_day;
    v_garagem := CASE WHEN r.has_garage THEN r.garage_value ELSE 0 END;
    v_cheio := round(r.rent_value + v_garagem, 2);

    -- último vencimento regular até a data fim (dia 31 em mês curto vira o último dia)
    v_venc_mes := make_date(extract(year from r.end_date)::int, extract(month from r.end_date)::int,
                    least(v_dia, extract(day from (date_trunc('month', r.end_date) + interval '1 month - 1 day'))::int));
    IF v_venc_mes <= r.end_date THEN
      v_ultimo_venc := v_venc_mes;
    ELSE
      v_ultimo_venc := make_date(extract(year from (r.end_date - interval '1 month'))::int,
                         extract(month from (r.end_date - interval '1 month'))::int,
                         least(v_dia, extract(day from (date_trunc('month', r.end_date - interval '1 month') + interval '1 month - 1 day'))::int));
    END IF;
    v_dias := r.end_date - v_ultimo_venc;

    -- a) última parcela regular proporcional -> cheia
    FOR p IN
      SELECT id, due_date, expected_amount FROM payments
       WHERE rental_id = r.id AND COALESCE(payment_kind, 'rent') = 'rent' AND NOT contract_end
         AND status IN ('pending', 'overdue') AND COALESCE(installment, 0) <> 1
         AND due_date = v_ultimo_venc AND expected_amount < v_cheio - 0.01
    LOOP
      INSERT INTO plano_fim_contrato VALUES (r.locacao, r.end_date,
        'parcela regular proporcional -> valor cheio (era R$ ' || p.expected_amount || ')', p.due_date, v_cheio, v_situacao);
      IF v_aplicar THEN
        UPDATE payments SET expected_amount = v_cheio,
               breakdown = CASE WHEN v_garagem > 0
                 THEN jsonb_build_array(jsonb_build_object('description','Aluguel','amount',r.rent_value,'type','addition'),
                                        jsonb_build_object('description','Garagem','amount',v_garagem,'type','addition'))
                 ELSE jsonb_build_array(jsonb_build_object('description','Aluguel','amount',r.rent_value,'type','addition')) END
         WHERE id = p.id;
      END IF;
    END LOOP;

    -- b) parcela regular pendente vencendo depois da data fim -> apaga
    FOR p IN
      SELECT id, due_date, expected_amount FROM payments
       WHERE rental_id = r.id AND COALESCE(payment_kind, 'rent') = 'rent' AND NOT contract_end
         AND status IN ('pending', 'overdue') AND due_date > r.end_date
    LOOP
      INSERT INTO plano_fim_contrato VALUES (r.locacao, r.end_date,
        'APAGAR parcela pendente depois da data fim', p.due_date, p.expected_amount, v_situacao);
      IF v_aplicar THEN DELETE FROM payments WHERE id = p.id; END IF;
    END LOOP;

    -- c) proporcional de fim de contrato
    IF v_dias > 0 AND NOT EXISTS (
         SELECT 1 FROM payments WHERE rental_id = r.id AND contract_end AND COALESCE(payment_kind, 'rent') = 'rent') THEN
      v_prop_alug := round(r.rent_value / 30.0 * v_dias, 2);
      v_prop_gar  := round(v_garagem / 30.0 * v_dias, 2);
      INSERT INTO plano_fim_contrato VALUES (r.locacao, r.end_date,
        'criar proporcional de ' || v_dias || ' dia(s)', r.end_date, v_prop_alug + v_prop_gar, v_situacao);
      IF v_aplicar THEN
        SELECT COALESCE(max(installment), 0) + 1 INTO v_prox_parcela FROM payments
         WHERE rental_id = r.id AND COALESCE(payment_kind, 'rent') = 'rent';
        INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status,
                              breakdown, installment, payment_kind, contract_end)
        VALUES (r.id, to_char(r.end_date, 'MM'), to_char(r.end_date, 'YYYY'), r.end_date, v_prop_alug + v_prop_gar, 'pending',
                CASE WHEN v_prop_gar > 0
                  THEN jsonb_build_array(
                    jsonb_build_object('description','Aluguel - Proporcional Fim de Contrato (' || v_dias || ' dias)','amount',v_prop_alug,'type','addition'),
                    jsonb_build_object('description','Garagem - Proporcional Fim de Contrato (' || v_dias || ' dias)','amount',v_prop_gar,'type','addition'))
                  ELSE jsonb_build_array(
                    jsonb_build_object('description','Aluguel - Proporcional Fim de Contrato (' || v_dias || ' dias)','amount',v_prop_alug,'type','addition')) END,
                v_prox_parcela, 'rent', true);
      END IF;
    END IF;

    -- d) recebimento de Fim de Contrato
    IF NOT EXISTS (SELECT 1 FROM payments WHERE rental_id = r.id AND payment_kind = 'termination') THEN
      INSERT INTO plano_fim_contrato VALUES (r.locacao, r.end_date,
        'criar Fim de Contrato (caução calculado na tela)', r.end_date, 0, v_situacao);
      IF v_aplicar THEN
        INSERT INTO payments (rental_id, reference_month, reference_year, due_date, expected_amount, status,
                              breakdown, payment_kind, contract_end,
                              termination_corrected_deposit, termination_additional_expenses, termination_discount, notes)
        VALUES (r.id, to_char(r.end_date, 'MM'), to_char(r.end_date, 'YYYY'), r.end_date, 0, 'pending',
                '[{"description":"Caução Corrigido p/ Devolução","amount":0,"type":"deduction"}]'::jsonb,
                'termination', true, 0, 0, 0,
                'Recebimento de Fim de Contrato - Data fim: ' || to_char(r.end_date, 'YYYY-MM-DD') ||
                '. Devolução de caução, despesas adicionais e desconto. Não entra na base das taxas de administração e gerenciamento.');
        -- trava contra o trigger antigo que marcava 0 = 0 como pago
        UPDATE payments SET status = 'pending'
         WHERE rental_id = r.id AND payment_kind = 'termination' AND contract_end AND status <> 'pending'
           AND COALESCE(paid_amount, 0) = 0;
      END IF;
    END IF;

    -- total de parcelas (só aluguel)
    IF v_aplicar THEN
      UPDATE payments SET total_installments = (
               SELECT count(*) FROM payments WHERE rental_id = r.id AND COALESCE(payment_kind, 'rent') = 'rent')
       WHERE rental_id = r.id AND COALESCE(payment_kind, 'rent') = 'rent';
    END IF;
  END LOOP;
END
$plano$;

COMMIT;

-- 4) Resultado: o que foi (ou seria) feito, locação por locação
SELECT locacao, to_char(data_fim, 'DD/MM/YYYY') AS data_fim, acao,
       to_char(vencimento, 'DD/MM/YYYY') AS vencimento, valor, situacao
  FROM plano_fim_contrato
 ORDER BY data_fim, locacao, vencimento;
