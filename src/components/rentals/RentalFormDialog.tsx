import { useState, useEffect, useCallback, memo, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAlert } from "@/contexts/AlertContext";
import { formatCurrency, parseCurrencyToNumber, applyMoneyMask, formatMoneyForDisplay, parseMoneyMaskToNumber } from "@/lib/masks";
import { create as createRental, update as updateRentalService } from "@/services/rentalService";
import { update as updateProperty } from "@/services/propertyService";
import { update as updateTenant } from "@/services/tenantService";
import { getAll as getAllLocations } from "@/services/locationService";
import {
  createPaymentsForRental,
} from "@/services/paymentService";
import { 
  createDepositInstallments, 
  deleteDepositInstallmentsByRental 
} from "@/services/depositInstallmentService";
import type { Property, Tenant, Location, Rental } from "@/types";
import { AttachmentViewer } from "@/components/AttachmentViewer";
import { AttachmentUploadButton } from "@/components/attachments/AttachmentUploadButton";
import { RentalContract } from "@/components/RentalContract";
import { DepositPaymentDialog } from "@/components/rentals/DepositPaymentDialog";
import { useRentalForm } from "@/hooks/useRentalForm";
import { rentalUpdateService } from "@/services/rentalUpdateService";
import { supabase } from "@/integrations/supabase/client";

interface RentalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableProperties: Property[];
  availableTenants: Tenant[];
  properties?: Property[];
  tenants?: Tenant[];
  locations?: Location[];
  onSuccess: () => void;
  rental?: Rental | null;
  isViewMode?: boolean;
  isLoadingData?: boolean;
  preselectedPropertyId?: string;
  preselectedTenantId?: string;
}

