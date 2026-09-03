-- ============================================================================
-- PRODUÇÃO -- remove tabelas e funções confirmadas sem uso (achado na
-- auditoria de segurança + limpeza pedida pelo Cadu, 03/set/2026)
--
-- NÃO RODE ISTO ÀS CEGAS. Cada bloco tem o motivo de por que o item está
-- morto. Leia, confira se faz sentido, e só então rode em produção -- e
-- SEMPRE PRIMEIRO EM DEV, pra conferir que nada quebra.
--
-- Como foi confirmado: busquei ".from('nome')" e ".rpc('nome')" em todo o
-- código do site (src/), nos testes automáticos (e2e/) e nos scripts
-- (scripts/) -- zero ocorrência pra cada item abaixo. Ou seja, nenhuma tela
-- e nenhum teste usa isso hoje.
--
-- Isto NÃO apaga dado nenhum das tabelas que o sistema usa de verdade
-- (properties, rentals, tenants, payments, etc.) -- só remove o que sobrou
-- de versões antigas/abandonadas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- GRUPO 1: sobra de uma tentativa (nunca concluída) de trocar o login
-- próprio do sistema pelo login do Supabase. auth_user_mapping guardava a
-- ligação entre um login real do Supabase (auth.users) e o usuário do
-- sistema (system_users) -- como essa troca nunca foi pra frente, a tabela
-- nunca foi populada de verdade em uso normal.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.auth_user_mapping CASCADE;
DROP FUNCTION IF EXISTS public.authenticate_user_secure CASCADE;
DROP FUNCTION IF EXISTS public.authenticate_user_simple CASCADE;
DROP FUNCTION IF EXISTS public.create_auth_mapping_for_migration CASCADE;
DROP FUNCTION IF EXISTS public.migrate_system_user_to_auth CASCADE;
DROP FUNCTION IF EXISTS public.migrate_user_to_auth CASCADE;
DROP FUNCTION IF EXISTS public.sync_user_to_auth CASCADE;
DROP FUNCTION IF EXISTS public.verify_password CASCADE;
DROP FUNCTION IF EXISTS public.user_has_location_access CASCADE;

-- ----------------------------------------------------------------------------
-- GRUPO 2: versão antiga de isenção de taxa. A versão atual (usada de
-- verdade hoje) é admin_fee_exempt_locations + management_fee_exempt_locations.
-- ⚠️ Antes de rodar este grupo: docs/REGRAS_DE_NEGOCIO.md ainda cita
-- user_fee_exemptions como se fosse a atual -- corrigir a documentação
-- junto (ver ticket).
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.broker_fee_exemptions CASCADE;
DROP TABLE IF EXISTS public.user_fee_exemptions CASCADE;

-- ----------------------------------------------------------------------------
-- GRUPO 3: forma antiga de guardar rescisão, substituída pela tabela
-- payments com payment_kind (ver ticket #59/#63).
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.rental_terminations CASCADE;

-- ----------------------------------------------------------------------------
-- GRUPO 4: funções auxiliares de dashboard/listagem que nunca chegaram a
-- ser chamadas pela tela -- o dashboard e as listagens hoje usam outras
-- consultas (inclusive mv_monthly_revenue e mv_monthly_payments, que
-- CONTINUAM em uso -- não fazem parte deste grupo).
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.dashboard_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_dashboard_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_monthly_expenses CASCADE;
DROP FUNCTION IF EXISTS public.get_available_properties CASCADE;
DROP FUNCTION IF EXISTS public.get_properties_with_locations CASCADE;
DROP FUNCTION IF EXISTS public.get_expected_revenue CASCADE;
DROP FUNCTION IF EXISTS public.get_overdue_payments_count CASCADE;
DROP FUNCTION IF EXISTS public.get_correct_due_date CASCADE;
DROP FUNCTION IF EXISTS public.get_valid_due_date CASCADE;
DROP FUNCTION IF EXISTS public.calculate_correct_payment_status CASCADE;
DROP FUNCTION IF EXISTS public.delete_location_permanently CASCADE;

-- ----------------------------------------------------------------------------
-- GRUPO 5: tentativas descartadas de "atualizar inquilino". Só
-- update_tenant_guaranteed vingou e continua em uso -- não faz parte deste
-- grupo.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_tenant_atomic CASCADE;
DROP FUNCTION IF EXISTS public.update_tenant_force CASCADE;
DROP FUNCTION IF EXISTS public.update_tenant_with_verification CASCADE;

-- ----------------------------------------------------------------------------
-- GRUPO 6: tabela de teste/rascunho -- pelo nome, nunca devia ter ido pra
-- produção.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.test_properties_only CASCADE;

-- ============================================================================
-- CONFERE -- roda de novo a varredura geral de tabelas/funções depois, pra
-- confirmar que a lista de "sem uso" ficou vazia.
-- ============================================================================
