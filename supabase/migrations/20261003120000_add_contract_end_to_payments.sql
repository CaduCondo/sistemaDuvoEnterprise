-- Regra de FIM DE CONTRATO (issue #108, 03/out/2026).
--
-- Marca os dois recebimentos que todo contrato passa a ter na data fim:
--   - o proporcional de fim de contrato (payment_kind = 'rent');
--   - o recebimento de Fim de Contrato -- devolução do caução, despesas e
--     desconto (payment_kind = 'termination').
-- É essa marca (e não o texto das observações) que diz ao sistema quais
-- recebimentos trocar de data quando o contrato é renovado, ou apagar quando
-- é rescindido. Ver src/lib/contractEnd.ts.
alter table public.payments
  add column if not exists contract_end boolean not null default false;

comment on column public.payments.contract_end is
  'true = recebimento de fim de contrato (proporcional final ou Fim de Contrato/caução), vence na data fim da locação. Ver src/lib/contractEnd.ts';

create index if not exists payments_rental_contract_end_idx
  on public.payments (rental_id) where contract_end;
