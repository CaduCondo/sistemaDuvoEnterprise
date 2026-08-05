-- ✅ REABILITAR RLS e TRIGGER (estavam desabilitados para teste)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE TRIGGER update_tenants_updated_at;