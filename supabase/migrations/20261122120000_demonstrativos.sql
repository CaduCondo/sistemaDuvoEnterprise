-- Demonstrativos (DRE, Balanço, Fluxo de Caixa) -- issue #128, 22/nov/2026.
--
-- Só ACRESCENTA: três tabelas novas, uma coluna nova (com valor padrão) em
-- location_expenses e a permissão de menu do Admin. Nenhum dado existente é
-- alterado ou apagado. Pode rodar duas vezes sem estragar nada.

-- 1) Patrimônio de cada Local (prédio) -------------------------------------
create table if not exists public.location_assets (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null unique references public.locations(id) on delete cascade,
  -- Quem é o dono do Local para fins de imposto: pessoa física ou holding.
  owner_regime text not null default 'pf' check (owner_regime in ('pf', 'holding')),
  acquisition_date date,
  land_value numeric(14,2) not null default 0,      -- terreno: não deprecia
  building_value numeric(14,2) not null default 0,  -- edificação
  -- 25 anos = 4% ao ano, taxa da Receita para edificações (IN RFB 1.700/2017, anexo III).
  building_useful_life_years numeric(6,2) not null default 25 check (building_useful_life_years > 0),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
comment on table public.location_assets is 'Patrimônio de cada Local para o Balanço dos Demonstrativos (#128)';

-- 2) Financiamentos de cada Local ------------------------------------------
create table if not exists public.location_financings (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  description text not null default 'Financiamento',
  start_date date not null,
  principal numeric(14,2) not null check (principal >= 0),  -- saldo na data de início
  annual_rate_pct numeric(7,4) not null default 0 check (annual_rate_pct >= 0),
  term_months integer not null check (term_months > 0),
  amortization_system text not null default 'SAC' check (amortization_system in ('SAC', 'PRICE')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists location_financings_location_idx on public.location_financings(location_id);
comment on table public.location_financings is 'Financiamentos dos Locais, para juros na DRE e dívida no Balanço (#128)';

-- 3) Premissas gerais (uma linha só) ---------------------------------------
create table if not exists public.demonstrativos_premissas (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  base_date date not null default '2026-01-01',       -- mês de abertura do Balanço
  opening_cash numeric(14,2) not null default 0,      -- caixa no mês de abertura
  owner_distribution_pct numeric(7,4) not null default 0, -- % do caixa do mês repassado ao proprietário
  projected_vacancy_pct numeric(7,4) not null default 5,  -- após o fim de cada contrato
  projected_default_pct numeric(7,4) not null default 2,  -- inadimplência sobre a receita projetada
  projection_years integer not null default 5 check (projection_years between 1 and 10),
  -- Séries por ano (% ao ano), editáveis na aba Premissas: {"2026": 4.0, ...}
  rent_index_by_year jsonb not null default '{}'::jsonb,
  expense_index_by_year jsonb not null default '{}'::jsonb,
  -- Impostos: tudo editável. Ver docs/REGRAS_DE_NEGOCIO.md, seção Demonstrativos.
  tax_params jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
comment on table public.demonstrativos_premissas is 'Premissas dos Demonstrativos: caixa inicial, repasses, vacância, índices e impostos (#128)';

insert into public.demonstrativos_premissas (singleton, rent_index_by_year, expense_index_by_year, tax_params)
values (
  true,
  '{"2026":4.0,"2027":4.0,"2028":4.0,"2029":4.0,"2030":4.0,"2031":4.0,"2032":4.0}'::jsonb,
  '{"2026":4.0,"2027":4.0,"2028":4.0,"2029":4.0,"2030":4.0,"2031":4.0,"2032":4.0}'::jsonb,
  '{
    "pf": {
      "irpf_faixas": [
        {"ate": 2428.80, "aliquota": 0,    "deducao": 0},
        {"ate": 2826.65, "aliquota": 7.5,  "deducao": 182.16},
        {"ate": 3751.05, "aliquota": 15,   "deducao": 394.16},
        {"ate": 4664.68, "aliquota": 22.5, "deducao": 675.49},
        {"ate": null,    "aliquota": 27.5, "deducao": 908.73}
      ],
      "redutor_ate": 5000.00, "redutor_max": 312.89,
      "redutor_faixa_ate": 7350.00, "redutor_a": 978.62, "redutor_b": 0.133145,
      "deduz_taxas": true,
      "ibs_cbs_limite_receita_anual": 240000, "ibs_cbs_limite_imoveis": 3
    },
    "holding": {
      "presuncao_pct": 32, "irpj_pct": 15, "irpj_adicional_pct": 10,
      "irpj_adicional_limite_mensal": 20000, "csll_pct": 9,
      "pis_pct": 0.65, "cofins_pct": 3.0
    },
    "ibs_cbs": {
      "reducao_locacao_pct": 70, "redutor_social_mensal_por_unidade": 600,
      "cbs_referencia_pct": 8.8, "ibs_referencia_pct": 17.7,
      "cbs_fator_por_ano": {"2026":0,"2027":1,"2028":1,"2029":1,"2030":1,"2031":1,"2032":1,"2033":1},
      "ibs_fator_por_ano": {"2026":0,"2027":0,"2028":0,"2029":0.1,"2030":0.2,"2031":0.3,"2032":0.4,"2033":1},
      "pis_cofins_ate_ano": 2026
    }
  }'::jsonb
)
on conflict (singleton) do nothing;

-- 4) Despesa que é investimento/reforma (vai para o Ativo, não para a DRE) ---
alter table public.location_expenses add column if not exists is_capex boolean not null default false;
comment on column public.location_expenses.is_capex is 'true = investimento/reforma (Ativo), não despesa do mês (#128)';

-- 5) Mesmo acesso das outras tabelas (login próprio: o banco vê sempre "anon") ---
do $$
declare t text;
begin
  foreach t in array array['location_assets', 'location_financings', 'demonstrativos_premissas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Allow public select to %1$s" on public.%1$I', t);
    execute format('drop policy if exists "Allow public insert to %1$s" on public.%1$I', t);
    execute format('drop policy if exists "Allow public update to %1$s" on public.%1$I', t);
    execute format('drop policy if exists "Allow public delete to %1$s" on public.%1$I', t);
    execute format('create policy "Allow public select to %1$s" on public.%1$I for select using (true)', t);
    execute format('create policy "Allow public insert to %1$s" on public.%1$I for insert with check (true)', t);
    execute format('create policy "Allow public update to %1$s" on public.%1$I for update using (true) with check (true)', t);
    execute format('create policy "Allow public delete to %1$s" on public.%1$I for delete using (true)', t);
  end loop;
end $$;

-- 6) Menu "Demonstrativos": por padrão só Admin -----------------------------
-- A lista de menus aceitos é uma trava do banco: inclui o novo nome nela.
alter table public.role_menu_permissions drop constraint if exists role_menu_permissions_menu_item_check;
alter table public.role_menu_permissions add constraint role_menu_permissions_menu_item_check
  check (menu_item = any (array['dashboard','properties','tenants','rentals','payments','financial','settings','demonstrativos']));

insert into public.role_menu_permissions (role, menu_item, can_access)
values ('admin', 'demonstrativos', true)
on conflict (role, menu_item) do nothing;
