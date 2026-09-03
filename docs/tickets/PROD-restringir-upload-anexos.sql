-- Issue #74: bucket "uploads" do Supabase Storage aceitava upload público
-- sem login (policy INSERT liberada pra role "public", sem checar nada).
--
-- Agora que o upload de anexo passa por /api/uploads/sign (exige sessão
-- válida do nosso login e gera um link de upload assinado por arquivo --
-- ver src/pages/api/uploads/sign.ts), essa policy pública deixou de ser
-- necessária: o link assinado autoriza o upload sozinho, sem depender de
-- nenhuma policy de INSERT.
--
-- ⚠️ SÓ RODAR DEPOIS que o deploy com o código novo (issue #74) já estiver
-- em produção e confirmado funcionando (subir anexo em Locação, Recebimento
-- de Aluguel e Recebimento de Caução, testando os três). Rodar isso ANTES
-- do deploy quebra o upload pra quem ainda estiver na versão antiga do
-- código.
--
-- Rodar em DEV primeiro, testar upload de anexo nas 3 telas, só depois em
-- PRODUÇÃO.
--
-- A policy "Public can view uploaded files" (SELECT) NÃO é tocada aqui --
-- ela é o que deixa o link do anexo abrir direto no navegador depois de
-- salvo. Isso é outro assunto (issue #73, item 2 -- se dá pra LISTAR todos
-- os arquivos do bucket, não só ler um pela URL exata), tratado à parte.

DROP POLICY IF EXISTS "Public can upload files" ON storage.objects;

-- Confirma o que sobrou: só "Authenticated users can upload files" (que já
-- era uma policy morta -- este sistema nunca usa o login de verdade do
-- Supabase, então role "authenticated" nunca acontece de fato) deve
-- continuar existindo pra INSERT no bucket "uploads".
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' AND qual::text LIKE '%uploads%'
ORDER BY cmd, policyname;
