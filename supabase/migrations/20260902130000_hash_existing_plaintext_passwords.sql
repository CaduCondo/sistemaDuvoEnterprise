-- Converte as senhas de system_users.password_hash de texto puro para hash
-- bcrypt (pgcrypto), usando o próprio Postgres.
--
-- Contexto (issue #67 no GitHub, card "Segurança: senhas gravadas em texto
-- puro em system_users" no kanban interno): a coluna sempre guardou a senha
-- literal -- o nome sempre enganou. Isso foi achado pelo Cadu rodando um
-- `select * from system_users` em PRODUÇÃO por curiosidade.
--
-- Por que dá para fazer isso com segurança: o valor gravado hoje JÁ É a
-- senha (em texto puro), então não precisa "adivinhar" nada -- só embaralhar
-- o que já está lá. `crypt(valor, gen_salt('bf'))` é bcrypt de verdade
-- (mesmo formato "$2a$"/"$2b$" que a biblioteca bcryptjs usada no código
-- entende, ver src/lib/passwordHash.ts).
--
-- O `WHERE password_hash NOT LIKE '$2%'` faz esta migration não mexer duas
-- vezes num valor que já é hash -- pode rodar mais de uma vez sem problema
-- (ex.: se algum usuário novo já tiver sido criado com hash entre uma rodada
-- e outra).
--
-- RODAR PRIMEIRO EM DEV, DEPOIS EM PROD -- pelo SQL Editor do Supabase (é o
-- Cadu quem roda; este ambiente não alcança *.supabase.co).

create extension if not exists pgcrypto;

update system_users
set password_hash = crypt(password_hash, gen_salt('bf'))
where password_hash is not null
  and password_hash <> ''
  and password_hash not like '$2%';

-- Conferir depois de rodar: a query abaixo deve devolver ZERO linhas --
-- se devolver alguma, é sinal de que sobrou senha em texto puro.
--
-- select id, username, email from system_users
-- where password_hash is not null and password_hash not like '$2%';
