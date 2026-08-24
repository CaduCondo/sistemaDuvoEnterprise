-- ============================================================================
-- Desmembre da rescisao: recebimento de aluguel x Recebimento de Rescisao
-- Issue #49 -- ver docs/tickets/rescisao-caucao.md
--
-- Hoje a rescisao grava UM recebimento so, com a conta
--     aluguel proporcional + multa - caucao devolvido
-- na aba Locacoes. O caucao e dinheiro de terceiro, nao e receita, mas entra
-- na base sobre a qual as taxas de adm (5%) e gerenciamento (3%) sao
-- calculadas.
--
-- A partir daqui a rescisao gera DOIS recebimentos ligados entre si:
--   1. Recebimento de aluguel  -> aba Locacoes. Proporcional do aluguel +
--      proporcional da garagem + multa. GERA taxa.
--   2. Recebimento de Rescisao -> aba Caucoes. Devolucao corrigida + despesas
--      adicionais + desconto. NAO gera taxa.
--
-- Escrita para poder rodar mais de uma vez sem quebrar (`if not exists`), e
-- para rodar igual em DEV e em PROD.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- O que liga os dois recebimentos e o que distingue um do outro
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists payment_kind text not null default 'rent',
  add column if not exists termination_group_id uuid;

comment on column public.payments.payment_kind is
  'Tipo do recebimento. "rent" = recebimento comum de aluguel, aparece na aba Locacoes e entra na base das taxas de adm e gerenciamento. "termination" = Recebimento de Rescisao, aparece na aba Caucoes e NAO entra na base das taxas, porque e devolucao de caucao (dinheiro de terceiro), despesas e desconto. Issue #49.';

comment on column public.payments.termination_group_id is
  'Liga os dois recebimentos gerados por uma mesma rescisao: os dois recebem o mesmo valor aqui. Serve para achar um a partir do outro (relatorio, migracao dos antigos e estorno).';

-- ---------------------------------------------------------------------------
-- Os tres valores do Recebimento de Rescisao
--
-- Sinais, combinados com o Cadu em 21/ago/2026:
--   termination_corrected_deposit    NEGATIVO  (dinheiro sai da imobiliaria)
--   termination_additional_expenses  POSITIVO  (cobranca do inquilino)
--   termination_discount             NEGATIVO  (concedido ao inquilino)
--
-- O total e a soma dos tres e fica em expected_amount, como em qualquer
-- recebimento. Total negativo = a imobiliaria paga o inquilino.
--
-- Ficam em payments, e nao em rentals, para haver UMA fonte de verdade: o
-- Recebimento de Rescisao e um recebimento de verdade, com vencimento e
-- status (pendente/pago) como os outros.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists termination_corrected_deposit numeric(12,2),
  add column if not exists termination_additional_expenses numeric(12,2),
  add column if not exists termination_discount numeric(12,2);

comment on column public.payments.termination_corrected_deposit is
  'Valor do caucao corrigido para devolucao, ja calculado sobre o que o inquilino EFETIVAMENTE PAGOU (e nao sobre o valor contratado). Gravado NEGATIVO. E a coluna que substitui "Valor Devolvido" na aba Caucoes.';

comment on column public.payments.termination_additional_expenses is
  'Despesas adicionais cobradas do inquilino na rescisao (reparos, limpeza, etc). Gravado POSITIVO.';

comment on column public.payments.termination_discount is
  'Desconto concedido ao inquilino na rescisao. Gravado NEGATIVO -- o usuario digita so o numero, o sinal fica preso no campo (decisao 1 do ticket).';

-- ---------------------------------------------------------------------------
-- Indice para achar rapido os dois lados de uma rescisao
-- ---------------------------------------------------------------------------
create index if not exists idx_payments_termination_group
  on public.payments (termination_group_id)
  where termination_group_id is not null;

create index if not exists idx_payments_kind_rental
  on public.payments (rental_id, payment_kind);

-- ---------------------------------------------------------------------------
-- Os recebimentos que ja existem sao todos de aluguel.
-- O default da coluna ja cuida das linhas antigas, mas deixamos explicito
-- para o caso de a coluna ja existir de uma execucao anterior sem default.
-- ---------------------------------------------------------------------------
update public.payments
   set payment_kind = 'rent'
 where payment_kind is null;
