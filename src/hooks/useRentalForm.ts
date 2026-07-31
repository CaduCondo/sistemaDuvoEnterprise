import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { formatCurrency } from "@/lib/masks";
import { calculateProportionalRent, calculateDaysBetweenDates, shouldUseProportionalRent } from "@/lib/rentalCalculations";
import { getDepositInstallmentsByRental } from "@/services/depositInstallmentService";
import type { Rental, Property, Tenant, Location, Attachment } from "@/types";

interface UseRentalFormProps {
  open: boolean;
  rental: Rental | null;
  isViewMode: boolean;
  properties: Property[];
  tenants: Tenant[];
  locations: Location[];
}

interface ProportionalRentInfo {
  isProportional: boolean;
  days: number;
  firstRentValue: number;
}

export function useRentalForm({
  open,
  rental,
  isViewMode,
  properties,
  tenants,
  locations,
}: UseRentalFormProps) {
  const [isEditing, setIsEditing] = useState(!isViewMode);
  
  // Estados principais
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [hasGarage, setHasGarage] = useState(false);
  const [garageValue, setGarageValue] = useState("");
  const [hasPartnerBroker, setHasPartnerBroker] = useState(false);
  
  // Estados de caução
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositInstallment, setIsDepositInstallment] = useState(false);
  const [depositInstallmentCount, setDepositInstallmentCount] = useState("");
  const [depositPaymentDate, setDepositPaymentDate] = useState(""); // Data de VENCIMENTO da 1ª parcela
  const [depositPixCode, setDepositPixCode] = useState("");
  
  // Estados de parcelas 2 e 3
  const [depositInstallment2, setDepositInstallment2] = useState("");
  const [depositInstallment3, setDepositInstallment3] = useState("");
  const [depositInstallment2PaymentDate, setDepositInstallment2PaymentDate] = useState("");
  const [depositInstallment3PaymentDate, setDepositInstallment3PaymentDate] = useState("");
  const [depositInstallment2PixCode, setDepositInstallment2PixCode] = useState("");
  const [depositInstallment3PixCode, setDepositInstallment3PixCode] = useState("");
  
  // Outros estados
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [proportionalRentInfo, setProportionalRentInfo] = useState<ProportionalRentInfo>({
    isProportional: false,
    days: 30,
    firstRentValue: 0,
  });

  const initializedRef = useRef(false);
  const prevRentalIdRef = useRef<string | null>(null);

  // Helper para formatar data
  const formatDate = useCallback((dateString?: string | Date) => {
    if (!dateString) return "";
    try {
      const date = typeof dateString === 'string' 
        ? new Date(dateString)
        : dateString;
      return date.toISOString().split('T')[0];
    } catch {
      return "";
    }
  }, []);

  // Calcular valor proporcional (MEMOIZADO)
  useEffect(() => {
    if (!startDate || !paymentDay || !selectedPropertyId) return;

    const selectedProperty = properties.find(p => p.id === selectedPropertyId);
    if (!selectedProperty) return;

    const propertyValue = selectedProperty.value || 0;
    const garage = hasGarage
      ? parseFloat(garageValue.replace(/[^\d,]/g, "").replace(",", ".") || "0")
      : 0;
    const totalMonthlyRent = propertyValue + garage;
    
    const isProportional = shouldUseProportionalRent(startDate, parseInt(paymentDay));
    const days = calculateDaysBetweenDates(startDate, parseInt(paymentDay));
    const firstRentValue = isProportional 
      ? calculateProportionalRent(totalMonthlyRent, startDate, parseInt(paymentDay))
      : totalMonthlyRent;
    
    setProportionalRentInfo({
      isProportional,
      days,
      firstRentValue,
    });
  }, [startDate, paymentDay, selectedPropertyId, properties, hasGarage, garageValue]);

  // Função para resetar formulário
  const resetForm = useCallback(() => {
    console.log("🔄 [useRentalForm] Resetando formulário");
    setSelectedPropertyId("");
    setSelectedTenantId("");
    setStartDate("");
    setEndDate("");
    setPaymentDay("");
    setHasGarage(false);
    setGarageValue("");
    setHasPartnerBroker(false);
    setDepositAmount("");
    setIsDepositInstallment(false);
    setDepositInstallmentCount("");
    setDepositPaymentDate("");
    setDepositPixCode("");
    setDepositInstallment2("");
    setDepositInstallment3("");
    setDepositInstallment2PaymentDate("");
    setDepositInstallment3PaymentDate("");
    setDepositInstallment2PixCode("");
    setDepositInstallment3PixCode("");
    setAttachments([]);
    setProportionalRentInfo({
      isProportional: false,
      days: 30,
      firstRentValue: 0,
    });
  }, []);

  // Função para inicializar campos com dados do rental
  const initializeFromRental = useCallback(async (rentalData: Rental) => {
    console.log("🚀 [useRentalForm] Inicializando dados do rental:", rentalData);
    
    setSelectedPropertyId(rentalData.propertyId || "");
    setSelectedTenantId(rentalData.tenantId || "");
    
    console.log("🏠 [useRentalForm] PropertyId:", rentalData.propertyId);
    console.log("👤 [useRentalForm] TenantId:", rentalData.tenantId);
    
    // Datas
    setStartDate(rentalData.startDate ? rentalData.startDate.split('T')[0] : "");
    setEndDate(rentalData.endDate ? rentalData.endDate.split('T')[0] : "");
    setPaymentDay(rentalData.paymentDay?.toString() || "");
    
    // Garagem e Corretor
    setHasGarage(rentalData.hasGarage || false);
    setGarageValue(rentalData.garageValue ? formatCurrency(rentalData.garageValue) : "");
    setHasPartnerBroker(rentalData.hasPartnerBroker || false);
    
    // ✅ NOVO: Buscar parcelas de caução da tabela deposit_installments
    try {
      console.log("🔍 [useRentalForm] Buscando parcelas de caução da tabela...");
      const installments = await getDepositInstallmentsByRental(rentalData.id);
      console.log("📦 [useRentalForm] Parcelas encontradas:", installments);
      
      if (installments && installments.length > 0) {
        // Ordenar por installment_number
        const sortedInstallments = installments.sort((a, b) => a.installment_number - b.installment_number);
        
        // 1ª PARCELA
        const firstInstallment = sortedInstallments[0];
        if (firstInstallment) {
          console.log("💰 [useRentalForm] 1ª parcela:", firstInstallment);
          setDepositAmount(formatCurrency(firstInstallment.amount));
          // ✅ Se houver payment_date, carregar ele; senão, carregar due_date
          setDepositPaymentDate(formatDate(firstInstallment.payment_date || firstInstallment.due_date));
          setDepositPixCode(firstInstallment.pix_code || "");
        }
        
        // Se tem mais de 1 parcela, marcar como parcelado
        if (sortedInstallments.length > 1) {
          console.log("✅ [useRentalForm] Marcando como parcelado");
          setIsDepositInstallment(true);
          setDepositInstallmentCount(sortedInstallments.length.toString());
          
          // 2ª PARCELA
          const secondInstallment = sortedInstallments[1];
          if (secondInstallment) {
            console.log("💰 [useRentalForm] 2ª parcela:", secondInstallment);
            setDepositInstallment2(formatCurrency(secondInstallment.amount));
            setDepositInstallment2PaymentDate(formatDate(secondInstallment.due_date));
            setDepositInstallment2PixCode(secondInstallment.pix_code || "");
          }
          
          // 3ª PARCELA
          if (sortedInstallments.length === 3) {
            const thirdInstallment = sortedInstallments[2];
            if (thirdInstallment) {
              console.log("💰 [useRentalForm] 3ª parcela:", thirdInstallment);
              setDepositInstallment3(formatCurrency(thirdInstallment.amount));
              setDepositInstallment3PaymentDate(formatDate(thirdInstallment.due_date));
              setDepositInstallment3PixCode(thirdInstallment.pix_code || "");
            }
          }
        } else {
          console.log("ℹ️ [useRentalForm] Caução à vista (1 parcela)");
          setIsDepositInstallment(false);
          setDepositInstallmentCount("");
        }
      } else {
        // ⚠️ FALLBACK: Se não encontrou parcelas na tabela, tenta usar dados antigos do rental
        console.log("⚠️ [useRentalForm] Nenhuma parcela encontrada, usando fallback do rental");
        const depositValue1 = rentalData.depositInstallment1 || rentalData.depositAmount || 0;
        setDepositAmount(depositValue1 > 0 ? formatCurrency(depositValue1) : "");
        setDepositPaymentDate(formatDate(rentalData.depositPaymentDate || rentalData.depositInstallment1PaymentDate));
        setDepositPixCode(rentalData.depositPixCode || rentalData.depositInstallment1PixCode || "");
      }
    } catch (error) {
      console.error("❌ [useRentalForm] Erro ao buscar parcelas de caução:", error);
      // Fallback para dados antigos do rental
      const depositValue1 = rentalData.depositInstallment1 || rentalData.depositAmount || 0;
      setDepositAmount(depositValue1 > 0 ? formatCurrency(depositValue1) : "");
      setDepositPaymentDate(formatDate(rentalData.depositPaymentDate || rentalData.depositInstallment1PaymentDate));
      setDepositPixCode(rentalData.depositPixCode || rentalData.depositInstallment1PixCode || "");
    }
    
    // Anexos
    setAttachments(rentalData.contractAttachments || rentalData.attachments || []);
    
    console.log("✅ [useRentalForm] Inicialização completa!");
  }, [formatDate]);

  // Inicializar formulário quando o modal abrir
  useEffect(() => {
    console.log("🔄 [useRentalForm] useEffect disparado - open:", open, "rental:", rental?.id);
    
    if (open) {
      initializedRef.current = false;
      setIsEditing(!isViewMode);

      if (rental) {
        console.log("🔄 [useRentalForm] Rental detectado, inicializando...");
        console.log("📊 [useRentalForm] Properties disponíveis:", properties.length);
        console.log("📊 [useRentalForm] Tenants disponíveis:", tenants.length);
        
        initializedRef.current = true;
        prevRentalIdRef.current = rental.id;
        initializeFromRental(rental);
      } else {
        console.log("🆕 [useRentalForm] Novo rental, resetando formulário");
        initializedRef.current = true;
        resetForm();
      }
    } else {
      console.log("❌ [useRentalForm] Modal fechado, limpando dados");
      initializedRef.current = false;
      prevRentalIdRef.current = null;
      resetForm();
      setIsEditing(false);
    }
  }, [open, rental, isViewMode, initializeFromRental, resetForm]);

  // Handler de upload de arquivo
  const handleFileUpload = useCallback(async (file: File): Promise<Attachment> => {
    const uuid = crypto.randomUUID();
    const extension = file.name.split(".").pop();
    const fileName = `rental_${uuid}.${extension}`;

    const formData = new FormData();
    formData.append("file", file, fileName);

    return new Promise<Attachment>((resolve, reject) => {
      fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
        .then(() => {
          const url = `/uploads/${fileName}`;
          const attachment: Attachment = {
            id: uuid,
            name: file.name,
            url: url,
            type: file.type,
            uploadedAt: new Date().toISOString(),
            category: "contract",
          };
          setAttachments((prev) => [...prev, attachment]);
          resolve(attachment);
        })
        .catch(() => {
          reject();
        });
    });
  }, []);

  // Remover anexo
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  }, []);

  // Obter propriedade selecionada (MEMOIZADO)
  const getSelectedProperty = useCallback((): Property | undefined => {
    const found = properties.find((p) => p.id === selectedPropertyId);
    
    if (!found && rental?.property && rental.propertyId === selectedPropertyId) {
      console.log("🏠 [getSelectedProperty] Usando property do rental como fallback");
      return rental.property as Property;
    }
    
    return found;
  }, [properties, selectedPropertyId, rental]);

  // Calcular total (MEMOIZADO)
  const calculateTotal = useMemo((): number => {
    const property = getSelectedProperty();
    const propertyValue = property?.value || 0;
    const garage = hasGarage
      ? parseFloat(garageValue.replace(/[^\d,]/g, "").replace(",", ".") || "0")
      : 0;
    
    return propertyValue + garage;
  }, [getSelectedProperty, hasGarage, garageValue]);

  return {
    // Estado
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

    // Funções
    resetForm,
    handleFileUpload,
    removeAttachment,
    getSelectedProperty,
    calculateTotal,
  };
}