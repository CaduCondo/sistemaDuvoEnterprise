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
  
  // ✅ ABORDAGEM RADICAL: Criar objeto APENAS com campos que TÊM valores REAIS
  const dbData: any = {};
  
  // ✅ CAMPOS OBRIGATÓRIOS - incluir SEMPRE (mesmo que vazios, pois são required)
  if (data.name !== undefined) dbData.name = data.name;
  if (data.email !== undefined) dbData.email = data.email;
  if (data.phone !== undefined) dbData.phone = data.phone;
  
  // ✅ CAMPOS OPCIONAIS - incluir APENAS se tiverem valor REAL (não vazio)
  if (data.status !== undefined) {
    dbData.status = data.status;
  }
  
  if (data.rg !== undefined && data.rg !== null && data.rg !== "") {
    dbData.rg = data.rg;
  }
  
  if (data.occupation !== undefined && data.occupation !== null && data.occupation !== "") {
    const occupation = data.occupation.substring(0, 255);
    dbData.occupation = occupation;
    if (data.occupation.length > 255) {
      console.warn(`⚠️ [toDatabase] occupation truncado de ${data.occupation.length} para 255 caracteres`);
    }
  }
  
  if (data.document !== undefined && data.document !== null && data.document !== "") {
    dbData.document = data.document;
  }
  
  if (data.cpf !== undefined && data.cpf !== null && data.cpf !== "") {
    dbData.cpf = data.cpf;
  }
  
  if (data.street !== undefined && data.street !== null && data.street !== "") {
    dbData.street = data.street;
  }
  
  if (data.number !== undefined && data.number !== null && data.number !== "") {
    dbData.number = data.number;
  }
  
  if (data.complement !== undefined && data.complement !== null && data.complement !== "") {
    dbData.complement = data.complement;
  }
  
  if (data.neighborhood !== undefined && data.neighborhood !== null && data.neighborhood !== "") {
    dbData.neighborhood = data.neighborhood;
  }
  
  if (data.city !== undefined && data.city !== null && data.city !== "") {
    dbData.city = data.city;
  }
  
  if (data.state !== undefined && data.state !== null && data.state !== "") {
    dbData.state = data.state;
  }
  
  // MARITAL_STATUS com validação de tamanho
  if (data.marital_status !== undefined && data.marital_status !== null && data.marital_status !== "") {
    const maritalStatus = data.marital_status.substring(0, 50);
    dbData.marital_status = maritalStatus;
    if (data.marital_status.length > 50) {
      console.warn(`⚠️ [toDatabase] marital_status truncado de ${data.marital_status.length} para 50 caracteres`);
    }
  } else if (data.maritalStatus !== undefined && data.maritalStatus !== null && data.maritalStatus !== "") {
    const maritalStatus = data.maritalStatus.substring(0, 50);
    dbData.marital_status = maritalStatus;
    if (data.maritalStatus.length > 50) {
      console.warn(`⚠️ [toDatabase] marital_status truncado de ${data.maritalStatus.length} para 50 caracteres`);
    }
  }
  
  // DOCUMENT_TYPE - só enviar se tiver valor
  if (data.document_type !== undefined && data.document_type !== null && data.document_type !== "") {
    dbData.document_type = data.document_type;
  } else if (data.documentType !== undefined && data.documentType !== null && data.documentType !== "") {
    dbData.document_type = data.documentType;
  }
  
  // CEP → zip_code
  if (data.cep !== undefined && data.cep !== null && data.cep !== "") {
    dbData.zip_code = data.cep;
  }
  
  // MONTHLY_INCOME - garantir que seja número com MÁXIMO 2 casas decimais
  if (data.monthly_income !== undefined && data.monthly_income !== null && data.monthly_income !== 0) {
    const rawValue = typeof data.monthly_income === 'string' 
      ? parseFloat(data.monthly_income) 
      : data.monthly_income;
    
    // ✅ Verificar se é um número válido
    if (!isNaN(rawValue) && rawValue > 0) {
      dbData.monthly_income = Math.round(rawValue * 100) / 100;
      console.log(`💰 [toDatabase] monthly_income: ${data.monthly_income} → ${dbData.monthly_income} (arredondado para 2 decimais)`);
    }
  } else if (data.monthlyIncome !== undefined && data.monthlyIncome !== null && data.monthlyIncome !== 0) {
    const rawValue = typeof data.monthlyIncome === 'string' 
      ? parseFloat(data.monthlyIncome) 
      : data.monthlyIncome;
    
    // ✅ Verificar se é um número válido
    if (!isNaN(rawValue) && rawValue > 0) {
      dbData.monthly_income = Math.round(rawValue * 100) / 100;
      console.log(`💰 [toDatabase] monthly_income: ${data.monthlyIncome} → ${dbData.monthly_income} (arredondado para 2 decimais)`);
    }
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
    console.log("\n🔥 ===== INÍCIO updateTenant (VERSÃO RAW SQL) =====");
    console.log("🔍 [updateTenant] ID:", id);
    console.log("🔍 [updateTenant] Dados RECEBIDOS do form:", JSON.stringify(data, null, 2));
    
    // ✅ Buscar valores antigos ANTES de atualizar
    const { data: oldData, error: selectOldError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single();
    
    if (selectOldError) {
      console.error("❌ [updateTenant] ERRO ao buscar dados ANTIGOS:", selectOldError);
      throw selectOldError;
    }
    
    console.log("🔍 [updateTenant] Valores ANTIGOS no banco (ANTES do update):");
    console.log(JSON.stringify(oldData, null, 2));
    
    // ✅ VERSÃO RAW: Construir payload DIRETO sem toDatabase()
    const rawPayload: any = {};
    
    // CAMPOS OBRIGATÓRIOS
    if (data.name !== undefined) rawPayload.name = data.name;
    if (data.email !== undefined) rawPayload.email = data.email;
    if (data.phone !== undefined) rawPayload.phone = data.phone;
    
    // CAMPOS OPCIONAIS - enviar EXATAMENTE como vieram (incluindo vazios)
    if (data.cpf !== undefined) rawPayload.cpf = data.cpf || null;
    if (data.rg !== undefined) rawPayload.rg = data.rg || null;
    if (data.occupation !== undefined) rawPayload.occupation = data.occupation || null;
    if (data.document !== undefined) rawPayload.document = data.document || null;
    
    // MARITAL_STATUS - aceitar tanto marital_status quanto maritalStatus
    if (data.marital_status !== undefined) {
      rawPayload.marital_status = data.marital_status || null;
    } else if (data.maritalStatus !== undefined) {
      rawPayload.marital_status = data.maritalStatus || null;
    }
    
    // MONTHLY_INCOME - garantir número com 2 decimais
    if (data.monthly_income !== undefined && data.monthly_income !== null) {
      const rawValue = typeof data.monthly_income === 'string' 
        ? parseFloat(data.monthly_income) 
        : data.monthly_income;
      rawPayload.monthly_income = !isNaN(rawValue) && rawValue > 0 
        ? Math.round(rawValue * 100) / 100 
        : null;
    } else if (data.monthlyIncome !== undefined && data.monthlyIncome !== null) {
      const rawValue = typeof data.monthlyIncome === 'string' 
        ? parseFloat(data.monthlyIncome) 
        : data.monthlyIncome;
      rawPayload.monthly_income = !isNaN(rawValue) && rawValue > 0 
        ? Math.round(rawValue * 100) / 100 
        : null;
    }
    
    // DOCUMENT_TYPE
    if (data.document_type !== undefined) {
      rawPayload.document_type = data.document_type || null;
    } else if (data.documentType !== undefined) {
      rawPayload.document_type = data.documentType || null;
    }
    
    // ENDEREÇO
    if (data.cep !== undefined) rawPayload.zip_code = data.cep || null;
    if (data.street !== undefined) rawPayload.street = data.street || null;
    if (data.number !== undefined) rawPayload.number = data.number || null;
    if (data.complement !== undefined) rawPayload.complement = data.complement || null;
    if (data.neighborhood !== undefined) rawPayload.neighborhood = data.neighborhood || null;
    if (data.city !== undefined) rawPayload.city = data.city || null;
    if (data.state !== undefined) rawPayload.state = data.state || null;
    
    // STATUS
    if (data.status !== undefined) rawPayload.status = data.status;
    
    console.log("\n📤 [updateTenant] PAYLOAD RAW (sem toDatabase()):");
    console.log(JSON.stringify(rawPayload, null, 2));
    console.log("📤 [updateTenant] Campos no payload:", Object.keys(rawPayload));
    
    // LOG DETALHADO de cada campo
    console.log("\n🔍 DETALHAMENTO DO PAYLOAD RAW:");
    for (const key in rawPayload) {
      const value = rawPayload[key];
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

    console.log("\n📡 [updateTenant] Executando UPDATE RAW no Supabase...");
    
    // ✅ UPDATE RAW - sem .select()
    const { error: updateError } = await supabase
      .from("tenants")
      .update(rawPayload)
      .eq("id", id);

    if (updateError) {
      console.error("❌ [updateTenant] ERRO DO SUPABASE NO UPDATE:");
      console.error("   - message:", updateError.message);
      console.error("   - details:", updateError.details);
      console.error("   - hint:", updateError.hint);
      console.error("   - code:", updateError.code);
      console.error("   - Erro completo:", JSON.stringify(updateError, null, 2));
      throw updateError;
    }

    console.log("✅ [updateTenant] UPDATE RAW executado com SUCESSO!");
    
    // Aguardar commit
    console.log("⏳ [updateTenant] Aguardando 200ms para garantir commit no banco...");
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log("✅ [updateTenant] Aguardado 200ms - prosseguindo com SELECT...");
    
    // SELECT para buscar dados atualizados
    console.log("\n📡 [updateTenant] Buscando dados ATUALIZADOS do banco...");
    const { data: updatedData, error: selectNewError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single();
    
    if (selectNewError) {
      console.error("❌ [updateTenant] ERRO ao buscar dados ATUALIZADOS:", selectNewError);
      throw selectNewError;
    }
    
    console.log("✅ [updateTenant] Dados ATUALIZADOS buscados do banco:");
    console.log(JSON.stringify(updatedData, null, 2));
    
    // COMPARAÇÃO campo por campo
    console.log("\n🔍 [updateTenant] COMPARAÇÃO ANTIGO vs NOVO:");
    
    let changedCount = 0;
    let unchangedCount = 0;
    const unchangedFields: string[] = [];
    
    for (const key of Object.keys(rawPayload)) {
      const oldValue = oldData[key];
      const newValue = updatedData[key];
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changedCount++;
        console.log(`  ✅ Campo "${key}" FOI ATUALIZADO: ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`);
      } else {
        unchangedCount++;
        unchangedFields.push(key);
        console.warn(`  ⚠️ Campo "${key}" NÃO MUDOU: ${JSON.stringify(oldValue)} = ${JSON.stringify(newValue)}`);
      }
    }
    
    console.log(`\n📊 [updateTenant] RESUMO DA ATUALIZAÇÃO:`);
    console.log(`  ✅ Campos enviados no payload: ${Object.keys(rawPayload).length}`);
    console.log(`  ✅ Campos que MUDARAM no banco: ${changedCount}`);
    console.log(`  ⚠️ Campos que NÃO MUDARAM: ${unchangedCount}`);
    
    if (unchangedCount > 0) {
      console.error(`\n❌❌❌ ALERTA CRÍTICO: ${unchangedCount} CAMPOS NÃO FORAM SALVOS! ❌❌❌`);
      console.error(`  🚨 Campos que NÃO mudaram: ${unchangedFields.join(', ')}`);
      console.error(`  🚨 Possíveis causas:`);
      console.error(`     1. TRIGGER no banco revertendo mudanças`);
      console.error(`     2. CONSTRAINT CHECK falhando silenciosamente`);
      console.error(`     3. VIEW/FUNCTION interceptando UPDATE`);
      console.error(`     4. Permissões RLS ainda ativas (mesmo após DISABLE)`);
    }
    
    // Log de auditoria
    if (updatedData && oldData) {
      const changes: string[] = [];
      
      if (oldData.name !== updatedData.name) {
        changes.push(`name: de=${oldData.name} -> para=${updatedData.name}`);
      }
      if (oldData.email !== updatedData.email) {
        changes.push(`email: de=${oldData.email || '-'} -> para=${updatedData.email || '-'}`);
      }
      if (oldData.phone !== updatedData.phone) {
        changes.push(`phone: de=${oldData.phone || '-'} -> para=${updatedData.phone || '-'}`);
      }
      if (oldData.status !== updatedData.status) {
        changes.push(`status: de=${oldData.status} -> para=${updatedData.status}`);
      }
      if (oldData.monthly_income !== updatedData.monthly_income) {
        changes.push(`monthly_income: de=${oldData.monthly_income || '-'} -> para=${updatedData.monthly_income || '-'}`);
      }
      if (oldData.marital_status !== updatedData.marital_status) {
        changes.push(`marital_status: de=${oldData.marital_status || '-'} -> para=${updatedData.marital_status || '-'}`);
      }
      
      const changesSummary = changes.length > 0 
        ? `Nome Inquilino: ${updatedData.name}\n${changes.join('\n')}`
        : `Nome Inquilino: ${updatedData.name}`;
      
      await logAudit({
        action_type: "update",
        entity_type: "tenant",
        entity_id: id,
        changes_summary: changesSummary,
        old_values: oldData ? {
          name: oldData.name,
          email: oldData.email,
          phone: oldData.phone,
          status: oldData.status,
        } : undefined,
        new_values: {
          name: updatedData.name,
          email: updatedData.email,
          phone: updatedData.phone,
          status: updatedData.status,
        },
      });
    }
    
    console.log("🔥 ===== FIM updateTenant (VERSÃO RAW SQL) =====\n");
    return updatedData ? fromDatabase(updatedData) : null;
  } catch (error: any) {
    console.error("❌ [updateTenant] EXCEÇÃO CAPTURADA:");
    console.error("   - Message:", error.message);
    console.error("   - Code:", error.code);
    console.error("   - Details:", error.details);
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