/**
 * SISTEMA DE PERMISSÕES CENTRALIZADO
 * 
 * Fonte única de verdade para todas as permissões do sistema.
 * Baseado em perfis (roles) com verificações simples e diretas.
 */

// ============================================================
// PERFIS DO SISTEMA
// ============================================================

export const ROLES = {
  ADMIN: "admin",
  BROKER: "broker",
  FINANCIAL: "financial",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// ============================================================
// DEFINIÇÃO DE PERMISSÕES POR PERFIL
// ============================================================

export interface RolePermissions {
  // Menu e Navegação
  canViewDashboard: boolean;
  canViewProperties: boolean;
  canViewTenants: boolean;
  canViewRentals: boolean;
  canViewPayments: boolean;
  canViewFinancial: boolean;
  canViewSettings: boolean;
  canViewKanban: boolean;

  // Operações de Imóveis
  canCreateProperty: boolean;
  canEditProperty: boolean;
  canDeleteProperty: boolean;

  // Operações de Inquilinos
  canCreateTenant: boolean;
  canEditTenant: boolean;
  canDeleteTenant: boolean;

  // Operações de Locações
  canCreateRental: boolean;
  canEditRental: boolean;
  canDeleteRental: boolean;

  // Operações de Pagamentos
  canCreatePayment: boolean;
  canEditPayment: boolean;
  canDeletePayment: boolean;
  canMarkAsPaid: boolean;

  // Configurações Gerais
  canEditCompanyData: boolean;
  canConfigureFees: boolean;
  canConfigureFines: boolean;

  // Gerenciamento de Usuários
  canViewUsers: boolean;
  canCreateUser: boolean;
  canEditUser: boolean;
  canDeleteUser: boolean;
  canChangeUserRole: boolean; // ← CRÍTICO: Apenas admin
  canResetPassword: boolean;
  canUnlockUser: boolean;

  // Gerenciamento de Permissões
  canManageMenuPermissions: boolean;
  canManageLocationPermissions: boolean;

  // Gerenciamento de Locais
  canViewLocations: boolean;
  canCreateLocation: boolean;
  canEditLocation: boolean;
  canDeleteLocation: boolean;
}

// ============================================================
// PERMISSÕES POR PERFIL - CONFIGURAÇÃO
// ============================================================

export const PERMISSIONS: Record<Role, RolePermissions> = {
  // ADMINISTRADOR: Controle total do sistema
  admin: {
    // Menu e Navegação
    canViewDashboard: true,
    canViewProperties: true,
    canViewTenants: true,
    canViewRentals: true,
    canViewPayments: true,
    canViewFinancial: true,
    canViewSettings: true,
    canViewKanban: true,

    // Operações de Imóveis
    canCreateProperty: true,
    canEditProperty: true,
    canDeleteProperty: true,

    // Operações de Inquilinos
    canCreateTenant: true,
    canEditTenant: true,
    canDeleteTenant: true,

    // Operações de Locações
    canCreateRental: true,
    canEditRental: true,
    canDeleteRental: true,

    // Operações de Pagamentos
    canCreatePayment: true,
    canEditPayment: true,
    canDeletePayment: true,
    canMarkAsPaid: true,

    // Configurações Gerais
    canEditCompanyData: true,
    canConfigureFees: true,
    canConfigureFines: true,

    // Gerenciamento de Usuários
    canViewUsers: true,
    canCreateUser: true,
    canEditUser: true,
    canDeleteUser: true,
    canChangeUserRole: true, // ← APENAS ADMIN PODE MUDAR PERFIS
    canResetPassword: true,
    canUnlockUser: true,

    // Gerenciamento de Permissões
    canManageMenuPermissions: true,
    canManageLocationPermissions: true,

    // Gerenciamento de Locais
    canViewLocations: true,
    canCreateLocation: true,
    canEditLocation: true,
    canDeleteLocation: true,
  },

  // CORRETOR: Operações do dia-a-dia
  broker: {
    // Menu e Navegação
    canViewDashboard: true,
    canViewProperties: true,
    canViewTenants: true,
    canViewRentals: true,
    canViewPayments: true,
    canViewFinancial: true, // ← Acesso ao módulo financeiro
    canViewSettings: false,
    canViewKanban: true,

    // Operações de Imóveis
    canCreateProperty: true,
    canEditProperty: true,
    canDeleteProperty: true,

    // Operações de Inquilinos
    canCreateTenant: true,
    canEditTenant: true,
    canDeleteTenant: true,

    // Operações de Locações
    canCreateRental: true,
    canEditRental: true,
    canDeleteRental: true,

    // Operações de Pagamentos
    canCreatePayment: true,
    canEditPayment: true,
    canDeletePayment: true, // ← ATUALIZADO: Corretor pode cancelar pagamentos
    canMarkAsPaid: true,

    // Configurações Gerais
    canEditCompanyData: false, // ← Não pode editar empresa
    canConfigureFees: false, // ← Não pode configurar taxas
    canConfigureFines: false, // ← Não pode configurar multas

    // Gerenciamento de Usuários
    canViewUsers: true,
    canCreateUser: false, // ← Não pode criar usuários
    canEditUser: true, // Pode editar dados pessoais
    canDeleteUser: false, // ← Não pode deletar usuários
    canChangeUserRole: false, // ← NÃO PODE MUDAR PERFIS
    canResetPassword: false, // ← Não pode resetar senhas
    canUnlockUser: false, // ← Não pode desbloquear

    // Gerenciamento de Permissões
    canManageMenuPermissions: false, // ← Não pode gerenciar permissões
    canManageLocationPermissions: false, // ← Não pode gerenciar permissões

    // Gerenciamento de Locais
    canViewLocations: true,
    canCreateLocation: false, // ← Não pode criar locais
    canEditLocation: false, // ← Não pode editar locais
    canDeleteLocation: false, // ← Não pode deletar locais
  },

  // FINANCEIRO: Visualização e relatórios
  financial: {
    // Menu e Navegação
    canViewDashboard: true,
    canViewProperties: true, // Pode ver para relatórios
    canViewTenants: true, // Pode ver para relatórios
    canViewRentals: true, // Pode ver para relatórios
    canViewPayments: true,
    canViewFinancial: true, // ← Acesso ao módulo financeiro
    canViewSettings: true,
    canViewKanban: false,

    // Operações de Imóveis
    canCreateProperty: false, // ← Não gerencia imóveis
    canEditProperty: false,
    canDeleteProperty: false,

    // Operações de Inquilinos
    canCreateTenant: false, // ← Não gerencia inquilinos
    canEditTenant: false,
    canDeleteTenant: false,

    // Operações de Locações
    canCreateRental: false, // ← Não gerencia locações
    canEditRental: false,
    canDeleteRental: false,

    // Operações de Pagamentos
    canCreatePayment: false, // ← Apenas visualiza
    canEditPayment: false,
    canDeletePayment: false,
    canMarkAsPaid: true, // ← PODE marcar como pago

    // Configurações Gerais
    canEditCompanyData: false,
    canConfigureFees: false,
    canConfigureFines: false,

    // Gerenciamento de Usuários
    canViewUsers: true,
    canCreateUser: false,
    canEditUser: false,
    canDeleteUser: false,
    canChangeUserRole: false, // ← NÃO PODE MUDAR PERFIS
    canResetPassword: false,
    canUnlockUser: false,

    // Gerenciamento de Permissões
    canManageMenuPermissions: false,
    canManageLocationPermissions: false,

    // Gerenciamento de Locais
    canViewLocations: true,
    canCreateLocation: false,
    canEditLocation: false,
    canDeleteLocation: false,
  },
};

// ============================================================
// HELPERS DE VERIFICAÇÃO DE PERMISSÃO
// ============================================================

/**
 * Verifica se um usuário tem uma permissão específica
 * 
 * @param userRole - Perfil do usuário (admin, broker, financial)
 * @param permission - Nome da permissão a verificar
 * @returns true se o usuário tem a permissão, false caso contrário
 * 
 * @example
 * hasPermission("admin", "canChangeUserRole") // true
 * hasPermission("broker", "canChangeUserRole") // false
 */
export function hasPermission(
  userRole: string | undefined | null,
  permission: keyof RolePermissions
): boolean {
  if (!userRole) return false;

  const rolePermissions = PERMISSIONS[userRole as Role];
  if (!rolePermissions) return false;

  return rolePermissions[permission] ?? false;
}

/**
 * Verifica se usuário pode gerenciar configurações
 */
export function canManageSettings(userRole: string | undefined | null): boolean {
  return (
    hasPermission(userRole, "canEditCompanyData") ||
    hasPermission(userRole, "canConfigureFees") ||
    hasPermission(userRole, "canConfigureFines")
  );
}

/**
 * Verifica se usuário pode alterar perfis de outros usuários
 */
export function canChangeRoles(userRole: string | undefined | null): boolean {
  return hasPermission(userRole, "canChangeUserRole");
}

/**
 * Verifica se usuário pode gerenciar usuários
 */
export function canManageUsers(userRole: string | undefined | null): boolean {
  return (
    hasPermission(userRole, "canCreateUser") ||
    hasPermission(userRole, "canDeleteUser") ||
    hasPermission(userRole, "canResetPassword") ||
    hasPermission(userRole, "canUnlockUser")
  );
}

/**
 * Verifica se usuário é administrador
 */
export function isAdmin(userRole: string | undefined | null): boolean {
  return userRole === ROLES.ADMIN;
}

/**
 * Verifica se usuário é corretor
 */
export function isBroker(userRole: string | undefined | null): boolean {
  return userRole === ROLES.BROKER;
}

/**
 * Verifica se usuário é financeiro
 */
export function isFinancial(userRole: string | undefined | null): boolean {
  return userRole === ROLES.FINANCIAL;
}

/**
 * Retorna todas as permissões de um perfil
 */
export function getRolePermissions(userRole: string | undefined | null): RolePermissions | null {
  if (!userRole) return null;
  return PERMISSIONS[userRole as Role] ?? null;
}

/**
 * Retorna label amigável para o perfil
 */
export function getRoleLabel(role: string | undefined | null): string {
  switch (role) {
    case ROLES.ADMIN:
      return "Administrador";
    case ROLES.BROKER:
      return "Corretor";
    case ROLES.FINANCIAL:
      return "Financeiro";
    default:
      return "Desconhecido";
  }
}

import { supabase } from "@/integrations/supabase/client";

export async function checkUserPermission(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  try {
    // 1. Buscar a role do usuário na tabela de system_users
    // A tabela profiles não existe nos tipos gerados, usando system_users que está na lista válida
    const { data: systemUser } = await supabase
      .from('system_users')
      .select('role')
      .eq('id', userId) // Assumindo que o ID do usuário auth é o mesmo ou tem mapeamento
      .maybeSingle();
      
    // Se não achar direto, tenta pelo auth_user_mapping se necessário, 
    // mas por enquanto vamos assumir que system_users tem a role.
    // Se systemUser for null, tenta fallback ou assume broker.

    const userRole = systemUser?.role || 'broker';

    if (userRole === 'admin') return true;
    if (userRole === 'financial') return false;

    return false;
  } catch (error) {
    console.error("Erro ao verificar permissão:", error);
    return false;
  }
}