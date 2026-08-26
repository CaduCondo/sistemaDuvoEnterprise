import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useAlert } from "@/contexts/AlertContext";
import { Camera, Paperclip, CreditCard, Edit, X, Upload, FileText, Loader2, ImageIcon, Trash2 } from "lucide-react";
import type { Payment, Rental, Property, Tenant } from "@/types";
import { calculateCorrectedDeposit } from "@/services/igpmService";
import { ehLinhaDeDevolucaoDeCaucao } from "@/lib/rentalCalculations";
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
import { validateAttachmentFile } from "@/lib/attachmentValidation";
import { PaymentReceipt } from "@/components/PaymentReceipt";
import { forceDialogCleanup } from "@/lib/forceCleanup";

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
  partial_payments?: any;
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
  // Se informado, mostra um botão "Cancelar Pagamento" no rodapé (à
  // esquerda) quando o recebimento já está pago — dispara a confirmação de
  // cancelamento do lado de quem chamou (ex: página de Recebimentos).
  onCancelPayment?: (paymentId: string) => void;
}

export function ManagePaymentForm({ paymentId, onSuccess, onClose, embedded = false, onCancelPayment }: ManagePaymentFormProps) {
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

  /**
   * Qual dos DOIS recebimentos da rescisao e este (#49).
   *
   *   'rent'        -> Recebimento de Aluguel: proporcional do aluguel,
   *                    proporcional da garagem e multa. Tem campo de
   *                    Desconto, NAO tem Despesas Adicionais.
   *   'termination' -> Recebimento de Rescisao: devolucao do caucao. Tem
   *                    Despesas Adicionais E Desconto.
   *
   * Vem de payments.payment_kind. Antes isso era adivinhado pelo TEXTO da
   * observacao (`notes.includes("Rescisão de Contrato")`) — o que quebrou
   * assim que o texto mudou, e foi o que deixou as duas telas invertidas em
   * 24/ago/2026.
   */
  const [paymentKind, setPaymentKind] = useState<"rent" | "termination">("rent");

  /** VALOR TOTAL do OUTRO recebimento da mesma rescisao, para o TOTAL GERAL. */
  const [totalDoOutroRecebimento, setTotalDoOutroRecebimento] = useState<number | null>(null);
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
  const [historyReceiptEntry, setHistoryReceiptEntry] = useState<any | null>(null);
  // Índice (dentro de partial_payments) do recibo que o usuário pediu pra excluir -
  // guardamos o índice pra poder mostrar a confirmação antes de apagar de verdade.
  const [entryIndexToDelete, setEntryIndexToDelete] = useState<number | null>(null);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);

  // Monta um "Payment" sintético para o recibo de UM pagamento parcial
  // específico do histórico (não o total acumulado da linha em `payments`).
  const buildHistoryReceiptPayment = useCallback((entry: any) => {
    const raw: any = payment || {};
    return {
      id: raw.id,
      dueDate: raw.due_date,
      referenceMonth: raw.reference_month,
      referenceYear: raw.reference_year,
      installment: raw.installment,
      totalInstallments: raw.total_installments,
      status: "partial",
      property,
      tenant,
      rental,
      paidAmount: entry.amount,
      expectedAmount: entry.amount,
      paymentDate: entry.payment_date,
      paymentTime: entry.payment_time,
      paymentMethod: entry.payment_method,
      notes: entry.notes,
      attachments: (entry.attachments || []).map((a: any) => (typeof a === "string" ? a : a.url)),
      breakdown: null,
      late_fee: 0,
      interest: 0,
      paid_amount: entry.amount,
      expected_amount: entry.amount,
      discount_amount: 0,
      payment_time: entry.payment_time,
    } as any;
  }, [payment, property, tenant, rental]);

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

      // Recebimentos criados antes da migracao 20260824120000 nao tem
      // payment_kind nem termination_group_id: para eles vale o criterio
      // antigo, pelo texto da observacao.
      const kind = (validatedPayment as any).payment_kind as "rent" | "termination" | undefined;
      const grupo = (validatedPayment as any).termination_group_id as string | undefined;

      const isTermination = kind
        ? (kind === "termination" || !!grupo)
        : (validatedPayment.notes?.includes("Rescisão de Contrato") || false);

      setIsTerminationPayment(isTermination);
      setPaymentKind(kind === "termination" ? "termination" : "rent");
      
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
          .select("amount, paid_amount, payment_date, installment_number")
          .eq("rental_id", rentalId)
          .order("payment_date", { ascending: true });

        if (installmentsError) {
          console.error("Erro ao buscar parcelas do caução:", installmentsError);
        } else {
          if (installments && installments.length > 0) {
            /**
             * ⚠️ A correcao incide sobre o que o inquilino EFETIVAMENTE PAGOU
             * (paid_amount), e nao sobre o valor contratado (amount) --
             * decisao 4 do ticket, docs/tickets/rescisao-caucao.md.
             *
             * Esta tela somava `amount` enquanto o terminationService somava
             * `paid_amount`. Os dois discordavam: o banco gravava devolucao
             * 0,00 (nada pago) e a tela exibia milhares de reais (valor
             * contratado corrigido), sem nenhum aviso de que eram contas
             * diferentes.
             */
            const totalDeposit = installments.reduce((sum, inst) => sum + ((inst as any).paid_amount || 0), 0);
            
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
        // ✅ CORREÇÃO: "validatedPayment.paid_amount ? ..." tratava 0 como "vazio"
        // (0 é falsy em JS) - então reabrir um recebimento já Pago com paid_amount
        // 0/ausente deixava o campo em branco, e o formulário não deixava salvar
        // (campo obrigatório) mesmo só querendo mexer nos anexos. Agora sempre
        // mostra um valor de verdade (R$ 0,00 quando não há valor pago registrado),
        // sem alterar nenhuma outra regra de cálculo do campo.
        amount_to_pay: formatCurrency((validatedPayment.paid_amount || 0).toFixed(2)),
        // ✅ CORREÇÃO: Observações não pode "herdar" o texto do pagamento
        // parcial anterior — isso parecia preenchimento automático errado.
        // Só reaproveita o texto salvo quando é edição de um pagamento já
        // 100% pago; para um NOVO pagamento (pendente/atrasado/parcial em
        // aberto) o campo sempre começa vazio.
        notes: validatedPayment.status === "paid" ? (validatedPayment.notes || "") : "",
      });

      // ✅ CORREÇÃO: se já está totalmente pago, os campos refletem o horário
      // histórico salvo (edição). Caso contrário (pendente/atrasado/parcial),
      // o usuário está prestes a registrar UM NOVO pagamento agora — os campos
      // devem começar no horário atual, não vazios (vazio + padStart virava
      // "00:00:00" salvo silenciosamente quando o usuário não mexia neles).
      if (validatedPayment.status === "paid" && validatedPayment.payment_time) {
        const [h, m, s] = validatedPayment.payment_time.split(":");
        setPaymentHour(h || "");
        setPaymentMinute(m || "");
        setPaymentSecond(s || "00");
      } else {
        const now = new Date();
        setPaymentHour(String(now.getHours()).padStart(2, "0"));
        setPaymentMinute(String(now.getMinutes()).padStart(2, "0"));
        setPaymentSecond(String(now.getSeconds()).padStart(2, "0"));
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

  /**
   * Busca o VALOR TOTAL do OUTRO recebimento da mesma rescisao.
   *
   * Os dois nascem juntos e compartilham termination_group_id (#49). O
   * usuario precisa ver, nas duas telas, quanto da o encontro de contas —
   * porque na pratica o inquilino acerta tudo de uma vez.
   */
  useEffect(() => {
    const grupo = (payment as any)?.termination_group_id;
    if (!grupo || !payment?.id) {
      setTotalDoOutroRecebimento(null);
      return;
    }

    let cancelado = false;

    (async () => {
      const { data, error } = await (supabase as any)
        .from("payments")
        .select("id, expected_amount, payment_kind")
        .eq("termination_group_id", grupo)
        // O irmao e o do OUTRO tipo. Sem este filtro, quando o grupo tinha
        // mais de dois registros o TOTAL GERAL somava o par errado.
        .neq("payment_kind", (payment as any).payment_kind || "rent")
        .limit(1)
        .maybeSingle();

      if (cancelado) return;

      if (error) {
        console.warn("⚠️ Nao foi possivel buscar o recebimento irmao da rescisao:", error);
        setTotalDoOutroRecebimento(null);
        return;
      }

      setTotalDoOutroRecebimento(data ? Number(data.expected_amount || 0) : null);
    })();

    return () => {
      cancelado = true;
    };
  }, [payment]);

  useEffect(() => {
    if (loading || !payment) return;
    
    const values = calculateValues;
    
    if (isTerminationPayment && originalBreakdown.length > 0) {
      let workingBreakdown = [...originalBreakdown];
      
      if (igpmCorrection && igpmCorrection.correctedAmount > 0) {
        workingBreakdown = workingBreakdown.map((item: any) => {
          if (ehLinhaDeDevolucaoDeCaucao(item.description)) {
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

      /**
       * A conta muda conforme o recebimento (#49), confirmado com o Cadu em
       * 24/ago/2026:
       *
       *   Recebimento de Aluguel
       *     aluguel proporcional + garagem proporcional + multa − desconto
       *
       *   Recebimento de Rescisao
       *     devolucao do caucao − despesas adicionais + desconto
       *
       * Repare no sinal do desconto: no aluguel ele TIRA (a imobiliaria abre
       * mao de receber). Na rescisao ele SOMA, porque o que se esta perdoando
       * sao as despesas — entao o valor volta para o inquilino.
       */
      const newTotal =
        paymentKind === "termination"
          ? breakdownTotal + repairExpenses - discountAmount
          : breakdownTotal + lateFees - discountAmount;
      
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
      // ✅ CORREÇÃO: se já tinha sido pago parcialmente, "Valor a Pagar" deve
      // vir preenchido com o SALDO ainda devido (o que a pessoa realmente
      // precisa cobrar agora), não o valor cheio do boleto de novo.
      const alreadyPaid = Math.abs(payment?.paid_amount || 0);
      const totalValue = Math.max(subtotal + lateFees - discountAmount - alreadyPaid, 0);

      setFormData(prev => ({
        ...prev,
        amount_to_pay: formatCurrency(totalValue.toFixed(2))
      }));
    }
  }, [
    isTerminationPayment,
    paymentKind,
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

  // ✅ Remove o anexo já na hora, direto no banco - sem precisar clicar em
  // "Editar" primeiro. Antes, um anexo de um recebimento já pago só podia
  // ser removido depois de destravar a tela inteira (isReadOnly); agora o X
  // funciona sempre, igual à tela de Anexos da Locação. Anexo que ainda nem
  // foi enviado (slot vazio) só some da tela, não mexe no banco.
  const removeAttachment = useCallback(async (index: number) => {
    setAttachments(prev => {
      const toRemove = prev[index];
      const updated = prev.filter((_, i) => i !== index);

      if (toRemove?.url && payment?.id) {
        const validAttachments = updated
          .filter(a => a.url)
          .map(({ url, name, description }) => ({ url, name, description }));

        supabase
          .from("payments")
          .update({ attachments: validAttachments as any })
          .eq("id", payment.id)
          .then(({ error }) => {
            if (error) {
              console.error("Erro ao remover anexo:", error);
              showAlert({
                title: "Erro",
                description: "Não foi possível remover o anexo.",
                type: "error",
              });
              setAttachments(prev); // reverte a remoção na tela
            }
          });
      }

      return updated;
    });
  }, [payment?.id, showAlert]);

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

    const validation = validateAttachmentFile(file);
    if (!validation.ok) {
      showAlert({
        title: "Arquivo não permitido",
        description: validation.message,
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

      // ✅ CORREÇÃO: Remover alerta que fecha o formulário
      // O arquivo aparece na lista automaticamente, não precisa de alerta
      
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

    // ✅ CORREÇÃO: antes zerava para "" (vazio) - como o campo é obrigatório,
    // quem editasse só para mexer em outra coisa (ex.: anexos) e esquecesse de
    // preencher esse campo tomava um erro de validação ao salvar, e fechar esse
    // erro travava a página. Agora mostra R$ 0,00 (valor válido) em vez de
    // vazio - se o usuário realmente for mexer no valor, ele mesmo substitui.
    setFormData(prev => ({
      ...prev,
      amount_to_pay: formatCurrency((0).toFixed(2))
    }));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditMode(false);
    loadPaymentData();

    // ✅ CORREÇÃO: Remover alerta que pode travar a tela
  }, [loadPaymentData]);

  // Exclui um recibo específico do histórico de pagamentos parciais (pedido do
  // Cadu). Recalcula o valor total pago e o status do recebimento com base
  // no que sobrar no histórico - nunca mexe nos outros recibos.
  const handleConfirmDeletePartialPayment = useCallback(async () => {
    if (entryIndexToDelete === null || !payment) return;

    setIsDeletingEntry(true);
    try {
      const currentHistory = Array.isArray(payment.partial_payments) ? payment.partial_payments : [];
      const updatedHistory = currentHistory.filter((_: any, i: number) => i !== entryIndexToDelete);

      const newPaidAmount = updatedHistory.reduce((sum: number, entry: any) => sum + Math.abs(entry.amount || 0), 0);
      const expected = Math.abs(payment.expected_amount || 0);

      let newStatus: string;
      if (newPaidAmount <= 0) {
        newStatus = "pending";
      } else if (newPaidAmount >= expected - 0.01) {
        newStatus = "paid";
      } else {
        newStatus = "partial";
      }

      // O recebimento principal (payment_date/hora/forma) passa a refletir o
      // recibo mais recente que sobrou no histórico - ou fica vazio se não
      // sobrar nenhum.
      const lastEntry = updatedHistory[updatedHistory.length - 1];

      const { error } = await supabase
        .from("payments")
        .update({
          partial_payments: updatedHistory,
          paid_amount: newPaidAmount,
          status: newStatus,
          payment_date: lastEntry?.payment_date ?? null,
          payment_time: lastEntry?.payment_time ?? null,
          payment_method: lastEntry?.payment_method ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      if (error) throw error;

      invalidateCache('payments');
      await loadPaymentData();
    } catch (error) {
      console.error("❌ Erro ao excluir recibo:", error);
      showAlert({
        title: "Erro",
        description: "Não foi possível excluir esse recibo. Tente novamente.",
        type: "error",
      });
    } finally {
      setIsDeletingEntry(false);
      setEntryIndexToDelete(null);
    }
  }, [entryIndexToDelete, payment, paymentId, loadPaymentData, showAlert]);

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
        // ✅ CORREÇÃO: salvar a lista de verdade (não texto). O banco já guarda
        // esse campo como jsonb; convertendo para string aqui, quem lê depois
        // (ex.: tela de Recibo) recebia um texto em vez de lista e quebrava ao
        // tentar usar métodos de lista como .find().
        breakdown: breakdownData,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("🚀 [ManagePaymentForm.handleSubmit] INÍCIO");
    console.log("📎 [ManagePaymentForm.handleSubmit] attachments:", attachments);
    console.log("💰 [ManagePaymentForm.handleSubmit] formData:", formData);

    if (!formData.amount_to_pay || !formData.payment_date) {
      showAlert({
        title: "Erro de validação",
        description: "Preencha todos os campos obrigatórios.",
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
          
          // ✅ CORREÇÃO: mesma causa do outro ponto acima - salvar a lista, não texto.
          updatedBreakdown = breakdownData;
          
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

      const thisPaymentDate = formData.payment_date;
      const thisPaymentTime = formData.payment_method === "pix"
        ? `${paymentHour.padStart(2, '0')}:${paymentMinute.padStart(2, '0')}:${paymentSecond.padStart(2, '0')}`
        : null;

      // ✅ CORREÇÃO: cada pagamento (inclusive parcelas) fica registrado em
      // partial_payments com sua própria data/hora/anexo, para não perder o
      // histórico quando um novo pagamento parcial sobrescreve os campos
      // principais do registro (bug: horário do 1º pagamento sumia ao
      // registrar o 2º).
      // expected_amount = quanto ainda era esperado NESSE momento (já com
      // multa/juros do dia, se houver) antes desse pagamento entrar — usado
      // por relatórios (ex: Financeiro) para mostrar o valor esperado
      // correto de cada parcela, não o valor total do boleto inteiro.
      const previousPaidBeforeThis = Math.abs(payment?.paid_amount || 0);
      const expectedForThisEntry = Math.max(Math.abs(expectedTotal) - previousPaidBeforeThis, 0);
      const previousHistory = Array.isArray(payment?.partial_payments)
        ? payment.partial_payments
        : [];
      const updatedHistory = userInputAmount > 0
        ? [
            ...previousHistory,
            {
              amount: userInputAmount,
              expected_amount: expectedForThisEntry,
              payment_date: thisPaymentDate,
              payment_time: thisPaymentTime,
              payment_method: formData.payment_method,
              notes: formData.notes,
              attachments: attachmentsToSave,
              registered_at: new Date().toISOString(),
            },
          ]
        : previousHistory;

      const paymentDataUpdate = {
        payment_date: thisPaymentDate,
        payment_method: formData.payment_method,
        payment_time: thisPaymentTime,
        paid_amount: finalPaidAmount,
        notes: formData.notes,
        status: paymentStatus,
        attachments: attachmentsToSave.length > 0 ? attachmentsToSave : null,
        partial_payments: updatedHistory,
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

      // ✅ CORREÇÃO: Chamar callbacks e só mostrar alerta quando NÃO há callback
      if (onSuccess) {
        // Quando há callback, não mostra alerta - o callback decide o que fazer (ex: abrir recibo)
        const updatedPayment: any = {
          ...payment,
          ...paymentDataUpdate,
          lateFee: paymentDataUpdate.late_fee,
          interest: paymentDataUpdate.interest,
          paidAmount: paymentDataUpdate.paid_amount,
          paymentDate: paymentDataUpdate.payment_date,
          paymentMethod: paymentDataUpdate.payment_method,
          paymentTime: paymentDataUpdate.payment_time,
        };

        onSuccess({
          payment: updatedPayment,
          rental: rental,
          property: property,
          tenant: tenant,
        });
      } else if (onClose) {
        onClose();
        
        // Alerta após fechar
        setTimeout(() => {
          showAlert({
            title: "Sucesso",
            description: "Pagamento atualizado com sucesso!",
            type: "success",
          });
        }, 100);
      } else {
        router.push("/payments");
        
        // Alerta após navegação
        setTimeout(() => {
          showAlert({
            title: "Sucesso",
            description: userInputAmount === 0
              ? "Pagamento atualizado com sucesso!"
              : paymentStatus === "partial" 
                ? `Pagamento parcial registrado! Total pago: ${formatCurrency(Math.abs(finalPaidAmount).toFixed(2))} de ${formatCurrency(Math.abs(expectedTotal).toFixed(2))}. Restante: ${formatCurrency(remainingAmount.toFixed(2))}`
                : isPaid ? "Pagamento atualizado com sucesso!" : "Pagamento registrado com sucesso!",
            type: "success",
          });
        }, 100);
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
          Registrar Recebimento
          {isTerminationPayment && (paymentKind === "termination" ? " de Rescisão" : " de Aluguel")}
        </h1>
        {/* A parcela era um campo so-de-leitura dentro do formulario, ocupando
            espaco de um campo editavel. Como e informacao de contexto, e nao
            algo que se preencha, subiu para debaixo do titulo. */}
        {installmentInfo && (
          <p className="text-sm text-muted-foreground mt-1">{installmentInfo}</p>
        )}
      </div>

      <PaymentInfoCards rental={rental} property={property} tenant={tenant} />

      {Array.isArray(payment?.partial_payments) && payment.partial_payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de pagamentos parciais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payment.partial_payments.map((entry: any, index: number) => (
              <div key={index} className="rounded-md bg-muted/50 p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-medium">{formatCurrency((entry.amount || 0).toFixed(2))}</span>
                <span className="text-muted-foreground">
                  {entry.payment_date}
                  {entry.payment_time ? ` às ${entry.payment_time}` : ""}
                </span>
                {entry.payment_method && (
                  <span className="text-muted-foreground uppercase">{entry.payment_method}</span>
                )}
                {entry.notes && <span className="text-muted-foreground italic">{entry.notes}</span>}
                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => setHistoryReceiptEntry(entry)}
                  >
                    Recibo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-red-600 hover:text-red-700"
                    onClick={() => setEntryIndexToDelete(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PaymentBreakdownCard
          isTerminationPayment={isTerminationPayment}
          paymentKind={paymentKind}
          totalDoOutroRecebimento={totalDoOutroRecebimento}
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
              paymentMethodField={
                <>
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
                </>
              }
            />
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
          <PaymentAttachments
            attachments={attachments}
            uploadingFile={uploadingFile}
            uploadProgress={uploadProgress}
            isReadOnly={isReadOnly}
            onFileChange={handleFileChange}
            onRemoveAttachment={removeAttachment}
            onAddAttachment={addAttachment}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4 pt-4">
        <div>
          {(payment?.status === "paid" || payment?.status === "partial") && onCancelPayment && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => onCancelPayment(paymentId)}
            >
              Cancelar Pagamento
            </Button>
          )}
        </div>

        <div className="flex gap-4">
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

      {historyReceiptEntry && (
        <PaymentReceipt
          payment={buildHistoryReceiptPayment(historyReceiptEntry)}
          rental={rental}
          property={property}
          tenant={tenant}
          onClose={() => setHistoryReceiptEntry(null)}
          skipFetch
        />
      )}

      <AlertDialog
        open={entryIndexToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEntryIndexToDelete(null);
            // ✅ Mesma correção do travamento pós-cancelamento: garante que a
            // página não fique com pointer-events bloqueado depois que esse
            // diálogo fecha.
            setTimeout(() => {
              if (document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]').length === 0) {
                forceDialogCleanup();
              }
            }, 100);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este recibo?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O valor total pago e o status deste
              recebimento serão recalculados com base nos recibos que sobrarem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingEntry}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeletePartialPayment}
              disabled={isDeletingEntry}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingEntry ? "Excluindo..." : "Excluir recibo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}