import { Tenant } from "@/types";
import { 
  getAll as fetchAll, 
  getSingle, 
  createSingle, 
  updateSingle, 
  deleteSingle 
} from "@/lib/supabaseHelpers";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./auditService";

const TABLE = "tenants";

function toDatabase(data: Partial<Tenant>): any {
  console.log("🔄 [tenantService.toDatabase] Dados recebidos:", data);
  console.log("🔍 [tenantService.toDatabase] Campos recebidos (bruto):", Object.keys(data));
  
  // ✅ CORREÇÃO CRÍTICA: Filtrar undefined/null ANTES de verificar quantidade de campos
  const nonEmptyData: any = {};
  for (const key in data) {
    const value = data[key as keyof Tenant];
    if (value !== undefined && value !== null) {
      nonEmptyData[key] = value;
    }
  }
  
  const receivedKeys = Object.keys(nonEmptyData);
  console.log("🔍 [tenantService.toDatabase] Campos com valor:", receivedKeys);
  
  // ✅ ATALHOS RÁPIDOS: Se recebeu APENAS 1 campo simples, enviar direto (sem processamento complexo)
  if (receivedKeys.length === 1) {
    const singleKey = receivedKeys[0];
    const singleValue = nonEmptyData[singleKey];
    
    // STATUS - enviar direto
    if (singleKey === 'status') {
      console.log("⚡ [tenantService.toDatabase] APENAS status - atalho rápido!");
      console.log(`✅ [tenantService.toDatabase] RETORNANDO: { status: "${singleValue}" }`);
      return { status: singleValue };
    }
    
    // MONTHLY_INCOME - garantir que é número
    if (singleKey === 'monthly_income') {
      const numValue = typeof singleValue === 'string' ? parseFloat(singleValue) : singleValue;
      console.log("⚡ [tenantService.toDatabase] APENAS monthly_income - atalho rápido!");
      console.log(`✅ [tenantService.toDatabase] RETORNANDO: { monthly_income: ${numValue} }`);
      return { monthly_income: numValue };
    }
    
    // PHONE, EMAIL, OCCUPATION - enviar direto como string
    if (['phone', 'email', 'occupation'].includes(singleKey)) {
      console.log(`⚡ [tenantService.toDatabase] APENAS ${singleKey} - atalho rápido!`);
      console.log(`✅ [tenantService.toDatabase] RETORNANDO: { ${singleKey}: "${singleValue}" }`);
      return { [singleKey]: singleValue };
    }
    
    // MARITAL_STATUS - mapear para marital_status
    if (singleKey === 'maritalStatus') {
      console.log("⚡ [tenantService.toDatabase] APENAS maritalStatus - atalho rápido!");
      console.log(`✅ [tenantService.toDatabase] RETORNANDO: { marital_status: "${singleValue}" }`);
      return { marital_status: singleValue };
    }
  }
  
  console.log("📝 [tenantService.toDatabase] Processamento normal (múltiplos campos ou campo que requer processamento)");
  
  // ✅ LISTA DE CAMPOS VÁLIDOS DO SCHEMA 'tenants'
  const VALID_FIELDS = [
    'name', 'email', 'phone', 'status', 'document', 'document_type', 'cpf',
    'rg', 'occupation', 'marital_status', 'monthly_income',
    'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'zip_code'
  ];
  
  const dbData: any = {};
  
  // ✅ CAMPOS OBRIGATÓRIOS
  if (data.name !== undefined && data.name !== "") dbData.name = data.name;
  if (data.email !== undefined && data.email !== "") dbData.email = data.email;
  if (data.phone !== undefined && data.phone !== "") dbData.phone = data.phone;
  
  // ✅ STATUS - ENVIAR DIRETO, SEM MAPEAMENTO (frontend e banco usam mesmos valores)
  if (data.status !== undefined) {
    dbData.status = data.status;
    console.log(`📋 [tenantService.toDatabase] Status: ${data.status} (enviando direto)`);
  }
  
  // ✅ DOCUMENTOS
  if (data.rg !== undefined && data.rg !== "") dbData.rg = data.rg;
  
  const docType = data.documentType || data.document_type || "cpf";
  if (data.documentType !== undefined || data.document_type !== undefined) {
    dbData.document_type = docType;
  }
  
  if (docType === "cpf") {
    const cpfValue = data.cpf || data.document || "";
    if (cpfValue && cpfValue !== "") {
      dbData.document = cpfValue;
      dbData.cpf = cpfValue;
    }
  } else if (docType === "cnpj") {
    const cnpjValue = data.cnpj || data.document || "";
    if (cnpjValue && cnpjValue !== "") {
      dbData.document = cnpjValue;
      dbData.cpf = null;
    }
  } else if (data.document && data.document !== "") {
    dbData.document = data.document;
    const cleanDoc = data.document.replace(/\D/g, "");
    dbData.document_type = cleanDoc.length === 11 ? "cpf" : "cnpj";
    if (cleanDoc.length === 11) {
      dbData.cpf = data.document;
    } else {
      dbData.cpf = null;
    }
  }
  
  // ✅ CAMPOS OPCIONAIS
  if (data.occupation !== undefined && data.occupation !== "") {
    dbData.occupation = data.occupation;
  }
  if (data.marital_status !== undefined && data.marital_status !== "") {
    dbData.marital_status = data.marital_status;
  } else if (data.maritalStatus !== undefined && data.maritalStatus !== "") {
    dbData.marital_status = data.maritalStatus;
  }
  if (data.monthly_income !== undefined && data.monthly_income !== null && data.monthly_income !== 0) {
    dbData.monthly_income = typeof data.monthly_income === 'string' 
      ? parseFloat(data.monthly_income) 
      : data.monthly_income;
  } else if (data.monthlyIncome !== undefined && data.monthlyIncome !== null && data.monthlyIncome !== 0) {
    dbData.monthly_income = typeof data.monthlyIncome === 'string' 
      ? parseFloat(data.monthlyIncome) 
      : data.monthlyIncome;
  }
  
  // ✅ ENDEREÇO
  if (data.cep !== undefined && data.cep !== "") dbData.zip_code = data.cep;
  if (data.street !== undefined && data.street !== "") dbData.street = data.street;
  if (data.number !== undefined && data.number !== "") dbData.number = data.number;
  if (data.complement !== undefined && data.complement !== "") dbData.complement = data.complement;
  if (data.neighborhood !== undefined && data.neighborhood !== "") dbData.neighborhood = data.neighborhood;
  if (data.city !== undefined && data.city !== "") dbData.city = data.city;
  if (data.state !== undefined && data.state !== "") dbData.state = data.state;
  
  // ✅ VALIDAÇÃO FINAL: Remover undefined/null + validar campos
  const cleanedData: any = {};
  for (const key in dbData) {
    const value = dbData[key];
    
    // Verificar se é um campo válido
    if (!VALID_FIELDS.includes(key)) {
      console.error(`❌ [tenantService.toDatabase] CAMPO INVÁLIDO: "${key}" - PULANDO`);
      continue;
    }
    
    // ✅ CRÍTICO: Permitir null explícito (para limpar cpf quando muda para cnpj)
    if (value !== undefined) {
      cleanedData[key] = value;
    }
  }
  
  console.log("📤 [tenantService.toDatabase] PAYLOAD FINAL:", JSON.stringify(cleanedData, null, 2));
  
  return cleanedData;
}

