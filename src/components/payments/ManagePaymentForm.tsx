import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAlert } from "@/contexts/AlertContext";
import { Camera, Paperclip, CreditCard, Edit, X, Upload, FileText, Loader2, ImageIcon } from "lucide-react";
import type { Payment, Rental, Property, Tenant } from "@/types";
import { calculateCorrectedDeposit } from "@/services/igpmService";
import { PaymentInfoCards } from "./PaymentInfoCards";
import { PaymentBreakdownCard } from "./PaymentBreakdownCard";
import { PaymentFormFields } from "./PaymentFormFields";
import { PaymentAttachments } from "./PaymentAttachments";
import { usePaymentCalculations } from "@/hooks/usePaymentCalculations";
import { usePaymentBreakdown } from "@/hooks/usePaymentBreakdown";
import { invalidateCache } from "@/services/cacheService";
import { getAllPaymentMethods } from "@/services/paymentMethodService";
import { LateFeeInterestBlock } from "@/components/payments/LateFeeInterestBlock";
import { applyMoneyMask, formatMoneyForDisplay, parseMoneyMaskToNumber } from "@/lib/masks";

interface BreakdownItem {
  description?: string;
  amount?: number;
  value?: number;
  type?: string;
}

interface Attachment {
  url: string;
  name: string;
  description?: string;
  uploadProgress?: number;
}

interface PaymentFormData {
  id?: string;
  paid_amount?: number;
  expected_amount?: number;
  payment_date?: string;
  payment_time?: string;
  payment_method?: string;
  payment_location?: string;
  payment_code?: string;
  notes?: string;
  late_fee?: number;
  interest?: number;
  discount_amount?: number;
  attachments?: any;
  rentals?: any;
  rental_terminations?: any;
  breakdown?: any;
  due_date?: string;
  status?: string;
  installment?: number | null;
  total_installments?: number | null;
}

interface ManagePaymentFormProps {
  paymentId: string;
  onSuccess?: (data: {
    payment: Payment;
    rental: Rental;
    property: Property;
    tenant: Tenant;
  }) => void;
  onClose?: () => void;
  embedded?: boolean;
}

