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

/**
 * ✅ TRAVA DE SEGURANÇA: garante que um inquilino nunca seja criado com campos
 * obrigatórios vazios, mesmo que a validação da tela seja contornada por algum motivo.
 */
function validateRequiredTenantFields(data: Partial<Tenant>): void {
  const name = (data.name || "").trim();
  const phone = (data.phone || "").trim();
  const email = (data.email || "").trim();
  const cpf = (data.cpf || "").trim();
  const cnpj = (data.cnpj || "").trim();

  const missing: string[] = [];
  if (!name) missing.push("Nome");
  if (!phone) missing.push("Telefone");
  if (!email) missing.push("E-mail");
  if (!cpf && !cnpj) missing.push("CPF/CNPJ");

  if (missing.length > 0) {
    throw new Error(
      `Não é possível salvar o inquilino sem preencher: ${missing.join(", ")}.`
    );
  }
}

function toDatabase(data: Partial<Tenant>): any {
  console.log("🔄 [tenantService.toDatabase] Dados recebidos:", JSON.stringify(data, null, 2));

  // ✅ CORRIGIDO (bug crítico): antes esta função sempre montava o pacote com
  // TODOS os campos, preenchendo com "" ou null qualquer campo que não veio em `data`.
  // Isso é seguro quando `data` é o formulário inteiro (criação/edição pela tela),
  // mas quebra totalmente quando alguém chama update() com um objeto parcial -
  // por exemplo, a criação de Locação chama updateTenant(id, { status: "rented" })
  // só pra marcar o status, e essa função apagava nome, telefone, e-mail etc.
  // Agora só incluímos no pacote os campos que realmente vieram em `data`.
  const dbData: any = {};

  if (data.name !== undefined) dbData.name = data.name || "";
  if (data.email !== undefined) dbData.email = data.email || "";
  if (data.phone !== undefined) dbData.phone = data.phone || "";
  if (data.status !== undefined) dbData.status = data.status || "active";
  if (data.cpf !== undefined) dbData.cpf = data.cpf || null;
  if (data.rg !== undefined) dbData.rg = data.rg || null;
  if (data.occupation !== undefined) dbData.occupation = data.occupation || null;
  if (data.marital_status !== undefined) dbData.marital_status = data.marital_status || null;
  else if (data.maritalStatus !== undefined) dbData.marital_status = data.maritalStatus || null;
  if (data.document_type !== undefined) dbData.document_type = data.document_type || "cpf";
  else if (data.documentType !== undefined) dbData.document_type = data.documentType || "cpf";
  if (data.cep !== undefined) dbData.zip_code = data.cep || null;
  if (data.street !== undefined) dbData.street = data.street || null;
  if (data.number !== undefined) dbData.number = data.number || null;
  if (data.complement !== undefined) dbData.complement = data.complement || null;
  if (data.neighborhood !== undefined) dbData.neighborhood = data.neighborhood || null;
  if (data.city !== undefined) dbData.city = data.city || null;
  if (data.state !== undefined) dbData.state = data.state || null;

  // ✅ CAMPO DOCUMENT - baseado no document_type, só se cpf/cnpj vieram
  const docType = dbData.document_type || data.document_type || data.documentType;
  if (docType === "cnpj") {
    if (data.cnpj !== undefined) dbData.document = data.cnpj || null;
  } else {
    if (data.cpf !== undefined) dbData.document = data.cpf || null;
  }

  // ✅ MONTHLY_INCOME
  if (data.monthly_income !== undefined) {
    const raw = typeof data.monthly_income === 'string' ? parseFloat(data.monthly_income) : data.monthly_income;
    dbData.monthly_income = raw !== null && !isNaN(raw as number) && (raw as number) > 0 ? Math.round((raw as number) * 100) / 100 : null;
  } else if (data.monthlyIncome !== undefined) {
    const raw = typeof data.monthlyIncome === 'string' ? parseFloat(data.monthlyIncome) : data.monthlyIncome;
    dbData.monthly_income = raw !== null && !isNaN(raw as number) && (raw as number) > 0 ? Math.round((raw as number) * 100) / 100 : null;
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

  // ✅ VALIDAÇÃO: campos obrigatórios não podem estar vazios
  validateRequiredTenantFields(data);

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

/**
 * @deprecated NÃO UTILIZADA. A função `update()` (mais abaixo neste arquivo) é a que
 * está de fato conectada ao formulário de edição via useTenants.ts.
 * Esta função depende da RPC `update_tenant_guaranteed`, que existe no banco mas não
 * está versionada em nenhuma migration deste repositório - por isso foi abandonada.
 * Mantida apenas para referência histórica. Pode ser removida com segurança.
 */
export const updateTenant = async (id: string, data: Partial<Tenant>): Promise<Tenant | null> => {
  try {
    // 🚨🚨🚨 MENSAGEM GIGANTE PARA PROVAR QUE O CÓDIGO NOVO ESTÁ RODANDO 🚨🚨🚨
    console.log("%c═══════════════════════════════════════════════════════", "color: #00FF00; font-size: 24px; font-weight: bold; background: #000000; padding: 10px;");
    console.log("%c🚨 CÓDIGO NOVO VERSÃO 3.0 - UPDATE GARANTIDO 🚨", "color: #00FF00; font-size: 24px; font-weight: bold; background: #000000; padding: 10px;");
    console.log("%c═══════════════════════════════════════════════════════", "color: #00FF00; font-size: 24px; font-weight: bold; background: #000000; padding: 10px;");
    
    console.log("\n🔥 ===== updateTenant (VERIFICAÇÃO GARANTIDA) =====");
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
    const { data: old, error: oldError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single();
    
    if (oldError || !old) {
      console.error("❌ Erro ao buscar dados antigos:", oldError);
      throw new Error("Inquilino não encontrado");
    }
    
    console.log("🔍 Dados ANTIGOS no banco:", JSON.stringify(old, null, 2));
    
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
    
    console.log("🔄 Dados MESCLADOS:", JSON.stringify(merged, null, 2));
    
    // ✅ Converter para formato do banco
    const dbData = toDatabase(merged);
    
    console.log("\n📤 PAYLOAD para RPC:");
    console.log(JSON.stringify(dbData, null, 2));
    
    // ✅ PREPARAR PARÂMETROS para RPC
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

    // ✅ CHAMAR RPC COM VERIFICAÇÃO GARANTIDA
    console.log("\n📡 Executando update_tenant_guaranteed()...");
    console.log("📡 Esta função VERIFICA campo por campo e lança ERRO se algo não persistir");
    const { data: result, error } = await supabase.rpc('update_tenant_guaranteed', params);

    if (error) {
      console.error("❌ ERRO NA RPC:", error);
      console.error("❌ Mensagem:", error.message);
      console.error("❌ Detalhes:", error.details);
      
      // ✅ Se o erro contém "VERIFICAÇÃO FALHOU", significa que os campos não persistiram
      if (error.message && error.message.includes('VERIFICAÇÃO FALHOU')) {
        console.error("🚨🚨🚨 ALERTA: CAMPOS NÃO FORAM PERSISTIDOS! 🚨🚨🚨");
        console.error("🚨 Detalhes:", error.message);
      }
      
      throw error;
    }

    const verified = Array.isArray(result) && result.length > 0 ? result[0] : null;
    
    if (!verified) {
      console.error("❌ RPC retornou vazio!");
      throw new Error("Erro ao atualizar inquilino - nenhum dado retornado");
    }

    console.log("\n✅✅✅ ATUALIZAÇÃO COMPLETA E VERIFICADA! ✅✅✅");
    console.log("✅ TODOS os campos foram verificados campo por campo pela função SQL");
    console.log("✅ Dados VERIFICADOS:", JSON.stringify(verified, null, 2));
    
    // Log auditoria - TODOS OS CAMPOS
    const changes: string[] = [];
    
    if (old.name !== verified.name) changes.push(`Nome: "${old.name}" → "${verified.name}"`);
    if (old.email !== verified.email) changes.push(`E-mail: "${old.email}" → "${verified.email}"`);
    if (old.phone !== verified.phone) changes.push(`Telefone: "${old.phone}" → "${verified.phone}"`);
    if (old.cpf !== verified.cpf) changes.push(`CPF: "${old.cpf || '-'}" → "${verified.cpf || '-'}"`);
    if (old.rg !== verified.rg) changes.push(`RG: "${old.rg || '-'}" → "${verified.rg || '-'}"`);
    if (old.occupation !== verified.occupation) changes.push(`Ocupação: "${old.occupation || '-'}" → "${verified.occupation || '-'}"`);
    if (old.marital_status !== verified.marital_status) changes.push(`Estado Civil: "${old.marital_status || '-'}" → "${verified.marital_status || '-'}"`);
    if (old.monthly_income !== verified.monthly_income) changes.push(`Renda Mensal: ${old.monthly_income || 0} → ${verified.monthly_income || 0}`);
    if (old.document !== verified.document) changes.push(`Documento: "${old.document || '-'}" → "${verified.document || '-'}"`);
    if (old.document_type !== verified.document_type) changes.push(`Tipo Documento: "${old.document_type || '-'}" → "${verified.document_type || '-'}"`);
    if (old.zip_code !== verified.zip_code) changes.push(`CEP: "${old.zip_code || '-'}" → "${verified.zip_code || '-'}"`);
    if (old.street !== verified.street) changes.push(`Rua: "${old.street || '-'}" → "${verified.street || '-'}"`);
    if (old.number !== verified.number) changes.push(`Número: "${old.number || '-'}" → "${verified.number || '-'}"`);
    if (old.complement !== verified.complement) changes.push(`Complemento: "${old.complement || '-'}" → "${verified.complement || '-'}"`);
    if (old.neighborhood !== verified.neighborhood) changes.push(`Bairro: "${old.neighborhood || '-'}" → "${verified.neighborhood || '-'}"`);
    if (old.city !== verified.city) changes.push(`Cidade: "${old.city || '-'}" → "${verified.city || '-'}"`);
    if (old.state !== verified.state) changes.push(`Estado: "${old.state || '-'}" → "${verified.state || '-'}"`);
    if (old.status !== verified.status) changes.push(`Status: "${old.status}" → "${verified.status}"`);
    
    const changesSummary = changes.length > 0 
      ? `Inquilino: ${verified.name}\n\nCampos alterados:\n${changes.join('\n')}`
      : `Inquilino: ${verified.name} (sem alterações)`;
    
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
        name: verified.name,
        email: verified.email,
        phone: verified.phone,
        cpf: verified.cpf,
        rg: verified.rg,
        occupation: verified.occupation,
        marital_status: verified.marital_status,
        monthly_income: verified.monthly_income,
        document: verified.document,
        document_type: verified.document_type,
        zip_code: verified.zip_code,
        street: verified.street,
        number: verified.number,
        complement: verified.complement,
        neighborhood: verified.neighborhood,
        city: verified.city,
        state: verified.state,
        status: verified.status,
      },
    });
    
    console.log("🔥 FIM updateTenant\n");
    return verified ? fromDatabase(verified) : null;
  } catch (error: any) {
    console.error("❌ ERRO:", error.message);
    throw error;
  }
};

