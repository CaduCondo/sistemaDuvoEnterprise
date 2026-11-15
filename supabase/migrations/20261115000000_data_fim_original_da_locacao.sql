-- Data fim ORIGINAL do contrato (14/nov/2026, bug LEMOS APTO 22).
--
-- A rescisão sobrescreve rentals.end_date com a data da saída. Ao trocar a data
-- de uma rescisão já feita, o diálogo calculava a multa "proporcional ao tempo
-- restante" a partir dessa data (já sobrescrita) e a multa saía ZERO.
-- Agora a rescisão guarda aqui a data fim que o contrato tinha antes da PRIMEIRA
-- rescisão, e o diálogo usa esta data para calcular a multa de uma locação já
-- rescindida. Nulo = locação nunca rescindida (vale end_date).
alter table public.rentals add column if not exists original_end_date date;
comment on column public.rentals.original_end_date is
  'Data fim do contrato antes da primeira rescisão. Nulo se nunca foi rescindida.';
