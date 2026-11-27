-- Issue #54: o sistema nao registrava QUEM criou/alterou imoveis, inquilinos,
-- locacoes e recebimentos. Desenho (decidido em 26/nov/2026):
--   1) o navegador manda o id do usuario logado no cabecalho `x-sistema-user-id`
--      (src/integrations/supabase/client.ts); o login e proprio (nao usa Supabase
--      Auth), entao o banco nao tem outra forma de saber quem e;
--   2) colunas created_by / updated_by nas 4 tabelas, preenchidas por gatilho (a
--      tela nao precisa lembrar de mandar);
--   3) gatilho grava cada criacao/alteracao/exclusao em audit_logs (que nao pode
--      ser alterada nem apagada pelas telas), com o autor.
-- O cabecalho NAO e prova de identidade (qualquer um com a chave publica poderia
-- mentir); serve de TRILHA de auditoria. A seguranca de verdade e a #94/#123.

CREATE OR REPLACE FUNCTION public.usuario_da_requisicao()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  cabecalhos text;
  valor text;
BEGIN
  BEGIN
    cabecalhos := current_setting('request.headers', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF cabecalhos IS NULL OR cabecalhos = '' THEN RETURN NULL; END IF;
  BEGIN
    valor := (cabecalhos::json)->>'x-sistema-user-id';
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF valor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN valor::uuid;
  END IF;
  RETURN NULL;
END;
$$;

ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS created_by uuid, ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.tenants    ADD COLUMN IF NOT EXISTS created_by uuid, ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.rentals    ADD COLUMN IF NOT EXISTS created_by uuid, ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.payments   ADD COLUMN IF NOT EXISTS created_by uuid, ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Antes de gravar: preenche o autor.
CREATE OR REPLACE FUNCTION public.trg_autoria_antes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  u uuid := public.usuario_da_requisicao();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN NEW.created_by := u; END IF;
    NEW.updated_by := COALESCE(NEW.updated_by, u);
  ELSE
    NEW.created_by := OLD.created_by;   -- quem criou nunca muda
    NEW.updated_by := u;                -- NULL = alteracao sem usuario identificado
  END IF;
  RETURN NEW;
END;
$$;

-- Depois de gravar: registra em audit_logs. Nunca derruba a gravacao principal.
CREATE OR REPLACE FUNCTION public.trg_autoria_depois()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u uuid := public.usuario_da_requisicao();
  entidade text;
  ignorar text[] := ARRAY['updated_at','updated_by','created_at','created_by'];
  pesadas text[] := ARRAY['attachments','photos','images','breakdown','partial_payments','values_before_agreement'];
  antigo jsonb := '{}'::jsonb;
  novo jsonb := '{}'::jsonb;
  chave text;
  mudadas text[] := ARRAY[]::text[];
  linha_antiga jsonb;
  linha_nova jsonb;
  acao text;
  id_registro uuid;
  u_log uuid;
BEGIN
  entidade := CASE TG_TABLE_NAME
    WHEN 'properties' THEN 'property'
    WHEN 'tenants'    THEN 'tenant'
    WHEN 'rentals'    THEN 'rental'
    WHEN 'payments'   THEN 'payment'
    ELSE TG_TABLE_NAME END;

  BEGIN
    -- audit_logs.user_id e chave para system_users: id que nao existe ali entra como NULL (o registro nao se perde).
    u_log := CASE WHEN u IS NOT NULL AND EXISTS (SELECT 1 FROM public.system_users WHERE id = u) THEN u ELSE NULL END;
    IF TG_OP = 'INSERT' THEN
      acao := 'create'; id_registro := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
      acao := 'delete'; id_registro := OLD.id;
      -- Exclusao: guarda o registro (sem campos pesados). Inquilino: so o id (dados pessoais).
      IF TG_TABLE_NAME <> 'tenants' THEN
        antigo := to_jsonb(OLD) - pesadas - ignorar;
      END IF;
    ELSE
      acao := 'update'; id_registro := NEW.id;
      linha_antiga := to_jsonb(OLD); linha_nova := to_jsonb(NEW);
      FOR chave IN SELECT jsonb_object_keys(linha_nova) LOOP
        IF chave = ANY(ignorar) THEN CONTINUE; END IF;
        IF linha_antiga->chave IS DISTINCT FROM linha_nova->chave THEN
          mudadas := mudadas || chave;
          -- Inquilino: so o NOME das colunas (dados pessoais ficam fora do log, que e legivel pela tela).
          IF TG_TABLE_NAME <> 'tenants' AND NOT (chave = ANY(pesadas)) THEN
            antigo := antigo || jsonb_build_object(chave, linha_antiga->chave);
            novo   := novo   || jsonb_build_object(chave, linha_nova->chave);
          END IF;
        END IF;
      END LOOP;
      -- Mudou so campo de controle (ex.: updated_at)? Nao polui o log.
      IF array_length(mudadas, 1) IS NULL THEN RETURN NEW; END IF;
    END IF;

    INSERT INTO public.audit_logs (user_id, action_type, entity_type, entity_id, old_values, new_values, changes_summary, metadata)
    VALUES (
      u_log, acao, entidade, id_registro,
      NULLIF(antigo, '{}'::jsonb), NULLIF(novo, '{}'::jsonb),
      CASE WHEN array_length(mudadas, 1) IS NULL THEN NULL ELSE 'Campos alterados: ' || array_to_string(mudadas, ', ') END,
      jsonb_build_object('origem', 'banco', 'tabela', TG_TABLE_NAME, 'sem_usuario_identificado', u_log IS NULL, 'usuario_informado', u, 'campos', to_jsonb(mudadas))
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trilha de autoria falhou em %: %', TG_TABLE_NAME, SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['properties','tenants','rentals','payments'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS a_autoria_antes ON public.%I', t);
    EXECUTE format('CREATE TRIGGER a_autoria_antes BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trg_autoria_antes()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS z_autoria_depois ON public.%I', t);
    EXECUTE format('CREATE TRIGGER z_autoria_depois AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trg_autoria_depois()', t);
  END LOOP;
END $$;
