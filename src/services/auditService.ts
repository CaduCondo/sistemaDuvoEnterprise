import { supabase } from "@/integrations/supabase/client";

export type AuditActionType = 
  | "create" 
  | "update" 
  | "delete" 
  | "login" 
  | "logout" 
  | "password_change"
  | "status_change";

export type AuditEntityType = 
  | "property" 
  | "tenant" 
  | "rental" 
  | "payment" 
  | "user" 
  | "location"
  | "system";

interface AuditLogParams {
  action_type: AuditActionType;
  entity_type: AuditEntityType;
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  changes_summary?: string;
  metadata?: Record<string, any>;
}

/**
 * Registra uma ação de auditoria no banco de dados
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    console.log("🔍 [audit] Tentando registrar log:", params);

    // ✅ CORREÇÃO: Buscar usuário do localStorage (autenticação custom)
    const currentUserStr = localStorage.getItem("currentUser");
    
    // 🔥 DEBUG: Mostrar EXATAMENTE o que tem no localStorage
    console.log("🔍 [audit] localStorage.getItem('currentUser'):", currentUserStr);
    console.log("🔍 [audit] Todas as chaves do localStorage:", Object.keys(localStorage));
    
    if (!currentUserStr) {
      console.warn("⚠️ [audit] Tentativa de log sem usuário autenticado - localStorage vazio");
      console.warn("⚠️ [audit] TODAS as chaves disponíveis:", Object.keys(localStorage).join(", "));
      return;
    }

    console.log("📋 [audit] localStorage currentUser encontrado:", currentUserStr);

    const currentUser = JSON.parse(currentUserStr);
    const userId = currentUser.id;

    console.log("📋 [audit] User ID extraído:", userId);
    console.log("📋 [audit] Usuário completo:", currentUser);

    if (!userId) {
      console.warn("⚠️ [audit] Usuário sem ID no localStorage");
      return;
    }

    // Obter informações do navegador/IP
    const userAgent = navigator.userAgent;
    const pageUrl = window.location.href;

    console.log("📋 [audit] UserAgent:", userAgent);
    console.log("📋 [audit] PageURL:", pageUrl);

    // Gerar resumo automático se não fornecido
    let changesSummary = params.changes_summary;
    if (!changesSummary && params.old_values && params.new_values) {
      changesSummary = generateChangesSummary(
        params.action_type,
        params.entity_type,
        params.old_values,
        params.new_values
      );
    }

    console.log("📋 [audit] Resumo gerado:", changesSummary);

    const logData = {
      user_id: userId,
      action_type: params.action_type,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      old_values: params.old_values || null,
      new_values: params.new_values || null,
      changes_summary: changesSummary,
      user_agent: userAgent,
      page_url: pageUrl,
      metadata: params.metadata || null,
    };

    console.log("📤 [audit] Enviando para banco:", logData);

    // Inserir log
    const { data: insertedData, error } = await supabase
      .from("audit_logs")
      .insert(logData)
      .select()
      .single();

    if (error) {
      console.error("❌ [audit] Erro ao registrar log:", error);
      console.error("❌ [audit] Código do erro:", error.code);
      console.error("❌ [audit] Mensagem:", error.message);
      console.error("❌ [audit] Detalhes:", error.details);
    } else {
      console.log("✅ [audit] Log registrado com SUCESSO:", insertedData);
      console.log("✅ [audit] ID do log:", insertedData?.id);
    }
  } catch (error) {
    console.error("❌ [audit] Erro ao registrar auditoria:", error);
    if (error instanceof Error) {
      console.error("❌ [audit] Stack:", error.stack);
    }
  }
}

/**
 * Gera um resumo automático das mudanças com base nos valores antigos e novos
 */
function generateChangesSummary(
  actionType: AuditActionType,
  entityType: AuditEntityType,
  oldValues: Record<string, any>,
  newValues: Record<string, any>
): string {
  const entityNames: Record<AuditEntityType, string> = {
    property: "Imóvel",
    tenant: "Inquilino",
    rental: "Locação",
    payment: "Recebimento",
    user: "Usuário",
    location: "Localização",
    system: "Sistema",
  };

  const entityName = entityNames[entityType] || entityType;

  if (actionType === "create") {
    return `${entityName} criado`;
  }

  if (actionType === "delete") {
    return `${entityName} deletado`;
  }

  if (actionType === "update") {
    // ✅ CORREÇÃO: Listar TODAS as mudanças, não apenas a primeira
    const changes: string[] = [];

    for (const key in newValues) {
      const oldValue = oldValues[key];
      const newValue = newValues[key];

      if (oldValue !== newValue) {
        // Mapear nomes dos campos para português
        const fieldNames: Record<string, string> = {
          location: "Localização",
          complement: "Complemento",
          description: "Descrição",
          rooms: "Quartos",
          bathrooms: "Banheiros",
          area: "Área",
          value: "Valor",
          has_garage: "Garagem",
          has_furniture: "Mobiliado",
          accepts_pets: "Aceita Pets",
          status: "Status",
          name: "Nome",
          email: "E-mail",
          phone: "Telefone",
          cpf: "CPF",
          rg: "RG",
        };

        const fieldName = fieldNames[key] || key;
        changes.push(`${fieldName}: "${oldValue}" → "${newValue}"`);
      }
    }

    if (changes.length === 0) {
      return `${entityName} atualizado`;
    }

    // Se houver muitas mudanças (>3), resumir
    if (changes.length > 3) {
      return `${entityName}: ${changes.slice(0, 3).join(", ")} e mais ${changes.length - 3} alterações`;
    }

    return `${entityName}: ${changes.join(", ")}`;
  }

  return `${entityName} - ${actionType}`;
}

/**
 * Formata nomes de campos para exibição
 */
function formatFieldName(key: string): string {
  const fieldNames: Record<string, string> = {
    name: "Nome",
    email: "E-mail",
    phone: "Telefone",
    status: "Status",
    value: "Valor",
    location: "Local",
    complement: "Complemento",
    tenant_id: "Inquilino",
    property_id: "Imóvel",
    start_date: "Data Início",
    end_date: "Data Fim",
    paid_amount: "Valor Pago",
    expected_amount: "Valor Esperado",
    payment_date: "Data Pagamento",
    due_date: "Data Vencimento",
  };

  return fieldNames[key] || key.replace(/_/g, " ");
}

/**
 * Formata valores para exibição
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") {
    // Se parece com dinheiro (tem vírgula ou ponto decimal)
    if (value % 1 !== 0) {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
    }
    return value.toString();
  }
  if (typeof value === "string") {
    // Se é uma data
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
      const date = new Date(value + "T00:00:00");
      return date.toLocaleDateString("pt-BR");
    }
    return value;
  }
  return String(value);
}

/**
 * Log de login bem-sucedido
 */
export async function logLogin(userId: string, metadata?: Record<string, any>): Promise<void> {
  await logAudit({
    action_type: "login",
    entity_type: "user",
    entity_id: userId,
    changes_summary: "Login realizado com sucesso",
    metadata,
  });
}

/**
 * Log de logout
 */
export async function logLogout(userId: string): Promise<void> {
  await logAudit({
    action_type: "logout",
    entity_type: "user",
    entity_id: userId,
    changes_summary: "Logout realizado",
  });
}

/**
 * Log de mudança de senha
 */
export async function logPasswordChange(userId: string, wasTemporary: boolean = false): Promise<void> {
  await logAudit({
    action_type: "password_change",
    entity_type: "user",
    entity_id: userId,
    changes_summary: wasTemporary 
      ? "Senha temporária alterada pelo usuário" 
      : "Senha alterada",
  });
}