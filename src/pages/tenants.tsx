import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List, Trash2, HelpCircle, Users } from "lucide-react";
import { useTenants } from "@/hooks/useTenants";
import { TenantCard } from "@/components/tenants/TenantCard";
import { TenantFormDialog } from "@/components/tenants/TenantFormDialog";
import { TenantDeleteAlert } from "@/components/tenants/TenantDeleteAlert";
import { TenantFilters } from "@/components/tenants/TenantFilters";
import { Tenant } from "@/types";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { SortableTable } from "@/components/ui/sortable-table";
import { Badge } from "@/components/ui/badge";
import { useAlert } from "@/contexts/AlertContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpDialog } from "@/components/HelpDialog";

export default function TenantsPage() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const {
    tenants,
    isLoading,
    createTenant,
    updateTenant,
    deleteTenant,
  } = useTenants();

  const [dialogState, setDialogState] = useState({
    isOpen: false,
    selectedTenant: null as Tenant | null,
    isViewMode: false,
  });
  
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]); // Não usar filtro de status
  const [helpOpen, setHelpOpen] = useState(false);
  
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const formatDocument = useCallback((tenant: Tenant) => {
    if (tenant.documentType === "cpf" && tenant.cpf) {
      return tenant.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (tenant.documentType === "cnpj" && tenant.document) {
      return tenant.document.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return tenant.document || tenant.cpf || "-";
  }, []);

  const formatPhone = useCallback((phone?: string) => {
    if (!phone) return "-";
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }, []);

  const filteredTenants = useMemo(() => {
    let filtered = tenants;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((tenant) => {
        const name = tenant.name.toLowerCase();
        const doc = formatDocument(tenant).toLowerCase();
        const phone = formatPhone(tenant.phone).toLowerCase();
        const email = (tenant.email || "").toLowerCase();
        
        return name.includes(search) || 
               doc.includes(search) || 
               phone.includes(search) || 
               email.includes(search);
      });
    }

    // Filtrar por status se houver filtro selecionado
    if (statusFilter.length > 0) {
      filtered = filtered.filter((t) => statusFilter.includes(t.status));
    }

    if (sortKey) {
      filtered.sort((a, b) => {
        const aVal = sortKey === "name" ? a.name.toLowerCase() : a.status;
        const bVal = sortKey === "name" ? b.name.toLowerCase() : b.status;
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [tenants, searchTerm, statusFilter, sortKey, sortDirection, formatDocument, formatPhone]);

  useEffect(() => {
    const viewId = router.query.view as string;
    if (viewId && tenants.length > 0) {
      const tenant = tenants.find((t) => t.id === viewId);
      if (tenant) {
        setDialogState({
          isOpen: true,
          selectedTenant: tenant,
          isViewMode: true,
        });
        router.replace("/tenants", undefined, { shallow: true });
      }
    }
  }, [router.query.view, tenants, router]);

  const handleCreateNew = useCallback(() => {
    setDialogState({
      isOpen: true,
      selectedTenant: null,
      isViewMode: false,
    });
  }, []);

  const handleViewTenant = useCallback((tenant: Tenant) => {
    setDialogState({
      isOpen: true,
      selectedTenant: tenant,
      isViewMode: true,
    });
  }, []);

  const handleEditTenant = useCallback((tenant: Tenant, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDialogState({
      isOpen: true,
      selectedTenant: tenant,
      isViewMode: false,
    });
  }, []);

  const handleDelete = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const tenant = tenants.find(t => t.id === id);
    
    if (!tenant) return;
    
    // Verificar se o inquilino está como locatário ANTES de abrir o dialog
    if (tenant.status === "rented") {
      showAlert({
        title: "Inquilino é Locatário",
        description: "Este inquilino não pode ser deletado porque está como locatário em uma locação ativa. Para deletar este inquilino: 1) Vá para a página Locações, 2) Encontre a locação ativa deste inquilino, 3) Encerre ou rescinda o contrato, 4) Depois volte aqui para deletar o inquilino.",
        type: "error",
      });
      return;
    }
    
    setTenantToDelete(tenant);
  }, [tenants, showAlert]);

  const handleConfirmDelete = useCallback(async () => {
    if (tenantToDelete) {
      await deleteTenant(tenantToDelete.id);
      setTenantToDelete(null);
    }
  }, [tenantToDelete, deleteTenant]);

  const handleSave = useCallback(async (data: Partial<Tenant>) => {
    const { selectedTenant } = dialogState;
    let success = false;
    
    if (selectedTenant) {
      success = await updateTenant(selectedTenant.id, data);
    } else {
      success = await createTenant(data);
    }

    if (success) {
      setDialogState({
        isOpen: false,
        selectedTenant: null,
        isViewMode: false,
      });
    }
    return success;
  }, [dialogState, createTenant, updateTenant]);

  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setDialogState({
        isOpen: false,
        selectedTenant: null,
        isViewMode: false,
      });
    }
  }, []);

  const getStatusBadge = useCallback((status: "active" | "rented" | "inactive") => {
    // ✅ VALIDAÇÃO: Garantir que status seja válido
    const validStatus = (status === "active" || status === "rented" || status === "inactive") 
      ? status 
      : "active";
    
    const statusConfig = {
      active: { 
        label: "Disponível", 
        variant: "default" as const,
        className: "bg-green-100 text-green-800 border-green-200" 
      },
      rented: { 
        label: "Locatário", 
        variant: "default" as const,
        className: "bg-blue-100 text-blue-800 border-blue-200" 
      },
      inactive: { 
        label: "Inativo", 
        variant: "secondary" as const,
        className: "bg-gray-100 text-gray-800 border-gray-200" 
      },
    };

    // ✅ GARANTIA: Sempre usar o status validado
    const config = statusConfig[validStatus];
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  }, []);

  const getRowClassName = useCallback((tenant: Tenant) => {
    // Classes padrão neutras - sem fundo colorido
    return "cursor-pointer hover:bg-muted/50 transition-colors";
  }, []);

  const tenantColumns = useMemo(() => [
    { key: "name", label: "Nome", headerClassName: "text-center", render: (t: Tenant) => <span className="font-medium text-blue-600">{t.name}</span> },
    { key: "document", label: "Documento", headerClassName: "text-center", render: (t: Tenant) => t.cpf || t.cnpj || t.document || "-" },
    { key: "phone", label: "Telefone", headerClassName: "text-center", render: (t: Tenant) => t.phone || "-" },
    { key: "email", label: "Email", headerClassName: "text-center", render: (t: Tenant) => t.email || "-" },
    { key: "status", label: "Status", headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[110px]", render: (t: Tenant) => getStatusBadge(t.status) },
    { key: "actions", label: "Deletar", sortable: false, headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[80px]", render: (t: Tenant) => (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
        onClick={(e) => handleDelete(t.id, e)}
        title="Excluir"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} />
      </Button>
    )}
  ], [getStatusBadge, handleDelete]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando inquilinos...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO
        title="Inquilinos - Gerenciador de Locações"
        description="Gerencie seus inquilinos"
      />

      <div id="tenants-page" className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-1">Inquilinos</h1>
              <p className="text-sm text-muted-foreground">Gerencie os inquilinos dos seus imóveis</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHelpOpen(true)}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              <Button
                id="tenants-view-grid"
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Grade
              </Button>
              <Button
                id="tenants-view-table"
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4 mr-2" />
                Lista
              </Button>
              <Button id="tenants-new-button" onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Inquilino
              </Button>
            </div>
          </div>
        </ScrollReveal>

        <Card className="w-full">
          <CardContent className="pt-6">
            <TenantFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sortBy="alphabetical"
              onSortChange={() => {}}
              totalCount={filteredTenants.length}
            />
          </CardContent>
        </Card>

        <div className="rounded-md border">
          {filteredTenants.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchTerm || statusFilter.length > 0
                  ? "Nenhum inquilino encontrado com os filtros aplicados." 
                  : "Nenhum inquilino encontrado."}
              </p>
              {!searchTerm && statusFilter.length === 0 && (
                <Button id="tenants-create-first" onClick={handleCreateNew} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Inquilino
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTenants.map((tenant) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  onClick={() => handleViewTenant(tenant)}
                  onDelete={() => handleDelete(tenant.id)}
                  viewMode={viewMode}
                />
              ))}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <div className="inline-block min-w-full align-middle">
                <SortableTable
                  data={filteredTenants}
                  columns={tenantColumns}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onRowClick={handleViewTenant}
                  emptyMessage={searchTerm || statusFilter.length > 0 ? "Nenhum inquilino encontrado com os filtros aplicados." : "Nenhum inquilino encontrado."}
                />
              </div>
            </div>
          )}
        </div>

        <TenantFormDialog
          open={dialogState.isOpen}
          onOpenChange={handleDialogClose}
          onSave={handleSave}
          tenant={dialogState.selectedTenant || undefined}
          isViewMode={dialogState.isViewMode}
        />

        <TenantDeleteAlert
          open={!!tenantToDelete}
          tenant={tenantToDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => setTenantToDelete(null)}
        />

        <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} page="tenants" />
      </div>
    </Layout>
  );
}