function fromDatabase(data: any): Tenant {
  return {
    ...data,
    documentType: data.document_type || (data.cpf ? "cpf" : data.document ? "cnpj" : "cpf"),
    document_type: data.document_type || (data.cpf ? "cpf" : data.document ? "cnpj" : "cpf"),
    cpf: data.document_type === "cpf" ? data.document : (data.cpf || ""),
    cnpj: data.document_type === "cnpj" ? data.document : "",
    rg: data.rg,
    occupation: data.occupation || "",
    marital_status: data.marital_status || "",
    maritalStatus: data.marital_status || "",
    monthly_income: data.monthly_income || null,
    monthlyIncome: data.monthly_income || null,
    cep: data.zip_code,
    street: data.street,
    number: data.number,
    complement: data.complement,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    status: data.status,
  };
}

export async function getAllTenants(): Promise<Tenant[]> {
  console.log("🔄 [tenantService] Buscando inquilinos e suas locações...");
  
  const tenantsData = await fetchAll<any>(TABLE);
  console.log(`📊 [tenantService] ${tenantsData.length} inquilinos encontrados`);
  
  const { data: rentalsData, error: rentalsError } = await supabase
    .from("rentals")
    .select("tenant_id, status") as any;
  
  if (rentalsError) {
    console.error("❌ [tenantService] Erro ao buscar locações:", rentalsError);
  } else {
    console.log(`📊 [tenantService] ${(rentalsData || []).length} locações encontradas`);
  }
  
  const rentalsMap = new Map<string, string[]>();
  (rentalsData || []).forEach((rental: any) => {
    if (!rentalsMap.has(rental.tenant_id)) {
      rentalsMap.set(rental.tenant_id, []);
    }
    rentalsMap.get(rental.tenant_id)!.push(rental.status);
  });
  
  console.log(`📊 [tenantService] Mapa de locações criado com ${rentalsMap.size} inquilinos`);
  
  const result = tenantsData.map((data) => {
    const tenant = fromDatabase(data);
    const rentalStatuses = rentalsMap.get(tenant.id) || [];
    
    // ✅ NOVA LÓGICA SIMPLIFICADA (sem mapeamento - frontend e banco usam mesmos valores):
    // 1. Se tem locação ativa → SEMPRE é "rented" (sobrescreve qualquer status manual)
    // 2. Se NÃO tem locação ativa E status no banco é "rented" → converter para "active" (disponível)
    // 3. Caso contrário → respeitar o status do banco (active ou inactive)
    
    let finalStatus: "active" | "rented" | "inactive";
    
    // REGRA 1: Se tem locação ativa, SEMPRE é "rented" (sobrescreve qualquer status manual)
    if (rentalStatuses.includes("active")) {
      finalStatus = "rented";
      console.log(`📌 [tenantService] Inquilino ${tenant.name}: status 'rented' (tem locação ativa - SOBRESCRITO)`);
    }
    // REGRA 2: Se NÃO tem locação ativa MAS status no banco é "rented" → converter para "active" (disponível)
    else if (data.status === "rented" && !rentalStatuses.includes("active")) {
      finalStatus = "active";
      console.log(`📌 [tenantService] Inquilino ${tenant.name}: status 'active' (era 'rented' mas NÃO tem locação ativa - CORRIGIDO)`);
    }
    // REGRA 3: Respeitar status do banco para "inactive"
    else if (data.status === "inactive") {
      finalStatus = "inactive";
      console.log(`📌 [tenantService] Inquilino ${tenant.name}: status 'inactive' (respeitando banco)`);
    }
    // REGRA 4: Caso contrário (status "active" no banco) → manter "active"
    else {
      finalStatus = "active";
      console.log(`📌 [tenantService] Inquilino ${tenant.name}: status 'active' (respeitando banco)`);
    }
    
    return {
      ...tenant,
      status: finalStatus,
    };
  });
  
  const uniqueStatuses = [...new Set(result.map(t => t.status))];
  console.log(`✅ [tenantService] Status únicos encontrados:`, uniqueStatuses);
  console.log(`📊 [tenantService] Resumo: ${result.filter(t => t.status === "active").length} disponíveis, ${result.filter(t => t.status === "rented").length} locatários, ${result.filter(t => t.status === "inactive").length} inativos`);
  
  return result;
}

