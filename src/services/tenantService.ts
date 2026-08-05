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
  console.log("🔄 [tenantService.toDatabase] Dados recebidos:", JSON.stringify(data, null, 2));
  
  // ✅ ULTRA-SIMPLES: Criar objeto com TODOS os campos SEMPRE
  const dbData: any = {
    // CAMPOS OBRIGATÓRIOS
    name: data.name || "",
    email: data.email || "",
    phone: data.phone || "",
    status: data.status || "active",
    
    // CAMPOS OPCIONAIS - null se vazio
    cpf: data.cpf || null,
    rg: data.rg || null,
    occupation: data.occupation || null,
    marital_status: data.marital_status || data.maritalStatus || null,
    monthly_income: null, // Vai ser calculado abaixo
    document_type: data.document_type || data.documentType || "cpf",
    zip_code: data.cep || null,
    street: data.street || null,
    number: data.number || null,
    complement: data.complement || null,
    neighborhood: data.neighborhood || null,
    city: data.city || null,
    state: data.state || null,
  };
  
  // ✅ CAMPO DOCUMENT - baseado no document_type
  if (dbData.document_type === "cpf") {
    dbData.document = data.cpf || null;
  } else {
    dbData.document = data.cnpj || null;
  }
  
  // ✅ MONTHLY_INCOME
  if (data.monthly_income !== undefined && data.monthly_income !== null) {
    const raw = typeof data.monthly_income === 'string' ? parseFloat(data.monthly_income) : data.monthly_income;
    dbData.monthly_income = !isNaN(raw) && raw > 0 ? Math.round(raw * 100) / 100 : null;
  } else if (data.monthlyIncome !== undefined && data.monthlyIncome !== null) {
    const raw = typeof data.monthlyIncome === 'string' ? parseFloat(data.monthlyIncome) : data.monthlyIncome;
    dbData.monthly_income = !isNaN(raw) && raw > 0 ? Math.round(raw * 100) / 100 : null;
  }
  
  console.log("📤 [tenantService.toDatabase] PAYLOAD FINAL:", JSON.stringify(dbData, null, 2));
  console.log("📤 [tenantService.toDatabase] Campos incluídos:", Object.keys(dbData).length);
  
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
  console.log("\n🔥 ===== createTenant =====");
  console.log("🔍 Dados recebidos:", JSON.stringify(data, null, 2));
  
  // ✅ VALIDAÇÃO: Email único
  if (data.email) {
    const { data: existingTenant, error: emailCheckError } = await supabase
      .from("tenants")
      .select("id, email")
      .eq("email", data.email)
      .maybeSingle();
    
    if (emailCheckError) {
      console.error("❌ [createTenant] Erro ao verificar email único:", emailCheckError);
      throw emailCheckError;
    }
    
    if (existingTenant) {
      console.error("❌ [createTenant] Email já existe:", existingTenant.id);
      throw new Error("EMAIL_ALREADY_EXISTS");
    }
  }
  
  // ✅ Converter para formato do banco
  const dbData = toDatabase(data);
  
  console.log("\n📤 PAYLOAD para INSERT:");
  console.log(JSON.stringify(dbData, null, 2));
  
  const result = await createSingle<any>(TABLE, dbData);
  const tenant = fromDatabase(result);
  
  console.log("✅ Inquilino criado:", JSON.stringify(tenant, null, 2));
  
  // ✅ Log de auditoria
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
  
  console.log("🔥 FIM createTenant\n");
  return tenant;
}

export const create = createTenant;

