-- ✅ TESTE: Desabilitar a trigger temporariamente para confirmar se ela é a causa
ALTER TABLE tenants DISABLE TRIGGER update_tenants_updated_at;