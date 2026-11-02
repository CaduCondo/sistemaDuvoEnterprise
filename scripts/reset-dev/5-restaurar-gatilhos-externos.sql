-- Reset de DEV (issue #36) -- passo 5: recria os gatilhos de OUTROS schemas
-- (ex.: on_auth_user_created em auth.users) que o passo 1 guardou antes de
-- apagar as funções do public. Se a função não existir mais em PROD, o
-- gatilho não é recriado (só avisa) -- igual ao que existe em PROD.

SET LOCAL client_min_messages = notice;
SET LOCAL search_path = '';

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM reset_dev_gatilhos_externos LOOP
    BEGIN
      EXECUTE r.definicao;
      RAISE NOTICE 'Reset DEV: gatilho % em % recriado.', r.nome, r.tabela;
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Reset DEV: gatilho % em % já existia.', r.nome, r.tabela;
      WHEN undefined_function THEN
        RAISE NOTICE 'Reset DEV: gatilho % em % NÃO recriado (função não existe em PROD).', r.nome, r.tabela;
    END;
  END LOOP;
END $$;