export const updateTenant = async (id: string, data: Partial<Tenant>): Promise<Tenant | null> => {
  try {
    console.log("\n🔥 ===== updateTenant (VIA RPC SQL PURO) =====");
    console.log("🔍 ID:", id);
    console.log("🔍 Dados recebidos:", JSON.stringify(data, null, 2));
    
    // ✅ Email único
    if (data.email) {
      const { data: existing } = await supabase
        .from("tenants")
        .select("id")
        .eq("email", data.email)
        .neq("id", id)
        .maybeSingle();
      
      if (existing) {
        throw new Error("EMAIL_ALREADY_EXISTS");
      }
    }
    
    // ✅ Buscar dados antigos
    const { data: old } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single();
    
    if (!old) throw new Error("Inquilino não encontrado");
    
    console.log("🔍 Dados antigos no banco:", JSON.stringify(old, null, 2));
    
    // ✅ MESCLAR: novos dados sobrescrevem antigos
    const merged: Partial<Tenant> = {
      name: data.name || old.name,
      email: data.email || old.email,
      phone: data.phone || old.phone,
      cpf: data.cpf !== undefined ? data.cpf : old.cpf,
      cnpj: data.cnpj !== undefined ? data.cnpj : old.document_type === "cnpj" ? old.document : null,
      rg: data.rg !== undefined ? data.rg : old.rg,
      occupation: data.occupation !== undefined ? data.occupation : old.occupation,
      marital_status: data.marital_status !== undefined ? data.marital_status : (data.maritalStatus !== undefined ? data.maritalStatus : old.marital_status),
      monthly_income: data.monthly_income !== undefined ? data.monthly_income : (data.monthlyIncome !== undefined ? data.monthlyIncome : old.monthly_income),
      document_type: data.document_type !== undefined ? data.document_type : (data.documentType !== undefined ? data.documentType : old.document_type),
      cep: data.cep !== undefined ? data.cep : old.zip_code,
      street: data.street !== undefined ? data.street : old.street,
      number: data.number !== undefined ? data.number : old.number,
      complement: data.complement !== undefined ? data.complement : old.complement,
      neighborhood: data.neighborhood !== undefined ? data.neighborhood : old.neighborhood,
      city: data.city !== undefined ? data.city : old.city,
      state: data.state !== undefined ? data.state : old.state,
      status: (data.status || old.status) as "active" | "rented" | "inactive",
    };
    
    console.log("🔄 Dados MESCLADOS (novo + antigo):", JSON.stringify(merged, null, 2));
    
    // ✅ Converter para formato do banco
    const dbData = toDatabase(merged);
    
    console.log("\n📤 DADOS CONVERTIDOS (toDatabase):");
    console.log(JSON.stringify(dbData, null, 2));
    
    // ✅ PREPARAR PARÂMETROS para RPC (todos os campos individuais)
    const params = {
      p_id: id,
      p_name: dbData.name || "",
      p_email: dbData.email || "",
      p_phone: dbData.phone || "",
      p_cpf: dbData.cpf || "",
      p_rg: dbData.rg || "",
      p_occupation: dbData.occupation || "",
      p_document: dbData.document || "",
      p_marital_status: dbData.marital_status || "",
      p_monthly_income: dbData.monthly_income || 0,
      p_document_type: dbData.document_type || "cpf",
      p_zip_code: dbData.zip_code || "",
      p_street: dbData.street || "",
      p_number: dbData.number || "",
      p_complement: dbData.complement || "",
      p_neighborhood: dbData.neighborhood || "",
      p_city: dbData.city || "",
      p_state: dbData.state || "",
      p_status: dbData.status || "active",
    };
    
    console.log("\n📤 PARÂMETROS RPC:");
    console.log(JSON.stringify(params, null, 2));

    // ✅ CHAMAR RPC que faz UPDATE via SQL puro
    console.log("\n📡 Executando RPC update_tenant_complete()...");
    const { data: result, error } = await supabase.rpc('update_tenant_complete', params);

    if (error) {
      console.error("❌ ERRO RPC:", error);
      throw error;
    }

    console.log("✅ RPC EXECUTADA COM SUCESSO!");
    console.log("✅ Resultado retornado:", JSON.stringify(result, null, 2));
    
    const updated = result as any;
    
    // ✅ VERIFICAÇÃO campo por campo
    console.log("\n🔍 VERIFICAÇÃO (PARÂMETROS vs RESULTADO):");
    let allOk = true;
    
    const fieldMap: Record<string, string> = {
      p_name: 'name',
      p_email: 'email',
      p_phone: 'phone',
      p_cpf: 'cpf',
      p_rg: 'rg',
      p_occupation: 'occupation',
      p_document: 'document',
      p_marital_status: 'marital_status',
      p_monthly_income: 'monthly_income',
      p_document_type: 'document_type',
      p_zip_code: 'zip_code',
      p_street: 'street',
      p_number: 'number',
      p_complement: 'complement',
      p_neighborhood: 'neighborhood',
      p_city: 'city',
      p_state: 'state',
      p_status: 'status',
    };
    
    for (const paramKey in params) {
      if (paramKey === 'p_id') continue;
      
      const dbField = fieldMap[paramKey];
      if (!dbField) continue;
      
      const sent = params[paramKey as keyof typeof params];
      const returned = updated[dbField];
      
      // Comparar tratando "" e null como equivalentes
      const sentNorm = sent === "" ? null : sent;
      const returnedNorm = returned === "" ? null : returned;
      
      if (JSON.stringify(sentNorm) !== JSON.stringify(returnedNorm)) {
        allOk = false;
        console.error(`❌ ${dbField}: enviado=${JSON.stringify(sent)} vs retornado=${JSON.stringify(returned)}`);
      } else {
        console.log(`✅ ${dbField}: OK`);
      }
    }
    
    if (allOk) {
      console.log("\n✅✅✅ TODOS OS CAMPOS FORAM SALVOS CORRETAMENTE! ✅✅✅");
    } else {
      console.error("\n❌❌❌ ALGUNS CAMPOS NÃO FORAM SALVOS! ❌❌❌");
    }
    
    // Log auditoria - INCLUIR TODOS OS CAMPOS
    await logAudit({
      action_type: "update",
      entity_type: "tenant",
      entity_id: id,
      changes_summary: `Nome Inquilino: ${updated.name}`,
      old_values: {
        name: old.name,
        email: old.email,
        phone: old.phone,
        cpf: old.cpf,
        rg: old.rg,
        occupation: old.occupation,
        marital_status: old.marital_status,
        monthly_income: old.monthly_income,
        document: old.document,
        document_type: old.document_type,
        zip_code: old.zip_code,
        street: old.street,
        number: old.number,
        complement: old.complement,
        neighborhood: old.neighborhood,
        city: old.city,
        state: old.state,
        status: old.status,
      },
      new_values: {
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        cpf: updated.cpf,
        rg: updated.rg,
        occupation: updated.occupation,
        marital_status: updated.marital_status,
        monthly_income: updated.monthly_income,
        document: updated.document,
        document_type: updated.document_type,
        zip_code: updated.zip_code,
        street: updated.street,
        number: updated.number,
        complement: updated.complement,
        neighborhood: updated.neighborhood,
        city: updated.city,
        state: updated.state,
        status: updated.status,
      },
    });
    
    console.log("🔥 FIM updateTenant\n");
    return updated ? fromDatabase(updated) : null;
  } catch (error: any) {
    console.error("❌ ERRO:", error.message);
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