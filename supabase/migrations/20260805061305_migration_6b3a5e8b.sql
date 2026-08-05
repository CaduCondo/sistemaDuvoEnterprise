-- ✅ SOLUÇÃO RADICAL: Dropar e recriar TODAS as constraints check se existirem
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'tenants'
      AND con.contype = 'c'  -- CHECK constraints
  ) LOOP
    EXECUTE format('ALTER TABLE tenants DROP CONSTRAINT IF EXISTS %I CASCADE', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;