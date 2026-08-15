import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SortableTable } from "@/components/ui/sortable-table";
import { Building, Plus, LayoutGrid, List, Bed, Bath, Trash2, Camera, HelpCircle } from "lucide-react";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { formatCurrency } from "@/lib/masks";
import type { Property } from "@/types";
import { useProperties, type PropertyFormData } from "@/hooks/useProperties";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyFilters } from "@/components/properties/PropertyFilters";
import { PropertyFormDialog } from "@/components/properties/PropertyFormDialog";
import { PropertyDeleteAlert } from "@/components/properties/PropertyDeleteAlert";
import { Badge } from "@/components/ui/badge";
import { useAlert } from "@/contexts/AlertContext";
import { propertyService } from "@/services";
import { HelpDialog } from "@/components/HelpDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const INITIAL_FORM_DATA: PropertyFormData = {
  location_id: "",
  property_identifier: "",
  complement: "",
  rooms: "",
  bathrooms: "",
  monthly_rent: "",
  description: "",
  status: "available",
  images: [],
  hasFurniture: false,
  acceptsPets: false,
  area: "",
  hasGarage: false,
  hasBarbecue: false,
  listingType: "rent",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  available: "default",
  occupied: "secondary",
  unavailable: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Disponível",
  occupied: "Ocupado",
  unavailable: "Indisponível",
};

