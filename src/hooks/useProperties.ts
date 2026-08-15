import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { propertyService, locationService } from "@/services";
import type { Property, Location } from "@/types";
import { parseCurrencyToFloat } from "@/lib/masks";
import { useAlert } from "@/contexts/AlertContext";
import { supabase } from "@/integrations/supabase/client";
import { rentalUpdateService } from "@/services/rentalUpdateService";

interface UsePropertiesReturn {
  properties: Property[];
  locations: Location[];
  filteredProperties: Property[];
  loading: boolean;
  searchTerm: string;
  statusFilter: string;
  selectedLocations: string[];
  sortOrder: "alphabetical" | "price-asc" | "price-desc";
  viewMode: "grid" | "table";
  setSearchTerm: (term: string) => void;
  setStatusFilter: (status: string) => void;
  setSelectedLocations: (locations: string[]) => void;
  setSortOrder: (order: "alphabetical" | "price-asc" | "price-desc") => void;
  setViewMode: (mode: "grid" | "table") => void;
  handleLocationToggle: (locationId: string) => void;
  loadData: () => Promise<void>;
  createProperty: (data: PropertyFormData) => Promise<void>;
  updateProperty: (id: string, data: PropertyFormData) => Promise<boolean | void>;
  deleteProperty: (id: string) => Promise<void>;
  pendingRentAdjustment: {
    propertyId: string;
    oldValue: number;
    newValue: number;
    rentalId: string;
  } | null;
  confirmRentAdjustment: () => Promise<void>;
  cancelRentAdjustment: () => void;
}

export interface PropertyFormData {
  location_id: string;
  property_identifier: string;
  complement: string;
  rooms: string;
  bathrooms: string;
  monthly_rent: string;
  description: string;
  status: string;
  images: string[];
  hasFurniture: boolean;
  acceptsPets: boolean;
  area?: string;
  hasGarage: boolean;
  listingType: "rent" | "sale";
}

const SORT_FUNCTIONS = {
  alphabetical: (a: Property, b: Property) => (a.location || "").localeCompare(b.location || ""),
  "price-asc": (a: Property, b: Property) => (a.value || 0) - (b.value || 0),
  "price-desc": (a: Property, b: Property) => (b.value || 0) - (a.value || 0),
};

