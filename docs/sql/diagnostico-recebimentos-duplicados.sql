-- ============================================================================
-- Quais recebimentos estao duplicados (mesmo rental / mes / ano / tipo)?
--
-- Rodar no SQL Editor. So consulta, nao altera nada.
--
-- Sao restos das rescisoes ANTIGAS: antes do commit 1388dfaf a rescisao criava
-- DOIS recebimentos de aluguel no mesmo mes (um com o mes cheio, outro com o
-- proporcional + multa). Hoje ela cria um so, com tudo dentro.
--
-- Enquanto essas linhas existirem, nao da para recriar o indice unico.
-- ============================================================================

select
  p.rental_id,
  t.name                       as inquilino,
  p.reference_month            as mes,
  p.reference_year             as ano,
  p.payment_kind               as tipo,
  count(*)                     as qtd_recebimentos,
  sum(p.expected_amount)       as soma_dos_valores,
  string_agg(
    p.status || ' R$ ' || p.expected_amount::text,
    '  |  ' order by p.created_at
  )                            as detalhe,
  string_agg(p.id::text, ', ' order by p.created_at) as ids
from public.payments p
left join public.rentals r on r.id = p.rental_id
left join public.tenants t on t.id = r.tenant_id
group by p.rental_id, t.name, p.reference_month, p.reference_year, p.payment_kind
having count(*) > 1
order by p.reference_year desc, p.reference_month desc, t.name;
