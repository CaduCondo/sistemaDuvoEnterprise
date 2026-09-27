import { useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RoleMenuPermission, SystemUser, Location } from "@/types";
import { FeeExemptionDialog } from "./FeeExemptionDialog";
import { 
  CheckCircle2, 
  XCircle, 
  User, 
  Settings as SettingsIcon,
  MapPin, 
  Shield, 
  DollarSign 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface PermissionsTabProps {
  users: SystemUser[];
  locations: Location[];
  roleMenuPermissions: RoleMenuPermission[];
  isLoading: boolean;
  onUpdateRoleMenuPermission: (role: string, menuItem: string, hasAccess: boolean) => Promise<boolean>;
  onSaveLocationPermissions: (userId: string, locationIds: string[]) => Promise<boolean>;
  onSaveAdminFeeExemptions: (locationIds: string[]) => Promise<boolean>;
  onSaveManagementFeeExemptions: (locationIds: string[]) => Promise<boolean>;
  getUserLocationPermissions: (userId: string) => Promise<string[]>;
  getAdminFeeExemptions: () => Promise<string[]>;
  getManagementFeeExemptions: () => Promise<string[]>;
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  broker: "Corretor",
  financial: "Financeiro",
};

const menuLabels: Record<string, string> = {
  dashboard: "Dashboard",
  properties: "Imóveis",
  tenants: "Inquilinos",
  rentals: "Locações",
  payments: "Recebimentos",
  financial: "Financeiro",
  settings: "Configurações",
};

const menuItems = ["dashboard", "properties", "tenants", "rentals", "payments", "financial", "settings"];
const roles = ["admin", "broker", "financial"];

export function PermissionsTab({
  users,
  locations,
  roleMenuPermissions,
  isLoading,
  onUpdateRoleMenuPermission,
  onSaveLocationPermissions,
  onSaveAdminFeeExemptions,
  onSaveManagementFeeExemptions,
  getUserLocationPermissions,
  getAdminFeeExemptions,
  getManagementFeeExemptions,
}: PermissionsTabProps) {
  const { toast } = useToast();
  const [selectedUserForLocations, setSelectedUserForLocations] = useState<SystemUser | null>(null);
  const [isAdminFeeExemptionDialogOpen, setIsAdminFeeExemptionDialogOpen] = useState(false);
  const [isManagementFeeExemptionDialogOpen, setIsManagementFeeExemptionDialogOpen] = useState(false);
  const [userLocationPermissions, setUserLocationPermissions] = useState<string[]>([]);
  const [isLocationPermissionsDialogOpen, setIsLocationPermissionsDialogOpen] = useState(false);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionsSet, setPermissionsSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    const newSet = new Set<string>();
    roleMenuPermissions.forEach(perm => {
      const key = `${perm.role}-${perm.menu_id}`;
      newSet.add(key);
    });
    setPermissionsSet(newSet);
  }, [roleMenuPermissions]);

  const hasPermission = (role: string, menuItem: string): boolean => {
    const key = `${role}-${menuItem}`;
    return permissionsSet.has(key);
  };

  const togglePermission = async (role: string, menuItem: string) => {
    if (isSaving) return;
    setIsSaving(true);
    const key = `${role}-${menuItem}`;
    const currentHasAccess = hasPermission(role, menuItem);
    const newHasAccess = !currentHasAccess;

    setPermissionsSet(prev => {
      const newSet = new Set(prev);
      if (newHasAccess) {
        newSet.add(key);
      } else {
        newSet.delete(key);
      }
      return newSet;
    });

    try {
      const success = await onUpdateRoleMenuPermission(role, menuItem, newHasAccess);
      if (!success) {
        setPermissionsSet(prev => {
          const newSet = new Set(prev);
          if (currentHasAccess) {
            newSet.add(key);
          } else {
            newSet.delete(key);
          }
          return newSet;
        });
      }
    } catch (error) {
      console.error("Erro ao alternar permissão:", error);
      setPermissionsSet(prev => {
        const newSet = new Set(prev);
        if (currentHasAccess) {
          newSet.add(key);
        } else {
          newSet.delete(key);
        }
        return newSet;
      });
      toast({
        title: "Erro",
        description: "Erro ao atualizar permissão. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openLocationPermissionsDialog = async (user: SystemUser) => {
    setSelectedUserForLocations(user);
    setIsLoadingPermissions(true);
    try {
      const permissions = await getUserLocationPermissions(user.id);
      setUserLocationPermissions(permissions);
      setIsLocationPermissionsDialogOpen(true);
    } catch (error) {
      console.error("Erro ao carregar permissões:", error);
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  const handleToggleLocationPermission = (locationId: string) => {
    setUserLocationPermissions((prev) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId]
    );
  };

  const handleSaveLocationPermissions = async () => {
    if (!selectedUserForLocations) return;
    const success = await onSaveLocationPermissions(selectedUserForLocations.id, userLocationPermissions);
    if (success) {
      setIsLocationPermissionsDialogOpen(false);
    }
  };

  const openAdminFeeExemptionDialog = () => {
    setIsAdminFeeExemptionDialogOpen(true);
  };

  const openManagementFeeExemptionDialog = () => {
    setIsManagementFeeExemptionDialogOpen(true);
  };

  const handleSaveAdminFeeExemptions = async (locationIds: string[]) => {
    return await onSaveAdminFeeExemptions(locationIds);
  };

  const handleSaveManagementFeeExemptions = async (locationIds: string[]) => {
    return await onSaveManagementFeeExemptions(locationIds);
  };

  return (
    <div className="space-y-4">
      {/* Permissões de Menu */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4" />
            Permissões de Menu por Perfil
          </CardTitle>
          <CardDescription className="text-xs">Controle o acesso de cada perfil aos menus do sistema</CardDescription>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[140px] font-semibold text-xs py-2">Menu</TableHead>
                  {roles.map((role) => (
                    <TableHead key={role} className="text-center font-semibold text-xs py-2">
                      {roleLabels[role]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {menuItems.map((menuItem) => (
                  <TableRow key={menuItem} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-xs py-2">{menuLabels[menuItem]}</TableCell>
                    {roles.map((role) => {
                      const hasAccess = hasPermission(role, menuItem);
                      return (
                        <TableCell key={role} className="text-center py-2">
                          <button
                            onClick={() => togglePermission(role, menuItem)}
                            className="inline-flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
                            disabled={isLoading || isSaving}
                          >
                            {hasAccess ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            )}
                          </button>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Isenções de Taxa - Lado a Lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Isenção de Taxa de Gerenciamento */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4" />
              Isenção de Taxa Gerenciamento
            </CardTitle>
            <CardDescription className="text-xs">
              Configure quais locais são isentos de taxa de gerenciamento.
              Esta configuração se aplica a todos os corretores.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-3 flex flex-col justify-center items-center h-[120px]">
            {/* ⚠️ Corrigido em 25/set/2026 (issue #110): este botão -- que abre a
                isenção de GERENCIAMENTO -- se chamava
                "permissions-admin-fee-exemption", e o da isenção de ADMIN se
                chamava "permissions-management-fee-exemption". Os dois ids
                estavam TROCADOS em relação ao que cada botão faz. Nenhum teste
                usava (conferido), mas era uma armadilha pronta: um teste
                escrito pelo nome certo abriria a tela errada e passaria
                testando outra coisa. */}
            <Button
              id="permissions-management-fee-exemption"
              variant="outline"
              className="w-full max-w-xs gap-2"
              onClick={openManagementFeeExemptionDialog}
            >
              <SettingsIcon className="h-4 w-4" />
              Gerenciar Locais Isentos
            </Button>
            <p className="text-[10px] text-muted-foreground mt-2 text-center max-w-xs">
              Locais selecionados não gerarão cobrança de taxa de gerenciamento no sistema.
            </p>
          </CardContent>
        </Card>

        {/* Isenção de Taxa Admin */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4" />
              Isenção de Taxa Admin
            </CardTitle>
            <CardDescription className="text-xs">
              Configure quais locais são isentos de taxa de administração.
              Esta configuração se aplica a todos os corretores.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-3 flex flex-col justify-center items-center h-[120px]">
            {/* Ver comentário no botão da isenção de Gerenciamento: os dois ids
                estavam trocados e foram acertados em 25/set/2026. */}
            <Button
              id="permissions-admin-fee-exemption"
              variant="outline"
              className="w-full max-w-xs gap-2"
              onClick={openAdminFeeExemptionDialog}
            >
              <SettingsIcon className="h-4 w-4" />
              Gerenciar Locais Isentos
            </Button>
            <p className="text-[10px] text-muted-foreground mt-2 text-center max-w-xs">
              Locais selecionados não gerarão cobrança de taxa de administração no sistema.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Permissões de Locais por Usuário */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4" />
            Permissões de Locais
          </CardTitle>
          <CardDescription className="text-xs">Usuários Financeiros</CardDescription>
        </CardHeader>
        <CardContent className="pb-3">
          {users.filter((u) => u.role === "financial").length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-xs">
              Nenhum usuário financeiro
            </div>
          ) : (
            <div className="space-y-2">
              {users
                .filter((u) => u.role === "financial")
                .map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 border rounded-lg hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-xs truncate">{user.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <Button 
                      id={`permissions-location-${user.id}`}
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] px-2 ml-2 flex-shrink-0"
                      onClick={() => openLocationPermissionsDialog(user)}
                    >
                      Gerenciar
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Permissões de Local */}
      <Dialog open={isLocationPermissionsDialogOpen} onOpenChange={setIsLocationPermissionsDialogOpen}>
        <DialogContent id="permissions-location-dialog" className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Permissões de Locais - {selectedUserForLocations?.name}</DialogTitle>
            <DialogDescription className="text-xs">Selecione os locais que este usuário pode visualizar</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {isLoadingPermissions ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Carregando...</div>
            ) : locations.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Nenhum local cadastrado</div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-lg p-3">
                {locations.map((location) => (
                  <div key={location.id} className="flex items-center gap-2 p-2 border rounded hover:bg-accent/50">
                    <Checkbox
                      id={`permissions-location-checkbox-${location.id}`}
                      checked={userLocationPermissions.includes(location.id)}
                      onCheckedChange={() => handleToggleLocationPermission(location.id)}
                    />
                    <label htmlFor={`permissions-location-checkbox-${location.id}`} className="flex-1 cursor-pointer">
                      <p className="font-medium text-sm">{location.name}</p>
                      <p className="text-xs text-muted-foreground">{location.city}, {location.state}</p>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button id="permissions-location-cancel" variant="outline" onClick={() => setIsLocationPermissionsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button id="permissions-location-save" onClick={handleSaveLocationPermissions} className="bg-emerald-600 hover:bg-emerald-700">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Isenção de Taxa Admin */}
      {isAdminFeeExemptionDialogOpen && (
        <FeeExemptionDialog
          open={isAdminFeeExemptionDialogOpen}
          onOpenChange={setIsAdminFeeExemptionDialogOpen}
          locations={locations}
          onSave={handleSaveAdminFeeExemptions}
          getExemptions={getAdminFeeExemptions}
          title="Isenção de Taxa Admin"
          description="Selecione os locais que não terão cobrança de taxa de administração"
        />
      )}

      {/* Dialog de Isenção de Taxa de Gerenciamento */}
      {isManagementFeeExemptionDialogOpen && (
        <FeeExemptionDialog
          open={isManagementFeeExemptionDialogOpen}
          onOpenChange={setIsManagementFeeExemptionDialogOpen}
          locations={locations}
          onSave={handleSaveManagementFeeExemptions}
          getExemptions={getManagementFeeExemptions}
          title="Isenção de Taxa Gerenciamento"
          description="Selecione os locais que não terão cobrança de taxa de gerenciamento"
        />
      )}
    </div>
  );
}