-- ============================================================================
-- #119 — Acordo de parcelamento do débito do inquilino (rescisão)
--
-- Regras combinadas com o Cadu (06/out/2026):
--   * os recebimentos que entram no acordo NÃO são apagados: viram status
--     'renegotiated' e ficam ligados ao acordo (renegotiated_in_agreement_id);
--   * o acordo gera recebimentos novos (payment_kind 'agreement'): a entrada
--     (opcional) e as parcelas, no máximo 6, sem juros;
--   * total = recebimentos em aberto (aluguel, proporcional, multa
--     rescisória) + multa e juros por atraso de cada um (percentuais de
--     Configurações > Multas e Juros) + Despesas Adicionais − caução corrigido
--     − desconto (os dois últimos digitados/salvos no Recebimento de Rescisão);
--   * recebimentos com vencimento até 31/12/2025 NUNCA entram (o sistema não
--     existia; os registros antigos não são confiáveis);
--   * ao criar o acordo os valores de todos os recebimentos que entram ficam
--     CONGELADOS (multa, juros, caução corrigido, despesas, desconto): foram
--     combinados com o inquilino. Multa e juros voltam a contar só sobre a
--     parcela do acordo que atrasar;
--   * o caução corrigido abatido no acordo é registrado como devolvido
--     (rentals.returned_deposit_amount, coluna "Valor Devolvido" da aba
--     Cauções);
--   * desfazer o acordo só enquanto nenhuma parcela tiver pagamento: apaga as
--     parcelas e devolve os originais EXATAMENTE como estavam.
--
-- Pode rodar mais de uma vez (if not exists / create or replace).
-- Rodar em DEV e em PROD ANTES do push do código que usa estas colunas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabela do acordo
-- ---------------------------------------------------------------------------
create table if not exists public.payment_agreements (
  id uuid primary key default gen_random_uuid(),
  agreement_number bigserial unique,
  rental_id uuid not null references public.rentals(id) on delete cascade,
  agreement_date date not null default current_date,
  total_original numeric(12,2) not null,      -- soma dos saldos em aberto (caução já abatido)
  late_fees numeric(12,2) not null default 0, -- multa + juros por atraso até a data do acordo
  discount numeric(12,2) not null default 0,  -- desconto do acordo (positivo)
  down_payment numeric(12,2) not null default 0,
  down_payment_date date,
  installments integer not null check (installments between 1 and 6),
  first_due_date date not null,
  total_agreed numeric(12,2) not null,        -- total_original + late_fees - discount
  status text not null default 'active' check (status in ('active', 'paid', 'undone')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payment_agreements is
  'Acordo de parcelamento do débito do inquilino (#119). Os recebimentos originais ficam com status renegotiated e renegotiated_in_agreement_id; as parcelas são payments com payment_kind agreement e agreement_id.';

create index if not exists payment_agreements_rental_idx on public.payment_agreements (rental_id);

alter table public.payment_agreements enable row level security;

-- Mesmas permissões da tabela payments (o sistema acessa com a chave pública
-- e controla o acesso pela tela).
drop policy if exists "Allow public select to payment_agreements" on public.payment_agreements;
drop policy if exists "Allow public insert to payment_agreements" on public.payment_agreements;
drop policy if exists "Allow public update to payment_agreements" on public.payment_agreements;
drop policy if exists "Allow public delete to payment_agreements" on public.payment_agreements;
create policy "Allow public select to payment_agreements" on public.payment_agreements for select using (true);
create policy "Allow public insert to payment_agreements" on public.payment_agreements for insert with check (true);
create policy "Allow public update to payment_agreements" on public.payment_agreements for update using (true) with check (true);
create policy "Allow public delete to payment_agreements" on public.payment_agreements for delete using (true);

-- ---------------------------------------------------------------------------
-- 2) Colunas novas em payments
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists agreement_id uuid references public.payment_agreements(id) on delete set null,
  add column if not exists renegotiated_in_agreement_id uuid references public.payment_agreements(id) on delete set null,
  add column if not exists status_before_agreement text,
  add column if not exists values_before_agreement jsonb;

comment on column public.payments.agreement_id is
  'Parcela/entrada de um acordo de parcelamento (#119). payment_kind = agreement.';
comment on column public.payments.renegotiated_in_agreement_id is
  'Recebimento original que entrou num acordo de parcelamento (#119). status = renegotiated.';
comment on column public.payments.status_before_agreement is
  'Status que o recebimento tinha antes de entrar no acordo; volta para ele se o acordo for desfeito.';
comment on column public.payments.values_before_agreement is
  'Valores do recebimento antes do acordo (late_fee, interest, expected_amount, termination_corrected_deposit); voltam se o acordo for desfeito.';

alter table public.payment_agreements
  add column if not exists previous_returned_deposit numeric(12,2),
  add column if not exists deposit_returned numeric(12,2);
comment on column public.payment_agreements.deposit_returned is
  'Caução corrigido abatido no acordo (positivo). Gravado em rentals.returned_deposit_amount.';
comment on column public.payment_agreements.previous_returned_deposit is
  'rentals.returned_deposit_amount antes do acordo; volta se o acordo for desfeito.';

create index if not exists payments_agreement_idx on public.payments (agreement_id) where agreement_id is not null;
create index if not exists payments_renegotiated_idx on public.payments (renegotiated_in_agreement_id) where renegotiated_in_agreement_id is not null;

-- Status novo
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('paid', 'pending', 'partial', 'overdue', 'renegotiated'));

