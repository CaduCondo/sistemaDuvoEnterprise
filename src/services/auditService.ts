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
    // ✅ CORREÇÃO: Buscar usuário do localStorage (autenticação custom)
    const currentUserStr = localStorage.getItem("currentUser");
    if (!currentUserStr) {
      console.warn("⚠️ [audit] Tentativa de log sem usuário autenticado");
      return;
    }

    const currentUser = JSON.parse(currentUserStr);
    const userId = currentUser.id;

    if (!userId) {
      console.warn("⚠️ [audit] Usuário sem ID no localStorage");
      return;
    }

    // Obter informações do navegador/IP
    const userAgent = navigator.userAgent;
    const pageUrl = window.location.href;

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

    // Inserir log
    const { error } = await supabase.from("audit_logs").insert({
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
    });

    if (error) {
      console.error("❌ [audit] Erro ao registrar log:", error);
    } else {
      console.log("✅ [audit] Log registrado:", {
        action: params.action_type,
        entity: params.entity_type,
        id: params.entity_id,
        summary: changesSummary,
      });
    }
  } catch (error) {
    console.error("❌ [audit] Erro ao registrar auditoria:", error);
  }
}

/**
 * Gera um resumo legível das alterações
 */
function generateChangesSummary(
  action: AuditActionType,
  entity: AuditEntityType,
  oldValues: Record<string, any>,
  newValues: Record<string, any>
): string {
  const entityNames: Record<AuditEntityType, string> = {
    property: "Imóvel",
    tenant: "Inquilino",
    rental: "Locação",
    payment: "Recebimento",
    user: "Usuário",
    location: "Local",
    system: "Sistema",
  };

  const entityName = entityNames[entity] || entity;

  if (action === "create") {
    return `${entityName} criado`;
  }

  if (action === "delete") {
    return `${entityName} excluído`;
  }

  if (action === "update") {
    const changes: string[] = [];
    
    // Comparar valores
    for (const key in newValues) {
      if (oldValues[key] !== newValues[key]) {
        const fieldName = formatFieldName(key);
        const oldVal = formatValue(oldValues[key]);
        const newVal = formatValue(newValues[key]);
        
        changes.push(`${fieldName}: "${oldVal}" → "${newVal}"`);
      }
    }

    if (changes.length === 0) {
      return `${entityName} atualizado (sem alterações detectadas)`;
    }

    if (changes.length === 1) {
      return `${entityName}: ${changes[0]}`;
    }

    return `${entityName}: ${changes.slice(0, 3).join(", ")}${changes.length > 3 ? ` e mais ${changes.length - 3}` : ""}`;
  }

  return `${entityName}: ${action}`;
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