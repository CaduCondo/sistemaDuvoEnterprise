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
  
  const dbData: any = {};
  
  if (data.name !== undefined) dbData.name = data.name;
  if (data.email !== undefined) dbData.email = data.email;
  if (data.phone !== undefined) dbData.phone = data.phone;
  
  // 🔥 MAPEAMENTO DE STATUS - banco só aceita: active, inactive, rented
  // Frontend usa "new" mas banco usa "active"
  if (data.status !== undefined) {
    const statusMap: Record<string, string> = {
      "new": "active",
      "active": "active",
      "rented": "rented",
      "inactive": "inactive"
    };
    dbData.status = statusMap[data.status] || "active";
    console.log(`📋 [tenantService.toDatabase] Status mapeado: ${data.status} → ${dbData.status}`);
  }
  
  if (data.rg !== undefined && data.rg !== "") dbData.rg = data.rg;
  
  // ✅ NOVOS CAMPOS OPCIONAIS (verificar se existe antes de gravar)
  if (data.occupation !== undefined && data.occupation !== "") {
    dbData.occupation = data.occupation;
  }
  if (data.marital_status !== undefined && data.marital_status !== "") {
    dbData.marital_status = data.marital_status;
  } else if (data.maritalStatus !== undefined && data.maritalStatus !== "") {
    dbData.marital_status = data.maritalStatus;
  }
  if (data.monthly_income !== undefined && data.monthly_income !== null) {
    dbData.monthly_income = typeof data.monthly_income === 'string' 
      ? parseFloat(data.monthly_income) 
      : data.monthly_income;
  } else if (data.monthlyIncome !== undefined && data.monthlyIncome !== null) {
    dbData.monthly_income = typeof data.monthlyIncome === 'string' 
      ? parseFloat(data.monthlyIncome) 
      : data.monthlyIncome;
  }
  
  if (data.cep !== undefined && data.cep !== "") dbData.zip_code = data.cep;
  if (data.street !== undefined && data.street !== "") dbData.street = data.street;
  if (data.number !== undefined && data.number !== "") dbData.number = data.number;
  if (data.complement !== undefined && data.complement !== "") dbData.complement = data.complement;
  if (data.neighborhood !== undefined && data.neighborhood !== "") dbData.neighborhood = data.neighborhood;
  if (data.city !== undefined && data.city !== "") dbData.city = data.city;
  if (data.state !== undefined && data.state !== "") dbData.state = data.state;
  
  // Determinar tipo de documento
  const docType = data.documentType || data.document_type || "cpf";
  dbData.document_type = docType;
  
  console.log("📋 [tenantService.toDatabase] Tipo de documento:", docType);
  console.log("📋 [tenantService.toDatabase] CPF:", data.cpf);
  console.log("📋 [tenantService.toDatabase] CNPJ:", data.cnpj);
  console.log("📋 [tenantService.toDatabase] Document:", data.document);
  
  // ✅ CORREÇÃO CRÍTICA: Gravar APENAS em 'document' e 'cpf', NUNCA em 'cnpj' (coluna não existe)
  if (docType === "cpf") {
    const cpfValue = data.cpf || data.document || "";
    if (cpfValue && cpfValue !== "") {
      dbData.document = cpfValue;
      dbData.cpf = cpfValue;
      console.log("✅ [tenantService.toDatabase] CPF definido:", cpfValue);
    }
  } else if (docType === "cnpj") {
    const cnpjValue = data.cnpj || data.document || "";
    if (cnpjValue && cnpjValue !== "") {
      dbData.document = cnpjValue;  // ✅ Gravar CNPJ em 'document', NÃO em 'cnpj'
      dbData.cpf = null;  // Limpar CPF quando for CNPJ
      console.log("✅ [tenantService.toDatabase] CNPJ definido em 'document':", cnpjValue);
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
    console.log("✅ [tenantService.toDatabase] Document genérico definido:", data.document);
  }
  
  console.log("📤 [tenantService.toDatabase] Dados para banco:", dbData);
  
  return dbData;
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
    
    // ✅ NOVA LÓGICA: Respeitar SEMPRE o status do banco, exceto quando há locação ativa
    let finalStatus: "new" | "rented" | "inactive";
    
    // ÚNICA EXCEÇÃO: Se tem locação ativa, SEMPRE é "rented" (sobrescreve qualquer status manual)
    if (rentalStatuses.includes("active")) {
      finalStatus = "rented";
      console.log(`📌 [tenantService] Inquilino ${tenant.name}: status 'rented' (tem locação ativa - SOBRESCRITO)`);
    }
    // CASO CONTRÁRIO: Respeitar o status do banco
    else if (data.status === "inactive") {
      finalStatus = "inactive";
      console.log(`📌 [tenantService] Inquilino ${tenant.name}: status 'inactive' (respeitando banco)`);
    }
    else if (data.status === "rented") {
      finalStatus = "rented";
      console.log(`📌 [tenantService] Inquilino ${tenant.name}: status 'rented' (respeitando banco)`);
    }
    else {
      // Status do banco é "active" → mostrar como "new"
      finalStatus = "new";
      console.log(`📌 [tenantService] Inquilino ${tenant.name}: status 'new' (respeitando banco)`);
    }
    
    return {
      ...tenant,
      status: finalStatus,
    };
  });
  
  const uniqueStatuses = [...new Set(result.map(t => t.status))];
  console.log(`✅ [tenantService] Status únicos encontrados:`, uniqueStatuses);
  console.log(`📊 [tenantService] Resumo: ${result.filter(t => t.status === "new").length} novos, ${result.filter(t => t.status === "rented").length} locatários, ${result.filter(t => t.status === "inactive").length} inativos`);
  
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
  
  // ✅ Registrar log de auditoria
  await logAudit({
    action_type: "create",
    entity_type: "tenant",
    entity_id: tenant.id,
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
    
    // ✅ CORREÇÃO: Usar toDatabase para garantir mapeamento correto
    const updateData = toDatabase(data);
    
    console.log("🔍 [updateTenant] Dados APÓS toDatabase (ENVIADOS ao Supabase):", JSON.stringify(updateData, null, 2));
    console.log("🔍 [updateTenant] Campos presentes:", Object.keys(updateData));
    console.log("🔍 [updateTenant] Tem 'cnpj'?", 'cnpj' in updateData, "← Coluna NÃO EXISTE no banco!");
    console.log("🔍 [updateTenant] Tem 'status'?", 'status' in updateData, "→", updateData.status);
    console.log("🔍 [updateTenant] Tem 'document'?", 'document' in updateData, "→", updateData.document);
    console.log("🔍 [updateTenant] Tem 'cpf'?", 'cpf' in updateData, "→", updateData.cpf);

    console.log("\n📡 [updateTenant] Executando UPDATE no Supabase...");
    const { data: tenant, error } = await supabase
      .from("tenants")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("❌ [updateTenant] ERRO DO SUPABASE:");
      console.error("   - message:", error.message);
      console.error("   - details:", error.details);
      console.error("   - hint:", error.hint);
      console.error("   - code:", error.code);
      console.error("   - Erro completo:", JSON.stringify(error, null, 2));
      throw error;
    }

    console.log("✅ [updateTenant] UPDATE executado com SUCESSO!");
    console.log("✅ [updateTenant] Dados RETORNADOS do banco:", JSON.stringify(tenant, null, 2));
    
    // ✅ Registrar log de auditoria
    if (tenant) {
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
          name: tenant.name,
          email: tenant.email,
          phone: tenant.phone,
          status: tenant.status,
        },
      });
    }
    
    console.log("🔥 ===== FIM updateTenant =====\n");
    return tenant ? fromDatabase(tenant) : null;
  } catch (error) {
    console.error("❌ [updateTenant] EXCEÇÃO CAPTURADA:");
    console.error(error);
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
    status: data.status as "new" | "rented" | "inactive",
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
  
  // ✅ Registrar log de auditoria
  if (tenantData) {
    await logAudit({
      action_type: "delete",
      entity_type: "tenant",
      entity_id: id,
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

  // ✅ Registrar log de auditoria
  if (tenantData) {
    await logAudit({
      action_type: "delete",
      entity_type: "tenant",
      entity_id: id,
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
  
  console.log(`✅ [tenantService.getActive] ${newTenants.length} inquilinos com status "new" (nunca tiveram locações)`);
  
  return newTenants as unknown as Tenant[];
}