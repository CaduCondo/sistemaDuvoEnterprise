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
    console.log("\n🔥 ===== INÍCIO updateTenant (ULTRA-SIMPLES) =====");
    console.log("🔍 [updateTenant] ID:", id);
    console.log("🔍 [updateTenant] Dados RECEBIDOS:", JSON.stringify(data, null, 2));
    
    // ✅ VALIDAÇÃO: Email único
    if (data.email) {
      const { data: existingTenant, error: emailCheckError } = await supabase
        .from("tenants")
        .select("id, email")
        .eq("email", data.email)
        .neq("id", id)
        .maybeSingle();
      
      if (emailCheckError) {
        console.error("❌ [updateTenant] Erro ao verificar email:", emailCheckError);
        throw emailCheckError;
      }
      
      if (existingTenant) {
        console.error("❌ [updateTenant] Email já existe:", existingTenant.id);
        throw new Error("EMAIL_ALREADY_EXISTS");
      }
    }
    
    // ✅ Buscar valores antigos ANTES
    const { data: oldData, error: selectOldError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single();
    
    if (selectOldError) {
      console.error("❌ [updateTenant] ERRO ao buscar dados ANTIGOS:", selectOldError);
      throw selectOldError;
    }
    
    console.log("🔍 [updateTenant] Valores ANTIGOS no banco:");
    console.log(JSON.stringify(oldData, null, 2));
    
    // ✅ CONSTRUIR PAYLOAD ULTRA-SIMPLES - TODOS OS CAMPOS
    const payload: any = {
      name: data.name || oldData.name,
      email: data.email || oldData.email,
      phone: data.phone || oldData.phone,
      cpf: data.cpf !== undefined ? (data.cpf || null) : (oldData.cpf || null),
      rg: data.rg !== undefined ? (data.rg || null) : (oldData.rg || null),
      occupation: data.occupation !== undefined ? (data.occupation || null) : (oldData.occupation || null),
      marital_status: data.marital_status !== undefined 
        ? (data.marital_status || null) 
        : (data.maritalStatus !== undefined ? (data.maritalStatus || null) : (oldData.marital_status || null)),
      document_type: data.document_type !== undefined 
        ? (data.document_type || null) 
        : (data.documentType !== undefined ? (data.documentType || null) : (oldData.document_type || null)),
      zip_code: data.cep !== undefined ? (data.cep || null) : (oldData.zip_code || null),
      street: data.street !== undefined ? (data.street || null) : (oldData.street || null),
      number: data.number !== undefined ? (data.number || null) : (oldData.number || null),
      complement: data.complement !== undefined ? (data.complement || null) : (oldData.complement || null),
      neighborhood: data.neighborhood !== undefined ? (data.neighborhood || null) : (oldData.neighborhood || null),
      city: data.city !== undefined ? (data.city || null) : (oldData.city || null),
      state: data.state !== undefined ? (data.state || null) : (oldData.state || null),
      status: data.status || oldData.status,
    };
    
    // ✅ ADICIONAR CAMPO DOCUMENT (pode estar faltando e causando o problema!)
    // document deve receber o valor do cpf OU cnpj dependendo do document_type
    const finalDocType = payload.document_type || oldData.document_type || 'cpf';
    if (finalDocType === 'cpf') {
      payload.document = payload.cpf || oldData.cpf || null;
    } else {
      payload.document = data.cnpj || oldData.document || null;
    }
    
    console.log(`📋 [updateTenant] Campo 'document' definido: ${payload.document} (baseado em document_type=${finalDocType})`);
    
    // MONTHLY_INCOME
    if (data.monthly_income !== undefined && data.monthly_income !== null) {
      const rawValue = typeof data.monthly_income === 'string' 
        ? parseFloat(data.monthly_income) 
        : data.monthly_income;
      payload.monthly_income = !isNaN(rawValue) && rawValue > 0 
        ? Math.round(rawValue * 100) / 100 
        : null;
    } else if (data.monthlyIncome !== undefined && data.monthlyIncome !== null) {
      const rawValue = typeof data.monthlyIncome === 'string' 
        ? parseFloat(data.monthlyIncome) 
        : data.monthlyIncome;
      payload.monthly_income = !isNaN(rawValue) && rawValue > 0 
        ? Math.round(rawValue * 100) / 100 
        : null;
    } else {
      payload.monthly_income = oldData.monthly_income || null;
    }
    
    // Adicionar updated_at manualmente
    payload.updated_at = new Date().toISOString();
    
    console.log("\n📤 [updateTenant] PAYLOAD COMPLETO (TODOS OS CAMPOS):");
    console.log(JSON.stringify(payload, null, 2));
    console.log("📤 [updateTenant] Total de campos:", Object.keys(payload).length);

    console.log("\n📡 [updateTenant] Executando UPDATE DIRETO via Supabase...");
    
    // ✅ UPDATE DIRETO - com .select() para pegar o resultado
    const { data: updatedData, error: updateError } = await supabase
      .from("tenants")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("❌ [updateTenant] ERRO DO SUPABASE:");
      console.error("   - message:", updateError.message);
      console.error("   - details:", updateError.details);
      console.error("   - hint:", updateError.hint);
      console.error("   - code:", updateError.code);
      throw updateError;
    }

    console.log("✅ [updateTenant] UPDATE executado com SUCESSO!");
    console.log("✅ [updateTenant] Dados RETORNADOS do UPDATE:");
    console.log(JSON.stringify(updatedData, null, 2));
    
    // COMPARAÇÃO campo por campo - PAYLOAD vs RETORNO
    console.log("\n🔍 [updateTenant] COMPARAÇÃO (PAYLOAD vs RETORNO DO UPDATE):");
    let allFieldsMatch = true;
    
    for (const key of Object.keys(payload)) {
      if (key === 'updated_at') continue; // Pular updated_at
      
      const sentValue = payload[key];
      const returnedValue = updatedData[key];
      
      if (JSON.stringify(sentValue) !== JSON.stringify(returnedValue)) {
        allFieldsMatch = false;
        console.error(`  ❌ Campo "${key}" DIFERENTE: enviado=${JSON.stringify(sentValue)} vs retornado=${JSON.stringify(returnedValue)}`);
      } else {
        console.log(`  ✅ Campo "${key}" OK: ${JSON.stringify(returnedValue)}`);
      }
    }
    
    if (allFieldsMatch) {
      console.log("\n✅✅✅ TODOS OS CAMPOS DO UPDATE ESTÃO CORRETOS NO RETORNO! ✅✅✅");
    } else {
      console.error("\n❌❌❌ ALGUNS CAMPOS ESTÃO DIFERENTES NO RETORNO DO UPDATE! ❌❌❌");
    }
    
    // ESPERAR 500ms e BUSCAR NOVAMENTE para verificar se os dados foram PERSISTIDOS
    console.log("\n⏳ [updateTenant] Aguardando 500ms para verificar persistência...");
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log("\n📡 [updateTenant] Buscando dados PERSISTIDOS no banco (SELECT separado)...");
    const { data: persistedData, error: selectError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single();
    
    if (selectError) {
      console.error("❌ [updateTenant] ERRO ao buscar dados persistidos:", selectError);
      throw selectError;
    }
    
    console.log("✅ [updateTenant] Dados PERSISTIDOS no banco:");
    console.log(JSON.stringify(persistedData, null, 2));
    
    // COMPARAÇÃO campo por campo - PAYLOAD vs PERSISTIDO
    console.log("\n🔍 [updateTenant] COMPARAÇÃO CRÍTICA (PAYLOAD vs PERSISTIDO):");
    let allFieldsPersisted = true;
    
    for (const key of Object.keys(payload)) {
      if (key === 'updated_at') continue;
      
      const sentValue = payload[key];
      const persistedValue = persistedData[key];
      
      if (JSON.stringify(sentValue) !== JSON.stringify(persistedValue)) {
        allFieldsPersisted = false;
        console.error(`  ❌ Campo "${key}" NÃO PERSISTIU: enviado=${JSON.stringify(sentValue)} vs banco=${JSON.stringify(persistedValue)}`);
      } else {
        console.log(`  ✅ Campo "${key}" PERSISTIDO: ${JSON.stringify(persistedValue)}`);
      }
    }
    
    if (allFieldsPersisted) {
      console.log("\n✅✅✅ TODOS OS CAMPOS FORAM PERSISTIDOS CORRETAMENTE! ✅✅✅");
    } else {
      console.error("\n❌❌❌ ALGUNS CAMPOS NÃO FORAM PERSISTIDOS! ❌❌❌");
      console.error("🚨 Isso significa que algo no BANCO está REVERTENDO as mudanças DEPOIS do UPDATE!");
    }
    
    // Log de auditoria
    if (persistedData && oldData) {
      const changes: string[] = [];
      
      if (oldData.name !== persistedData.name) {
        changes.push(`name: de=${oldData.name} -> para=${persistedData.name}`);
      }
      if (oldData.email !== persistedData.email) {
        changes.push(`email: de=${oldData.email || '-'} -> para=${persistedData.email || '-'}`);
      }
      if (oldData.phone !== persistedData.phone) {
        changes.push(`phone: de=${oldData.phone || '-'} -> para=${persistedData.phone || '-'}`);
      }
      if (oldData.status !== persistedData.status) {
        changes.push(`status: de=${oldData.status} -> para=${persistedData.status}`);
      }
      if (oldData.monthly_income !== persistedData.monthly_income) {
        changes.push(`monthly_income: de=${oldData.monthly_income || '-'} -> para=${persistedData.monthly_income || '-'}`);
      }
      if (oldData.marital_status !== persistedData.marital_status) {
        changes.push(`marital_status: de=${oldData.marital_status || '-'} -> para=${persistedData.marital_status || '-'}`);
      }
      
      const changesSummary = changes.length > 0 
        ? `Nome Inquilino: ${persistedData.name}\n${changes.join('\n')}`
        : `Nome Inquilino: ${persistedData.name}`;
      
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
          name: persistedData.name,
          email: persistedData.email,
          phone: persistedData.phone,
          status: persistedData.status,
        },
      });
    }
    
    console.log("🔥 ===== FIM updateTenant =====\n");
    return persistedData ? fromDatabase(persistedData) : null;
  } catch (error: any) {
    console.error("❌ [updateTenant] EXCEÇÃO:");
    console.error("   - Message:", error.message);
    console.error("   - Code:", error.code);
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