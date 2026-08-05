-- ✅ LIMPAR: Dropar TODAS as funções RPC problemáticas que criamos
DROP FUNCTION IF EXISTS force_update_tenant CASCADE;
DROP FUNCTION IF EXISTS update_tenant_direct CASCADE;
DROP FUNCTION IF EXISTS update_tenant_raw CASCADE;