export function ManagePaymentForm({ paymentId, onSuccess, onClose, embedded = false }: ManagePaymentFormProps) {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: number]: number }>({});
  
  const [removeLateFee, setRemoveLateFee] = useState(false);
  const [removeInterest, setRemoveInterest] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [repairExpenses, setRepairExpenses] = useState<number>(0);
  const [repairExpensesInput, setRepairExpensesInput] = useState<string>("R$ 0,00");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountAmountInput, setDiscountAmountInput] = useState<string>("R$ 0,00");
  const [isTerminationPayment, setIsTerminationPayment] = useState(false);
  const [originalBreakdown, setOriginalBreakdown] = useState<any[]>([]);
  const [calculatedTotal, setCalculatedTotal] = useState<number>(0);
  const [igpmCorrection, setIgpmCorrection] = useState<{
    originalAmount: number;
    correctedAmount: number;
    igpmPercentage?: number;
    poupancaPercentage?: number;
    months: number;
    igpmDetails?: string;
    poupancaDetails?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    payment_date: "",
    payment_method: "pix",
    payment_time: "",
    amount_to_pay: "",
    notes: "",
  });
  
  const [paymentHour, setPaymentHour] = useState<string>("");
  const [paymentMinute, setPaymentMinute] = useState<string>("");
  const [paymentSecond, setPaymentSecond] = useState<string>("");

  const [payment, setPayment] = useState<PaymentFormData | null>(null);
  const [rental, setRental] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [rentalValue, setRentalValue] = useState(0);
  const [garageValue, setGarageValue] = useState(0);
  const [effectiveRentalValue, setEffectiveRentalValue] = useState(0);
  const [effectiveGarageValue, setEffectiveGarageValue] = useState(0);
  const [lateFeePercentage, setLateFeePercentage] = useState(0);
  const [interestRatePercentage, setInterestRatePercentage] = useState(0);

  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<Array<{ code: string; name: string }>>([]);

  const formatCurrency = useCallback((value: string | number): string => {
    const numericValue = typeof value === "string" ? value.replace(/\D/g, "") : String(value).replace(/\D/g, "");
    const number = parseFloat(numericValue) / 100;
    
    if (isNaN(number)) return "R$ 0,00";
    
    return `R$ ${number.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, []);

  const parseCurrency = useCallback((value: string): number => {
    // 🔥 CORREÇÃO CRÍTICA: Preservar sinal negativo
    const isNegative = value.trim().startsWith('-');
    const parsedValue = parseMoneyMaskToNumber(value);
    return isNegative ? -parsedValue : parsedValue;
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("configs")
        .select("late_fee_percentage, interest_rate_percentage")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("❌ Erro ao buscar config:", error);
        return;
      }

      if (data) {
        // Type assertion necessária para bypass do erro de tipo complexo do Supabase
        const configData = data as any;
        setLateFeePercentage(configData.late_fee_percentage || 0);
        setInterestRatePercentage(configData.interest_rate_percentage || 0);
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    }
  }, []);

  const loadPaymentData = useCallback(async () => {
    try {
      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .select(`
          *,
          rentals!inner (
            *,
            properties!inner (
              *,
              locations!inner (*)
            ),
            tenants!inner (
              id,
              name,
              email,
              phone,
              cpf,
              document_type,
              document,
              rg,
              street,
              number,
              complement,
              neighborhood,
              city,
              state,
              zip_code,
              status,
              created_at,
              updated_at
            )
          )
        `)
        .eq("id", paymentId)
        .single();

      if (paymentError) {
        console.error("❌ Erro ao buscar pagamento:", paymentError);
        throw paymentError;
      }

      if (!paymentData) {
        throw new Error("Pagamento não encontrado");
      }

      const validatedPayment = paymentData as any;

      setPayment(validatedPayment);
      setRental(validatedPayment.rentals);
      setProperty(validatedPayment.rentals.properties);
      setLocation(validatedPayment.rentals.properties.locations);
      setTenant(validatedPayment.rentals.tenants);

      const baseRentalValue = validatedPayment.rentals.rent_value || 0;
      const baseGarageValue = validatedPayment.rentals.has_garage ? (validatedPayment.rentals.garage_value || 0) : 0;

      setRentalValue(baseRentalValue);
      setGarageValue(baseGarageValue);
      setEffectiveRentalValue(baseRentalValue);
      setEffectiveGarageValue(baseGarageValue);

      const alreadyPaid = validatedPayment.status === "paid";
      setIsPaid(alreadyPaid);
      setIsEditMode(!alreadyPaid);

      const isTermination = validatedPayment.notes?.includes("Rescisão de Contrato") || false;
      setIsTerminationPayment(isTermination);
      
      const waiveLateFee = validatedPayment.late_fee_waived || false;
      const waiveInterest = validatedPayment.interest_waived || false;
      
      setRemoveLateFee(waiveLateFee);
      setRemoveInterest(waiveInterest);

      if (validatedPayment.breakdown) {
        try {
          let breakdownData = validatedPayment.breakdown;
          if (typeof breakdownData === 'string') {
            breakdownData = JSON.parse(breakdownData);
          }
          
          if (!Array.isArray(breakdownData)) {
            breakdownData = [];
          }
          
          setOriginalBreakdown(breakdownData || []);
          
          if (isTermination && Array.isArray(breakdownData)) {
            const expensesItem = (breakdownData as BreakdownItem[]).find((item) => 
              item.description?.includes("Despesas")
            );
            
            if (expensesItem) {
              const expValue = Math.abs(expensesItem.amount || 0);
              setRepairExpenses(expValue);
              setRepairExpensesInput(formatCurrency(expValue.toFixed(2)));
            }

            const discountItem = (breakdownData as BreakdownItem[]).find((item) => 
              item.description?.includes("Desconto") || item.type === "deduction" && !item.description?.includes("Caução")
            );

            if (discountItem) {
              const discValue = Math.abs(discountItem.amount || 0);
              setDiscountAmount(discValue);
              setDiscountAmountInput(formatCurrency(discValue.toFixed(2)));
            }
          }
        } catch (error) {
          console.error("Erro ao parsear breakdown:", error);
          setOriginalBreakdown([]);
        }
      }
      
      if (validatedPayment.discount_amount !== undefined && validatedPayment.discount_amount !== null) {
        setDiscountAmount(validatedPayment.discount_amount);
        setDiscountAmountInput(formatCurrency(validatedPayment.discount_amount.toFixed(2)));
      }

      if (isTermination && validatedPayment.rentals) {
        const rentalId = validatedPayment.rentals.id;

        const { data: installments, error: installmentsError } = await supabase
          .from("deposit_installments")
          .select("amount, payment_date, installment_number")
          .eq("rental_id", rentalId)
          .order("payment_date", { ascending: true });

        if (installmentsError) {
          console.error("Erro ao buscar parcelas do caução:", installmentsError);
        } else {
          if (installments && installments.length > 0) {
            const totalDeposit = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
            
            const startDate = validatedPayment.rentals.start_date;
            const endDate = validatedPayment.rentals.end_date;
            
            if (totalDeposit > 0 && startDate && endDate) {
              const igpmCorrectionValue = calculateCorrectedDeposit(
                totalDeposit,
                startDate,
                endDate
              );
              
              setIgpmCorrection(igpmCorrectionValue);
            }
          }
        }
      }

      if (validatedPayment.attachments && Array.isArray(validatedPayment.attachments)) {
        const attachmentData = validatedPayment.attachments.map((att: any) => {
          if (typeof att === 'string') {
            return {
              url: att,
              name: att.split('/').pop() || 'Arquivo',
              description: ''
            };
          }
          return att;
        });
        setAttachments(attachmentData);
      }

      setFormData({
        payment_date: validatedPayment.payment_date || new Date().toISOString().split("T")[0],
        payment_method: validatedPayment.payment_method || "pix",
        payment_time: validatedPayment.payment_time || "",
        amount_to_pay: validatedPayment.paid_amount 
          ? formatCurrency(validatedPayment.paid_amount.toFixed(2))
          : "",
        notes: validatedPayment.notes || "",
      });

      if (validatedPayment.payment_time) {
        const [h, m, s] = validatedPayment.payment_time.split(":");
        setPaymentHour(h || "");
        setPaymentMinute(m || "");
        setPaymentSecond(s || "00");
      }
      
    } catch (error) {
      console.error("❌ Error loading payment data:", error);
      showAlert({
        title: "Erro",
        description: "Erro ao carregar dados do pagamento",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [paymentId, showAlert, formatCurrency]);

  // ✅ CORREÇÃO: Buscar formas de pagamento usando o service
  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const methods = await getAllPaymentMethods();
        setPaymentMethods(methods.filter(m => m.active).map(m => ({ code: m.code, name: m.name })));
      } catch (error) {
        console.error("Erro ao carregar métodos de pagamento:", error);
        // Fallback para opções padrão se houver erro
        setPaymentMethods([
          { code: "pix", name: "PIX" },
          { code: "dinheiro", name: "Dinheiro" },
        ]);
      }
    };

    loadPaymentMethods();
  }, []);

  useEffect(() => {
    loadPaymentData();
    loadConfig();
  }, [loadPaymentData, loadConfig]);

  const calculateValues = usePaymentCalculations({
    payment,
    formData,
    rentalValue,
    garageValue,
    isTerminationPayment,
    originalBreakdown,
    removeLateFee,
    removeInterest,
    lateFeePercentage,
    interestRatePercentage,
  });

  const displayBreakdown = usePaymentBreakdown({
    payment,
    rentalValue: effectiveRentalValue,
    garageValue: effectiveGarageValue,
  });

  useEffect(() => {
    if (payment && displayBreakdown) {
      console.log("🔍 [ManagePaymentForm] Display Breakdown:", {
        displayBreakdown,
        effectiveRentalValue,
        effectiveGarageValue,
        paymentExpectedAmount: payment.expected_amount,
        paymentBreakdown: payment.breakdown
      });
    }
  }, [payment, displayBreakdown, effectiveRentalValue, effectiveGarageValue]);

  useEffect(() => {
    if (loading || !payment) return;
    
    const values = calculateValues;
    
    if (isTerminationPayment && originalBreakdown.length > 0) {
      let workingBreakdown = [...originalBreakdown];
      
      if (igpmCorrection && igpmCorrection.correctedAmount > 0) {
        workingBreakdown = workingBreakdown.map((item: any) => {
          if (item.description?.includes("Devolução de Caução")) {
            return {
              ...item,
              amount: -igpmCorrection.correctedAmount,
            };
          }
          return item;
        });
      }
      
      const cleanBreakdown = workingBreakdown.filter((item: any) => 
        !item.description?.includes("Despesas") && 
        !item.description?.includes("Multa por Atraso") && 
        !item.description?.includes("Juros por Atraso")
      );
      
      const breakdownTotal = cleanBreakdown.reduce((sum, item) => sum + item.amount, 0);
      const lateFees = (removeLateFee ? 0 : values.multa) + (removeInterest ? 0 : values.juros);
      const newTotal = breakdownTotal + repairExpenses + lateFees - discountAmount;
      
      setCalculatedTotal(newTotal);
      
      if (isEditMode && !isPaid) {
        setFormData(prev => ({
          ...prev,
          amount_to_pay: formatCurrency(newTotal.toFixed(2))
        }));
      }
    } else if (!isTerminationPayment && isEditMode && !isPaid) {
      const subtotal = displayBreakdown.total;
      const lateFees = (removeLateFee ? 0 : values.multa) + (removeInterest ? 0 : values.juros);
      const totalValue = subtotal + lateFees - discountAmount;
      
      setFormData(prev => ({
        ...prev,
        amount_to_pay: formatCurrency(totalValue.toFixed(2))
      }));
    }
  }, [
    isTerminationPayment,
    originalBreakdown,
    repairExpenses,
    discountAmount,
    removeLateFee,
    removeInterest,
    calculateValues,
    isEditMode,
    isPaid,
    loading,
    payment,
    igpmCorrection,
    formatCurrency,
    displayBreakdown
  ]);

  const addAttachment = useCallback(() => {
    setAttachments(prev => [...prev, { url: '', name: '', description: '' }]);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const uploadToSupabase = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `payment-attachments/${fileName}`;

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      showAlert({
        title: "Arquivo muito grande",
        description: `O arquivo tem ${(file.size / 1024 / 1024).toFixed(2)}MB. O tamanho máximo é 15MB`,
        type: "error",
      });
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg", 
      "image/png",
      "image/webp",
      "application/pdf"
    ];
    
    if (!allowedTypes.includes(file.type)) {
      showAlert({
        title: "Tipo de arquivo não suportado",
        description: "Apenas imagens (JPG, PNG, WEBP) e PDF são permitidos",
        type: "error",
      });
      return;
    }

    setUploadingFile(true);
    setUploadProgress({ ...uploadProgress, [index]: 0 });

    try {
      setUploadProgress(prev => ({ ...prev, [index]: 30 }));
      
      const publicUrl = await uploadToSupabase(file);
      
      setUploadProgress(prev => ({ ...prev, [index]: 100 }));

      setAttachments(prev => {
        const newAttachments = [...prev];
        newAttachments[index] = {
          ...newAttachments[index],
          url: publicUrl,
          name: file.name,
          uploadProgress: 100,
        };
        return newAttachments;
      });

      showAlert({
        title: "Arquivo enviado",
        description: "Comprovante anexado com sucesso",
        type: "success",
      });
    } catch (error) {
      console.error("❌ Upload error:", error);
      
      let errorMessage = "Erro ao enviar arquivo. Tente novamente";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      showAlert({
        title: "Erro ao enviar arquivo",
        description: errorMessage,
        type: "error",
      });

      setAttachments(prev => {
        const newAttachments = [...prev];
        newAttachments[index] = {
          ...newAttachments[index],
          url: "",
          name: "",
          uploadProgress: 0,
        };
        return newAttachments;
      });
    } finally {
      setUploadingFile(false);
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[index];
        return newProgress;
      });
    }
  };

  const handleEnableEdit = useCallback(() => {
    setIsEditMode(true);
    
    setFormData(prev => ({
      ...prev,
      amount_to_pay: ""
    }));
    
    showAlert({
      title: "Modo de Edição",
      description: "Campos desbloqueados para edição. Campo 'Valor a Pagar' zerado - preencha o valor manualmente.",
      type: "info",
    });
  }, [showAlert]);

  const handleCancelEdit = useCallback(() => {
    setIsEditMode(false);
    loadPaymentData();
    showAlert({
      title: "Edição Cancelada",
      description: "Alterações descartadas.",
      type: "info",
    });
  }, [loadPaymentData, showAlert]);

  const handleRepairExpensesChange = useCallback((value: string) => {
    const masked = applyMoneyMask(value);
    setRepairExpensesInput(masked);
    setRepairExpenses(parseMoneyMaskToNumber(masked));
  }, []);

  const handleDiscountAmountChange = useCallback((value: string) => {
    const masked = applyMoneyMask(value);
    setDiscountAmountInput(masked);
    setDiscountAmount(parseMoneyMaskToNumber(masked));
  }, []);

  const [isSavingExpenses, setIsSavingExpenses] = useState(false);

  const handleSaveExpensesAndDiscount = useCallback(async () => {
    if (!payment || !isTerminationPayment || loading) return;
    
    try {
      setIsSavingExpenses(true);
      
      let breakdownData = payment.breakdown;
      if (typeof breakdownData === 'string') {
        breakdownData = JSON.parse(breakdownData);
      }
      
      if (!Array.isArray(breakdownData)) {
        breakdownData = [];
      }
      
      if (igpmCorrection && igpmCorrection.correctedAmount > 0) {
        breakdownData = breakdownData.map((item: any) => {
          if (item.description?.includes("Devolução de Caução")) {
            return {
              ...item,
              amount: -igpmCorrection.correctedAmount,
            };
          }
          return item;
        });
      }
      
      breakdownData = breakdownData.filter((item: any) => 
        !item.description?.includes("Despesas") &&
        !item.description?.includes("Multa por Atraso") &&
        !item.description?.includes("Juros por Atraso") &&
        !item.description?.includes("Desconto")
      );
      
      if (!removeLateFee && calculateValues.multa > 0) {
        breakdownData.push({
          description: "Multa por Atraso",
          amount: calculateValues.multa,
          type: "addition"
        });
      }
      
      if (!removeInterest && calculateValues.juros > 0) {
        breakdownData.push({
          description: "Juros por Atraso",
          amount: calculateValues.juros,
          type: "addition"
        });
      }
      
      if (repairExpenses > 0) {
        breakdownData.push({
          description: "Despesas Adicionais*",
          amount: repairExpenses,
          type: "addition"
        });
      }
      
      const breakdownTotal = breakdownData.reduce((sum: number, item: any) => sum + item.amount, 0);
      const newExpectedTotal = breakdownTotal - discountAmount;
      
      console.log("💾 AUTO-SAVE - Despesas:", repairExpenses, "Desconto:", discountAmount);
      console.log("💾 AUTO-SAVE - Breakdown Total:", breakdownTotal);
      console.log("💾 AUTO-SAVE - Novo Expected Total (com desconto):", newExpectedTotal);
      
      const updateData = {
        breakdown: JSON.stringify(breakdownData),
        expected_amount: Math.abs(newExpectedTotal),
        discount_amount: discountAmount,
        updated_at: new Date().toISOString(),
      };
      
      console.log("💾 SALVANDO NO BANCO:", updateData);
      
      const { error: updateError } = await supabase
        .from("payments")
        .update(updateData)
        .eq("id", paymentId);

      if (updateError) throw updateError;
      
      console.log("✅ Valores salvos com sucesso!");
      
      invalidateCache('payments');
      
    } catch (error) {
      console.error("❌ Erro ao salvar despesas/descontos:", error);
    } finally {
      setIsSavingExpenses(false);
    }
  }, [
    payment,
    isTerminationPayment,
    loading,
    repairExpenses,
    discountAmount,
    removeLateFee,
    removeInterest,
    calculateValues,
    igpmCorrection,
    paymentId
  ]);

  useEffect(() => {
    if (!isTerminationPayment || loading || !payment) return;
    
    const timeoutId = setTimeout(() => {
      handleSaveExpensesAndDiscount();
    }, 1500);
    
    return () => clearTimeout(timeoutId);
  }, [repairExpenses, discountAmount, handleSaveExpensesAndDiscount, isTerminationPayment, loading, payment, igpmCorrection]);

  const handleSubmit = async () => {
    if (!formData.payment_date || !formData.payment_method) {
      showAlert({
        title: "Atenção",
        description: "Preencha os campos obrigatórios: Data e Método de Pagamento",
        type: "error",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const userInputAmount = formData.amount_to_pay 
        ? parseCurrency(formData.amount_to_pay)
        : 0;
      
      let expectedTotal = 0;
      let updatedBreakdown = payment?.breakdown;
      const values = calculateValues;

      if (isTerminationPayment) {
        try {
          let breakdownData = payment.breakdown;
          if (typeof breakdownData === 'string') {
            breakdownData = JSON.parse(breakdownData);
          }
          
          if (!Array.isArray(breakdownData)) {
            breakdownData = [];
          }
          
          if (igpmCorrection && igpmCorrection.correctedAmount > 0) {
            breakdownData = breakdownData.map((item: any) => {
              if (item.description?.includes("Devolução de Caução")) {
                return {
                  ...item,
                  amount: -igpmCorrection.correctedAmount,
                };
              }
              return item;
            });
          }
          
          breakdownData = breakdownData.filter((item: any) => 
            !item.description?.includes("Despesas") &&
            !item.description?.includes("Multa por Atraso") &&
            !item.description?.includes("Juros por Atraso") &&
            !item.description?.includes("Desconto")
          );
          
          if (!removeLateFee && values.multa > 0) {
            breakdownData.push({
              description: "Multa por Atraso",
              amount: values.multa,
              type: "addition"
            });
          }
          
          if (!removeInterest && values.juros > 0) {
            breakdownData.push({
              description: "Juros por Atraso",
              amount: values.juros,
              type: "addition"
            });
          }
          
          if (repairExpenses > 0) {
            breakdownData.push({
              description: "Despesas Adicionais*",
              amount: repairExpenses,
              type: "addition"
            });
          }
          
          updatedBreakdown = JSON.stringify(breakdownData);
          
          const breakdownTotal = breakdownData.reduce((sum: number, item: any) => sum + item.amount, 0);
          expectedTotal = breakdownTotal - discountAmount;
          
        } catch (error) {
          console.error("❌ Erro ao atualizar breakdown:", error);
          expectedTotal = calculatedTotal;
        }
      } else {
        expectedTotal = values.valorAPagar - discountAmount;
      }
      
      let paymentStatus: string;
      let finalPaidAmount: number;
      
      if (userInputAmount === 0) {
        finalPaidAmount = payment?.paid_amount || 0;
        paymentStatus = payment?.status || "pending";
      } else {
        const previousPaid = payment?.paid_amount || 0;
        const previousStatus = payment?.status || "pending";
        
        if (previousStatus === "partial" && previousPaid > 0) {
          finalPaidAmount = previousPaid + userInputAmount;
        } else {
          finalPaidAmount = userInputAmount;
        }
        
        const totalExpected = Math.abs(expectedTotal);
        const totalPaid = Math.abs(finalPaidAmount);
        
        if (totalPaid >= (totalExpected - 0.01)) {
          paymentStatus = "paid";
        } else {
          paymentStatus = "partial";
          const remaining = totalExpected - totalPaid;
        }
      }

      const attachmentsToSave = attachments.filter(a => a.url).map(a => ({
        url: a.url,
        name: a.name,
        description: a.description
      }));

      const paymentDataUpdate = {
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        payment_time: formData.payment_method === "pix" 
          ? `${paymentHour.padStart(2, '0')}:${paymentMinute.padStart(2, '0')}:${paymentSecond.padStart(2, '0')}`
          : null,
        paid_amount: finalPaidAmount,
        notes: formData.notes,
        status: paymentStatus,
        attachments: attachmentsToSave.length > 0 ? attachmentsToSave : null,
        late_fee: removeLateFee ? 0 : values.multa,
        interest: removeInterest ? 0 : values.juros,
        late_fee_waived: removeLateFee,
        interest_waived: removeInterest,
        discount_amount: discountAmount,
        updated_at: new Date().toISOString(),
        pix_code_type: null,
        breakdown: updatedBreakdown,
        expected_amount: expectedTotal,
      };

      const { error: updateError } = await supabase
        .from("payments")
        .update({
          ...paymentDataUpdate,
          discount_amount: discountAmount,
        })
        .eq("id", paymentId);

      if (updateError) throw updateError;

      const remainingAmount = Math.max(0, Math.abs(expectedTotal) - Math.abs(finalPaidAmount));

      showAlert({
        title: "Sucesso",
        description: userInputAmount === 0
          ? "Pagamento atualizado com sucesso!"
          : paymentStatus === "partial" 
            ? `Pagamento parcial registrado! Total pago: ${formatCurrency(Math.abs(finalPaidAmount).toFixed(2))} de ${formatCurrency(Math.abs(expectedTotal).toFixed(2))}. Restante: ${formatCurrency(remainingAmount.toFixed(2))}`
            : isPaid ? "Pagamento atualizado com sucesso!" : "Pagamento registrado com sucesso!",
        type: "success",
      });

      if (onSuccess) {
        const updatedPayment: any = {
          ...payment,
          ...paymentDataUpdate,
          lateFee: paymentDataUpdate.late_fee,
          interest: paymentDataUpdate.interest,
          paidAmount: paymentDataUpdate.paid_amount,
          paymentDate: paymentDataUpdate.payment_date,
          paymentMethod: paymentDataUpdate.payment_method,
        };

        onSuccess({
          payment: updatedPayment,
          rental: rental,
          property: property,
          tenant: tenant,
        });
      } else if (onClose) {
        onClose();
      } else {
        router.push("/payments");
      }

    } catch (error) {
      console.error("Erro ao confirmar recebimento:", error);
      showAlert({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro inesperado ao registrar pagamento.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const installmentInfo = useMemo(() => {
    if (payment?.installment === null || payment?.installment === undefined) {
      return "Proporcional";
    }
    return payment?.total_installments 
      ? `${payment.installment}/${payment.total_installments}`
      : "Única";
  }, [payment?.installment, payment?.total_installments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const values = calculateValues;
  const isReadOnly = isPaid && !isEditMode;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">
          Registrar Recebimento{isTerminationPayment ? " - Rescisão de Contrato" : ""}
        </h1>
      </div>

      <PaymentInfoCards rental={rental} property={property} tenant={tenant} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PaymentBreakdownCard
          isTerminationPayment={isTerminationPayment}
          originalBreakdown={originalBreakdown}
          igpmCorrection={igpmCorrection}
          repairExpenses={repairExpenses}
          repairExpensesInput={repairExpensesInput}
          removeLateFee={removeLateFee}
          removeInterest={removeInterest}
          lateFeePercentage={lateFeePercentage}
          interestRatePercentage={interestRatePercentage}
          calculatedTotal={calculatedTotal}
          displayBreakdown={displayBreakdown}
          values={values}
          isEditMode={isEditMode}
          isReadOnly={isReadOnly}
          formatCurrency={(val) => formatCurrency(val.toFixed(2))}
          onRepairExpensesChange={handleRepairExpensesChange}
          onRemoveLateFeeChange={setRemoveLateFee}
          onRemoveInterestChange={setRemoveInterest}
          discountAmount={discountAmount}
          discountAmountInput={discountAmountInput}
          onDiscountAmountChange={handleDiscountAmountChange}
          paymentStatus={payment?.status}
          paidAmount={payment?.paid_amount}
          onSaveExpensesAndDiscount={handleSaveExpensesAndDiscount}
          isSaving={isSavingExpenses}
          payment={payment}
          rental={rental}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Informações do Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentFormFields
              formData={formData}
              paymentHour={paymentHour}
              paymentMinute={paymentMinute}
              paymentSecond={paymentSecond}
              installmentInfo={installmentInfo}
              isReadOnly={isReadOnly}
              onFormDataChange={setFormData}
              onPaymentHourChange={setPaymentHour}
              onPaymentMinuteChange={setPaymentMinute}
              onPaymentSecondChange={setPaymentSecond}
              formatCurrency={formatCurrency}
              isTerminationPayment={isTerminationPayment}
            />
            <div>
              <Label htmlFor="payment-method">Forma de Pagamento *</Label>
              <Select
                value={formData.payment_method || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.code} value={method.code}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Anexos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((attachment, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded">
                    <FileText className="h-4 w-4" />
                    <span className="flex-1 text-sm truncate">{attachment.name}</span>
                    {!isReadOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {!isReadOnly && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    id="payment-file-upload"
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const index = attachments.length;
                      addAttachment();
                      handleFileChange(e, index);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12"
                    onClick={() => document.getElementById("payment-file-upload")?.click()}
                    disabled={uploadingFile}
                  >
                    <Paperclip className="mr-2 h-5 w-5" />
                    Escolher Arquivo
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4 justify-end pt-4">
        {isPaid && !isEditMode ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose ? onClose() : router.push("/payments")}
            >
              <X className="mr-2 h-4 w-4" />
              Fechar
            </Button>
            <Button 
              type="button" 
              onClick={handleEnableEdit}
            >
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </>
        ) : (
          <>
            <Button
              id="manage-payment-cancel"
              type="button"
              variant="outline"
              onClick={isPaid ? handleCancelEdit : (onClose ? onClose : () => router.push("/payments"))}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              id="manage-payment-submit"
              type="button" 
              onClick={handleSubmit} 
              disabled={isSubmitting} 
              size="lg"
            >
              {isSubmitting ? "Salvando..." : isPaid ? "Salvar Alterações" : "Confirmar Recebimento"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}