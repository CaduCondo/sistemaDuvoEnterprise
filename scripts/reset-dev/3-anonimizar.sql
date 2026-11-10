-- Reset de DEV (issue #36) -- passo 3: mascara os dados pessoais copiados
-- de producao, ANTES de o DEV ficar disponivel.
--
-- Decisao do Cadu (30/out/2026): DEV recebe copia completa de PROD, mas com
-- os dados pessoais trocados por dados falsos. Roda na mesma transacao do
-- reset: se algo aqui falhar (ou a conferencia do final achar dado real
-- sobrando), NADA e gravado e o DEV fica como estava.
--
-- Roda depois dos dados e ANTES dos indices/gatilhos/chaves estrangeiras
-- (secao "post-data" do pg_dump). Por isso:
--   - os gatilhos (ex.: auditoria) ainda nao existem -> nao disparam aqui;
--   - as chaves estrangeiras para auth.users (usuarios do Supabase Auth de
--     PROD, que nao existem em DEV) podem ser limpas antes de serem criadas.
--
-- O que muda:
--   tenants       nome, CPF, RG, documento, e-mail, telefone, rua, numero, CEP
--   system_users  NADA (desde 09/nov/2026): entram no DEV iguais a producao,
--                 com o mesmo e-mail, usuario e senha.
--   audit_logs    apagado inteiro (guarda copias antigas dos dados pessoais e IPs)
--   anexos        apagados das linhas (apontam para contratos/comprovantes
--                 reais guardados no Storage de PRODUCAO)
-- Cada valor falso e sempre o mesmo para o mesmo registro (vem do id), entao
-- dois resets seguidos geram os mesmos dados falsos.

-- Troca cada digito por outro "aleatorio" (fixo pela semente), mantendo a
-- pontuacao: "(11) 98765-4321" -> "(47) 20391-8856".
CREATE FUNCTION pg_temp.mascarar_digitos(valor text, semente text) RETURNS text
LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE WHEN valor IS NULL OR valor = '' THEN valor ELSE (
    SELECT string_agg(
             CASE WHEN ch ~ '[0-9]'
                  THEN (('x' || substr(md5(semente || ':' || i), 1, 2))::bit(8)::int % 10)::text
                  ELSE ch END,
             '' ORDER BY i)
      FROM regexp_split_to_table(valor, '') WITH ORDINALITY AS t(ch, i)
  ) END
$f$;

-- CPF falso, mas com digitos verificadores validos (para a tela nao recusar
-- ao editar o inquilino em DEV). Mantem o formato do original: se o CPF de
-- producao tinha pontos/traco, o falso tambem tem.
CREATE FUNCTION pg_temp.cpf_falso(original text, semente text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE
  base text := translate(substr(md5(semente), 1, 9), 'abcdef', '012345');
  d int[];
  s int;
  i int;
BEGIN
  IF original IS NULL OR original = '' THEN RETURN original; END IF;
  d := ARRAY(SELECT substr(base, g, 1)::int FROM generate_series(1, 9) g);
  s := 0; FOR i IN 1..9 LOOP s := s + d[i] * (11 - i); END LOOP;
  s := 11 - (s % 11); IF s >= 10 THEN s := 0; END IF; d := d || s;
  s := 0; FOR i IN 1..10 LOOP s := s + d[i] * (12 - i); END LOOP;
  s := 11 - (s % 11); IF s >= 10 THEN s := 0; END IF; d := d || s;
  IF original ~ '\D' THEN
    RETURN format('%s%s%s.%s%s%s.%s%s%s-%s%s', VARIADIC d::text[]);
  END IF;
  RETURN array_to_string(d, '');
END
$f$;

-- Aplica uma expressao numa coluna SO se a tabela/coluna existir (os bancos
-- de DEV e PROD ja divergiram antes -- ver issue #44). "{c}" na expressao
-- vira o nome da coluna.
CREATE FUNCTION pg_temp.mascarar(tabela text, coluna text, expressao text) RETURNS void
LANGUAGE plpgsql AS $f$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = tabela AND column_name = coluna) THEN
    EXECUTE format('UPDATE public.%I SET %I = %s', tabela, coluna,
                   replace(expressao, '{c}', quote_ident(coluna)));
  END IF;
END
$f$;

-- ---------------------------------------------------------------- inquilinos
DO $m$
BEGIN
  PERFORM pg_temp.mascarar('tenants', 'name',     $$'Inquilino Teste ' || upper(substr(md5(id::text), 1, 6))$$);
  PERFORM pg_temp.mascarar('tenants', 'cpf',      $$pg_temp.cpf_falso({c}::text, 'cpf' || id)$$);
  PERFORM pg_temp.mascarar('tenants', 'rg',       $$pg_temp.mascarar_digitos({c}::text, 'rg' || id)$$);
  PERFORM pg_temp.mascarar('tenants', 'document', $$pg_temp.mascarar_digitos({c}::text, 'doc' || id)$$);
  PERFORM pg_temp.mascarar('tenants', 'email',    $$CASE WHEN {c} IS NULL OR {c} = '' THEN {c} ELSE 'inquilino.' || substr(md5(id::text), 1, 12) || '@exemplo.test' END$$);
  PERFORM pg_temp.mascarar('tenants', 'phone',    $$pg_temp.mascarar_digitos({c}::text, 'tel' || id)$$);
  PERFORM pg_temp.mascarar('tenants', 'street',   $$CASE WHEN {c} IS NULL OR {c} = '' THEN {c} ELSE 'Rua de Teste' END$$);
  PERFORM pg_temp.mascarar('tenants', 'number',   $$pg_temp.mascarar_digitos({c}::text, 'num' || id)$$);
  PERFORM pg_temp.mascarar('tenants', 'zip_code', $$pg_temp.mascarar_digitos({c}::text, 'cep' || id)$$);
END $m$;

-- --------------------------------------------------------- usuarios do sistema
-- NAO mascarar (decisao do Cadu, 09/nov/2026): os usuarios do sistema sao a
-- propria familia, e trocar o e-mail deles impedia de entrar no DEV pelo
-- e-mail. Usuarios do sistema chegam no DEV iguais a PRODUCAO.

DO $$
DECLARE
  tipo text;
BEGIN
  -- senha temporaria pode estar guardada em texto puro: nao copiar
  SELECT data_type INTO tipo FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'system_users' AND column_name = 'temporary_password';
  IF tipo IN ('text', 'character varying') THEN
    UPDATE public.system_users SET temporary_password = NULL WHERE temporary_password IS NOT NULL;
  END IF;

  -- ligacoes com usuarios do Supabase Auth de PRODUCAO (nao existem em DEV)
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'system_users' AND column_name = 'auth_user_id') THEN
    UPDATE public.system_users s SET auth_user_id = NULL
     WHERE s.auth_user_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = s.auth_user_id::text);
  END IF;
  IF to_regclass('public.auth_user_mapping') IS NOT NULL THEN
    DELETE FROM public.auth_user_mapping m
     WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = m.auth_user_id::text);
  END IF;

  -- historico de auditoria: guarda copias dos dados pessoais antigos e IPs
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    TRUNCATE public.audit_logs;
  END IF;