export default function PropertiesPage() {
  const router = useRouter();
  const {
    properties,
    filteredProperties,
    loading,
    locations,
    statusFilter,
    selectedLocations,
    searchTerm,
    sortOrder,
    viewMode,
    setSearchTerm,
    setStatusFilter,
    setSelectedLocations,
    setSortOrder,
    setViewMode,
    handleLocationToggle,
    loadData,
    createProperty: createPropertyService,
    updateProperty: updatePropertyService,
    deleteProperty: deletePropertyService,
    pendingRentAdjustment,
    confirmRentAdjustment,
    cancelRentAdjustment,
  } = useProperties();

  const { showAlert } = useAlert();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [formData, setFormData] = useState<PropertyFormData>(INITIAL_FORM_DATA);

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (viewMode === "grid") {
      setViewMode("table");
    }
  }, []);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedAndFilteredProperties = useMemo(() => {
    const result = [...filteredProperties];
    if (sortKey) {
      result.sort((a, b) => {
        let aVal: any = "";
        let bVal: any = "";
        switch (sortKey) {
          case "local": aVal = a.location || ""; bVal = b.location || ""; break;
          case "complement": aVal = a.complement || ""; bVal = b.complement || ""; break;
          case "value": aVal = a.value || 0; bVal = b.value || 0; break;
          case "rooms": aVal = Number(a.rooms) || 0; bVal = Number(b.rooms) || 0; break;
          case "bathrooms": aVal = Number(a.bathrooms) || 0; bVal = Number(b.bathrooms) || 0; break;
          case "area": aVal = Number(a.area) || 0; bVal = Number(b.area) || 0; break;
          case "status": aVal = a.status || ""; bVal = b.status || ""; break;
          case "foto": aVal = a.images?.length || 0; bVal = b.images?.length || 0; break;
        }
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [filteredProperties, sortKey, sortDirection]);

  const handleNumberChange = useCallback((field: "rooms" | "bathrooms", value: string) => {
    const numbersOnly = value.replace(/[^0-9]/g, "").slice(0, 2);
    setFormData(prev => ({ ...prev, [field]: numbersOnly }));
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    const fileArray = Array.from(files);
    
    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          newImages.push(reader.result as string);
          if (newImages.length === fileArray.length) {
            setFormData(prev => ({
              ...prev,
              images: [...prev.images, ...newImages],
            }));
          }
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_DATA);
    setEditingProperty(null);
    setIsEditMode(false);
    setIsViewMode(false);
  }, []);

  const handleCloseDialog = useCallback((open: boolean) => {
    setIsDialogOpen(open);
    if (!open) resetForm();
  }, [resetForm]);

  const prepareFormDataFromProperty = useCallback((property: Property): PropertyFormData => ({
    location_id: property.locationId || "",
    property_identifier: property.propertyIdentifier || "",
    complement: property.complement || "",
    rooms: String(property.rooms || ""),
    bathrooms: String(property.bathrooms || ""),
    monthly_rent: formatCurrency(property.value || 0),
    description: property.description || "",
    status: property.status || "available",
    images: property.images || [],
    hasFurniture: property.hasFurniture || false,
    acceptsPets: property.acceptsPets || false,
    area: String(property.area || ""),
    hasGarage: property.hasGarage || false,
    hasBarbecue: property.hasBarbecue || false,
    listingType: property.listingType || "rent",
  }), []);

  const handleEdit = useCallback((property: Property) => {
    setEditingProperty(property);
    setFormData(prepareFormDataFromProperty(property));
    setIsDialogOpen(true);
  }, [prepareFormDataFromProperty]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.location_id || !formData.rooms || !formData.bathrooms) {
      showAlert({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        type: "error",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      if (editingProperty) {
        const result = await updatePropertyService(editingProperty.id, formData);
        
        if (result === false) {
          return;
        }
        
        showAlert({
          title: "Sucesso",
          description: "Imóvel atualizado com sucesso.",
          type: "success",
        });
      } else {
        await createPropertyService(formData);
        showAlert({
          title: "Sucesso",
          description: "Imóvel criado com sucesso.",
          type: "success",
        });
      }

      handleCloseDialog(false);
    } catch (error: any) {
      console.error("Erro ao salvar imóvel:", error);
      showAlert({
        title: "Erro",
        description: error?.message || "Não foi possível salvar o imóvel.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingProperty, updatePropertyService, createPropertyService, showAlert, handleCloseDialog]);

  const handleConfirmRentAdjustment = useCallback(async () => {
    try {
      setIsSubmitting(true);
      await confirmRentAdjustment();
      handleCloseDialog(false);
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  }, [confirmRentAdjustment, handleCloseDialog]);

  const handleCancelRentAdjustment = useCallback(() => {
    cancelRentAdjustment();
  }, [cancelRentAdjustment]);

  const handleCardClick = useCallback(async (property: Property) => {
    try {
      const fullProperty = await propertyService.getById(property.id);
      
      if (fullProperty) {
        setEditingProperty(fullProperty);
        setFormData(prepareFormDataFromProperty(fullProperty));
      } else {
        setEditingProperty(property);
        setFormData(prepareFormDataFromProperty(property));
      }
      
      setIsDialogOpen(true);
      setIsViewMode(true);
      setIsEditMode(true);
    } catch (error) {
      console.error("Erro ao carregar dados completos:", error);
      setEditingProperty(property);
      setFormData(prepareFormDataFromProperty(property));
      setIsDialogOpen(true);
      setIsViewMode(true);
      setIsEditMode(true);
    }
  }, [prepareFormDataFromProperty]);

  const handleEnableEdit = useCallback(() => {
    setIsViewMode(false);
  }, []);

  const confirmDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    const property = sortedAndFilteredProperties.find(p => p.id === id);
    
    if (property?.status === "occupied") {
      showAlert({
        title: "Imóvel Ocupado",
        description: "Este imóvel não pode ser deletado porque está ocupado com uma locação ativa. Vá para a página Locações, encontre a locação ativa deste imóvel, encerre ou rescinda o contrato, depois volte aqui para deletar o imóvel.",
        type: "error",
      });
      return;
    }
    
    setPropertyToDelete(id);
    setIsDeleteDialogOpen(true);
  }, [sortedAndFilteredProperties, showAlert]);

  const handleDelete = useCallback(async () => {
    if (!propertyToDelete) return;

    try {
      await deletePropertyService(propertyToDelete);
      setIsDeleteDialogOpen(false);
      setPropertyToDelete(null);
    } catch (error) {
      console.error("Erro ao excluir imóvel:", error);
    }
  }, [propertyToDelete, deletePropertyService]);

  const getStatusBadge = useCallback((status: string) => (
    <Badge variant={STATUS_VARIANTS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  ), []);

  const handleOpenDialog = useCallback(() => {
    resetForm();
    setIsDialogOpen(true);
  }, [resetForm]);

  // ✅ Atalho para abrir a tela de "Novo Imóvel" direto por URL
  // (/properties?novo=1), sem precisar clicar no botão. Útil, por exemplo,
  // pra testar layout com uma extensão de navegador (tipo VisBug) que fecha
  // o formulário se ele for aberto clicando no botão logo antes de ativá-la.
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.novo === "1") {
      handleOpenDialog();
      // Remove o "?novo=1" da URL sem recarregar a página, pra não reabrir
      // de novo sozinho se a pessoa der refresh depois de fechar a tela.
      router.replace("/properties", undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.novo]);

  const propertyColumns = useMemo(() => [
    { key: "local", label: "Local", headerClassName: "text-center", render: (p: Property) => <span className="font-medium text-blue-600">{p.location}</span> },
    { key: "complement", label: "Complemento", headerClassName: "text-center", render: (p: Property) => p.complement || "-" },
    { key: "value", label: "Valor", headerClassName: "text-center", render: (p: Property) => formatCurrency(p.value || 0) },
    { key: "rooms", label: "Quartos", headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[100px]", render: (p: Property) => p.rooms ? <div className="flex items-center justify-center gap-1"><Bed className="h-4 w-4" /><span>{p.rooms}</span></div> : "-" },
    { key: "bathrooms", label: "Banheiros", headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[100px]", render: (p: Property) => p.bathrooms ? <div className="flex items-center justify-center gap-1"><Bath className="h-4 w-4" /><span>{p.bathrooms}</span></div> : "-" },
    { key: "area", label: "Área Útil", headerClassName: "text-right px-2", cellClassName: "text-right px-2", className: "w-[100px]", render: (p: Property) => p.area ? `${p.area} m²` : "-" },
    { key: "status", label: "Status", headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[110px]", render: (p: Property) => getStatusBadge(p.status) },
    { key: "foto", label: "Foto", headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[80px]", render: (p: Property) => p.images && p.images.length > 0 ? <div className="flex items-center justify-center gap-1 text-blue-600"><Camera className="h-4 w-4" /><span className="text-xs font-medium">{p.images.length}</span></div> : <span className="text-muted-foreground text-xs">-</span> },
    { key: "actions", label: "Deletar", sortable: false, headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[80px]", render: (p: Property) => (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
        onClick={(e) => confirmDelete(e, p.id)}
        title="Excluir"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} />
      </Button>
    )}
  ], [getStatusBadge, confirmDelete]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <p>Carregando...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="Imóveis - Gerenciador de Locações" />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-3xl font-bold mb-1">Imóveis</h1>
            <p className="text-sm text-muted-foreground">
              Gerenciamento de cadastro dos imóveis para locação.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHelpOpen(true)}
              className="h-9"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                id="properties-view-grid"
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="h-8 px-2 sm:px-3"
              >
                <LayoutGrid className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Grade</span>
              </Button>
              <Button
                id="properties-view-table"
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-8 px-2 sm:px-3"
              >
                <List className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Lista</span>
              </Button>
            </div>
            <Button id="properties-new-button" onClick={handleOpenDialog} className="flex-1 sm:flex-none">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Novo Imóvel</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>
        </div>

        <Card className="w-full">
          <CardContent className="pt-6 px-3 sm:px-6">
            <PropertyFilters
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              locations={locations}
              selectedLocations={selectedLocations}
              handleLocationToggle={handleLocationToggle}
              setSelectedLocations={setSelectedLocations}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              totalCount={filteredProperties.length}
            />
          </CardContent>
        </Card>

        {viewMode === "grid" && (
          <ScrollReveal>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full">
              {filteredProperties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onCardClick={handleCardClick}
                  onDeleteClick={confirmDelete}
                />
              ))}
            </div>
          </ScrollReveal>
        )}

        {viewMode === "table" && (
          <ScrollReveal>
            <div className="w-full overflow-x-auto -mx-3 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-3 sm:px-0">
                <div className="overflow-hidden">
                  <SortableTable
                    data={sortedAndFilteredProperties}
                    columns={propertyColumns}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    onRowClick={handleCardClick}
                    emptyMessage="Nenhum imóvel encontrado com os filtros aplicados."
                  />
                </div>
              </div>
            </div>
          </ScrollReveal>
        )}

        <PropertyFormDialog
          open={isDialogOpen}
          onOpenChange={handleCloseDialog}
          onSubmit={handleSubmit}
          formData={formData}
          setFormData={setFormData}
          isEditMode={isEditMode}
          locations={locations}
          handleNumberChange={handleNumberChange}
          handleImageUpload={handleImageUpload}
          removeImage={removeImage}
          isSubmitting={isSubmitting}
          viewOnly={isViewMode}
          onEdit={handleEnableEdit}
        />

        <PropertyDeleteAlert
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onConfirm={handleDelete}
          onCancel={() => setPropertyToDelete(null)}
        />

        <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} page="properties" />
      </div>

      <AlertDialog open={!!pendingRentAdjustment} onOpenChange={(open) => !open && handleCancelRentAdjustment()}>
        <AlertDialogContent id="properties-rent-adjustment-dialog" className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">
              🔄 Atualização de Valor de Aluguel
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-base">
              <p className="font-semibold text-foreground">
                Você está alterando o valor do aluguel de um imóvel ocupado.
              </p>
              
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Valor Antigo:</span>
                  <span className="font-bold text-red-600">
                    {pendingRentAdjustment?.oldValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Valor Novo:</span>
                  <span className="font-bold text-green-600">
                    {pendingRentAdjustment?.newValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-foreground">O que acontecerá:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-sm">
                  <li>
                    <strong>Recebimentos futuros</strong> (todos os meses seguintes) serão atualizados com o <strong>novo valor integral</strong>
                  </li>
                  <li>
                    <strong>Recebimento do mês atual</strong> terá valor proporcional calculado automaticamente:
                    <ul className="list-disc list-inside ml-6 mt-1 space-y-0.5 text-xs text-slate-600">
                      <li>Dias já passados = cobrado pelo valor antigo</li>
                      <li>Dias restantes = cobrado pelo valor novo</li>
                    </ul>
                  </li>
                  <li>
                    O valor será atualizado tanto no <strong>imóvel</strong> quanto na <strong>locação</strong>
                  </li>
                </ol>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Atenção:</strong> Esta ação atualizará automaticamente todos os recebimentos pendentes desta locação.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel id="properties-rent-adjustment-cancel" onClick={handleCancelRentAdjustment} disabled={isSubmitting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction id="properties-rent-adjustment-confirm" onClick={handleConfirmRentAdjustment} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
              {isSubmitting ? "Processando..." : "Confirmar Ajuste"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}