export const RentalFormDialog = memo(function RentalFormDialog({
  open,
  onOpenChange,
  availableProperties,
  availableTenants,
  properties = [],
  tenants = [],
  locations: locationsFromProps = [],
  onSuccess,
  rental = null,
  isViewMode = false,
  isLoadingData = false,
  preselectedPropertyId = "",
  preselectedTenantId = "",
}: RentalFormDialogProps) {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>(locationsFromProps);
  const [showContract, setShowContract] = useState(false);
  const [createdRentalData, setCreatedRentalData] = useState<{
    rental: Rental;
    property: Property;
    tenant: Tenant;
    location?: Location;
  } | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInstallmentNumber, setSelectedInstallmentNumber] = useState<number | null>(null);
  const [loadedInstallment, setLoadedInstallment] = useState<any>(null);

  useEffect(() => {
    const loadDepositInstallments = async () => {
      if (rental && open) {
        try {
          const { data, error } = await supabase
            .from("deposit_installments")
            .select("*")
            .eq("rental_id", rental.id)
            .order("installment_number");

          if (!error && data) {
            // Armazenar no rental
            rental.depositInstallmentsList = data as any[];
          }
        } catch (err) {
          console.error("Erro ao carregar parcelas:", err);
        }
      }
    };

    loadDepositInstallments();
  }, [rental, open]);

  const loadInstallmentFromDatabase = useCallback(async (rentalId: string, installmentNum: number) => {
    try {
      const { data, error } = await supabase
        .from("deposit_installments")
        .select("*")
        .eq("rental_id", rentalId)
        .eq("installment_number", installmentNum)
        .single();

      if (error) {
        console.error("Erro ao buscar parcela:", error);
        return null;
      }

      // ✅ CORREÇÃO: mapear para o formato DepositInstallment (a coluna no banco é
      // "installment_total", mas o tipo usado no app é "total_installments").
      return {
        id: data.id,
        rental_id: data.rental_id,
        installment_number: data.installment_number,
        total_installments: data.installment_total,
        amount: data.amount,
        due_date: data.due_date,
        payment_date: data.payment_date,
        paid_amount: data.paid_amount || 0,
        payment_method: data.payment_method,
        pix_code: data.pix_code,
        status: data.status,
        notes: data.notes,
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (err) {
      console.error("Erro ao buscar parcela:", err);
      return null;
    }
  }, []);

  const {
    isEditing,
    setIsEditing,
    selectedPropertyId,
    setSelectedPropertyId,
    selectedTenantId,
    setSelectedTenantId,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    paymentDay,
    setPaymentDay,
    hasGarage,
    setHasGarage,
    garageValue,
    setGarageValue,
    hasPartnerBroker,
    setHasPartnerBroker,
    depositAmount,
    setDepositAmount,
    
    isDepositInstallment,
    setIsDepositInstallment,
    depositInstallmentCount,
    setDepositInstallmentCount,
    
    depositPaymentDate,
    setDepositPaymentDate,
    depositPixCode,
    setDepositPixCode,
    
    depositInstallment2,
    setDepositInstallment2,
    depositInstallment3,
    setDepositInstallment3,
    
    depositInstallment2PaymentDate,
    setDepositInstallment2PaymentDate,
    depositInstallment3PaymentDate,
    setDepositInstallment3PaymentDate,
    
    depositInstallment2PixCode,
    setDepositInstallment2PixCode,
    depositInstallment3PixCode,
    setDepositInstallment3PixCode,
    
    attachments,
    setAttachments,
    proportionalRentInfo,
    resetForm,
    handleFileUpload,
    removeAttachment,
    getSelectedProperty,
    calculateTotal,
  } = useRentalForm({
    open,
    rental,
    isViewMode,
    properties: properties.length > 0 ? properties : availableProperties,
    tenants: tenants.length > 0 ? tenants : availableTenants,
    locations,
  });

  useEffect(() => {
    if (locationsFromProps.length > 0) {
      setLocations(locationsFromProps);
    }
  }, [locationsFromProps]);

  useEffect(() => {
    const fetchLocations = async () => {
      if (open && locations.length === 0) {
        try {
          const data = await getAllLocations();
          setLocations(data);
        } catch (error) {
          console.error("Erro ao buscar locais:", error);
        }
      }
    };
    
    fetchLocations();
  }, [open, locations.length]);

  useEffect(() => {
    if (open && !rental && preselectedPropertyId) {
      setSelectedPropertyId(preselectedPropertyId);
    }
  }, [open, rental, preselectedPropertyId]);

  useEffect(() => {
    if (open && !rental && preselectedTenantId) {
      setSelectedTenantId(preselectedTenantId);
    }
  }, [open, rental, preselectedTenantId]);

  const onFilesSelected = useCallback(async (files: File[]) => {
    for (const file of files) {
      try {
        await handleFileUpload(file);
      } catch (error) {
        console.error("Erro ao anexar arquivo:", error);
        showAlert({
          title: "Erro ao anexar arquivo",
          description: `Não foi possível enviar "${file.name}".`,
          type: "error",
        });
      }
    }
  }, [handleFileUpload, showAlert]);

  const onUploadError = useCallback((message: string) => {
    showAlert({ title: "Arquivo não permitido", description: message, type: "error" });
  }, [showAlert]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("🚀 [RentalFormDialog.onSubmit] INÍCIO DO SUBMIT");
    console.log("📎 [RentalFormDialog.onSubmit] Estado de attachments:", attachments);
    console.log("📦 [RentalFormDialog.onSubmit] Todos os estados:", {
      propertyId: String(selectedPropertyId),
      tenantId: String(selectedTenantId),
      startDate,
      endDate: endDate || null,
      paymentDay,
      baseRent: selectedProperty?.value || selectedProperty?.monthlyRent || 0,
      depositAmount,
      hasGarage,
      garageValue,
      attachments,
    });

    if (!selectedPropertyId || !selectedTenantId || !startDate || !paymentDay) {
      showAlert({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        type: "error",
      });
      return;
    }

    const propertySelected = propertiesToDisplay.find((p) => p.id === selectedPropertyId);
    const selectedTenant = tenantsToDisplay.find((t) => t.id === selectedTenantId);

    if (!propertySelected || !selectedTenant) {
      showAlert({
        title: "Erro",
        description: "Imóvel ou inquilino não encontrado.",
        type: "error",
      });
      return;
    }

    const baseRent = propertySelected.value || propertySelected.monthlyRent || 0;
    const garageAmount = hasGarage && garageValue ? parseMoneyMaskToNumber(garageValue) : 0;
    let totalValue = baseRent + garageAmount;
    totalValue = parseFloat(totalValue.toFixed(2));

    if (!totalValue || totalValue <= 0 || isNaN(totalValue)) {
      showAlert({
        title: "Erro Crítico",
        description: `Valor do aluguel inválido: R$ ${totalValue}. Verifique o valor do imóvel.`,
        type: "error",
      });
      return;
    }

    if (isDepositInstallment && depositInstallmentCount) {
      const count = parseInt(depositInstallmentCount);
      if (count === 2 && !depositInstallment2) {
        showAlert({ 
          title: "Erro", 
          description: "Preencha o valor da 2ª parcela.", 
          type: "error" 
        });
        return;
      }
      if (count === 3 && (!depositInstallment2 || !depositInstallment3)) {
        showAlert({ 
          title: "Erro", 
          description: "Preencha os valores da 2ª e 3ª parcelas.", 
          type: "error" 
        });
        return;
      }
    }

    try {
      setLoading(true);

      const propertyId = String(selectedPropertyId);
      const tenantId = String(selectedTenantId);
      
      const commonData = {
        propertyId: propertyId,
        tenantId: tenantId,
        startDate: startDate,
        endDate: endDate || null,
        paymentDay: parseInt(paymentDay),
        value: totalValue,
        monthlyRent: baseRent,
        depositAmount: parseMoneyMaskToNumber(depositAmount) || 0,
        // ✅ CORREÇÃO: esses 2 campos existiam na tela mas nunca eram enviados ao
        // salvar uma edição, então a Data Pagamento do caução (e o código PIX)
        // nunca chegavam a ser atualizados no banco. O rentalService.update() já
        // sabia processar esses campos - só faltava incluí-los aqui.
        depositPaymentDate: depositPaymentDate || undefined,
        depositPixCode: depositPixCode || undefined,
        status: "active" as const,
        isActive: true,
        attachments: attachments, // ✅ Agora é Attachment[] corretamente
        contractAttachments: [],
        hasGarage: hasGarage,
        garageValue: hasGarage && garageValue ? parseCurrencyToNumber(garageValue) : undefined,
        hasPartnerBroker: hasPartnerBroker,
      };

      console.log("🔍 [RentalFormDialog] ANTES de salvar:");
      console.log("📎 Attachments do form:", attachments);
      console.log("📦 commonData.attachments:", commonData.attachments);
      console.log("📦 Dados completos sendo enviados:", commonData);

      if (!rental) {
        const createdRental = await createRental(commonData);
        
        await updateProperty(propertyId, { status: "occupied" });
        await updateTenant(tenantId, { status: "rented" });

        const mappedRental: Rental = {
          ...createdRental,
          monthlyRent: baseRent,
        };

        await createPaymentsForRental({
          rental: mappedRental,
          startDate: new Date(mappedRental.startDate),
          endDate: mappedRental.endDate ? new Date(mappedRental.endDate) : new Date(new Date(mappedRental.startDate).setFullYear(new Date(mappedRental.startDate).getFullYear() + 1)),
          monthlyRent: Number(mappedRental.monthlyRent),
          paymentDay: Number(mappedRental.paymentDay),
          hasGarage: mappedRental.hasGarage,
          garageValue: mappedRental.garageValue || 0,
        });

        if (isDepositInstallment && depositInstallmentCount) {
          const installmentsData = [];
          const totalInstallments = parseInt(depositInstallmentCount);

          // ✅ 1ª PARCELA: Se PIX Code preenchido → marcar como PAGO automaticamente
          if (depositAmount && depositPaymentDate) {
            const hasPix = depositPixCode && depositPixCode.trim() !== "";
            
            installmentsData.push({
              installment_number: 1,
              total_installments: totalInstallments,
              amount: parseMoneyMaskToNumber(depositAmount),
              due_date: depositPaymentDate,
              payment_date: hasPix ? depositPaymentDate : null, // ✅ Preencher payment_date se tiver PIX
              pix_code: depositPixCode || null,
              status: hasPix ? "paid" : "pending", // ✅ Se tiver PIX → marcar como pago
              paid_amount: hasPix ? parseMoneyMaskToNumber(depositAmount) : 0, // ✅ Se pago → paid_amount = amount
              payment_method: hasPix ? "pix" : null, // ✅ Método de pagamento
            });
            
            if (hasPix) {
              console.log("✅ [RentalFormDialog] 1ª parcela marcada como PAGA (PIX Code preenchido)");
            }
          }

          // ✅ 2ª PARCELA: Salva APENAS due_date (payment_date será preenchido ao pagar)
          if (totalInstallments >= 2 && depositInstallment2 && depositInstallment2PaymentDate) {
            installmentsData.push({
              installment_number: 2,
              total_installments: totalInstallments,
              amount: parseMoneyMaskToNumber(depositInstallment2),
              due_date: depositInstallment2PaymentDate,
              payment_date: null, // ✅ NULL: será preenchido quando for pago
              status: "pending",
              paid_amount: 0,
            });
          }

          // ✅ 3ª PARCELA: Salva APENAS due_date (payment_date será preenchido ao pagar)
          if (totalInstallments === 3 && depositInstallment3 && depositInstallment3PaymentDate) {
            installmentsData.push({
              installment_number: 3,
              total_installments: totalInstallments,
              amount: parseMoneyMaskToNumber(depositInstallment3),
              due_date: depositInstallment3PaymentDate,
              payment_date: null, // ✅ NULL: será preenchido quando for pago
              status: "pending",
              paid_amount: 0,
            });
          }

          if (installmentsData.length > 0) {
            await createDepositInstallments(createdRental.id, installmentsData);
          }
        }

        const selectedLocation = locations.find((loc) => loc.id === propertySelected.locationId);

        setCreatedRentalData({
          rental: mappedRental,
          property: propertySelected,
          tenant: selectedTenant,
          location: selectedLocation,
        });

        // ✅ CORREÇÃO: na criação, mostrar o Contrato primeiro. O aviso de sucesso só
        // aparece depois que o usuário fecha o Contrato (ver onClose do RentalContract
        // mais abaixo), evitando dois modais empilhados.
        setShowContract(true);
      } else {
        console.log("🔄 [RentalFormDialog] EDITANDO locação:", rental.id);
        console.log("📦 [RentalFormDialog] Dados sendo enviados:", commonData);
        console.log("📎 [RentalFormDialog] Anexos sendo salvos:", attachments); // ✅ DEBUG: Log de anexos
        
        const changes: any = {};
        if (startDate !== rental.startDate) changes.startDate = startDate;
        if (endDate !== rental.endDate) changes.endDate = endDate;
        if (baseRent !== rental.monthlyRent) changes.monthlyRent = baseRent;
        if (parseInt(paymentDay) !== rental.paymentDay) changes.paymentDay = parseInt(paymentDay);
        if (hasGarage !== rental.hasGarage) changes.hasGarage = hasGarage;
        if (hasGarage && garageAmount !== (rental.garageValue || 0)) changes.garageValue = garageAmount;

        // 🔥 CORREÇÃO: NÃO deletar/recriar parcelas - deixar rentalService.update() fazer a atualização inteligente
        const updatedRental = await updateRentalService(rental.id, commonData);
        
        console.log("✅ [RentalFormDialog] Locação atualizada, rentalService.update() já atualizou as parcelas");
        
        // Atualizar pagamentos apenas se houver mudanças relevantes
        if (Object.keys(changes).length > 0) {
          console.log("🔄 [RentalFormDialog] Atualizando pagamentos de aluguel...");
          await rentalUpdateService.updatePaymentsOnRentalEdit(
            rental.id,
            rental,
            changes
          );
        }

        const mergedRental: Rental = {
          ...rental,
          ...updatedRental,
          status: isViewMode ? "active" : (updatedRental.status || "active"),
          value: Number(updatedRental.value || 0),
        };
        
        setCreatedRentalData({
          rental: mergedRental,
          property: propertySelected,
          tenant: selectedTenant,
          location: locations.find((loc) => loc.id === propertySelected.locationId),
        });

        // ✅ CORREÇÃO: edição NÃO abre o Contrato automaticamente - só mostra o aviso
        // de sucesso. Ao confirmar, fecha a tela de edição e atualiza a lista.
        showAlert({
          title: "Sucesso!",
          description: "Locação atualizada com sucesso.",
          type: "success",
          onConfirm: () => {
            onOpenChange(false);
            resetForm();
            onSuccess();
          },
        });
      }
    } catch (error: any) {
      console.error("❌ ERRO GERAL:", error);
      showAlert({
        title: "Erro",
        description: error.message || "Erro ao processar locação. Verifique o console.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [
    selectedPropertyId, selectedTenantId, startDate, paymentDay,
    hasGarage, garageValue, isDepositInstallment, depositInstallmentCount,
    depositInstallment2, depositInstallment3, depositAmount, endDate,
    hasPartnerBroker, attachments, depositPaymentDate, depositPixCode,
    depositInstallment2PaymentDate, depositInstallment3PaymentDate,
    rental, isViewMode, locations, showAlert, onOpenChange, onSuccess, resetForm
  ]);

  const handleCloseDialog = useCallback(() => {
    // ✅ CORREÇÃO: removida a remoção manual de nós do DOM (overlay.parentNode.removeChild)
    // - isso desincroniza a árvore virtual do React com o DOM real e pode travar a
    // página (mesma causa raiz do travamento que corrigimos em Inquilinos). Mantém
    // apenas a limpeza segura de estilos/atributos do body.
    onOpenChange(false);
    resetForm();
    setShowContract(false);

    setTimeout(() => {
      if (document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]').length === 0) {
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
        document.body.style.paddingRight = '';
        document.body.removeAttribute('data-scroll-locked');
      }
    }, 100);
  }, [onOpenChange, resetForm]);

  const calculateTotalDeposit = useCallback(() => {
    let total = 0;
    if (depositAmount) total += parseMoneyMaskToNumber(depositAmount);
    if (isDepositInstallment && depositInstallmentCount) {
      if (parseInt(depositInstallmentCount) >= 2 && depositInstallment2) total += parseMoneyMaskToNumber(depositInstallment2);
      if (parseInt(depositInstallmentCount) === 3 && depositInstallment3) total += parseMoneyMaskToNumber(depositInstallment3);
    }
    return total;
  }, [depositAmount, isDepositInstallment, depositInstallmentCount, depositInstallment2, depositInstallment3]);

  const propertiesToDisplay = useMemo(() => {
    const baseList = rental ? properties : availableProperties;
    if (rental && rental.property && !baseList.find(p => p.id === rental.propertyId)) {
      return [...baseList, rental.property as Property];
    }
    return baseList;
  }, [rental, properties, availableProperties]);

  const tenantsToDisplay = useMemo(() => {
    const baseList = rental ? tenants : availableTenants;
    if (rental && rental.tenant && !baseList.find(t => t.id === rental.tenantId)) {
      return [...baseList, rental.tenant as Tenant];
    }
    return baseList;
  }, [rental, tenants, availableTenants]);

  // ✅ CORREÇÃO: Mover selectedProperty para ANTES do useEffect
  const selectedProperty = propertiesToDisplay.find(p => p.id === selectedPropertyId);
  const isFieldDisabled = isViewMode && !isEditing;
  
  // Verificar se já existe locação ativa para este imóvel
  useEffect(() => {
    if (selectedPropertyId && !rental) {
      const hasActiveRental = selectedProperty?.status === "occupied";
      
      if (hasActiveRental) {
        showAlert({
          title: "Atenção",
          description: "Este imóvel já possui uma locação ativa. Deseja continuar?",
          type: "warning",
        });
      }
    }
  }, [selectedPropertyId, rental, selectedProperty, showAlert]);

  if (!open) return null;

  if (isLoadingData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Carregando dados...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rental && isViewMode && !isEditing
              ? "Visualização da Locação"
              : rental && isEditing
              ? "Edição da Locação"
              : "Nova Locação"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rental-property">{rental ? "Imóvel Selecionado" : "Imóveis Disponíveis"} *</Label>
              <Select
                value={selectedPropertyId}
                onValueChange={(value) => setSelectedPropertyId(value)}
                disabled={isFieldDisabled || !!rental}
              >
                <SelectTrigger id="rental-property">
                  <SelectValue placeholder="Selecione um imóvel" />
                </SelectTrigger>
                <SelectContent>
                  {propertiesToDisplay
                    .slice()
                    .sort((a, b) => {
                      const getLocName = (p: Property) => 
                        p.location || 
                        locations.find(l => l.id === p.locationId)?.name || 
                        p.locationDetails?.name || 
                        "Local não encontrado";
                        
                      const locationA = getLocName(a);
                      const locationB = getLocName(b);
                      
                      if (locationA < locationB) return -1;
                      if (locationA > locationB) return 1;
                      return 0;
                    })
                    .map((property) => {
                      const locationName = 
                        property.location || 
                        locations.find(l => l.id === property.locationId)?.name || 
                        property.locationDetails?.name || 
                        "Local não encontrado";
                        
                      return (
                        <SelectItem key={property.id} value={property.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {locationName}
                              {property.complement && ` - ${property.complement}`}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-sm font-semibold text-emerald-600">
                              {formatCurrency(property.value || 0)}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rental-tenant">{rental ? "Inquilino Selecionado" : "Inquilinos Disponíveis"} *</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId} disabled={isFieldDisabled || !!rental}>
                <SelectTrigger id="rental-tenant">
                  <SelectValue placeholder="Selecione o inquilino" />
                </SelectTrigger>
                <SelectContent>
                  {tenantsToDisplay
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }))
                    .map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dados do Contrato */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rental-start-date">Data Início*</Label>
              <Input
                id="rental-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={isFieldDisabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rental-end-date">Data Fim*</Label>
              <Input
                id="rental-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={isFieldDisabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rental-payment-day">Dia Vencimento*</Label>
              <Select
                value={paymentDay}
                onValueChange={setPaymentDay}
                disabled={isFieldDisabled}
              >
                <SelectTrigger id="rental-payment-day">
                  <SelectValue placeholder="Dia" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="flex items-center space-x-2 md:col-span-3">
              <Checkbox
                id="rental-has-garage"
                checked={hasGarage}
                onCheckedChange={(checked) => {
                  setHasGarage(checked as boolean);
                  if (!checked) setGarageValue("");
                }}
                disabled={isFieldDisabled}
              />
              <Label htmlFor="rental-has-garage" className="cursor-pointer text-sm whitespace-nowrap">
                Vaga Garagem?
              </Label>
            </div>
            {hasGarage && (
              <div className="space-y-2 md:col-span-3">
                <Input
                  id="rental-garage-value"
                  value={garageValue}
                  onChange={(e) => setGarageValue(applyMoneyMask(e.target.value))}
                  placeholder="R$ 0,00"
                  disabled={isFieldDisabled}
                />
              </div>
            )}
          </div>

          <div className="space-y-4 p-4 border rounded-md bg-muted/20">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-muted-foreground">Informações do Caução</h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rental-has-partner"
                  checked={hasPartnerBroker}
                  onCheckedChange={(checked) => {
                    setHasPartnerBroker(checked as boolean);
                  }}
                  disabled={isFieldDisabled}
                />
                <Label htmlFor="rental-has-partner" className="cursor-pointer font-medium text-sm">
                  Corretor Parceiro?
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="rental-deposit-amount">
                  {isDepositInstallment ? "Valor Caução (1ª Parcela)" : "Valor Caução (À vista) *"}
                </Label>
                <Input
                  id="rental-deposit-amount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(applyMoneyMask(e.target.value))}
                  placeholder="R$ 0,00"
                  disabled={isFieldDisabled}
                />
              </div>

              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="rental-deposit-date">Data Pagamento *</Label>
                <Input
                  id="rental-deposit-date"
                  type="date"
                  value={depositPaymentDate}
                  onChange={(e) => setDepositPaymentDate(e.target.value)}
                  disabled={isFieldDisabled}
                />
              </div>

              <div className="space-y-2 md:col-span-3 flex flex-col justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!rental}
                  onClick={async () => {
                    if (rental) {
                      const installment = await loadInstallmentFromDatabase(rental.id, 1);
                      if (installment) {
                        setLoadedInstallment(installment);
                        setSelectedInstallmentNumber(1);
                        setPaymentDialogOpen(true);
                      } else {
                        showAlert({
                          title: "Erro",
                          description: "Parcela não encontrada no banco de dados.",
                          type: "error",
                        });
                      }
                    }
                  }}
                  className={`w-full h-10 ${
                    rental?.depositInstallmentsList?.find(d => d.installment_number === 1)?.status === "paid"
                      ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                      : rental?.depositInstallmentsList?.find(d => d.installment_number === 1)?.status === "pending"
                      ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                      : ""
                  }`}
                >
                  Recebimento
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rental-deposit-installment"
                  checked={isDepositInstallment}
                  onCheckedChange={(checked) => {
                    setIsDepositInstallment(checked as boolean);
                    if (!checked) {
                      setDepositInstallmentCount("");
                      setDepositInstallment2("");
                      setDepositInstallment3("");
                      setDepositInstallment2PaymentDate("");
                      setDepositInstallment3PaymentDate("");
                    }
                  }}
                  disabled={isFieldDisabled}
                />
                <Label htmlFor="rental-deposit-installment" className="cursor-pointer font-medium">
                  Caução Parcelado?
                </Label>
              </div>

              {isDepositInstallment && (
                <div className="w-40">
                  <Select
                    value={depositInstallmentCount}
                    onValueChange={(value) => {
                      setDepositInstallmentCount(value);
                      if (value === "2") {
                        setDepositInstallment3("");
                        setDepositInstallment3PaymentDate("");
                      }
                    }}
                    disabled={isFieldDisabled}
                  >
                    <SelectTrigger id="rental-installment-count" className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 parcelas</SelectItem>
                      <SelectItem value="3">3 parcelas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {isDepositInstallment && depositInstallmentCount && (
              <div className="space-y-4 mt-4 pt-4 border-t">
                {depositInstallmentCount && parseInt(depositInstallmentCount) >= 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4">
                      <Label htmlFor="depositInstallment2">Valor 2ª Parcela*</Label>
                      <Input
                        id="depositInstallment2"
                        value={depositInstallment2}
                        onChange={(e) => setDepositInstallment2(applyMoneyMask(e.target.value))}
                        placeholder="R$ 0,00"
                        required={depositInstallmentCount && parseInt(depositInstallmentCount) >= 2}
                        disabled={isFieldDisabled}
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Label htmlFor="depositInstallment2PaymentDate">Data Vencimento 2ª Parcela*</Label>
                      <Input
                        id="depositInstallment2PaymentDate"
                        type="date"
                        value={depositInstallment2PaymentDate}
                        onChange={(e) => setDepositInstallment2PaymentDate(e.target.value)}
                        required={depositInstallmentCount && parseInt(depositInstallmentCount) >= 2}
                        disabled={isFieldDisabled}
                      />
                    </div>
                    <div className="md:col-span-4 flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!rental}
                        onClick={async () => {
                          if (rental) {
                            const installment = await loadInstallmentFromDatabase(rental.id, 2);
                            if (installment) {
                              setLoadedInstallment(installment);
                              setSelectedInstallmentNumber(2);
                              setPaymentDialogOpen(true);
                            } else {
                              showAlert({
                                title: "Erro",
                                description: "Parcela não encontrada no banco de dados.",
                                type: "error",
                              });
                            }
                          }
                        }}
                        className={`w-full ${
                          rental?.depositInstallmentsList?.find(d => d.installment_number === 2)?.status === "paid"
                            ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                            : rental?.depositInstallmentsList?.find(d => d.installment_number === 2)?.status === "pending"
                            ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                            : ""
                        }`}
                      >
                        Recebimento
                      </Button>
                    </div>
                  </div>
                )}

                {depositInstallmentCount && parseInt(depositInstallmentCount) === 3 && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4">
                      <Label htmlFor="depositInstallment3">Valor 3ª Parcela*</Label>
                      <Input
                        id="depositInstallment3"
                        value={depositInstallment3}
                        onChange={(e) => setDepositInstallment3(applyMoneyMask(e.target.value))}
                        placeholder="R$ 0,00"
                        required={depositInstallmentCount && parseInt(depositInstallmentCount) === 3}
                        disabled={isFieldDisabled}
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Label htmlFor="depositInstallment3PaymentDate">Data Vencimento 3ª Parcela*</Label>
                      <Input
                        id="depositInstallment3PaymentDate"
                        type="date"
                        value={depositInstallment3PaymentDate}
                        onChange={(e) => setDepositInstallment3PaymentDate(e.target.value)}
                        required={depositInstallmentCount && parseInt(depositInstallmentCount) === 3}
                        disabled={isFieldDisabled}
                      />
                    </div>
                    <div className="md:col-span-4 flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!rental}
                        onClick={async () => {
                          if (rental) {
                            const installment = await loadInstallmentFromDatabase(rental.id, 3);
                            if (installment) {
                              setLoadedInstallment(installment);
                              setSelectedInstallmentNumber(3);
                              setPaymentDialogOpen(true);
                            } else {
                              showAlert({
                                title: "Erro",
                                description: "Parcela não encontrada no banco de dados.",
                                type: "error",
                              });
                            }
                          }
                        }}
                        className={`w-full ${
                          rental?.depositInstallmentsList?.find(d => d.installment_number === 3)?.status === "paid"
                            ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                            : rental?.depositInstallmentsList?.find(d => d.installment_number === 3)?.status === "pending"
                            ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                            : ""
                        }`}
                      >
                        Recebimento
                      </Button>
                    </div>
                  </div>
                )}

                {isDepositInstallment && depositInstallmentCount && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-blue-900 dark:text-blue-100">Valor Total Caução:</span>
                      <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(calculateTotalDeposit())}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 italic mt-2">
                      * Soma de todas as parcelas do caução
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-900 dark:text-emerald-100">Valor do Aluguel:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(selectedProperty?.value || 0)}
                </span>
              </div>
              {hasGarage && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-emerald-900 dark:text-emerald-100">Vaga Garagem:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {garageValue ? `+ ${formatCurrency(parseCurrencyToNumber(garageValue))}` : "+ R$ 0,00"}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-emerald-200 dark:border-emerald-800">
                <span className="font-bold text-emerald-900 dark:text-emerald-100">Valor Total:</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(calculateTotal)}
                </span>
              </div>
            </div>
          </div>

          {proportionalRentInfo.isProportional && startDate && paymentDay && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-blue-900 dark:text-blue-100">
                    📅 Primeira Parcela Proporcional
                  </span>
                </div>
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <p>
                    <strong>Data Início:</strong> {new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                  <p>
                    <strong>Dia Vencimento:</strong> {paymentDay}
                  </p>
                  <p>
                    <strong>Dias a Cobrar:</strong> {proportionalRentInfo.days} dias
                  </p>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-900 dark:text-blue-100">Aluguel Proporcional:</span>
                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                      {formatCurrency(((selectedProperty?.value || 0) / 30 * proportionalRentInfo.days))}
                    </span>
                  </div>
                  
                  {hasGarage && garageValue && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-blue-900 dark:text-blue-100">Vaga Proporcional:</span>
                      <span className="font-semibold text-blue-700 dark:text-blue-300">
                        {formatCurrency((parseCurrencyToNumber(garageValue) / 30 * proportionalRentInfo.days))}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-2 border-t-2 border-blue-300 dark:border-blue-700">
                    <span className="font-bold text-blue-900 dark:text-blue-100">Valor Total 1ª Parcela:</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(proportionalRentInfo.firstRentValue)}
                    </span>
                  </div>
                </div>
                
                <p className="text-xs text-blue-600 dark:text-blue-400 italic mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                  * Cálculo: (Valor Mensal ÷ 30 dias) × {proportionalRentInfo.days} dias
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Anexos</Label>

            {!isFieldDisabled && (
              <AttachmentUploadButton
                id="rentalFileUpload"
                multiple
                onFilesSelected={onFilesSelected}
                onError={onUploadError}
              />
            )}

            {attachments.length > 0 && (
              <AttachmentViewer
                attachments={attachments}
                onRemove={(id: string) => removeAttachment(id)}
              />
            )}
          </div>

          <DialogFooter>
            {isViewMode && !isEditing ? (
              <>
                <Button
                  id="rental-form-close"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    onOpenChange(false);
                  }}
                  disabled={loading}
                >
                  Fechar
                </Button>
                <Button
                  id="rental-form-edit"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                >
                  Editar
                </Button>
              </>
            ) : (
              <>
                <Button
                  id="rental-form-cancel"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (rental && isViewMode) {
                      setIsEditing(false);
                    } else {
                      resetForm();
                      onOpenChange(false);
                    }
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button id="rental-form-submit" type="submit" disabled={loading}>
                  {loading ? (rental ? "Atualizando..." : "Criando...") : rental ? "Atualizar Locação" : "Criar Locação"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>

      {rental && selectedInstallmentNumber && loadedInstallment && (
        <DepositPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          installment={loadedInstallment}
          rental={rental}
          onSuccess={() => {
            setPaymentDialogOpen(false);
            setSelectedInstallmentNumber(null);
            setLoadedInstallment(null);
            onSuccess();
          }}
        />
      )}

      {showContract && createdRentalData && (
        <RentalContract
          rental={createdRentalData.rental}
          property={createdRentalData.property}
          tenant={createdRentalData.tenant}
          location={createdRentalData.location}
          onClose={() => {
            setShowContract(false);
            setCreatedRentalData(null);
            resetForm();
            onOpenChange(false);
            onSuccess();
            // Aviso de sucesso só aparece depois que o Contrato foi fechado.
            showAlert({
              title: "Sucesso!",
              description: "Locação criada com sucesso.",
              type: "success",
            });
          }}
        />
      )}
    </Dialog>
  );
});