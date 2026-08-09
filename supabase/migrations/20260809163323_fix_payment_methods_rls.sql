-- Corrige a RLS de payment_methods, que estava exigindo auth.uid() IS NOT NULL
-- (sessão real do Supabase Auth). Este sistema usa login próprio (system_users),
-- nunca cria sessão do Supabase Auth — então essa regra bloqueava a leitura
-- para todo mundo. Alinha com o padrão "Public Access" já usado no resto do
-- banco (o controle de acesso é feito na aplicação, não no banco).

DROP POLICY IF EXISTS "Todos podem ler formas de pagamento" ON payment_methods;
DROP POLICY IF EXISTS "Apenas admin pode inserir formas de pagamento" ON payment_methods;
DROP POLICY IF EXISTS "Apenas admin pode atualizar formas de pagamento" ON payment_methods;
DROP POLICY IF EXISTS "Apenas admin pode deletar formas de pagamento" ON payment_methods;

CREATE POLICY "Public Access" ON payment_methods FOR ALL USING (true);