export const getAll = getAllTenants;

export async function getTenantById(id: string): Promise<Tenant> {
  const data = await getSingle<any>(TABLE, id);
  return fromDatabase(data);
}

export const getById = getTenantById;

export async function createTenant(data: Partial<Tenant>): Promise<Tenant> {
  const dbData = toDatabase(data);
  const result = await createSingle<any>(TABLE, dbData);
  const tenant = fromDatabase(result);
  
  // ✅ NOVO FORMATO: Nome Inquilino no resumo
  await logAudit({
    action_type: "create",
    entity_type: "tenant",
    entity_id: tenant.id,
    changes_summary: `Nome Inquilino: ${tenant.name}`,
    new_values: {
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
      status: tenant.status,
    },
  });
  
  return tenant;
}

export const create = createTenant;

export const updateTenant = async (id: string, data: Partial<Tenant>): Promise<Tenant | null> => {
  try {
    console.log("\n🔥 ===== INÍCIO updateTenant =====");
    console.log("🔍 [updateTenant] ID:", id);
    console.log("🔍 [updateTenant] Dados RECEBIDOS do form:", JSON.stringify(data, null, 2));
    
    // ✅ Buscar valores antigos ANTES de atualizar para log de auditoria
    const { data: oldData } = await supabase
      .from("tenants")
      .select("name, email, phone, status, document, document_type, cpf")
      .eq("id", id)
      .single();
    
    console.log("🔍 [updateTenant] Valores ANTIGOS no banco:", JSON.stringify(oldData, null, 2));
    
    let updateData: any;
    
    try {
      // ✅ Usar toDatabase para garantir mapeamento correto
      updateData = toDatabase(data);
    } catch (validationError: any) {
      console.error("❌ [updateTenant] ERRO NA VALIDAÇÃO toDatabase:");
      console.error("   - message:", validationError.message);
      console.error("   - Dados que causaram erro:", JSON.stringify(data, null, 2));
      throw new Error(`Erro na validação de dados: ${validationError.message}`);
    }
    
    console.log("🔍 [updateTenant] Dados APÓS toDatabase (ENVIADOS ao Supabase):", JSON.stringify(updateData, null, 2));
    console.log("🔍 [updateTenant] Campos presentes:", Object.keys(updateData));

    console.log("\n📡 [updateTenant] Executando UPDATE no Supabase...");
    
    let tenant: any;
    let error: any;
    
    try {
      const result = await supabase
        .from("tenants")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      
      tenant = result.data;
      error = result.error;
    } catch (supabaseError: any) {
      console.error("❌ [updateTenant] EXCEÇÃO DO SUPABASE:");
      console.error("   - Tipo:", typeof supabaseError);
      console.error("   - Message:", supabaseError.message);
      console.error("   - Stack:", supabaseError.stack);
      console.error("   - Objeto completo:", JSON.stringify(supabaseError, null, 2));
      throw supabaseError;
    }

    if (error) {
      console.error("❌ [updateTenant] ERRO DO SUPABASE:");
      console.error("   - message:", error.message);
      console.error("   - details:", error.details);
      console.error("   - hint:", error.hint);
      console.error("   - code:", error.code);
      console.error("   - Erro completo:", JSON.stringify(error, null, 2));
      console.error("\n🔍 [updateTenant] DADOS QUE CAUSARAM O ERRO:");
      console.error("   - updateData enviado:", JSON.stringify(updateData, null, 2));
      console.error("   - Campos enviados:", Object.keys(updateData));
      
      // ✅ Tentar identificar campo problemático
      for (const key in updateData) {
        console.error(`   - Campo "${key}": ${typeof updateData[key]} = ${JSON.stringify(updateData[key])}`);
      }
      
      throw error;
    }

    console.log("✅ [updateTenant] UPDATE executado com SUCESSO!");
    console.log("✅ [updateTenant] Dados RETORNADOS do banco:", JSON.stringify(tenant, null, 2));
    
    // ✅ NOVO FORMATO: Nome Inquilino + mudanças campo a campo
    if (tenant && oldData) {
      const changes: string[] = [];
      
      // ✅ SEM MAPEAMENTO - frontend e banco usam mesmos valores
      const oldStatus = oldData.status;
      const newStatus = tenant.status;
      
      if (oldData.name !== tenant.name) {
        changes.push(`name: de=${oldData.name} -> para=${tenant.name}`);
      }
      if (oldData.email !== tenant.email) {
        changes.push(`email: de=${oldData.email || '-'} -> para=${tenant.email || '-'}`);
      }
      if (oldData.phone !== tenant.phone) {
        changes.push(`phone: de=${oldData.phone || '-'} -> para=${tenant.phone || '-'}`);
      }
      if (oldStatus !== newStatus) {
        changes.push(`status: de=${oldStatus} -> para=${newStatus}`);
      }
      
      const changesSummary = changes.length > 0 
        ? `Nome Inquilino: ${tenant.name}\n${changes.join('\n')}`
        : `Nome Inquilino: ${tenant.name}`;
      
      await logAudit({
        action_type: "update",
        entity_type: "tenant",
        entity_id: id,
        changes_summary: changesSummary,
        old_values: oldData ? {
          name: oldData.name,
          email: oldData.email,
          phone: oldData.phone,
          status: oldStatus,
        } : undefined,
        new_values: {
          name: tenant.name,
          email: tenant.email,
          phone: tenant.phone,
          status: newStatus,
        },
      });
    }
    
    console.log("🔥 ===== FIM updateTenant =====\n");
    return tenant ? fromDatabase(tenant) : null;
  } catch (error: any) {
    console.error("❌ [updateTenant] EXCEÇÃO CAPTURADA NO NÍVEL MAIS ALTO:");
    console.error("   - Tipo:", typeof error);
    console.error("   - Message:", error.message);
    console.error("   - Code:", error.code);
    console.error("   - Details:", error.details);
    console.error("   - Hint:", error.hint);
    console.error("   - Stack:", error.stack);
    console.log("🔥 ===== FIM updateTenant (COM ERRO) =====\n");
    throw error;
  }
};

