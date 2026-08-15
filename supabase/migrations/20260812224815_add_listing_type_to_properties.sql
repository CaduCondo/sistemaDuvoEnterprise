-- Adiciona o campo "Tipo de anúncio" (Locação ou Venda) ao imóvel.
-- Todo imóvel já cadastrado continua sendo tratado como Locação ('rent'),
-- que é o comportamento atual do sistema.

alter table public.properties
  add column if not exists listing_type text not null default 'rent';

alter table public.properties
  drop constraint if exists properties_listing_type_check;

alter table public.properties
  add constraint properties_listing_type_check
  check (listing_type in ('rent', 'sale'));

comment on column public.properties.listing_type is
  'Tipo de anúncio do imóvel: rent (Locação) ou sale (Venda).';
