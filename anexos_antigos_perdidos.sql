-- ============================================================================
-- ANEXOS ANTIGOS PERDIDOS (arquivos que ficavam salvos no disco do servidor,
-- antes de migrarmos o upload para o Supabase Storage). Esse disco antigo foi
-- perdido, então qualquer anexo com URL que NÃO começa com "http" é um arquivo
-- que já não existe mais - não tem como recuperar o conteúdo.
--
-- Como usar (no Supabase, projeto de PRODUÇÃO -> SQL Editor):
--   1) Rode as 3 consultas do PASSO 1 (relatório) e SALVE o resultado de cada
--      uma (botão de exportar/baixar CSV do próprio Supabase, ou copiar e
--      colar numa planilha). Esse é o seu registro de "onde estava o quê"
--      antes de apagar.
--   2) Só depois de salvar o relatório, rode as 3 consultas do PASSO 2, que
--      apagam apenas os anexos quebrados (não mexe em anexos que ainda
--      funcionam, nem apaga a locação/recebimento - só remove a referência
--      ao arquivo perdido).
--   3) Rode o PASSO 1 de novo - as 3 consultas devem voltar vazias, confirmando
--      que não sobrou nenhum anexo quebrado.
-- ============================================================================


-- ============================================================================
-- PASSO 1 - RELATÓRIO (só leitura, não muda nada)
-- ============================================================================

-- 1A) Locações com anexo perdido
select
  r.id as locacao_id,
  l.name as local,
  p.complement as complemento,
  t.name as inquilino,
  (case when jsonb_typeof(elem) = 'string' then elem #>> '{}' else elem->>'url' end) as anexo_url,
  (case when jsonb_typeof(elem) = 'object' then elem->>'name' else null end) as anexo_nome
from rentals r
join properties p on p.id = r.property_id
join locations l on l.id = p.location_id
join tenants t on t.id = r.tenant_id
cross join lateral jsonb_array_elements(r.attachments) as elem
where r.attachments is not null
  and jsonb_typeof(r.attachments) = 'array'
  and (
    (jsonb_typeof(elem) = 'string' and (elem #>> '{}') not like 'http%')
    or (jsonb_typeof(elem) = 'object' and coalesce(elem->>'url', '') not like 'http%')
  );

-- 1B) Recebimentos de Aluguel (tabela "payments") com anexo perdido
select
  pay.id as recebimento_id,
  r.id as locacao_id,
  l.name as local,
  p.complement as complemento,
  t.name as inquilino,
  pay.reference_month,
  pay.reference_year,
  (case when jsonb_typeof(elem) = 'string' then elem #>> '{}' else elem->>'url' end) as anexo_url,
  (case when jsonb_typeof(elem) = 'object' then elem->>'name' else null end) as anexo_nome
from payments pay
join rentals r on r.id = pay.rental_id
join properties p on p.id = r.property_id
join locations l on l.id = p.location_id
join tenants t on t.id = r.tenant_id
cross join lateral jsonb_array_elements(pay.attachments) as elem
where pay.attachments is not null
  and jsonb_typeof(pay.attachments) = 'array'
  and (
    (jsonb_typeof(elem) = 'string' and (elem #>> '{}') not like 'http%')
    or (jsonb_typeof(elem) = 'object' and coalesce(elem->>'url', '') not like 'http%')
  );

-- 1C) Recebimentos de Caução (tabela "deposit_installments") com anexo perdido
--
-- ⚠️ Essa tabela guarda "attachments" como text[] (lista de texto simples) em
-- PRODUÇÃO - diferente das outras duas tabelas, que usam jsonb. Em alguns
-- registros antigos, cada item da lista é só a URL; em outros, é um texto que
-- por engano guarda um objeto JSON inteiro (ex.: {"url":"...","name":"..."}).
-- A consulta abaixo trata os dois casos.
select
  di.id as recebimento_caucao_id,
  r.id as locacao_id,
  l.name as local,
  p.complement as complemento,
  t.name as inquilino,
  di.installment_number as numero_parcela,
  (case when a like '{%' then (a::jsonb ->> 'url') else a end) as anexo_url,
  (case when a like '{%' then (a::jsonb ->> 'name') else null end) as anexo_nome
from deposit_installments di
join rentals r on r.id = di.rental_id
join properties p on p.id = r.property_id
join locations l on l.id = p.location_id
join tenants t on t.id = r.tenant_id
cross join lateral unnest(di.attachments) as a
where di.attachments is not null
  and (
    case when a like '{%' then coalesce((a::jsonb ->> 'url'), '') not like 'http%'
         else a not like 'http%'
    end
  );


-- ============================================================================
-- PASSO 2 - APAGAR só os anexos quebrados (rode DEPOIS de salvar o relatório
-- acima). Cada UPDATE mantém os anexos que ainda funcionam e remove só os que
-- apontam pro arquivo perdido.
-- ============================================================================

-- 2A) Locações
update rentals
set attachments = (
  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  from jsonb_array_elements(attachments) as elem
  where not (
    (jsonb_typeof(elem) = 'string' and (elem #>> '{}') not like 'http%')
    or (jsonb_typeof(elem) = 'object' and coalesce(elem->>'url', '') not like 'http%')
  )
)
where attachments is not null
  and jsonb_typeof(attachments) = 'array'
  and exists (
    select 1 from jsonb_array_elements(attachments) as elem
    where (jsonb_typeof(elem) = 'string' and (elem #>> '{}') not like 'http%')
       or (jsonb_typeof(elem) = 'object' and coalesce(elem->>'url', '') not like 'http%')
  );

-- 2B) Recebimentos de Aluguel
update payments
set attachments = (
  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  from jsonb_array_elements(attachments) as elem
  where not (
    (jsonb_typeof(elem) = 'string' and (elem #>> '{}') not like 'http%')
    or (jsonb_typeof(elem) = 'object' and coalesce(elem->>'url', '') not like 'http%')
  )
)
where attachments is not null
  and jsonb_typeof(attachments) = 'array'
  and exists (
    select 1 from jsonb_array_elements(attachments) as elem
    where (jsonb_typeof(elem) = 'string' and (elem #>> '{}') not like 'http%')
       or (jsonb_typeof(elem) = 'object' and coalesce(elem->>'url', '') not like 'http%')
  );

-- 2C) Recebimentos de Caução (attachments é text[] em produção - ver nota no 1C)
update deposit_installments
set attachments = array(
  select a
  from unnest(attachments) as a
  where case when a like '{%' then coalesce((a::jsonb ->> 'url'), '') like 'http%'
             else a like 'http%'
        end
)
where attachments is not null
  and exists (
    select 1 from unnest(attachments) as a
    where case when a like '{%' then coalesce((a::jsonb ->> 'url'), '') not like 'http%'
               else a not like 'http%'
          end
  );