export const update = async (
  id: string,
  tenant: Partial<Omit<Tenant, "id" | "createdAt">>
): Promise<Tenant> => {
  // ✅ Buscar valores antigos ANTES de atualizar
  const { data: oldData } = await supabase
    .from("tenants")
    .select("name, email, phone, status")
    .eq("id", id)
    .single();

  const updateData: any = {};

  if (tenant.name !== undefined) updateData.name = tenant.name;
  if (tenant.email !== undefined) updateData.email = tenant.email;
  if (tenant.phone !== undefined) updateData.phone = tenant.phone;
  if (tenant.cpf !== undefined) updateData.cpf = tenant.cpf;
  if (tenant.rg !== undefined) updateData.rg = tenant.rg;
  if (tenant.status !== undefined) updateData.status = tenant.status;

  const { data, error } = await supabase
    .from("tenants")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // ✅ Registrar log de auditoria
  await logAudit({
    action_type: "update",
    entity_type: "tenant",
    entity_id: id,
    old_values: oldData ? {
      name: oldData.name,
      email: oldData.email,
      phone: oldData.phone,
      status: oldData.status,
    } : undefined,
    new_values: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      status: data.status,
    },
  });

  // ✅ CORREÇÃO: Fazer cast do status para o tipo literal correto
  return {
    ...data,
    status: data.status as "active" | "rented" | "inactive",
  } as Tenant;
};

