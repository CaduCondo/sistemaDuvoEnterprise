import { useState, useEffect, useCallback, useMemo } from "react";
import { Tenant, Location } from "@/types";
import {
  getAll as getAllTenants,
  create as createTenant,
  update as updateTenant,
  remove as deleteTenant,
} from "@/services/tenantService";
import { getAll as getAllLocations } from "@/services/locationService";
import { useAlert } from "@/contexts/AlertContext";

export function useTenants() {
  const { showAlert } = useAlert();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]); // Não usar - sempre vazio
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"alphabetical" | "recent">("alphabetical");

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [tenantsData, locationsData] = await Promise.all([
        getAllTenants(),
        getAllLocations(),
      ]);
      setTenants(tenantsData);
      setLocations(locationsData);
    } catch (error) {
      // Não mostrar toast de erro - pode ser simplesmente que não há dados ainda
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLocationToggle = useCallback((locationId: string) => {
    setSelectedLocations((prev) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId],
    );
  }, []);

  const createTenantHandler = useCallback(
    async (data: Partial<Tenant>) => {
      try {
        await createTenant(data);
        showAlert({
          title: "Sucesso!",
          description: "Inquilino criado com sucesso.",
          type: "success",
          onConfirm: async () => {
            // ✅ CRÍTICO: Recarregar dados DEPOIS que o usuário clica OK
            console.log("🔄 [useTenants] Recarregando dados após confirmação do alert...");
            await loadData();
            console.log("✅ [useTenants] Dados recarregados com sucesso!");
          },
        });
        return true;
      } catch (error: any) {
        // ✅ Tratar erro de email duplicado
        if (error.message === "EMAIL_ALREADY_EXISTS") {
          showAlert({
            title: "E-mail já cadastrado",
            description: "Já existe um inquilino cadastrado com este e-mail. Por favor, utilize outro e-mail.",
            type: "error",
          });
        } else {
          showAlert({
            title: "Erro",
            description: "Não foi possível criar o inquilino.",
            type: "error",
          });
        }
        return false;
      }
    },
    [showAlert, loadData],
  );

  const updateTenantHandler = useCallback(
    async (id: string, data: Partial<Tenant>) => {
      try {
        await updateTenant(id, data);
        showAlert({
          title: "Sucesso!",
          description: "Inquilino atualizado com sucesso.",
          type: "success",
          onConfirm: async () => {
            // ✅ CRÍTICO: Recarregar dados DEPOIS que o usuário clica OK
            console.log("🔄 [useTenants] Recarregando dados após confirmação do alert...");
            await loadData();
            console.log("✅ [useTenants] Dados recarregados com sucesso!");
          },
        });
        return true;
      } catch (error: any) {
        // ✅ Tratar erro de email duplicado
        if (error.message === "EMAIL_ALREADY_EXISTS") {
          showAlert({
            title: "E-mail já cadastrado",
            description: "Já existe um inquilino cadastrado com este e-mail. Por favor, utilize outro e-mail.",
            type: "error",
          });
        } else {
          showAlert({
            title: "Erro",
            description: "Não foi possível atualizar o inquilino.",
            type: "error",
          });
        }
        return false;
      }
    },
    [showAlert, loadData],
  );

  const deleteTenantHandler = useCallback(
    async (id: string) => {
      try {
        await deleteTenant(id);
        showAlert({
          title: "Sucesso!",
          description: "Inquilino removido com sucesso.",
          type: "success",
          onConfirm: async () => {
            // ✅ CRÍTICO: Recarregar dados DEPOIS que o usuário clica OK
            console.log("🔄 [useTenants] Recarregando dados após confirmação do alert...");
            await loadData();
            console.log("✅ [useTenants] Dados recarregados com sucesso!");
          },
        });
      } catch (error) {
        showAlert({
          title: "Erro",
          description: "Não foi possível remover o inquilino.",
          type: "error",
        });
      }
    },
    [showAlert, loadData],
  );

  const filteredTenants = useMemo(() => {
    let list = tenants;

    // Filtro de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((tenant) =>
        tenant.name?.toLowerCase().includes(term) ||
        tenant.email?.toLowerCase().includes(term) ||
        tenant.document?.includes(searchTerm)
      );
    }

    // Filtrar por status se houver filtro selecionado
    if (statusFilter.length > 0) {
      list = list.filter((t) => statusFilter.includes(t.status));
    }

    // Ordenação
    if (sortBy === "alphabetical") {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [tenants, searchTerm, statusFilter, sortBy]);

  return {
    tenants: filteredTenants,
    locations,
    isLoading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    selectedLocations,
    handleLocationToggle,
    sortBy,
    setSortBy,
    createTenant: createTenantHandler,
    updateTenant: updateTenantHandler,
    deleteTenant: deleteTenantHandler,
  };
}