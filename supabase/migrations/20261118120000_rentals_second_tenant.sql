-- Locação com 2 inquilinos: guarda o 2º inquilino (opcional) na locação.
-- Seguro de rodar duas vezes.
alter table public.rentals
  add column if not exists second_tenant_id uuid references public.tenants(id);

comment on column public.rentals.second_tenant_id is
  'Segundo inquilino da locação (contrato com 2 locatários). Nulo na maioria das locações.';