export const update = async (
  id: string,
  tenant: Partial<Omit<Tenant, "id" | "createdAt">>
): Promise<Tenant> => {
  console.log("\n🔥 ===== tenantService.update =====");
  console.log("🔍 ID:", id);
  console.log("🔍 Dados recebidos:", JSON.stringify(tenant, null, 2));

  // ✅ Email único (ignorando o próprio registro)
  if (tenant.email) {
    const { data: existing, error: emailCheckError } = await supabase
      .from("tenants")
      .select("id")
      .eq("email", tenant.email)
      .neq("id", id)
      .maybeSingle();

    if (emailCheckError) {
      console.error("❌ [update] Erro ao verificar email único:", emailCheckError);
      throw emailCheckError;
    }

    if (existing) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }
  }

  const { data: oldData } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .single();

  // ✅ Converter para o formato do banco - envia TODOS os campos recebidos
  // (o formulário sempre envia o objeto completo, então isso cobre 100% dos campos)
  const dbData = toDatabase(tenant);

  console.log("📤 [update] PAYLOAD para UPDATE direto na tabela:");
  console.log(JSON.stringify(dbData, null, 2));

  const { data, error } = await supabase
    .from("tenants")
    .update(dbData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("❌ [update] Erro no UPDATE:", error);
    throw error;
  }

  console.log("✅ [update] Dados retornados pelo banco após UPDATE:", JSON.stringify(data, null, 2));

  await logAudit({
    action_type: "update",
    entity_type: "tenant",
    entity_id: id,
    old_values: oldData ? {
      name: oldData.name,
      email: oldData.email,
      phone: oldData.phone,
      occupation: oldData.occupation,
      marital_status: oldData.marital_status,
      monthly_income: oldData.monthly_income,
      status: oldData.status,
    } : undefined,
    new_values: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      occupation: data.occupation,
      marital_status: data.marital_status,
      monthly_income: data.monthly_income,
      status: data.status,
    },
  });

  console.log("🔥 FIM tenantService.update\n");
  return fromDatabase(data);
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