-- O gatilho que marca "pago" quando o saldo zera não pode mexer num
-- recebimento renegociado (ele não foi pago: foi para o acordo).
create or replace function public.validate_payment_status()
returns trigger
language plpgsql
as $function$
declare
  total_expected numeric;
  remaining numeric;
begin
  if new.payment_kind = 'termination' then
    return new;
  end if;

  if new.status = 'renegotiated' then
    return new;
  end if;

  total_expected := coalesce(new.expected_amount, 0) +
                    coalesce(new.late_fee, 0) +
                    coalesce(new.interest, 0) -
                    coalesce(new.discount_amount, 0);

  remaining := total_expected - coalesce(new.paid_amount, 0);

  if abs(remaining) <= 0.05 then
    new.status := 'paid';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3) Criar o acordo — tudo ou nada
--
-- p_origens:  [{"id": uuid, "saldo": numeric, "multa": numeric, "juros": numeric,
--               "caucao": numeric}]
--             saldo = o que falta pagar do recebimento. No Recebimento de
--             Rescisão: caução corrigido (negativo) + despesas − desconto;
--             "caucao" = o caução corrigido mostrado na tela (negativo).
-- p_parcelas: [{"numero": 1, "vencimento": "2026-11-10", "valor": 333.33}]
-- ---------------------------------------------------------------------------
create or replace function public.criar_acordo_parcelamento(
  p_rental_id uuid,
  p_origens jsonb,
  p_parcelas jsonb,
  p_desconto numeric default 0,
  p_entrada numeric default 0,
  p_entrada_data date default null,
  p_data_acordo date default current_date,
  p_observacoes text default null
) returns uuid
language plpgsql
as $function$
declare
  v_acordo uuid;
  v_numero bigint;
  v_origem record;
  v_pag record;
  v_total_original numeric := 0;
  v_multas numeric := 0;
  v_total_acordado numeric;
  v_soma_parcelas numeric := 0;
  v_qtd integer;
  v_parcela record;
  v_descricao text;
  v_primeiro date;
  v_caucao numeric;
  v_esperado numeric;
  v_caucao_total numeric := 0;
