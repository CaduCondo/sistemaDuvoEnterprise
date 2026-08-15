alter table public.properties
  add column if not exists has_barbecue boolean not null default false;

comment on column public.properties.has_barbecue is
  'Se o imóvel tem churrasqueira (checkbox "Churrasqueira" no cadastro do imóvel).';
