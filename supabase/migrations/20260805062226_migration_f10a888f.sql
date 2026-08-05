-- ✅ CORREÇÃO: Dropar e recriar função usando COALESCE para NULL
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
  UPDATE tenants
  SET 
    name = p_name,
    email = p_email,
    phone = p_phone,
    cpf = p_cpf,
    rg = p_rg,
    occupation = p_occupation,
    document = p_document,
    marital_status = p_marital_status,
    monthly_income = p_monthly_income,
    document_type = p_document_type,
    zip_code = p_zip_code,
    street = p_street,
    number = p_number,
    complement = p_complement,
    neighborhood = p_neighborhood,
    city = p_city,
    state = p_state,
    status = p_status,
    updated_at = NOW()
  WHERE id = p_tenant_id
  RETURNING to_jsonb(tenants.*) INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Inquilino não encontrado: %', p_tenant_id;
  END IF;
  
  RETURN v_result;
END;
$$;