export async function deleteTenant(id: string): Promise<void> {
  const { data: activeRentals, error: rentalError } = await supabase
    .from("rentals")
    .select("id, status")
    .eq("tenant_id", id)
    .eq("status", "active");

  if (rentalError) {
    console.error("❌ Erro ao verificar locações:", rentalError);
    throw rentalError;
  }

  if (activeRentals && activeRentals.length > 0) {
    throw new Error(
      "Não é possível deletar este inquilino porque ele está como locatário em uma locação ativa. " +
      "Encerre ou rescinda o contrato de locação antes de deletar o inquilino."
    );
  }

  // ✅ Buscar dados ANTES de deletar para log de auditoria
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("name, email, phone")
    .eq("id", id)
    .single();

  await deleteSingle(TABLE, id);
  
  // ✅ NOVO FORMATO: Nome Inquilino no resumo
  if (tenantData) {
    await logAudit({
      action_type: "delete",
      entity_type: "tenant",
      entity_id: id,
      changes_summary: `Nome Inquilino: ${tenantData.name}`,
      old_values: {
        name: tenantData.name,
        email: tenantData.email,
        phone: tenantData.phone,
      },
    });
  }
}

export const remove = async (id: string): Promise<void> => {
  // ✅ Buscar dados ANTES de deletar
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("name, email, phone")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("tenants").delete().eq("id", id);

  if (error) throw error;

  // ✅ NOVO FORMATO: Nome Inquilino no resumo
  if (tenantData) {
    await logAudit({
      action_type: "delete",
      entity_type: "tenant",
      entity_id: id,
      changes_summary: `Nome Inquilino: ${tenantData.name}`,
      old_values: {
        name: tenantData.name,
        email: tenantData.email,
        phone: tenantData.phone,
      },
    });
  }
};

export async function getActive(): Promise<Tenant[]> {
  console.log("🔄 [tenantService.getActive] Buscando inquilinos disponíveis (apenas status 'new')...");
  
  const { data: tenantsData, error: tenantsError } = await supabase
    .from("tenants")
    .select("id, name, status")
    .order("name");

  if (tenantsError) {
    console.error("❌ [tenantService.getActive] Erro ao buscar inquilinos:", tenantsError);
    throw tenantsError;
  }

  console.log(`📊 [tenantService.getActive] ${(tenantsData || []).length} inquilinos encontrados`);
  
  const { data: rentalsData, error: rentalsError } = await supabase
    .from("rentals")
    .select("tenant_id, status") as any;
  
  if (rentalsError) {
    console.error("❌ [tenantService.getActive] Erro ao buscar locações:", rentalsError);
  }
  
  const rentalsMap = new Map<string, string[]>();
  (rentalsData || []).forEach((rental: any) => {
    if (!rentalsMap.has(rental.tenant_id)) {
      rentalsMap.set(rental.tenant_id, []);
    }
    rentalsMap.get(rental.tenant_id)!.push(rental.status);
  });
  
  console.log(`📊 [tenantService.getActive] Mapa de locações criado com ${rentalsMap.size} inquilinos que já tiveram/têm locações`);
  
  const newTenants = (tenantsData || []).filter(
    (tenant: any) => !rentalsMap.has(tenant.id)
  );
  
  console.log(`✅ [tenantService.getActive] ${newTenants.length} inquilinos com status "active" (nunca tiveram locações)`);
  
  return newTenants as unknown as Tenant[];
}