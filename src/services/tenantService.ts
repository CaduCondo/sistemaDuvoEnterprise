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
  
  // ✅ ABORDAGEM ULTRA-SIMPLES: Criar objeto limpo com APENAS os campos que vieram do form
  const dbData: any = {};
  
  // CAMPOS DIRETOS (sem mapeamento) - enviar exatamente como vieram
  if (data.name !== undefined && data.name !== "") dbData.name = data.name;
  if (data.email !== undefined && data.email !== "") dbData.email = data.email;
  if (data.phone !== undefined && data.phone !== "") dbData.phone = data.phone;
  if (data.status !== undefined) dbData.status = data.status;
  if (data.rg !== undefined && data.rg !== "") dbData.rg = data.rg;
  if (data.occupation !== undefined && data.occupation !== "") {
    // ✅ VALIDAÇÃO: occupation max 255 caracteres
    const occupation = data.occupation.substring(0, 255);
    dbData.occupation = occupation;
    if (data.occupation.length > 255) {
      console.warn(`⚠️ [toDatabase] occupation truncado de ${data.occupation.length} para 255 caracteres`);
    }
  }
  if (data.document !== undefined && data.document !== "") dbData.document = data.document;
  if (data.cpf !== undefined && data.cpf !== "") dbData.cpf = data.cpf;
  if (data.street !== undefined && data.street !== "") dbData.street = data.street;
  if (data.number !== undefined && data.number !== "") dbData.number = data.number;
  if (data.complement !== undefined && data.complement !== "") dbData.complement = data.complement;
  if (data.neighborhood !== undefined && data.neighborhood !== "") dbData.neighborhood = data.neighborhood;
  if (data.city !== undefined && data.city !== "") dbData.city = data.city;
  if (data.state !== undefined && data.state !== "") dbData.state = data.state;
  
  // CAMPOS COM MAPEAMENTO DE NOME
  if (data.marital_status !== undefined && data.marital_status !== "") {
    // ✅ VALIDAÇÃO: marital_status max 50 caracteres
    const maritalStatus = data.marital_status.substring(0, 50);
    dbData.marital_status = maritalStatus;
    if (data.marital_status.length > 50) {
      console.warn(`⚠️ [toDatabase] marital_status truncado de ${data.marital_status.length} para 50 caracteres`);
    }
  } else if (data.maritalStatus !== undefined && data.maritalStatus !== "") {
    // ✅ VALIDAÇÃO: marital_status max 50 caracteres
    const maritalStatus = data.maritalStatus.substring(0, 50);
    dbData.marital_status = maritalStatus;
    if (data.maritalStatus.length > 50) {
      console.warn(`⚠️ [toDatabase] marital_status truncado de ${data.maritalStatus.length} para 50 caracteres`);
    }
  }
  
  if (data.document_type !== undefined) {
    dbData.document_type = data.document_type;
  } else if (data.documentType !== undefined) {
    dbData.document_type = data.documentType;
  }
  
  if (data.cep !== undefined && data.cep !== "") {
    dbData.zip_code = data.cep;
  }
  
  // MONTHLY_INCOME - garantir que seja número com MÁXIMO 2 casas decimais
  if (data.monthly_income !== undefined && data.monthly_income !== null) {
    const rawValue = typeof data.monthly_income === 'string' 
      ? parseFloat(data.monthly_income) 
      : data.monthly_income;
    // ✅ CRÍTICO: Arredondar para 2 casas decimais (banco é numeric(10,2))
    dbData.monthly_income = Math.round(rawValue * 100) / 100;
    console.log(`💰 [toDatabase] monthly_income: ${data.monthly_income} → ${dbData.monthly_income} (arredondado para 2 decimais)`);
  } else if (data.monthlyIncome !== undefined && data.monthlyIncome !== null) {
    const rawValue = typeof data.monthlyIncome === 'string' 
      ? parseFloat(data.monthlyIncome) 
      : data.monthlyIncome;
    // ✅ CRÍTICO: Arredondar para 2 casas decimais (banco é numeric(10,2))
    dbData.monthly_income = Math.round(rawValue * 100) / 100;
    console.log(`💰 [toDatabase] monthly_income: ${data.monthlyIncome} → ${dbData.monthly_income} (arredondado para 2 decimais)`);
  }
  
  console.log("📤 [tenantService.toDatabase] PAYLOAD FINAL:", JSON.stringify(dbData, null, 2));
  console.log("📤 [tenantService.toDatabase] Campos enviados:", Object.keys(dbData));
  
  // ✅ LOG ULTRA-DETALHADO de cada campo
  console.log("\n🔍 DETALHAMENTO DO PAYLOAD FINAL:");
  for (const key in dbData) {
    const value = dbData[key];
    const valueType = typeof value;
    
    if (valueType === 'string') {
      console.log(`  📤 "${key}": tipo=string, tamanho=${value.length}, valor="${value}"`);
    } else if (valueType === 'number') {
      console.log(`  📤 "${key}": tipo=number, valor=${value}`);
    } else if (value === null) {
      console.log(`  📤 "${key}": tipo=null, valor=null`);
    } else {
      console.log(`  📤 "${key}": tipo=${valueType}, valor=${JSON.stringify(value)}`);
    }
  }
  console.log("🔍 FIM DO DETALHAMENTO\n");
  
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