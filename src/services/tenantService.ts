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
    
    let finalStatus: "active" | "rented" | "inactive";
    
    if (rentalStatuses.includes("active")) {
      finalStatus = "rented";
      console.log(`📌 [tenantService] Inquilino ${tenant.name}: status 'rented' (tem locação ativa - SOBRESCRITO)`);
    }
    else if (data.status === "rented" && !rentalStatuses.includes("active")) {
      finalStatus = "active";
      console.log(`📌 [tenantService] Inquilino ${tenant.name}: status 'active' (era 'rented' mas NÃO tem locação ativa - CORRIGIDO)`);
    }
    else if (data.status === "inactive") {
      finalStatus = "inactive";
      console.log(`📌 [tenantService] Inquilino ${tenant.name}: status 'inactive' (respeitando banco)`);
    }
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
    console.log("\n🔥 ===== updateTenant (COM VERIFICAÇÃO PÓS-COMMIT) =====");
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
    
    // ✅ Buscar dados antigos para log de auditoria
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
    
    console.log("\n📤 PAYLOAD para RPC:");
    console.log(JSON.stringify(dbData, null, 2));

    // ✅ CHAMAR RPC COM VERIFICAÇÃO PÓS-COMMIT
    console.log("\n📡 Executando RPC com verificação pós-commit...");
    const { data: result, error: rpcError } = await supabase.rpc('update_tenant_with_verification', {
      p_id: id,
      p_name: dbData.name,
      p_email: dbData.email,
      p_phone: dbData.phone,
      p_cpf: dbData.cpf,
      p_rg: dbData.rg,
      p_occupation: dbData.occupation,
      p_document: dbData.document,
      p_marital_status: dbData.marital_status,
      p_monthly_income: dbData.monthly_income,
      p_document_type: dbData.document_type,
      p_zip_code: dbData.zip_code,
      p_street: dbData.street,
      p_number: dbData.number,
      p_complement: dbData.complement,
      p_neighborhood: dbData.neighborhood,
      p_city: dbData.city,
      p_state: dbData.state,
      p_status: dbData.status,
    });

    if (rpcError) {
      console.error("❌ ERRO RPC:", rpcError);
      throw new Error(`Erro ao atualizar: ${rpcError.message}`);
    }

    console.log("✅ RPC EXECUTADA COM SUCESSO!");
    console.log("✅ Resultado:", JSON.stringify(result, null, 2));
    
    // ✅ Extrair dados verificados do resultado
    const persisted = (result as any).data;
    
    if (!persisted) {
      throw new Error("Nenhum dado retornado pela função de atualização");
    }
    
    console.log("✅ Dados VERIFICADOS e PERSISTIDOS no banco:");
    console.log(JSON.stringify(persisted, null, 2));
    
    // Log auditoria - INCLUIR TODOS OS CAMPOS
    const changes: string[] = [];
    
    if (old.name !== persisted.name) {
      changes.push(`Nome: "${old.name}" → "${persisted.name}"`);
    }
    if (old.email !== persisted.email) {
      changes.push(`E-mail: "${old.email}" → "${persisted.email}"`);
    }
    if (old.phone !== persisted.phone) {
      changes.push(`Telefone: "${old.phone}" → "${persisted.phone}"`);
    }
    if (old.cpf !== persisted.cpf) {
      changes.push(`CPF: "${old.cpf || '-'}" → "${persisted.cpf || '-'}"`);
    }
    if (old.rg !== persisted.rg) {
      changes.push(`RG: "${old.rg || '-'}" → "${persisted.rg || '-'}"`);
    }
    if (old.occupation !== persisted.occupation) {
      changes.push(`Ocupação: "${old.occupation || '-'}" → "${persisted.occupation || '-'}"`);
    }
    if (old.marital_status !== persisted.marital_status) {
      changes.push(`Estado Civil: "${old.marital_status || '-'}" → "${persisted.marital_status || '-'}"`);
    }
    if (old.monthly_income !== persisted.monthly_income) {
      changes.push(`Renda Mensal: ${old.monthly_income || 0} → ${persisted.monthly_income || 0}`);
    }
    if (old.document !== persisted.document) {
      changes.push(`Documento: "${old.document || '-'}" → "${persisted.document || '-'}"`);
    }
    if (old.document_type !== persisted.document_type) {
      changes.push(`Tipo Documento: "${old.document_type || '-'}" → "${persisted.document_type || '-'}"`);
    }
    if (old.zip_code !== persisted.zip_code) {
      changes.push(`CEP: "${old.zip_code || '-'}" → "${persisted.zip_code || '-'}"`);
    }
    if (old.street !== persisted.street) {
      changes.push(`Rua: "${old.street || '-'}" → "${persisted.street || '-'}"`);
    }
    if (old.number !== persisted.number) {
      changes.push(`Número: "${old.number || '-'}" → "${persisted.number || '-'}"`);
    }
    if (old.complement !== persisted.complement) {
      changes.push(`Complemento: "${old.complement || '-'}" → "${persisted.complement || '-'}"`);
    }
    if (old.neighborhood !== persisted.neighborhood) {
      changes.push(`Bairro: "${old.neighborhood || '-'}" → "${persisted.neighborhood || '-'}"`);
    }
    if (old.city !== persisted.city) {
      changes.push(`Cidade: "${old.city || '-'}" → "${persisted.city || '-'}"`);
    }
    if (old.state !== persisted.state) {
      changes.push(`Estado: "${old.state || '-'}" → "${persisted.state || '-'}"`);
    }
    if (old.status !== persisted.status) {
      changes.push(`Status: "${old.status}" → "${persisted.status}"`);
    }
    
    const changesSummary = changes.length > 0 
      ? `Inquilino: ${persisted.name}\n\nCampos alterados:\n${changes.join('\n')}`
      : `Inquilino: ${persisted.name} (sem alterações)`;
    
    await logAudit({
      action_type: "update",
      entity_type: "tenant",
      entity_id: id,
      changes_summary: changesSummary,
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
        name: persisted.name,
        email: persisted.email,
        phone: persisted.phone,
        cpf: persisted.cpf,
        rg: persisted.rg,
        occupation: persisted.occupation,
        marital_status: persisted.marital_status,
        monthly_income: persisted.monthly_income,
        document: persisted.document,
        document_type: persisted.document_type,
        zip_code: persisted.zip_code,
        street: persisted.street,
        number: persisted.number,
        complement: persisted.complement,
        neighborhood: persisted.neighborhood,
        city: persisted.city,
        state: persisted.state,
        status: persisted.status,
      },
    });
    
    console.log("✅✅✅ ATUALIZAÇÃO COMPLETA E VERIFICADA! ✅✅✅");
    console.log("🔥 FIM updateTenant\n");
    return persisted ? fromDatabase(persisted) : null;
  } catch (error: any) {
    console.error("❌ ERRO:", error.message);
    throw error;
  }
};

export const update = async (
  id: string,
  tenant: Partial<Omit<Tenant, "id" | "createdAt">>
): Promise<Tenant> => {
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

  const { data: tenantData } = await supabase
    .from("tenants")
    .select("name, email, phone")
    .eq("id", id)
    .single();

  await deleteSingle(TABLE, id);
  
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
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("name, email, phone")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("tenants").delete().eq("id", id);

  if (error) throw error;

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