begin
  if p_origens is null or jsonb_array_length(p_origens) = 0 then
    raise exception 'Escolha pelo menos um recebimento para o acordo.';
  end if;

  v_qtd := coalesce(jsonb_array_length(p_parcelas), 0);
  if v_qtd < 1 or v_qtd > 6 then
    raise exception 'O acordo deve ter de 1 a 6 parcelas (veio %).', v_qtd;
  end if;

  if coalesce(p_desconto, 0) < 0 or coalesce(p_entrada, 0) < 0 then
    raise exception 'Desconto e entrada não podem ser negativos.';
  end if;

  if coalesce(p_entrada, 0) > 0 and p_entrada_data is null then
    raise exception 'Informe a data da entrada.';
  end if;

  -- Confere cada recebimento de origem contra o banco
  for v_origem in
    select (o->>'id')::uuid as id,
           round(coalesce((o->>'saldo')::numeric, 0), 2) as saldo,
           round(coalesce((o->>'multa')::numeric, 0), 2) as multa,
           round(coalesce((o->>'juros')::numeric, 0), 2) as juros,
           round((o->>'caucao')::numeric, 2) as caucao
      from jsonb_array_elements(p_origens) o
  loop
    select * into v_pag from public.payments where id = v_origem.id for update;
    if not found then
      raise exception 'Recebimento % não existe mais.', v_origem.id;
    end if;
    if v_pag.rental_id <> p_rental_id then
      raise exception 'Recebimento % é de outra locação.', v_origem.id;
    end if;
    if v_pag.status not in ('pending', 'partial', 'overdue') then
      raise exception 'O recebimento com vencimento % está "%" e não pode entrar no acordo.',
        to_char(v_pag.due_date, 'DD/MM/YYYY'), v_pag.status;
    end if;
    if v_pag.agreement_id is not null then
      raise exception 'O recebimento com vencimento % já é parcela de outro acordo.',
        to_char(v_pag.due_date, 'DD/MM/YYYY');
    end if;
    if v_pag.due_date < date '2026-01-01' then
      raise exception 'O recebimento com vencimento % é de antes de 2026 e não entra em acordo.',
        to_char(v_pag.due_date, 'DD/MM/YYYY');
    end if;
    if coalesce(v_pag.payment_kind, 'rent') = 'termination' then
      -- Caução corrigido: o da tela no Fim de Contrato (recalculado ao
      -- mostrar), o gravado na rescisão nos demais. Despesas e desconto:
      -- SEMPRE os salvos no banco (quem não salvou não entra).
      v_caucao := case when v_pag.contract_end
                       then coalesce(v_origem.caucao, v_pag.termination_corrected_deposit, 0)
                       else coalesce(v_pag.termination_corrected_deposit, 0) end;
      if v_caucao > 0 then
        raise exception 'Caução corrigido do Recebimento de Rescisão inválido (%).', v_caucao;
      end if;
      v_esperado := round(v_caucao + coalesce(v_pag.termination_additional_expenses, 0)
                          + coalesce(v_pag.termination_discount, 0), 2);
      if abs(v_origem.saldo - v_esperado) > 0.01 then
        raise exception 'Os valores do Recebimento de Rescisão mudaram (caução + despesas − desconto = %, veio %). Salve a Formação de Valores e abra o acordo de novo.',
          v_esperado, v_origem.saldo;
      end if;
      v_caucao_total := v_caucao_total + abs(v_caucao);
    else
      if abs(v_origem.saldo - round(v_pag.expected_amount - coalesce(v_pag.paid_amount, 0), 2)) > 0.01 then
        raise exception 'O saldo do recebimento com vencimento % mudou (esperado %, veio %). Abra o acordo de novo.',
          to_char(v_pag.due_date, 'DD/MM/YYYY'),
          round(v_pag.expected_amount - coalesce(v_pag.paid_amount, 0), 2), v_origem.saldo;
      end if;
    end if;

    v_total_original := v_total_original + v_origem.saldo;
    v_multas := v_multas + v_origem.multa + v_origem.juros;
  end loop;

  v_total_acordado := round(v_total_original + v_multas - coalesce(p_desconto, 0), 2);
  if v_total_acordado <= 0 then
    raise exception 'Não há débito para parcelar (total %). O saldo é a favor do inquilino.', v_total_acordado;
  end if;

  select coalesce(sum(round((p->>'valor')::numeric, 2)), 0), min((p->>'vencimento')::date)
    into v_soma_parcelas, v_primeiro
    from jsonb_array_elements(p_parcelas) p;

  if abs(v_soma_parcelas + coalesce(p_entrada, 0) - v_total_acordado) > 0.01 then
    raise exception 'Entrada + parcelas (%) não fecham com o total do acordo (%).',
      v_soma_parcelas + coalesce(p_entrada, 0), v_total_acordado;
  end if;

  if exists (select 1 from jsonb_array_elements(p_parcelas) p where (p->>'valor')::numeric <= 0) then
    raise exception 'Toda parcela precisa ter valor maior que zero.';
  end if;

  insert into public.payment_agreements (
    rental_id, agreement_date, total_original, late_fees, discount,
    down_payment, down_payment_date, installments, first_due_date, total_agreed, notes,
    deposit_returned, previous_returned_deposit
  ) values (
    p_rental_id, coalesce(p_data_acordo, current_date), round(v_total_original, 2), round(v_multas, 2),
    round(coalesce(p_desconto, 0), 2), round(coalesce(p_entrada, 0), 2), p_entrada_data,
    v_qtd, v_primeiro, v_total_acordado, p_observacoes,
    case when v_caucao_total > 0 then round(v_caucao_total, 2) end,
    (select returned_deposit_amount from public.rentals where id = p_rental_id)
  ) returning id, agreement_number into v_acordo, v_numero;

  -- Entrada
  if coalesce(p_entrada, 0) > 0 then
    v_descricao := 'Entrada do acordo #' || v_numero;
    insert into public.payments (
      rental_id, reference_month, reference_year, due_date, expected_amount, status,
      breakdown, payment_kind, agreement_id, notes
    ) values (
      p_rental_id, to_char(p_entrada_data, 'MM'), to_char(p_entrada_data, 'YYYY'), p_entrada_data,
      round(p_entrada, 2), 'pending',
      jsonb_build_array(jsonb_build_object('description', v_descricao, 'amount', round(p_entrada, 2), 'type', 'addition')),
      'agreement', v_acordo, v_descricao
    );
  end if;

  -- Parcelas
  for v_parcela in
    select (p->>'numero')::int as numero, (p->>'vencimento')::date as vencimento,
           round((p->>'valor')::numeric, 2) as valor
      from jsonb_array_elements(p_parcelas) p
     order by (p->>'numero')::int
  loop
    v_descricao := 'Acordo #' || v_numero || ' - parcela ' || v_parcela.numero || '/' || v_qtd;
    insert into public.payments (
      rental_id, reference_month, reference_year, due_date, expected_amount, status,
      breakdown, installment, total_installments, payment_kind, agreement_id, notes
    ) values (
      p_rental_id, to_char(v_parcela.vencimento, 'MM'), to_char(v_parcela.vencimento, 'YYYY'),
      v_parcela.vencimento, v_parcela.valor, 'pending',
      jsonb_build_array(jsonb_build_object('description', v_descricao, 'amount', v_parcela.valor, 'type', 'addition')),
      v_parcela.numero, v_qtd, 'agreement', v_acordo, v_descricao
    );
  end loop;

  -- Originais viram "renegociados", com os valores CONGELADOS
  update public.payments p
     set values_before_agreement = jsonb_build_object(
           'late_fee', p.late_fee, 'interest', p.interest,
           'expected_amount', p.expected_amount,
           'termination_corrected_deposit', p.termination_corrected_deposit),
         status_before_agreement = p.status,
         status = 'renegotiated',
         renegotiated_in_agreement_id = v_acordo,
         late_fee = case when coalesce(p.payment_kind, 'rent') = 'termination' then p.late_fee else o.multa end,
         interest = case when coalesce(p.payment_kind, 'rent') = 'termination' then p.interest else o.juros end,
         termination_corrected_deposit = case when coalesce(p.payment_kind, 'rent') = 'termination' and p.contract_end
                                              then coalesce(o.caucao, p.termination_corrected_deposit)
                                              else p.termination_corrected_deposit end,
         expected_amount = case when coalesce(p.payment_kind, 'rent') = 'termination' and p.contract_end
                                then round(coalesce(o.caucao, p.termination_corrected_deposit, 0)
                                           + coalesce(p.termination_additional_expenses, 0)
                                           + coalesce(p.termination_discount, 0), 2)
                                else p.expected_amount end
    from (select (x->>'id')::uuid as id,
                 round(coalesce((x->>'multa')::numeric, 0), 2) as multa,
                 round(coalesce((x->>'juros')::numeric, 0), 2) as juros,
                 round((x->>'caucao')::numeric, 2) as caucao
            from jsonb_array_elements(p_origens) x) o
   where p.id = o.id;

  -- Caução corrigido abatido = caução devolvido (aba Cauções)
  if v_caucao_total > 0 then
    update public.rentals set returned_deposit_amount = round(v_caucao_total, 2) where id = p_rental_id;
  end if;

  return v_acordo;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4) Desfazer o acordo (só se nenhuma parcela/entrada recebeu pagamento)
