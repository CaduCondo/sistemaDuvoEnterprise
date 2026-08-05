-- ✅ CORREÇÃO FINAL: Recriar função usando COALESCE + NULLIF para preservar valores quando parâmetros são vazios
DROP FUNCTION IF EXISTS update_tenant_raw(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_tenant_raw(
  p_tenant_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_cpf TEXT DEFAULT NULL,
  p_rg TEXT DEFAULT NULL,
  p_occupation TEXT DEFAULT NULL,
  p_document TEXT DEFAULT NULL,
  p_marital_status TEXT DEFAULT NULL,
  p_monthly_income NUMERIC DEFAULT NULL,
  p_document_type TEXT DEFAULT NULL,
  p_zip_code TEXT DEFAULT NULL,
  p_street TEXT DEFAULT NULL,
  p_number TEXT DEFAULT NULL,
  p_complement TEXT DEFAULT NULL,
  p_neighborhood TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- ✅ CORREÇÃO: Usar COALESCE + NULLIF para preservar valores quando parâmetros são vazios
  -- NULLIF(p_campo, '') converte string vazia em NULL
  -- COALESCE(NULL, campo_atual) mantém o valor atual quando o parâmetro é NULL
  UPDATE tenants
  SET 
    name = p_name,
    email = p_email,
    phone = p_phone,
    cpf = COALESCE(NULLIF(p_cpf, ''), cpf),
    rg = COALESCE(NULLIF(p_rg, ''), rg),
    occupation = COALESCE(NULLIF(p_occupation, ''), occupation),
    document = COALESCE(NULLIF(p_document, ''), document),
    marital_status = COALESCE(NULLIF(p_marital_status, ''), marital_status),
    monthly_income = COALESCE(NULLIF(p_monthly_income, 0), monthly_income),
    document_type = COALESCE(NULLIF(p_document_type, ''), document_type),
    zip_code = COALESCE(NULLIF(p_zip_code, ''), zip_code),
    street = COALESCE(NULLIF(p_street, ''), street),
    number = COALESCE(NULLIF(p_number, ''), number),
    complement = COALESCE(NULLIF(p_complement, ''), complement),
    neighborhood = COALESCE(NULLIF(p_neighborhood, ''), neighborhood),
    city = COALESCE(NULLIF(p_city, ''), city),
    state = COALESCE(NULLIF(p_state, ''), state),
    status = COALESCE(NULLIF(p_status, ''), status),
    updated_at = NOW()
  WHERE id = p_tenant_id
  RETURNING to_jsonb(tenants.*) INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Inquilino não encontrado: %', p_tenant_id;
  END IF;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION update_tenant_raw IS 'Atualiza inquilino preservando valores NULL com COALESCE + NULLIF - CORREÇÃO FINAL';