export function useProperties(): UsePropertiesReturn {
  const { showAlert } = useAlert();
  const [properties, setProperties] = useState<Property[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<"alphabetical" | "price-asc" | "price-desc">("alphabetical");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [loading, setLoading] = useState(true);
  const [pendingRentAdjustment, setPendingRentAdjustment] = useState<{
    propertyId: string;
    oldValue: number;
    newValue: number;
    rentalId: string;
  } | null>(null);

  // Ref para prevenir carregamentos duplicados
  const loadingRef = useRef(false);

  // Debounce search term para evitar filtros excessivos
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = useCallback(async () => {
    // Prevenir execuções simultâneas
    if (loadingRef.current) {
      console.log("⏸️ [useProperties] Carregamento já em andamento, ignorando...");
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      console.log("🔄 [useProperties] Carregando imóveis e localizações...");

      // 🔥 VOLTA PARA SERVICE DIRETO (mais confiável)
      const [propertiesData, locationsData] = await Promise.all([
        propertyService.getAll(),
        locationService.getAll(),
      ]);
      
      setProperties(propertiesData);
      setLocations(locationsData);
      
      console.log(`✅ [useProperties] ${propertiesData.length} imóveis carregados (com contador de imagens)`);
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
      showAlert({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os imóveis. Tente novamente.",
        type: "error",
      });
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [showAlert]);

  // Memoizar filtro + sort para evitar recalcular a cada render
  const filteredProperties = useMemo(() => {
    const searchLower = debouncedSearchTerm.toLowerCase();
    
    let filtered = properties.filter((property) => {
      const matchesSearch = !debouncedSearchTerm || 
        property.location?.toLowerCase().includes(searchLower) ||
        property.complement?.toLowerCase().includes(searchLower) ||
        property.description?.toLowerCase().includes(searchLower) ||
        property.propertyIdentifier?.toLowerCase().includes(searchLower);
      
      const matchesStatus = statusFilter === "all" || property.status === statusFilter;
      
      const propertyLocationId = property.location_id || property.locationId;
      const matchesLocation = selectedLocations.length === 0 || 
        (propertyLocationId && selectedLocations.includes(propertyLocationId));

      return matchesSearch && matchesStatus && matchesLocation;
    });

    const sortFn = SORT_FUNCTIONS[sortOrder];
    if (sortFn) {
      filtered = [...filtered].sort(sortFn);
    }

    console.log(`🔍 [useProperties] Filtrados: ${filtered.length} de ${properties.length}`);

    return filtered;
  }, [properties, debouncedSearchTerm, statusFilter, selectedLocations, sortOrder]);

  const handleLocationToggle = useCallback((locationId: string) => {
    setSelectedLocations((prev) =>
      prev.includes(locationId)
        ? prev.filter((id) => id !== locationId)
        : [...prev, locationId]
    );
  }, []);

  const createProperty = useCallback(async (formData: PropertyFormData) => {
    if (!formData.location_id?.trim()) {
      throw new Error("Por favor, selecione um local");
    }

    const selectedLocation = locations.find(loc => loc.id === formData.location_id);
    if (!selectedLocation) {
      throw new Error("Local selecionado inválido. Por favor, selecione novamente.");
    }

    const propertyData: Omit<Property, "id" | "createdAt" | "updatedAt"> = {
      locationId: formData.location_id,
      location: selectedLocation.name,
      propertyIdentifier: formData.property_identifier,
      complement: formData.complement,
      rooms: Number(formData.rooms) || 0,
      bathrooms: Number(formData.bathrooms) || 0,
      value: parseCurrencyToFloat(formData.monthly_rent),
      description: formData.description,
      images: formData.images,
      hasFurniture: formData.hasFurniture,
      acceptsPets: formData.acceptsPets,
      area: formData.area ? parseFloat(formData.area.replace(",", ".")) : 0,
      hasGarage: formData.hasGarage,
      status: formData.status as "available" | "occupied" | "unavailable",
      listingType: formData.listingType || "rent",
      address: "",
      features: [],
    };

    const createdProperty = await propertyService.create(propertyData);
    
    // Atualizar lista localmente (otimista)
    setProperties(prev => [createdProperty, ...prev]);
    
    console.log("✅ [useProperties] Imóvel criado:", createdProperty.id);
  }, [locations]);

  const updateProperty = useCallback(async (id: string, formData: PropertyFormData) => {
    if (!formData.location_id?.trim()) {
      throw new Error("Por favor, selecione um local");
    }

    const selectedLocation = locations.find(loc => loc.id === formData.location_id);
    if (!selectedLocation) {
      throw new Error("Local selecionado inválido. Por favor, selecione novamente.");
    }

    // Buscar o imóvel atual para comparar valores
    const currentProperty = properties.find(p => p.id === id);
    const newValue = parseCurrencyToFloat(formData.monthly_rent);
    const oldValue = currentProperty?.value || 0;

    // 🔍 DETECTAR MUDANÇA DE VALOR EM IMÓVEL OCUPADO
    if (formData.status === "occupied" && newValue !== oldValue && oldValue > 0) {
      console.log("💰 Detectada mudança de valor em imóvel ocupado!");
      console.log(`   - Valor antigo: R$ ${oldValue.toFixed(2)}`);
      console.log(`   - Valor novo: R$ ${newValue.toFixed(2)}`);

      // Buscar a locação ativa deste imóvel
      const { data: activeRental, error: rentalError } = await supabase
        .from("rentals")
        .select("id, rent_value")
        .eq("property_id", id)
        .eq("status", "active")
        .single();

      if (rentalError || !activeRental) {
        console.log("⚠️ Imóvel marcado como ocupado mas sem locação ativa encontrada");
        // Continuar com update normal
      } else {
        console.log("✅ Locação ativa encontrada:", activeRental.id);
        
        // Guardar dados para confirmação e retornar false (não salvar ainda)
        setPendingRentAdjustment({
          propertyId: id,
          oldValue,
          newValue,
          rentalId: activeRental.id,
        });

        return false; // Sinaliza que precisa de confirmação
      }
    }

    // Continuar com update normal
    const propertyData: Partial<Property> = {
      locationId: formData.location_id,
      location: selectedLocation.name,
      propertyIdentifier: formData.property_identifier || "Apartamento",
      complement: formData.complement || undefined,
      value: newValue,
      status: formData.status as "available" | "occupied" | "unavailable",
      description: formData.description,
      rooms: formData.rooms ? parseInt(formData.rooms) : undefined,
      bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
      images: formData.images,
      hasFurniture: formData.hasFurniture,
      acceptsPets: formData.acceptsPets,
      area: formData.area ? parseFloat(formData.area.replace(",", ".")) : 0,
      hasGarage: formData.hasGarage,
      listingType: formData.listingType || "rent",
    };

    await propertyService.update(id, propertyData);
    
    // Recarregar dados para pegar a versão atualizada
    await loadData();
    
    console.log("✅ [useProperties] Imóvel atualizado:", id);
    return true;
  }, [locations, loadData, properties]);

  const confirmRentAdjustment = useCallback(async () => {
    if (!pendingRentAdjustment) return;

    try {
      const { propertyId, oldValue, newValue, rentalId } = pendingRentAdjustment;
      
      console.log("✅ Usuário confirmou o ajuste de valor");
      
      // 1. Atualizar o valor na tabela properties
      const { error: propertyError } = await supabase
        .from("properties")
        .update({ value: newValue })
        .eq("id", propertyId);

      if (propertyError) throw propertyError;

      // 2. Atualizar o valor na tabela rentals
      const { error: rentalError } = await supabase
        .from("rentals")
        .update({ rent_value: newValue })
        .eq("id", rentalId);

      if (rentalError) throw rentalError;

      // 3. Ajustar os recebimentos
      const today = new Date();
      await rentalUpdateService.adjustRentalValue(
        rentalId,
        oldValue,
        newValue,
        today.toISOString().split('T')[0]
      );

      // 4. Recarregar dados
      await loadData();

      showAlert({
        title: "Sucesso!",
        description: "Valor do aluguel atualizado e recebimentos ajustados automaticamente.",
        type: "success",
      });

      // Limpar estado pendente
      setPendingRentAdjustment(null);
    } catch (error: any) {
      console.error("❌ Erro ao confirmar ajuste:", error);
      showAlert({
        title: "Erro",
        description: error?.message || "Não foi possível atualizar o valor do aluguel.",
        type: "error",
      });
      throw error;
    }
  }, [pendingRentAdjustment, loadData, showAlert]);

  const cancelRentAdjustment = useCallback(() => {
    console.log("❌ Usuário cancelou o ajuste de valor");
    setPendingRentAdjustment(null);
  }, []);

  const deleteProperty = useCallback(async (id: string) => {
    try {
      // Atualiza UI otimisticamente
      setProperties(prev => prev.filter(p => p.id !== id));
      
      await propertyService.remove(id);
      
      showAlert({
        title: "Sucesso!",
        description: "Imóvel deletado com sucesso.",
        type: "success",
      });
      
      console.log("✅ [useProperties] Imóvel deletado:", id);
    } catch (error: any) {
      // Reverte se falhar
      await loadData();
      
      showAlert({
        title: "Erro ao deletar",
        description: error?.message || "Não foi possível deletar o imóvel. Tente novamente.",
        type: "error",
      });
      
      throw error;
    }
  }, [loadData, showAlert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    properties,
    locations,
    filteredProperties,
    loading,
    searchTerm,
    statusFilter,
    selectedLocations,
    sortOrder,
    viewMode,
    setSearchTerm,
    setStatusFilter,
    setSelectedLocations,
    setSortOrder,
    setViewMode,
    handleLocationToggle,
    loadData,
    createProperty,
    updateProperty,
    deleteProperty,
    pendingRentAdjustment,
    confirmRentAdjustment,
    cancelRentAdjustment,
  };
}