-- ---------------------------------------------------------------------------
create or replace function public.desfazer_acordo_parcelamento(p_acordo_id uuid)
returns void
language plpgsql
as $function$
declare
  v_status text;
begin
  select status into v_status from public.payment_agreements where id = p_acordo_id for update;
  if not found then
    raise exception 'Acordo não encontrado.';
  end if;
  if v_status <> 'active' then
    raise exception 'Só um acordo ativo pode ser desfeito (este está "%").', v_status;
  end if;
  if exists (select 1 from public.payments
              where agreement_id = p_acordo_id
                and (status in ('paid', 'partial') or coalesce(paid_amount, 0) > 0)) then
    raise exception 'Este acordo já tem parcela paga e não pode ser desfeito.';
  end if;

  delete from public.payments where agreement_id = p_acordo_id;

  update public.payments
     set status = coalesce(status_before_agreement, 'pending'),
         late_fee = coalesce((values_before_agreement->>'late_fee')::numeric, late_fee),
         interest = coalesce((values_before_agreement->>'interest')::numeric, interest),
         expected_amount = coalesce((values_before_agreement->>'expected_amount')::numeric, expected_amount),
         termination_corrected_deposit = case when values_before_agreement ? 'termination_corrected_deposit'
                                              then (values_before_agreement->>'termination_corrected_deposit')::numeric
                                              else termination_corrected_deposit end,
         status_before_agreement = null,
         values_before_agreement = null,
         renegotiated_in_agreement_id = null
   where renegotiated_in_agreement_id = p_acordo_id;

  update public.rentals r
     set returned_deposit_amount = a.previous_returned_deposit
    from public.payment_agreements a
   where a.id = p_acordo_id and r.id = a.rental_id and a.deposit_returned is not null;

  update public.payment_agreements set status = 'undone', updated_at = now() where id = p_acordo_id;
end;
$function$;

grant execute on function public.criar_acordo_parcelamento(uuid, jsonb, jsonb, numeric, numeric, date, date, text) to anon, authenticated;
grant execute on function public.desfazer_acordo_parcelamento(uuid) to anon, authenticated;
grant select, insert, update, delete on public.payment_agreements to anon, authenticated;
grant usage, select on sequence public.payment_agreements_agreement_number_seq to anon, authenticated;