END $$;

-- ------------------------------------------------------------------- anexos
-- Qualquer coluna de anexo/comprovante em qualquer tabela: esvazia mantendo
-- o tipo (jsonb -> [], array -> {}, texto -> NULL ou '' se nao aceitar NULL).
DO $$
DECLARE
  r record;
  vazio text;
BEGIN
  FOR r IN
    SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name IN ('attachments', 'contract_attachments', 'receipt_url')
       AND table_name IN (SELECT table_name FROM information_schema.tables
                           WHERE table_schema = 'public' AND table_type = 'BASE TABLE')
  LOOP
    vazio := CASE
      WHEN r.data_type IN ('jsonb', 'json') THEN format('''[]''::%s', r.data_type)
      WHEN r.data_type = 'ARRAY' THEN '''{}'''
      WHEN r.is_nullable = 'YES' THEN 'NULL'
      ELSE ''''''
    END;
    EXECUTE format('UPDATE public.%I SET %I = %s WHERE %I IS NOT NULL',
                   r.table_name, r.column_name, vazio, r.column_name);
  END LOOP;
END $$;

-- ------------------------------------------------------------- conferencia
-- Se sobrar QUALQUER e-mail que nao seja falso, aborta tudo (rollback).
DO $$
DECLARE
  sobrando int;
BEGIN
  SELECT count(*) INTO sobrando FROM public.tenants
   WHERE email IS NOT NULL AND email <> '' AND email NOT LIKE '%@exemplo.test';
  IF sobrando > 0 THEN
    RAISE EXCEPTION 'Reset DEV: % inquilino(s) ainda com e-mail real -- reset cancelado.', sobrando;
  END IF;

  RAISE NOTICE 'Reset DEV: dados pessoais mascarados e conferidos.';
END $$;

