-- Fecha a função antiga de troca de senha para quem não está logado.
--
-- A função reset_user_password_by_token podia ser chamada direto com a chave
-- pública do site. O sistema não usa mais esse caminho (a recuperação de senha
-- hoje é por senha temporária, feita pelo servidor), então ninguém perde nada.
-- Aplicado em PROD e DEV em 16/nov/2026. Pode rodar de novo sem estragar.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reset_user_password_by_token'
  LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || f.sig || ' FROM PUBLIC, anon, authenticated';
  END LOOP;
END $$;
