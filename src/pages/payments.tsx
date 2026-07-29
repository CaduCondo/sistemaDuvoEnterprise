import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { PaymentCard } from "@/components/payments/PaymentCard";
import { PaymentReceipt } from "@/components/PaymentReceipt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Grid3x3, List, Search, HelpCircle, Receipt } from "lucide-react";
import { usePayments } from "@/hooks/usePayments";
import { Payment, Rental, Property, Tenant } from "@/types";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import { hasPermission } from "@/lib/permissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ManagePaymentForm } from "@/components/payments/ManagePaymentForm";
import { SortableTable } from "@/components/ui/sortable-table";
import { supabase } from "@/integrations/supabase/client";
import { getAllDepositInstallments } from "@/services/depositInstallmentService";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function Payments() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const mountedRef = useRef(false);
  const [helpOpen, setHelpOpen] = useState(false);
  
  // Permissões baseadas no sistema centralizado
  const permissions = useMemo(() => ({
    canDeletePayment: hasPermission(user?.role, "canDeletePayment"),
    canViewReceipt: true, // Todos podem ver recibos de pagamentos pagos
  }), [user?.role]);

  // Estados consolidados
  const [uiState, setUiState] = useState({
    viewMode: "list" as "grid" | "list",
    searchQuery: "",
    selectedPaymentId: null as string | null,
    paymentToCancel: null as string | null,
    showReceiptDialog: false,
    selectedPayment: null as Payment | null,
  });

  const [sortKeyPending, setSortKeyPending] = useState<string | null>(null);
  const [sortDirectionPending, setSortDirectionPending] = useState<"asc" | "desc">("asc");
  const [sortKeyPaid, setSortKeyPaid] = useState<string | null>(null);
  const [sortDirectionPaid, setSortDirectionPaid] = useState<"asc" | "desc">("asc");

  const handleSortPending = (key: string) => {
    if (sortKeyPending === key) {
      setSortDirectionPending(sortDirectionPending === "asc" ? "desc" : "asc");
    } else {
      setSortKeyPending(key);
      setSortDirectionPending("asc");
    }
  };

  const handleSortPaid = (key: string) => {
    if (sortKeyPaid === key) {
      setSortDirectionPaid(sortDirectionPaid === "asc" ? "desc" : "asc");
    } else {
      setSortKeyPaid(key);
      setSortDirectionPaid("asc");
    }
  };

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Debounce do search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(uiState.searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [uiState.searchQuery]);

  // ✅ CORREÇÃO: Filtros padrão para o mês/ano ATUAL ao abrir a página
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string | number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<string | number>(now.getFullYear());
  const firstLoadRef = useRef(true);

  const { 
    payments, 
    rentals, 
    properties, 
    tenants, 
    loading, 
    handleCancelPayment: cancelPayment,
    loadPayments
  } = usePayments();
  
  // 🔍 LOG: Verificar quantos payments chegam do hook em CADA RENDER
  console.log(`🎨 [payments.tsx RENDER] Payments recebidos do hook:`, {
    paymentsLength: payments.length,
    rentalsLength: rentals.length,
    propertiesLength: properties.length,
    tenantsLength: tenants.length,
    loading,
    selectedMonth,
    selectedYear
  });
  
  // 🔍 LOG: Rastrear MUDANÇAS no estado payments
  useEffect(() => {
    console.log(`🔔 [payments.tsx] Estado 'payments' MUDOU:`, {
      length: payments.length,
      timestamp: new Date().toISOString()
    });
  }, [payments]);

  // Helpers memoizados
  const getPropertyForPayment = useCallback((payment: Payment) => {
    const rental = rentals.find(r => r.id === payment.rentalId);
    if (!rental) return null;
    return properties.find(p => p.id === rental.propertyId) || null;
  }, [rentals, properties]);

  const getTenantForPayment = useCallback((payment: Payment) => {
    const rental = rentals.find(r => r.id === payment.rentalId);
    if (!rental) return null;
    return tenants.find(t => t.id === rental.tenantId) || null;
  }, [rentals, tenants]);

  const getPaymentInstallment = useCallback((payment: Payment) => {
    // Todos os pagamentos devem ter installment e totalInstallments definidos
    // Formato sempre: "X/Y" mesmo para parcelas proporcionais
    if (!payment.installment || !payment.totalInstallments) {
      return "N/A";
    }
    
    return `${payment.installment}/${payment.totalInstallments}`;
  }, []);

  const getExpectedAmount = useCallback((payment: Payment) => {
    // 🔥 CORREÇÃO: Calcular valor total a partir do breakdown quando ele existir
    if (payment.breakdown) {
      try {
        const breakdownData = typeof payment.breakdown === 'string' 
          ? JSON.parse(payment.breakdown) 
          : payment.breakdown;
        
        // Se o breakdown for um array, somar todos os valores PRESERVANDO SINAIS NEGATIVOS
        if (Array.isArray(breakdownData) && breakdownData.length > 0) {
          const breakdownTotal = breakdownData.reduce((sum: number, item: any) => {
            return sum + (item.value || item.amount || 0);
          }, 0);
          
          // Adicionar multa e juros ao total do breakdown (podem ser removidos se negativos)
          return breakdownTotal + (payment.lateFee || 0) + (payment.interest || 0);
        }
        
        // Se o breakdown for um objeto, processar as chaves
        if (typeof breakdownData === 'object' && !Array.isArray(breakdownData)) {
          let breakdownTotal = 0;
          Object.values(breakdownData).forEach((value: any) => {
            if (value && typeof value === 'object') {
              breakdownTotal += (value.value || value.amount || 0);
            }
          });
          
          if (breakdownTotal > 0 || breakdownTotal < 0) {
            return breakdownTotal + (payment.lateFee || 0) + (payment.interest || 0);
          }
        }
      } catch (error) {
        console.error("Erro ao processar breakdown:", error);
      }
    }
    
    // Fallback: usar expected_amount base + multa + juros
    return payment.expectedAmount + (payment.lateFee || 0) + (payment.interest || 0);
  }, []);

  const getMonthName = useCallback((month: number) => {
    return MONTH_NAMES[month - 1] || "";
  }, []);

  // Carregar pagamentos quando os filtros mudarem (incluindo montagem inicial)
  useEffect(() => {
    loadPayments(selectedMonth.toString(), selectedYear.toString());
    
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
    }
  }, [loadPayments, selectedMonth, selectedYear]);

  // 🔥 FORÇA RE-RENDER: Garantir que mudanças no estado payments causem re-render
  useEffect(() => {
    console.log(`🔔 [payments.tsx] FORÇANDO RE-RENDER - payments mudou para ${payments.length} itens`);
  }, [payments]);

  // Handlers otimizados
  const handleMonthChange = useCallback((value: string | number) => {
    setUiState(prev => ({ ...prev, paymentToCancel: null }));
    setSelectedMonth(value);
  }, []);

  const handleYearChange = useCallback((value: string | number) => {
    setUiState(prev => ({ ...prev, paymentToCancel: null }));
    setSelectedYear(value);
  }, []);

  const handlePaymentClick = useCallback((payment: Payment) => {
    if (payment.status === "paid") {
      setUiState(prev => ({
        ...prev,
        selectedPayment: payment,
        showReceiptDialog: true,
      }));
    } else {
      setUiState(prev => ({
        ...prev,
        selectedPaymentId: payment.id,
        showReceiptDialog: true,
      }));
    }
  }, []);

  const confirmCancelPayment = useCallback(async () => {
    if (!uiState.paymentToCancel) return;

    try {
      await cancelPayment(uiState.paymentToCancel);
      
      setUiState(prev => ({ ...prev, paymentToCancel: null }));
      
      await loadPayments("all", "all");
      
      showAlert({
        title: "Recebimento cancelado",
        description: "O recebimento foi cancelado com sucesso.",
      });
    } catch (error) {
      setUiState(prev => ({ ...prev, paymentToCancel: null }));
    }
  }, [uiState.paymentToCancel, cancelPayment, loadPayments, showAlert]);

  const handleCancelPayment = useCallback((paymentId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (!permissions.canDeletePayment) {
      showAlert({
        title: "Acesso negado",
        description: "Você não tem permissão para cancelar recebimentos",
        variant: "destructive",
      });
      return;
    }

    setUiState(prev => ({ ...prev, paymentToCancel: paymentId }));
  }, [permissions.canDeletePayment, showAlert]);

  const handleViewReceipt = useCallback((payment: Payment) => {
    setUiState(prev => ({
      ...prev,
      selectedPayment: payment,
      showReceiptDialog: true,
    }));
  }, []);

  const handleManagePaymentSuccess = useCallback(async () => {
    const paymentId = uiState.selectedPaymentId;
    
    setUiState(prev => ({ ...prev, selectedPaymentId: null }));
    
    // 🔥 CORREÇÃO: Recarregar com os filtros corretos
    await loadPayments(selectedMonth.toString(), selectedYear.toString());
    
    // 🔥 NOVA ABORDAGEM: Buscar dados completos DIRETAMENTE do banco COM JOINS
    if (paymentId) {
      try {
        // Buscar o payment atualizado
        const { data: paymentData, error: paymentError } = await supabase
          .from("payments")
          .select("*")
          .eq("id", paymentId)
          .single();
          
        if (paymentError) throw paymentError;
        
        if (paymentData) {
          // Buscar a rental associada
          const { data: rentalData, error: rentalError } = await supabase
            .from("rentals")
            .select("*")
            .eq("id", paymentData.rental_id)
            .single();
            
          if (rentalError) throw rentalError;
          
          if (rentalData) {
            // 🔥 CORREÇÃO CRÍTICA: Buscar property COM location via JOIN
            const { data: propertyData, error: propertyError } = await supabase
              .from("properties")
              .select(`
                *,
                locations:location_id (
                  id,
                  name,
                  street,
                  number,
                  complement,
                  neighborhood,
                  city,
                  state,
                  zip_code
                )
              `)
              .eq("id", rentalData.property_id)
              .single();
              
            if (propertyError) throw propertyError;
            
            // Buscar tenant
            const { data: tenantData, error: tenantError } = await supabase
              .from("tenants")
              .select("*")
              .eq("id", rentalData.tenant_id)
              .single();
              
            if (tenantError) throw tenantError;
            
            if (propertyData && tenantData) {
              // Extrair dados da location
              const locationData = propertyData.locations as any;
              
              // Converter os dados do banco para o formato do tipo Payment
              const payment: Payment = {
                id: paymentData.id,
                rentalId: paymentData.rental_id,
                propertyId: rentalData.property_id,
                tenantId: rentalData.tenant_id,
                referenceMonth: Number(paymentData.reference_month),
                referenceYear: Number(paymentData.reference_year),
                dueDate: paymentData.due_date,
                expectedAmount: paymentData.expected_amount || 0,
                paidAmount: paymentData.paid_amount || 0,
                status: paymentData.status as "pending" | "paid" | "overdue" | "partial",
                paymentDate: paymentData.payment_date || null,
                paymentMethod: paymentData.payment_method || null,
                notes: paymentData.notes || null,
                lateFee: paymentData.late_fee || 0,
                interest: paymentData.interest || 0,
                breakdown: paymentData.breakdown || null,
                attachments: paymentData.attachments as any, // Json type from database
                installment: paymentData.installment || 1,
                totalInstallments: paymentData.total_installments || 24,
              };
              
              // Converter rental com valores corretos
              const rental: Rental = {
                id: rentalData.id,
                propertyId: rentalData.property_id,
                property_id: rentalData.property_id,
                tenantId: rentalData.tenant_id,
                tenant_id: rentalData.tenant_id,
                startDate: rentalData.start_date,
                start_date: rentalData.start_date,
                endDate: rentalData.end_date,
                end_date: rentalData.end_date,
                value: rentalData.rent_value || 0,
                monthlyRent: rentalData.rent_value || 0,
                monthly_rent: rentalData.rent_value || 0,
                paymentDay: 10, // Valor padrão já que não existe no banco
                depositAmount: rentalData.security_deposit || rentalData.deposit_value || 0,
                deposit_amount: rentalData.security_deposit || rentalData.deposit_value || 0,
                security_deposit: rentalData.security_deposit || rentalData.deposit_value || 0,
                status: (rentalData.status === "active" || rentalData.status === "ended" || rentalData.status === "terminated") 
                  ? rentalData.status 
                  : "active" as "active" | "ended" | "terminated",
                isActive: rentalData.status === "active",
                is_active: rentalData.status === "active",
                attachments: [],
                contractAttachments: [],
                contract_attachments: [],
                hasGarage: rentalData.has_garage || false,
                has_garage: rentalData.has_garage || false,
                garageValue: rentalData.garage_value || 0,
                garage_value: rentalData.garage_value || 0,
                hasPartnerBroker: false,
                has_partner_broker: false,
                installments: rentalData.deposit_installments || 24,
                totalInstallments: rentalData.deposit_installments || 24,
              };
              
              // 🔥 CORREÇÃO: Converter property COM dados da location E TODOS OS CAMPOS OBRIGATÓRIOS
              const property: Property = {
                id: propertyData.id,
                locationId: propertyData.location_id,
                location_id: propertyData.location_id,
                location: locationData?.name || "",
                propertyIdentifier: propertyData.property_identifier || "",
                property_identifier: propertyData.property_identifier || "",
                complement: locationData?.complement || propertyData.complement || "",
                description: propertyData.description || "",
                rooms: propertyData.rooms || 0,
                bathrooms: propertyData.bathrooms || 0,
                area: propertyData.area || 0,
                value: propertyData.value || 0,
                hasGarage: propertyData.has_garage || false,
                has_garage: propertyData.has_garage || false,
                hasFurniture: propertyData.has_furniture || false,
                has_furniture: propertyData.has_furniture || false,
                acceptsPets: propertyData.accepts_pets || false,
                accepts_pets: propertyData.accepts_pets || false,
                status: (propertyData.status === "available" || propertyData.status === "occupied" || propertyData.status === "unavailable")
                  ? propertyData.status
                  : "available" as "available" | "occupied" | "unavailable",
                images: [],
                createdAt: propertyData.created_at,
                created_at: propertyData.created_at,
                address: locationData?.street || "",
                features: [],
                type: "apartment" as "apartment" | "house" | "commercial", // Valor padrão já que não existe no banco
                monthlyRent: rentalData.rent_value || 0,
                number: locationData?.number || propertyData.property_identifier || "",
                neighborhood: locationData?.neighborhood || "",
                city: locationData?.city || "",
                state: locationData?.state || "",
                zipCode: locationData?.zip_code || "",
              };
              
              // Converter tenant
              const tenant: Tenant = {
                id: tenantData.id,
                name: tenantData.name,
                email: tenantData.email,
                phone: tenantData.phone,
                cpf: tenantData.cpf || tenantData.document || "",
                rg: tenantData.rg || "",
                createdAt: tenantData.created_at,
                document: tenantData.document || tenantData.cpf || "",
                status: (tenantData.status === "new" || tenantData.status === "inactive" || tenantData.status === "rented")
                  ? tenantData.status
                  : "new" as "new" | "inactive" | "rented",
              };
              
              // Abrir o recibo com os dados completos
              setUiState(prev => ({
                ...prev,
                selectedPayment: payment,
                showReceiptDialog: true,
              }));
              
              showAlert({
                title: "Sucesso!",
                description: "Recebimento registrado com sucesso.",
              });
              
              return;
            }
          }
        }
        
        // Se chegou aqui, algo deu errado
        showAlert({
          title: "Aviso",
          description: "Recebimento registrado, mas não foi possível carregar os dados completos. Recarregue a página.",
          variant: "destructive",
        });
        
      } catch (error) {
        console.error("❌ Erro ao buscar dados completos:", error);
        showAlert({
          title: "Erro",
          description: "Erro ao buscar dados do recebimento.",
          variant: "destructive",
        });
      }
    }
  }, [uiState.selectedPaymentId, loadPayments, selectedMonth, selectedYear, showAlert]);

  // Pagamentos filtrados por busca e separados por status
  const { pendingPayments, paidPayments } = useMemo(() => {
    const filterBySearch = (p: Payment) => {
      if (!debouncedSearchQuery) return true;
      
      const query = debouncedSearchQuery.toLowerCase();
      const rental = rentals.find(r => r.id === p.rentalId);
      const property = rental ? properties.find(prop => prop.id === rental.propertyId) : null;
      const tenant = rental ? tenants.find(t => t.id === rental.tenantId) : null;

      const propertyAddress = property ? 
        `${property.address} ${property.number} ${property.complement || ''}`.toLowerCase() : "";
      const tenantName = tenant ? tenant.name.toLowerCase() : "";

      return propertyAddress.includes(query) || tenantName.includes(query);
    };

    const pending = payments.filter((p) => {
      const isStatusMatch = p.status === "pending" || p.status === "partial" || p.status === "overdue";
      return isStatusMatch && filterBySearch(p);
    });

    const paid = payments.filter((p) => {
      return p.status === "paid" && filterBySearch(p);
    });

    // ✅ ORDENAÇÃO PADRÃO: Pendentes por Data de Vencimento (ascendente)
    if (sortKeyPending) {
      pending.sort((a, b) => {
        let aVal: any = "";
        let bVal: any = "";
        const propA = getPropertyForPayment(a);
        const propB = getPropertyForPayment(b);
        const tenA = getTenantForPayment(a);
        const tenB = getTenantForPayment(b);

        switch (sortKeyPending) {
          case "local": 
            aVal = (propA?.location || "").toLowerCase(); 
            bVal = (propB?.location || "").toLowerCase();
            return sortDirectionPending === "asc" 
              ? aVal.localeCompare(bVal, 'pt-BR') 
              : bVal.localeCompare(aVal, 'pt-BR');
          case "complement": 
            aVal = (propA?.complement || "").toLowerCase(); 
            bVal = (propB?.complement || "").toLowerCase();
            return sortDirectionPending === "asc" 
              ? aVal.localeCompare(bVal, 'pt-BR') 
              : bVal.localeCompare(aVal, 'pt-BR');
          case "installment": aVal = getPaymentInstallment(a); bVal = getPaymentInstallment(b); break;
          case "status": aVal = a.status; bVal = b.status; break;
          case "tenant": 
            aVal = (tenA?.name || "").toLowerCase(); 
            bVal = (tenB?.name || "").toLowerCase();
            return sortDirectionPending === "asc" 
              ? aVal.localeCompare(bVal, 'pt-BR') 
              : bVal.localeCompare(aVal, 'pt-BR');
          case "dueDate": aVal = a.dueDate || ""; bVal = b.dueDate || ""; break;
          case "amount": aVal = getExpectedAmount(a); bVal = getExpectedAmount(b); break;
        }
        if (aVal < bVal) return sortDirectionPending === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirectionPending === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      // Ordenação padrão: Data de Vencimento ascendente
      pending.sort((a, b) => {
        const aDate = a.dueDate || "";
        const bDate = b.dueDate || "";
        return aDate.localeCompare(bDate);
      });
    }

    // ✅ ORDENAÇÃO PADRÃO: Pagos por Data de Pagamento (descendente - mais recentes primeiro)
    if (sortKeyPaid) {
      paid.sort((a, b) => {
        let aVal: any = "";
        let bVal: any = "";
        const propA = getPropertyForPayment(a);
        const propB = getPropertyForPayment(b);
        const tenA = getTenantForPayment(a);
        const tenB = getTenantForPayment(b);

        switch (sortKeyPaid) {
          case "local": 
            aVal = (propA?.location || "").toLowerCase(); 
            bVal = (propB?.location || "").toLowerCase();
            return sortDirectionPaid === "asc" 
              ? aVal.localeCompare(bVal, 'pt-BR') 
              : bVal.localeCompare(aVal, 'pt-BR');
          case "complement": 
            aVal = (propA?.complement || "").toLowerCase(); 
            bVal = (propB?.complement || "").toLowerCase();
            return sortDirectionPaid === "asc" 
              ? aVal.localeCompare(bVal, 'pt-BR') 
              : bVal.localeCompare(aVal, 'pt-BR');
          case "installment": aVal = getPaymentInstallment(a); bVal = getPaymentInstallment(b); break;
          case "status": aVal = a.status; bVal = b.status; break;
          case "tenant": 
            aVal = (tenA?.name || "").toLowerCase(); 
            bVal = (tenB?.name || "").toLowerCase();
            return sortDirectionPaid === "asc" 
              ? aVal.localeCompare(bVal, 'pt-BR') 
              : bVal.localeCompare(aVal, 'pt-BR');
          case "paymentDate": aVal = a.paymentDate || ""; bVal = b.paymentDate || ""; break;
          case "amount": aVal = a.paidAmount || 0; bVal = b.paidAmount || 0; break;
        }
        if (aVal < bVal) return sortDirectionPaid === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirectionPaid === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      // Ordenação padrão: Data de Pagamento descendente (mais recentes primeiro)
      paid.sort((a, b) => {
        const aDate = a.paymentDate || "";
        const bDate = b.paymentDate || "";
        return bDate.localeCompare(aDate);
      });
    }

    return { pendingPayments: pending, paidPayments: paid };
  }, [payments, debouncedSearchQuery, rentals, properties, tenants, sortKeyPending, sortDirectionPending, sortKeyPaid, sortDirectionPaid, getPropertyForPayment, getTenantForPayment, getPaymentInstallment, getExpectedAmount]);

  // Helper para determinar cores baseado na data de vencimento
  const getDueDateColor = (dueDate: string, isPaid: boolean): string => {
    if (isPaid) return "bg-green-50 border-l-4 border-l-green-500 hover:bg-green-100";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const due = new Date(dueDate + "T00:00:00");
    due.setHours(0, 0, 0, 0);
    
    if (due < today) {
      return "bg-red-50 border-l-4 border-l-red-500 hover:bg-red-100";
    } else if (due.getTime() === today.getTime()) {
      return "bg-yellow-50 border-l-4 border-l-yellow-500 hover:bg-yellow-100";
    } else {
      return "bg-blue-50 border-l-4 border-l-blue-500 hover:bg-blue-100";
    }
  };

  // Helper para determinar cor do texto baseado na data de vencimento
  const getDueDateTextColor = (dueDate: string, isPaid: boolean): string => {
    if (isPaid) return "text-green-600";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const due = new Date(dueDate + "T00:00:00");
    due.setHours(0, 0, 0, 0);
    
    if (due < today) {
      return "text-red-600";
    } else if (due.getTime() === today.getTime()) {
      return "text-yellow-700";
    } else {
      return "text-blue-600";
    }
  };

  const pendingColumns = useMemo(() => [
    { 
      key: "local", 
      label: "Local",
      headerClassName: "text-center",
      render: (p: Payment) => {
        const textColor = getDueDateTextColor(p.dueDate, false);
        return <span className={`font-medium ${textColor}`}>{getPropertyForPayment(p)?.location || "-"}</span>;
      }
    },
    { key: "complement", label: "Complemento", headerClassName: "text-center", render: (p: Payment) => getPropertyForPayment(p)?.complement || "-" },
    { key: "period", label: "Período", sortable: false, headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[100px]", render: (p: Payment) => `${getMonthName(p.referenceMonth)}/${p.referenceYear}` },
    { key: "installment", label: "Parcela", sortable: false, headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[80px]", render: (p: Payment) => getPaymentInstallment(p) },
    { key: "status", label: "Status", sortable: false, headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[100px]", render: (p: Payment) => {
        const config = {
          pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-800" },
          overdue: { label: "Atrasado", className: "bg-red-100 text-red-800" },
          partial: { label: "Parcial", className: "bg-orange-100 text-orange-800" },
        }[p.status] || { label: "Pendente", className: "bg-yellow-100 text-yellow-800" };
        return <Badge className={config.className}>{config.label}</Badge>;
    }},
    { key: "tenant", label: "Inquilino", headerClassName: "text-center", render: (p: Payment) => getTenantForPayment(p)?.name || "-" },
    { key: "phone", label: "Celular", sortable: false, headerClassName: "text-center", render: (p: Payment) => getTenantForPayment(p)?.phone || "-" },
    { key: "dueDate", label: "Vencimento", headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[110px]", render: (p: Payment) => p.dueDate ? new Date(p.dueDate + "T12:00:00").toLocaleDateString("pt-BR") : "-" },
    { 
      key: "amount", 
      label: "Valor Esperado",
      headerClassName: "text-center",
      className: "text-right", 
      render: (p: Payment) => {
        const textColor = getDueDateTextColor(p.dueDate, false);
        return <span className={`font-bold text-lg ${textColor}`}>{getExpectedAmount(p).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>;
      }
    }
  ], [getPropertyForPayment, getMonthName, getPaymentInstallment, getTenantForPayment, getExpectedAmount]);

  const paidColumns = useMemo(() => [
    { key: "local", label: "Local", headerClassName: "text-center", render: (p: Payment) => <span className="font-medium text-green-600">{getPropertyForPayment(p)?.location || "-"}</span> },
    { key: "complement", label: "Complemento", headerClassName: "text-center", render: (p: Payment) => getPropertyForPayment(p)?.complement || "-" },
    { key: "period", label: "Período", sortable: false, headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[100px]", render: (p: Payment) => `${getMonthName(p.referenceMonth)}/${p.referenceYear}` },
    { key: "attachments", label: "Anexo", sortable: false, headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[80px]", render: (p: Payment) => (p.attachments && (Array.isArray(p.attachments) ? p.attachments.length > 0 : Object.keys(p.attachments).length > 0)) ? <Badge className="bg-blue-100 text-blue-800">Sim</Badge> : <Badge variant="outline">Não</Badge> },
    { key: "installment", label: "Parcela", sortable: false, headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[80px]", render: (p: Payment) => getPaymentInstallment(p) },
    { key: "status", label: "Status", sortable: false, headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[100px]", render: () => <Badge className="bg-green-100 text-green-800">Pago</Badge> },
    { key: "tenant", label: "Inquilino", headerClassName: "text-center", render: (p: Payment) => getTenantForPayment(p)?.name || "-" },
    { key: "paymentDate", label: "Pago em", headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[110px]", render: (p: Payment) => p.paymentDate ? new Date(p.paymentDate + "T12:00:00").toLocaleDateString("pt-BR") : "-" },
    { 
      key: "amount", 
      label: "Valor Pago", 
      headerClassName: "text-center", 
      className: "text-right", 
      render: (p: Payment) => {
        const value = p.paidAmount || 0;
        const isNegative = value < 0;
        return (
          <span className={`font-bold text-lg ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
            {value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        );
      }
    },
    { key: "actions", label: "Ações", sortable: false, headerClassName: "text-center", cellClassName: "text-center px-2", className: "w-[120px]", render: (p: Payment) => (
      <div className="flex flex-col items-center gap-1">
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleViewReceipt(p); }} title="Ver Recibo">Recibo</Button>
        {permissions.canDeletePayment && (
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={(e) => handleCancelPayment(p.id, e)} title="Cancelar Pagamento">Cancelar</Button>
        )}
      </div>
    )}
  ], [getPropertyForPayment, getMonthName, getPaymentInstallment, getTenantForPayment, permissions, handleViewReceipt, handleCancelPayment]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">Recebimentos</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os recebimentos de aluguéis
            </p>
          </div>
          <div className="flex gap-2">
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
                id="payments-view-grid"
                variant={uiState.viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setUiState(prev => ({ ...prev, viewMode: "grid" }))}
                className="h-8 px-3"
              >
                <Grid3x3 className="h-4 w-4 mr-1.5" />
                Grade
              </Button>
              <Button
                id="payments-view-list"
                variant={uiState.viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setUiState(prev => ({ ...prev, viewMode: "list" }))}
                className="h-8 px-3"
              >
                <List className="h-4 w-4 mr-1.5" />
                Lista
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="payments-search-input"
                  type="search"
                  placeholder="Buscar por inquilino, endereço..."
                  className="pl-10 w-full"
                  value={uiState.searchQuery}
                  onChange={(e) => setUiState(prev => ({ ...prev, searchQuery: e.target.value }))}
                />
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <PeriodSelector
                  selectedMonth={selectedMonth as number}
                  selectedYear={selectedYear as number}
                  onMonthChange={handleMonthChange}
                  onYearChange={handleYearChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando recebimentos...</p>
          </div>
        ) : (
          <Tabs defaultValue="pending" className="space-y-0">
            <TabsList className="grid w-full max-w-md grid-cols-2 h-auto p-1">
              <TabsTrigger id="payments-tab-pending" value="pending" className="gap-2 text-xs sm:text-base py-3 px-4 sm:px-6">
                <span className="hidden sm:inline">Recebimentos Pendentes</span>
                <span className="sm:hidden">Pendentes</span>
                <Badge variant="destructive" className="text-xs">
                  {pendingPayments.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger id="payments-tab-paid" value="paid" className="gap-2 text-xs sm:text-base py-3 px-4 sm:px-6">
                <span className="hidden sm:inline">Recebimentos Pagos</span>
                <span className="sm:hidden">Pagos</span>
                <Badge variant="default" className="bg-green-500 text-xs">
                  {paidPayments.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Aba: Recebimentos Pendentes */}
            <TabsContent value="pending" className="mt-0 space-y-0">
              {pendingPayments.length > 0 ? (
                uiState.viewMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingPayments.map((payment) => (
                      <PaymentCard
                        key={payment.id}
                        payment={payment}
                        property={getPropertyForPayment(payment)}
                        tenant={getTenantForPayment(payment)}
                        isPaid={payment.status === "paid"}
                        viewMode={uiState.viewMode}
                        installment={getPaymentInstallment(payment)}
                        expectedAmount={getExpectedAmount(payment)}
                        onCardClick={(id) => setUiState(prev => ({ ...prev, selectedPaymentId: id }))}
                        onClick={() => setUiState(prev => ({ ...prev, selectedPaymentId: payment.id }))}
                        getMonthName={getMonthName}
                        onCancelPayment={permissions.canDeletePayment ? handleCancelPayment : undefined}
                        onViewReceipt={permissions.canViewReceipt ? (id, e) => {
                          e?.stopPropagation();
                          handleViewReceipt(payment);
                        } : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <div className="inline-block min-w-full align-middle">
                      <SortableTable
                        data={pendingPayments}
                        columns={pendingColumns}
                        sortKey={sortKeyPending}
                        sortDirection={sortDirectionPending}
                        onSort={handleSortPending}
                        onRowClick={(p) => setUiState(prev => ({ ...prev, selectedPaymentId: p.id }))}
                        getRowClassName={(p) => getDueDateColor(p.dueDate, false)}
                        emptyMessage="Nenhum recebimento pendente encontrado."
                      />
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhum recebimento pendente encontrado</p>
                </div>
              )}
            </TabsContent>

            {/* Aba: Recebimentos Pagos */}
            <TabsContent value="paid" className="space-y-6">
              {paidPayments.length > 0 ? (
                uiState.viewMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paidPayments.map((payment) => (
                      <PaymentCard
                        key={payment.id}
                        payment={payment}
                        property={getPropertyForPayment(payment)}
                        tenant={getTenantForPayment(payment)}
                        isPaid={payment.status === "paid"}
                        viewMode={uiState.viewMode}
                        installment={getPaymentInstallment(payment)}
                        expectedAmount={getExpectedAmount(payment)}
                        onCardClick={(id) => setUiState(prev => ({ ...prev, selectedPaymentId: id }))}
                        onClick={() => setUiState(prev => ({ ...prev, selectedPaymentId: payment.id }))}
                        getMonthName={getMonthName}
                        onCancelPayment={permissions.canDeletePayment ? handleCancelPayment : undefined}
                        onViewReceipt={permissions.canViewReceipt ? (id, e) => {
                          e?.stopPropagation();
                          handleViewReceipt(payment);
                        } : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <div className="inline-block min-w-full align-middle">
                      <SortableTable
                        data={paidPayments}
                        columns={paidColumns}
                        sortKey={sortKeyPaid}
                        sortDirection={sortDirectionPaid}
                        onSort={handleSortPaid}
                        onRowClick={(p) => setUiState(prev => ({ ...prev, selectedPaymentId: p.id }))}
                        getRowClassName={(p) => getDueDateColor(p.dueDate, true)}
                        emptyMessage="Nenhum recebimento pago encontrado."
                      />
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhum recebimento pago encontrado</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Dialog de confirmação de cancelamento */}
      <AlertDialog open={!!uiState.paymentToCancel} onOpenChange={(open) => !open && setUiState(prev => ({ ...prev, paymentToCancel: null }))}>
        <AlertDialogContent id="payments-cancel-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Tem certeza que deseja cancelar este recebimento? Esta ação irá:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Alterar o status para "Pendente"</li>
                  <li>Remover a data e hora do pagamento</li>
                  <li>Zerar o valor pago</li>
                  <li>Remover o método de pagamento</li>
                  <li>Remover anexos</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel id="payments-cancel-no">Cancelar</AlertDialogCancel>
            <AlertDialogAction id="payments-cancel-yes" onClick={confirmCancelPayment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {uiState.showReceiptDialog && uiState.selectedPayment && (
        <PaymentReceipt
          payment={uiState.selectedPayment}
          rental={rentals.find(r => r.id === uiState.selectedPayment!.rentalId) as any}
          property={getPropertyForPayment(uiState.selectedPayment) as any}
          tenant={getTenantForPayment(uiState.selectedPayment) as any}
          onClose={() => {
            setUiState(prev => ({
              ...prev,
              showReceiptDialog: false,
              selectedPayment: null,
            }));
          }}
        />
      )}

      <Dialog open={!!uiState.selectedPaymentId} onOpenChange={(open) => !open && setUiState(prev => ({ ...prev, selectedPaymentId: null }))}>
        <DialogContent id="payments-manage-dialog" className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="hidden">Detalhes do Recebimento</DialogTitle>
          </DialogHeader>
          {uiState.selectedPaymentId && (
            <ManagePaymentForm
              paymentId={uiState.selectedPaymentId}
              onSuccess={handleManagePaymentSuccess}
              onClose={() => setUiState(prev => ({ ...prev, selectedPaymentId: null }))}
              embedded
            />
          )}
        </DialogContent>
      </Dialog>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} page="payments" />
    </Layout>
  );
}