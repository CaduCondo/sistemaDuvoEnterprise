-- Correção em PRODUÇÃO — LEMOS APTO 22 (14/nov/2026)
-- Rodada em 14/nov/2026, resultado "OK" (as conferências do final passaram).
--
-- O que aconteceu: a rescisão foi feita e a data trocada 2 vezes. O sistema não
-- reconhecia a rescisão anterior e criou 3 Recebimentos de Rescisão (09/11, 13/11
-- e 14/11, todos de -3.271,20) e 2 parcelas de aluguel fantasmas em novembro
-- (14/25 vencendo 13/11 e 15/25 vencendo 14/11, ambas com valor 0,00 e "pagas").
-- A parcela 14/25 original (vence 15/11, R$ 1.500,00) tinha sumido.
--
-- Estado desejado (pedido do Cadu): rescisão cancelada, só a parcela 14/25 de
-- novembro, pendente, R$ 1.500,00, vencendo 15/11.
--
-- Só mexe nesta locação (b59dc4d3-...) e só em recebimentos SEM nenhum valor pago.
-- Se qualquer conferência falhar, a transação inteira é desfeita.

do $$
declare
  v_rental uuid := 'b59dc4d3-b010-4694-b1a4-bf7daf675c9e';
  n int;
begin
  -- 1) apaga as 3 rescisões erradas e a parcela 15/25 errada de novembro
  delete from payments
   where rental_id = v_rental
     and coalesce(paid_amount,0) = 0
     and (id::text like '02d4ff4e%' or id::text like 'ea8b640e%' or id::text like 'e5fe175f%' or id::text like '378d4bb3%');
  get diagnostics n = row_count;
  raise notice 'apagados: %', n;

  -- 2) a linha errada 14/25 vira a parcela original de novembro
  update payments
     set due_date = '2026-11-15', expected_amount = 1500, paid_amount = 0, status = 'pending', is_paid = false,
         payment_date = null, notes = null, termination_group_id = null,
         breakdown = '[{"type": "addition", "amount": 1500, "description": "Aluguel - Valor integral"}]'::jsonb,
         installment = 14, total_installments = 25, reference_month = '11', reference_year = '2026',
         payment_kind = 'rent', contract_end = false, updated_at = now()
   where id = '7ad9f7ae-5de4-436f-bf98-2a17a176ad7e' and rental_id = v_rental;

  -- 3) tira da locação o valor de caução devolvido que a rescisão deixou gravado
  update rentals set returned_deposit_amount = 0, updated_at = now() where id = v_rental;

  -- conferências
  if (select count(*) from payments where rental_id = v_rental and due_date between '2026-11-01' and '2026-11-30') <> 1 then
    raise exception 'conferencia falhou: novembro deveria ter 1 recebimento';
  end if;
  if not exists (select 1 from payments where rental_id = v_rental and due_date = '2026-11-15' and installment = 14 and status = 'pending' and expected_amount = 1500 and payment_kind = 'rent' and coalesce(paid_amount,0) = 0) then
    raise exception 'conferencia falhou: parcela 14/25 nao ficou pendente de 1500';
  end if;
  if (select count(*) from payments where rental_id = v_rental and payment_kind = 'termination' and coalesce(contract_end,false) = false) <> 0 then
    raise exception 'conferencia falhou: ainda existe recebimento de rescisao';
  end if;
  if (select count(*) from payments where rental_id = v_rental) <> 25 then
    raise exception 'conferencia falhou: total de recebimentos diferente de 25';
  end if;
end $$;
