import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAlert } from "@/contexts/AlertContext";
import { Home, Plus, User, ChevronDown, ChevronUp, Trash2, XCircle, Grid3x3, List, AlertTriangle, RefreshCw, Ban, MapPin, Eye, FileText, Calendar, Search, Wand2, RotateCw, Pencil, HelpCircle } from "lucide-react";
import { getAll as getAllRentals, remove as deleteRental, terminateContract } from "@/services/rentalService";
import { getAvailable as getAvailableProperties, update as updateProperty, getAll as getAllProperties } from "@/services/propertyService";
import { getActive as getActiveTenants, update as updateTenant, getAll as getAllTenants } from "@/services/tenantService";
import { getAll as getAllLocations } from "@/services/locationService";
import { RentalFormDialog } from "@/components/rentals/RentalFormDialog";
import type { Rental, Property, Tenant, Location } from "@/types";
import { formatCurrency } from "@/lib/masks";
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
import { SortableTable } from "@/components/ui/sortable-table";
import { calculateContractAlert, getAlertClasses, getAlertBadgeClasses } from "@/lib/contractAlerts";
import { RentalTerminationDialog } from "@/components/rentals/RentalTerminationDialog";
import { useContractExpiration } from "@/hooks/useContractExpiration";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import type React from "react";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export default function RentalsPage() {
  const router = useRouter();
  const { showAlert } = useAlert();
  useContractExpiration();
  
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [availableProperties, setAvailableProperties] = useState<Property[]>([]);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingAvailable, setLoadingAvailable] = useState(true);
  const [loadingAdditionalData, setLoadingAdditionalData] = useState(false);
  
  const [dataCache, setDataCache] = useState({
    loaded: false,
    timestamp: 0,
  });
  
  const [isRentalDialogOpen, setIsRentalDialogOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [rentalToDelete, setRentalToDelete] = useState<Rental | null>(null);
  const [paymentCounts, setPaymentCounts] = useState<{ pending: number; paid: number } | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2 | 3>(1);
  const [deleteChoices, setDeleteChoices] = useState({ pending: false, paid: false });
  const [rentalToEnd, setRentalToEnd] = useState<Rental | null>(null);
  const [rentalToRenew, setRentalToRenew] = useState<Rental | null>(null);
  const [rentalForPaymentHistory, setRentalForPaymentHistory] = useState<Rental | null>(null);
  
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [rentalTerminations, setRentalTerminations] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "terminated">("active");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // States para rastrear seleções dos combos
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  // Permissions helper
  const permissions = useMemo(() => ({
    canViewContract: true, // Todos podem ver contrato
  }), []);

  // Helper functions
  const getPropertyForRental = useCallback((rental: Rental) => {
    return rental.property || allProperties.find(p => p.id === rental.propertyId);
  }, [allProperties]);

  const getTenantForRental = useCallback((rental: Rental) => {
    return rental.tenant || allTenants.find(t => t.id === rental.tenantId);
  }, [allTenants]);

  const getRentalMonthlyRent = useCallback((rental: Rental) => {
    return (rental.value || 0) + (rental.garageValue || 0);
  }, []);

  const getStatusBadge = useCallback((status: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (status === "active") {
      return <Badge className="bg-green-500 text-white hover:bg-green-600">Ativa</Badge>;
    }
    return <Badge className="bg-gray-500 text-white hover:bg-gray-600">Encerrado</Badge>;
  }, []);

  const handleViewPayments = useCallback((rental: Rental) => {
    router.push(`/payments?rental=${rental.id}`);
  }, [router]);

  const handleViewContract = useCallback((rental: Rental) => {
    router.push(`/rentals?contract=${rental.id}`);
  }, [router]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Helper para formatar data
  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return "-";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  }, []);

  // Carregar informações de rescisão
  const loadTerminationInfo = useCallback(async (activeRentals: Rental[]) => {
    if (activeRentals.length === 0) {
      setRentalTerminations({});
      return;
    }

    try {
      const rentalIds = activeRentals.map(r => r.id);
      
      const { data: payments } = await supabase
        .from("payments")
        .select("rental_id, notes")
        .in("rental_id", rentalIds)
        .ilike("notes", "%Rescisão de Contrato%");
      
      const terminationMap: Record<string, boolean> = {};
      activeRentals.forEach(rental => {
        terminationMap[rental.id] = payments?.some(p => p.rental_id === rental.id) || false;
      });
      
      setRentalTerminations(terminationMap);
    } catch (error) {
      console.error("Erro ao carregar informações de rescisão:", error);
      setRentalTerminations({});
    }
  }, []);

  // Carregar dados de locações
  const loadRentalsData = useCallback(async () => {
    try {
      setLoading(true);
      
      // ✅ OTIMIZAÇÃO: Carregar em paralelo
      const [rentalsData, locationsData] = await Promise.all([
        getAllRentals(),
        getAllLocations(),
      ]);
      
      setRentals(rentalsData);
      setLocations(locationsData);
      
      // ✅ OTIMIZAÇÃO: Carregar rescisões apenas para ativos
      const activeOnly = rentalsData.filter(r => r.isActive);
      if (activeOnly.length > 0) {
        loadTerminationInfo(activeOnly); // Não espera - carrega em background
      }
    } catch (error) {
      console.error("Erro ao carregar locações:", error);
      showAlert({
        title: "Erro",
        description: "Não foi possível carregar as locações. Tente recarregar a página.",
        type: "error",
      });
      // Define arrays vazios em caso de erro
      setRentals([]);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [showAlert, loadTerminationInfo]);

  // Carregar dados disponíveis
  const loadAvailableData = useCallback(async () => {
    try {
      setLoadingAvailable(true);
      const [propertiesData, tenantsData] = await Promise.all([
        getAvailableProperties(),
        getActiveTenants(),
      ]);
      setAvailableProperties(propertiesData);
      setAvailableTenants(tenantsData);
    } catch (error) {
      console.error("Erro ao carregar dados disponíveis:", error);
    } finally {
      setLoadingAvailable(false);
    }
  }, []);

  // Carregar dados adicionais com cache
  const loadAdditionalData = useCallback(async () => {
    const now = Date.now();
    
    if (dataCache.loaded && (now - dataCache.timestamp) < CACHE_DURATION) {
      return;
    }

    try {
      setLoadingAdditionalData(true);
      
      const [allPropertiesData, allTenantsData] = await Promise.all([
        getAllProperties(),
        getAllTenants(),
      ]);
      
      setAllProperties(allPropertiesData);
      setAllTenants(allTenantsData);
      setDataCache({ loaded: true, timestamp: now });
    } catch (error) {
      console.error("❌ Erro ao carregar dados adicionais:", error);
      showAlert({
        title: "Aviso",
        description: "Alguns dados não puderam ser carregados. A funcionalidade pode estar limitada.",
        type: "info",
      });
    } finally {
      setLoadingAdditionalData(false);
    }
  }, [dataCache.loaded, dataCache.timestamp, showAlert]);

  useEffect(() => {
    loadRentalsData();
    loadAvailableData();
  }, [loadRentalsData, loadAvailableData]);

  // Filtrar locações
  const filteredRentals = useMemo(() => {
    const filtered = rentals.filter((rental) => {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const matchesSearch =
        !debouncedSearchTerm ||
        rental.tenant?.name?.toLowerCase().includes(searchLower) ||
        rental.property?.location?.toLowerCase().includes(searchLower) ||
        rental.property?.complement?.toLowerCase().includes(searchLower);

      if (statusFilter === "all") return matchesSearch;

      // Contratos ATIVOS = status active E não vencidos
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isExpired = rental.endDate && new Date(rental.endDate) < today;
      const effectiveStatus = (rental.isActive && !isExpired) ? "active" : "terminated";

      return matchesSearch && statusFilter === effectiveStatus;
    });

    if (sortKey) {
      filtered.sort((a, b) => {
        let aVal: any = "";
        let bVal: any = "";
        switch (sortKey) {
          case "local":
            aVal = locations.find(loc => loc.id === a.property?.locationId)?.name || a.property?.location || "";
            bVal = locations.find(loc => loc.id === b.property?.locationId)?.name || b.property?.location || "";
            break;
          case "complement":
            aVal = a.property?.complement || "";
            bVal = b.property?.complement || "";
            break;
          case "tenant":
            aVal = a.tenant?.name || "";
            bVal = b.tenant?.name || "";
            break;
          case "value":
            aVal = a.value || 0;
            bVal = b.value || 0;
            break;
          case "startDate":
            aVal = a.startDate || "";
            bVal = b.startDate || "";
            break;
          case "endDate":
            aVal = a.endDate || "";
            bVal = b.endDate || "";
            break;
          case "status":
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            aVal = (a.isActive && (!a.endDate || new Date(a.endDate) >= today)) ? "active" : "terminated";
            bVal = (b.isActive && (!b.endDate || new Date(b.endDate) >= today)) ? "active" : "terminated";
            break;
        }
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [rentals, debouncedSearchTerm, statusFilter, sortKey, sortDirection, locations]);

  const activeRentals = useMemo(() => rentals.filter((r) => r.isActive), [rentals]);
  const canCreateRental = useMemo(() => 
    availableProperties.length > 0 && availableTenants.length > 0, 
    [availableProperties.length, availableTenants.length]
  );

  // ✅ OTIMIZAÇÃO: Memoizar lista de IDs de locações para evitar recálculos
  const rentalIds = useMemo(() => rentals.map(r => r.id), [rentals]);

  // Handler para rescisão
  const handleTerminateRental = useCallback(async (data: {
    terminationDate: string;
    applyPenalty: boolean;
    penaltyAmount: number;
    depositAmount: number;
  }) => {
    if (!rentalToEnd) return;

    try {
      const { processContractTermination } = await import("@/services/terminationService");
      
      await processContractTermination({
        rentalId: rentalToEnd.id,
        terminationDate: data.terminationDate,
        penaltyAmount: data.penaltyAmount,
        paymentDay: rentalToEnd.paymentDay || 1,
        depositAmount: data.depositAmount,
        monthlyRent: rentalToEnd.value || 0,
      });

      showAlert({
        title: "Sucesso",
        description: "Rescisão processada com sucesso! Aguardando pagamento final.",
        type: "success",
      });
      
      await loadRentalsData();
    } catch (error) {
      console.error("❌ Erro ao processar rescisão:", error);
      throw error;
    }
  }, [rentalToEnd, showAlert, loadRentalsData]);

  // Handler para confirmar rescisão
  const handleConfirmTermination = useCallback(async (data: {
    terminationDate: string;
    applyPenalty: boolean;
    penaltyAmount: number;
    depositAmount: number;
  }) => {
    try {
      await handleTerminateRental(data);
      setRentalToEnd(null);
    } catch (error) {
      console.error("❌ Error ending contract:", error);
      showAlert({
        title: "Erro",
        description: "Não foi possível processar a rescisão.",
        type: "error",
      });
    }
  }, [handleTerminateRental, showAlert]);

  // Handler para renovar locação
  const handleRenewRental = useCallback(async () => {
    if (!rentalToRenew) return;

    try {
      const currentEndDate = new Date(rentalToRenew.endDate);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);

      const { update: updateRental } = await import("@/services/rentalService");
      await updateRental(rentalToRenew.id, {
        endDate: newEndDate.toISOString().split("T")[0],
      });

      showAlert({
        title: "Sucesso",
        description: `Contrato renovado com sucesso! Nova data final: ${formatDate(newEndDate.toISOString())}`,
      });

      setRentalToRenew(null);
      await loadRentalsData();
    } catch (error) {
      console.error("Error renewing contract:", error);
      showAlert({
        title: "Erro",
        description: "Não foi possível renovar o contrato.",
        type: "error",
      });
    }
  }, [rentalToRenew, showAlert, formatDate, loadRentalsData]);

  // Handler para deletar locação
  const handleDeleteRental = useCallback(async () => {
    if (!rentalToDelete) return;

    try {
      // Deletar recebimentos conforme escolhas do usuário
      if (deleteChoices.pending || deleteChoices.paid) {
        const { deletePaymentsByRentalIdSelective } = await import("@/services/paymentService");
        await deletePaymentsByRentalIdSelective(
          rentalToDelete.id, 
          deleteChoices.pending, 
          deleteChoices.paid
        );
      }
      
      await deleteRental(rentalToDelete.id);
      
      // ✅ CORREÇÃO: Sincronizar status do imóvel após deletar locação
      const { syncPropertyStatus } = await import("@/services/syncPropertyStatusService");
      await syncPropertyStatus(rentalToDelete.propertyId);

      let message = "Locação removida.";
      if (deleteChoices.pending && deleteChoices.paid) {
        message = "Locação e todos os recebimentos foram removidos.";
      } else if (deleteChoices.pending) {
        message = "Locação e recebimentos pendentes foram removidos. Recebimentos pagos foram preservados.";
      } else if (deleteChoices.paid) {
        message = "Locação e recebimentos pagos foram removidos. Recebimentos pendentes foram preservados.";
      } else {
        message = "Locação removida. Todo o histórico financeiro foi preservado.";
      }

      showAlert({
        title: "Sucesso!",
        description: message,
      });
      
      // Resetar estados
      setRentalToDelete(null);
      setPaymentCounts(null);
      setDeleteStep(1);
      setDeleteChoices({ pending: false, paid: false });
      
      await loadRentalsData();
      await loadAvailableData();
    } catch (error) {
      console.error("Erro ao deletar locação:", error);
      showAlert({
        title: "Erro",
        description: "Não foi possível remover a locação.",
        type: "error",
      });
    }
  }, [rentalToDelete, deleteChoices, showAlert, loadRentalsData, loadAvailableData]);

  // Função para abrir o dialog de exclusão com validação prévia
  const handleOpenDeleteDialog = useCallback(async (rental: Rental, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      // Buscar contagem de recebimentos
      const { data: payments, error } = await supabase
        .from("payments")
        .select("id, status")
        .eq("rental_id", rental.id);

      if (error) {
        console.error("Erro ao verificar recebimentos:", error);
        showAlert({
          title: "Erro",
          description: "Não foi possível verificar os recebimentos da locação.",
          type: "error",
        });
        return;
      }

      const pending = payments?.filter(p => p.status === "pending").length || 0;
      const paid = payments?.filter(p => p.status === "paid" || p.status === "partial").length || 0;

      setPaymentCounts({ pending, paid });
      setRentalToDelete(rental);
      setDeleteStep(1);
      setDeleteChoices({ pending: false, paid: false });
    } catch (error) {
      console.error("Erro ao validar locação:", error);
      showAlert({
        title: "Erro",
        description: "Não foi possível validar a locação.",
        type: "error",
      });
    }
  }, [showAlert]);

  const handleViewHistory = async () => {
    if (!rentalForPaymentHistory) return;
    
    const rental = rentalForPaymentHistory;
    
    try {
      // Buscar pagamentos do rental
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("rental_id", rental.id)
        .order("installment", { ascending: true });

      if (error) throw error;

      const payments = (data || []).map((p) => ({
        id: p.id,
        due_date: p.due_date,
        payment_date: p.payment_date,
        amount_paid: p.paid_amount || 0,
        expected_amount: p.expected_amount || 0,
        status: p.status === "paid" || p.status === "partial" ? "pago" : "pendente",
        installment_number: p.installment || 0,
      }));

      const location = rental?.property?.location || "-";
      const complement = rental?.property?.complement || "-";
      const tenantName = rental?.tenant?.name || "-";

      const totalPaid = payments
        .filter((p) => p.status === "pago")
        .reduce((sum, p) => sum + p.amount_paid, 0);

      // Criar conteúdo HTML para o pop-up
      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Histórico de Pagamentos</title>
            <style>
              @page {
                size: landscape;
                margin: 1cm;
              }
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
              }
              h1 {
                font-size: 28px;
                margin-bottom: 20px;
                font-weight: bold;
              }
              .info-box {
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 16px;
                background: #f9f9f9;
                margin-bottom: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 20px;
              }
              .info-content {
                flex: 1;
              }
              .info-content div {
                margin-bottom: 8px;
                font-size: 16px;
              }
              .info-content div:last-child {
                margin-bottom: 0;
              }
              .info-box strong {
                font-weight: 600;
              }
              .print-button {
                background-color: #2563eb;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                white-space: nowrap;
                flex-shrink: 0;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 12px 8px;
                text-align: center;
                font-size: 16px;
              }
              th {
                background-color: #f0f0f0;
                font-weight: 600;
              }
              .status-pago {
                background-color: #dcfce7;
                color: #15803d;
                border: 1px solid #86efac;
                padding: 4px 12px;
                border-radius: 4px;
                display: inline-block;
              }
              .status-pendente {
                background-color: #fee2e2;
                color: #991b1b;
                border: 1px solid #fca5a5;
                padding: 4px 12px;
                border-radius: 4px;
                display: inline-block;
              }
              .total-row {
                font-weight: bold;
                background-color: #f9f9f9;
              }
              .text-right {
                text-align: right;
              }
              .text-green {
                color: #15803d;
                font-weight: 600;
              }
              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <h1>Histórico de Pagamentos</h1>
            
            <div class="info-box">
              <div class="info-content">
                <div><strong>Local:</strong> ${location}</div>
                <div><strong>Complemento:</strong> ${complement}</div>
                <div><strong>Nome Inquilino:</strong> ${tenantName}</div>
              </div>
              
              <button onclick="window.print()" class="print-button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Imprimir
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Parcela</th>
                  <th>Vencimento</th>
                  <th>Pagamento</th>
                  <th>Status</th>
                  <th class="text-right">Valor Esperado</th>
                  <th class="text-right">Valor Pago</th>
                </tr>
              </thead>
              <tbody>
                ${payments.map(payment => `
                  <tr>
                    <td>${payment.installment_number}</td>
                    <td>${new Date(payment.due_date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                    <td>${payment.payment_date ? new Date(payment.payment_date + "T00:00:00").toLocaleDateString("pt-BR") : "-"}</td>
                    <td>
                      <span class="${payment.status === "pago" ? "status-pago" : "status-pendente"}">
                        ${payment.status === "pago" ? "Pago" : "Pendente"}
                      </span>
                    </td>
                    <td class="text-right">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.expected_amount)}</td>
                    <td class="text-right text-green">
                      ${payment.status === "pago" ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount_paid) : "-"}
                    </td>
                  </tr>
                `).join("")}
                <tr class="total-row">
                  <td colspan="5" class="text-right">Total Pago:</td>
                  <td class="text-right text-green">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPaid)}</td>
                </tr>
              </tbody>
            </table>

            <style>
              @media print {
                button {
                  display: none !important;
                }
              }
            </style>
          </body>
        </html>
      `;

      // Abrir pop-up
      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
      }
      
      // Fechar o estado após abrir o popup
      setRentalForPaymentHistory(null);
    } catch (error) {
      console.error("Erro ao abrir histórico:", error);
      showAlert({
        type: "error",
        title: "Erro ao abrir histórico",
        description: "Ocorreu um erro ao carregar os dados.",
      });
    }
  };
  
  // Executar quando rentalForPaymentHistory for definido
  useEffect(() => {
    if (rentalForPaymentHistory) {
      handleViewHistory();
    }
  }, [rentalForPaymentHistory]);

  // Handler para visualizar locação
  const handleViewRental = useCallback(async (rental: Rental) => {
    try {
      setSelectedRental(rental);
      setIsViewMode(true);
      setIsRentalDialogOpen(true);
    } catch (error) {
      console.error("❌ Erro ao abrir diálogo:", error);
      showAlert({
        title: "Erro",
        description: "Não foi possível abrir os detalhes da locação.",
        type: "error",
      });
    }
  }, [showAlert]);

  // Handler para criar nova locação
  const handleCreateNew = useCallback(async () => {
    try {
      setSelectedRental(null);
      setIsViewMode(false);
      setIsRentalDialogOpen(true);
      await loadAdditionalData();
    } catch (error) {
      console.error("⚠️ Erro ao carregar dados adicionais, mas o diálogo será aberto:", error);
    }
  }, [loadAdditionalData]);

  // Handler de sucesso do diálogo
  const handleDialogSuccess = useCallback(async () => {
    await loadRentalsData();
    await loadAvailableData();
  }, [loadRentalsData, loadAvailableData]);

  const rentalColumns = useMemo(() => [
    { key: "local", label: "Local", headerClassName: "text-center", render: (r: Rental) => <span className="font-medium text-blue-600">{getPropertyForRental(r)?.location || "-"}</span> },
    { key: "complement", label: "Complemento", headerClassName: "text-center", render: (r: Rental) => getPropertyForRental(r)?.complement || "-" },
    { key: "tenant", label: "Inquilino", headerClassName: "text-center", render: (r: Rental) => getTenantForRental(r)?.name || "-" },
    { key: "phone", label: "Celular", sortable: false, headerClassName: "text-center", render: (r: Rental) => getTenantForRental(r)?.phone || "-" },
    { key: "value", label: "Valor", headerClassName: "text-center", cellClassName: "text-center px-1", className: "w-[70px]", render: (r: Rental) => <span className="font-bold text-emerald-600">{formatCurrency(getRentalMonthlyRent(r))}</span> },
    { key: "startDate", label: "Data Início", headerClassName: "text-center", cellClassName: "text-center px-1", className: "w-[70px]", render: (r: Rental) => r.startDate ? new Date(r.startDate + "T12:00:00").toLocaleDateString("pt-BR") : "-" },
    { key: "endDate", label: "Data Fim", headerClassName: "text-center", cellClassName: "text-center px-1", className: "w-[70px]", render: (r: Rental) => r.endDate ? new Date(r.endDate + "T12:00:00").toLocaleDateString("pt-BR") : "-" },
    { key: "status", label: "Status", headerClassName: "text-center", cellClassName: "text-center px-1", className: "w-[70px]", render: (r: Rental) => getStatusBadge(r.status) },
    { key: "actions", label: "Ações", sortable: false, headerClassName: "text-center", cellClassName: "text-center px-1", className: "w-[150px]", render: (r: Rental) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isExpired = r.endDate && new Date(r.endDate) < today;
      const isVisuallyActive = r.isActive && !isExpired;
      
      if (!isVisuallyActive) return <span className="text-xs text-muted-foreground">-</span>;
      
      return (
        <div className="flex items-center justify-center gap-0.5">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 bg-gray-500 hover:bg-gray-600 text-white border-gray-500"
            onClick={(e) => {
              e.stopPropagation();
              setRentalForPaymentHistory(r);
            }}
            title="Histórico de Pagamentos"
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
            onClick={(e) => {
              e.stopPropagation();
              setRentalToRenew(r);
            }}
            title="Renovar Contrato"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500"
            onClick={(e) => {
              e.stopPropagation();
              setRentalToEnd(r);
            }}
            title="Rescisão de Contrato"
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => handleOpenDeleteDialog(r, e)}
            title="Excluir Locação"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }}
  ], [getPropertyForRental, getTenantForRental, getRentalMonthlyRent, getStatusBadge, handleOpenDeleteDialog]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">Locações</h1>
            <p className="text-sm text-muted-foreground">Gerencie os contratos de locação</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHelpOpen(true)}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                id="rentals-view-grid"
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="rounded-none"
              >
                <Grid3x3 className="h-4 w-4 mr-1.5" />
                Grade
              </Button>
              <Button
                id="rentals-view-table"
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="rounded-none"
              >
                <List className="h-4 w-4 mr-1.5" />
                Lista
              </Button>
            </div>
          </div>
        </div>

        {/* Vacant Properties Card + New Rental Button */}
        <div className="flex gap-[1%] mb-6">
          <Card className="w-[39%]">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Home className="h-4 w-4" />
                Imóveis Vagos ({loadingAvailable ? "..." : availableProperties.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {loadingAvailable ? (
                <div className="h-10 bg-muted animate-pulse rounded-lg" />
              ) : availableProperties.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum imóvel disponível</p>
              ) : (
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um imóvel vago" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProperties.map((property) => {
                      const location = locations.find(loc => loc.id === property.locationId);
                      const displayName = location?.name || property.location || "Local não encontrado";
                      const fullText = property.complement ? `${displayName} - ${property.complement}` : displayName;
                      const value = formatCurrency(property.value || property.monthlyRent || 0);
                      
                      return (
                        <SelectItem key={property.id} value={property.id}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span className="flex-1 truncate">{fullText}</span>
                            <span className="font-semibold text-emerald-600 whitespace-nowrap">
                              {value}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          <Card className="w-[39%]">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Inquilinos Disponíveis ({loadingAvailable ? "..." : availableTenants.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {loadingAvailable ? (
                <div className="h-10 bg-muted animate-pulse rounded-lg" />
              ) : availableTenants.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum inquilino disponível</p>
              ) : (
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um inquilino disponível" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          <div className="w-[20%] flex items-center justify-center">
            <Button 
              onClick={handleCreateNew}
              className="h-auto py-4 px-6"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nova Locação
            </Button>
          </div>
        </div>

        {/* Filtros de Busca e Status */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground font-medium">
                  {filteredRentals.length} {filteredRentals.length === 1 ? "locação encontrada" : "locações encontradas"}
                </div>
                
                <div className="hidden lg:block w-[180px] text-sm font-medium text-foreground text-left">Status:</div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 lg:max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="rentals-search-input"
                      placeholder="Buscar por inquilino, local ou complemento..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="hidden lg:flex ml-auto w-[180px]">
                  <Select
                    value={statusFilter}
                    onValueChange={(value: "all" | "active" | "terminated") => setStatusFilter(value)}
                  >
                    <SelectTrigger id="rentals-status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="terminated">Encerrado</SelectItem>
                      <SelectItem value="all">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rentals List */}
        <Card className="w-full">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredRentals.length === 0 ? (
              <div className="space-y-4">
                <p className="text-muted-foreground text-center py-8">
                  {searchTerm || statusFilter !== "all" 
                    ? "Nenhuma locação encontrada com os filtros aplicados."
                    : "Nenhuma locação cadastrada ainda."}
                </p>
                {statusFilter === "all" && !searchTerm && (
                  <div className="flex justify-center">
                    <Button id="rentals-create-first" onClick={handleCreateNew} disabled={!canCreateRental}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Locação
                    </Button>
                  </div>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRentals.map((rental) => {
                  const alert = calculateContractAlert(rental.endDate);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isExpired = rental.endDate && new Date(rental.endDate) < today;
                  const isVisuallyActive = rental.isActive && !isExpired;
                  
                  // Aplicar cores APENAS para contratos ativos dentro de 60 dias
                  // Vermelho: ≤30 dias | Amarelo: 31-60 dias
                  const shouldShowAlert = rental.isActive && !isExpired && (alert.level === "warning" || alert.level === "critical");
                  const alertClasses = shouldShowAlert ? getAlertClasses(alert.level) : "";
                  const badgeClasses = getAlertBadgeClasses(alert.level);

                  return (
                    <Card
                      key={rental.id}
                      className={`hover:shadow-lg transition-shadow cursor-pointer border-2 ${alertClasses} ${!isVisuallyActive ? "opacity-75 bg-slate-50" : ""}`}
                      onClick={() => handleViewRental(rental)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Home className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <h3 className="text-lg font-semibold text-blue-600 truncate">
                                {(() => {
                                  const foundLocation = locations.find(loc => loc.id === rental.property?.locationId);
                                  return foundLocation?.name || rental.property?.location || "Local não encontrado";
                                })()}
                              </h3>
                            </div>
                            {rental.property?.complement && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 ml-6">
                                {rental.property.complement}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                            {isVisuallyActive ? (
                              <>
                                <Badge className={`${badgeClasses} px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap`}>
                                  Ativa
                                </Badge>
                                {alert.level !== "normal" && (
                                  <Badge variant="outline" className={`text-xs whitespace-nowrap ${
                                    alert.level === "critical" 
                                      ? "border-red-500 text-red-700 bg-red-50" 
                                      : "border-yellow-500 text-yellow-700 bg-yellow-50"
                                  }`}>
                                    <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
                                    <span>{alert.message}</span>
                                  </Badge>
                                )}
                                {rentalTerminations[rental.id] && (
                                  <Badge className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap">
                                    Rescisão
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <Badge className={isExpired && rental.isActive ? "bg-red-100 text-red-700 border-red-200" : "bg-gray-500 hover:bg-gray-600 text-white"}>
                                Encerrado
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="mb-3 flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className="text-sm text-gray-600 dark:text-gray-400">{rental.tenant?.name || "-"}</p>
                        </div>

                        <div className="mb-3 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(rental.startDate)} - {formatDate(rental.endDate)}
                          </p>
                        </div>

                        <div className="flex items-end justify-between gap-3 pt-3 border-t">
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              Valor do Aluguel
                            </p>
                            <p className="text-2xl font-bold text-emerald-600">
                              {formatCurrency((rental.value || 0) + (rental.garageValue || 0))}
                            </p>
                          </div>
                          {rental.isActive && (
                            <div className="flex gap-1.5 flex-shrink-0">
                              <Button
                                id={`rentals-history-${rental.id}`}
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 bg-gray-500 hover:bg-gray-600 text-white border-gray-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRentalForPaymentHistory(rental);
                                }}
                                title="Histórico de Pagamentos"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                id={`rentals-renew-${rental.id}`}
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRentalToRenew(rental);
                                }}
                                title="Renovar Contrato"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button
                                id={`rentals-terminate-${rental.id}`}
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRentalToEnd(rental);
                                }}
                                title="Rescisão de Contrato"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                id={`rentals-delete-${rental.id}`}
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => handleOpenDeleteDialog(rental, e)}
                                title="Excluir Locação"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <div className="inline-block min-w-full align-middle">
                  <SortableTable
                    data={filteredRentals}
                    columns={rentalColumns}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    onRowClick={handleViewRental}
                    getRowClassName={(r) => {
                      const alert = calculateContractAlert(r.endDate);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isExpired = r.endDate && new Date(r.endDate) < today;
                      const isVisuallyActive = r.isActive && !isExpired;
                      const shouldShowAlert = r.isActive && !isExpired && (alert.level === "warning" || alert.level === "critical");
                      const alertClasses = shouldShowAlert ? getAlertClasses(alert.level) : "";
                      return `${alertClasses} ${!isVisuallyActive ? "opacity-75" : ""}`;
                    }}
                    emptyMessage="Nenhuma locação encontrada."
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {activeRentals.length === 0 && rentals.length === 0 && !loading && (
          <Card>
            <CardContent className="text-center py-12">
              <Home className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma locação cadastrada</h3>
              <p className="text-muted-foreground mb-4">
                Comece criando sua primeira locação
              </p>
              <Button onClick={handleCreateNew} disabled={!canCreateRental}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Locação
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <RentalFormDialog
        open={isRentalDialogOpen}
        onOpenChange={setIsRentalDialogOpen}
        availableProperties={availableProperties}
        availableTenants={availableTenants}
        properties={allProperties}
        tenants={allTenants}
        locations={locations}
        onSuccess={handleDialogSuccess}
        rental={selectedRental}
        isViewMode={isViewMode}
        isLoadingData={loadingAdditionalData}
        preselectedPropertyId={selectedPropertyId}
        preselectedTenantId={selectedTenantId}
      />

      <RentalTerminationDialog
        open={!!rentalToEnd}
        onOpenChange={(open) => !open && setRentalToEnd(null)}
        rental={rentalToEnd}
        onConfirm={handleConfirmTermination}
      />

      {/* Dialog Step 1: Confirmar exclusão da locação */}
      <AlertDialog 
        open={!!rentalToDelete && deleteStep === 1} 
        onOpenChange={(open) => {
          if (!open) {
            setRentalToDelete(null);
            setPaymentCounts(null);
            setDeleteStep(1);
            setDeleteChoices({ pending: false, paid: false });
            // ✅ CORREÇÃO: Limpeza agressiva de overlays
            setTimeout(() => {
              const overlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay], .fixed.inset-0, [role="dialog"], [role="alertdialog"]');
              overlays.forEach(overlay => {
                if (overlay.parentNode) {
                  overlay.parentNode.removeChild(overlay);
                }
              });
              document.body.style.overflow = '';
              document.body.style.pointerEvents = '';
              document.body.style.paddingRight = '';
              document.body.classList.remove('overflow-hidden', 'pointer-events-none');
              document.documentElement.removeAttribute('data-radix-scroll-lock');
              document.body.removeAttribute('data-radix-scroll-lock');
            }, 100);
          }
        }}
      >
        <AlertDialogContent id="rentals-delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão da locação</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>Esta locação possui:</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-blue-900">📊 Histórico Financeiro:</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>{paymentCounts?.pending || 0}</strong> recebimento(s) pendente(s)</li>
                  <li>• <strong>{paymentCounts?.paid || 0}</strong> recebimento(s) pago(s)/parcial(is)</li>
                </ul>
              </div>
              <p className="font-semibold">Tem certeza que deseja deletar esta locação?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel id="rentals-delete-cancel-1" className="w-full sm:w-auto">Não</AlertDialogCancel>
            <Button
              id="rentals-delete-confirm-1"
              onClick={() => {
                if (paymentCounts && paymentCounts.pending > 0) {
                  setDeleteStep(2); // Ir para pergunta sobre pendentes
                } else if (paymentCounts && paymentCounts.paid > 0) {
                  setDeleteStep(3); // Pular para pergunta sobre pagos
                } else {
                  handleDeleteRental(); // Sem recebimentos, deletar direto
                }
              }}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Step 2: Deletar recebimentos pendentes? */}
      <AlertDialog 
        open={!!rentalToDelete && deleteStep === 2} 
        onOpenChange={(open) => {
          if (!open) {
            setRentalToDelete(null);
            setPaymentCounts(null);
            setDeleteStep(1);
            setDeleteChoices({ pending: false, paid: false });
            // ✅ CORREÇÃO: Limpeza agressiva de overlays
            setTimeout(() => {
              const overlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay], .fixed.inset-0, [role="dialog"], [role="alertdialog"]');
              overlays.forEach(overlay => {
                if (overlay.parentNode) {
                  overlay.parentNode.removeChild(overlay);
                }
              });
              document.body.style.overflow = '';
              document.body.style.pointerEvents = '';
              document.body.style.paddingRight = '';
              document.body.classList.remove('overflow-hidden', 'pointer-events-none');
              document.documentElement.removeAttribute('data-radix-scroll-lock');
              document.body.removeAttribute('data-radix-scroll-lock');
            }, 100);
          }
        }}
      >
        <AlertDialogContent id="rentals-delete-pending-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar recebimentos pendentes?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>Esta locação possui <strong>{paymentCounts?.pending || 0}</strong> recebimento(s) pendente(s).</p>
              <p className="font-semibold">Deseja deletar também os recebimentos pendentes?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              id="rentals-delete-pending-no"
              onClick={() => {
                setDeleteChoices(prev => ({ ...prev, pending: false }));
                if (paymentCounts && paymentCounts.paid > 0) {
                  setDeleteStep(3); // Ir para pergunta sobre pagos
                } else {
                  handleDeleteRental(); // Sem pagos, deletar agora
                }
              }}
              className="w-full sm:w-auto"
              variant="outline"
            >
              Não
            </Button>
            <Button
              id="rentals-delete-pending-yes"
              onClick={() => {
                setDeleteChoices(prev => ({ ...prev, pending: true }));
                if (paymentCounts && paymentCounts.paid > 0) {
                  setDeleteStep(3); // Ir para pergunta sobre pagos
                } else {
                  handleDeleteRental(); // Sem pagos, deletar agora
                }
              }}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Step 3: Deletar recebimentos pagos? */}
      <AlertDialog 
        open={!!rentalToDelete && deleteStep === 3} 
        onOpenChange={(open) => {
          if (!open) {
            setRentalToDelete(null);
            setPaymentCounts(null);
            setDeleteStep(1);
            setDeleteChoices({ pending: false, paid: false });
            // ✅ CORREÇÃO: Limpeza agressiva de overlays
            setTimeout(() => {
              const overlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay], .fixed.inset-0, [role="dialog"], [role="alertdialog"]');
              overlays.forEach(overlay => {
                if (overlay.parentNode) {
                  overlay.parentNode.removeChild(overlay);
                }
              });
              document.body.style.overflow = '';
              document.body.style.pointerEvents = '';
              document.body.style.paddingRight = '';
              document.body.classList.remove('overflow-hidden', 'pointer-events-none');
              document.documentElement.removeAttribute('data-radix-scroll-lock');
              document.body.removeAttribute('data-radix-scroll-lock');
            }, 100);
          }
        }}
      >
        <AlertDialogContent id="rentals-delete-paid-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar recebimentos pagos/parciais?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>Esta locação possui <strong>{paymentCounts?.paid || 0}</strong> recebimento(s) pago(s)/parcial(is).</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-amber-900">⚠️ Atenção:</p>
                <p className="text-sm text-amber-800">
                  Deletar recebimentos pagos remove o histórico financeiro. 
                  Esta ação pode impactar relatórios contábeis.
                </p>
              </div>
              <p className="font-semibold">Deseja deletar também os recebimentos pagos/parciais?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              id="rentals-delete-paid-no"
              onClick={() => {
                setDeleteChoices(prev => ({ ...prev, paid: false }));
                handleDeleteRental();
              }}
              className="w-full sm:w-auto"
              variant="outline"
            >
              Não
            </Button>
            <Button
              id="rentals-delete-paid-yes"
              onClick={() => {
                setDeleteChoices(prev => ({ ...prev, paid: true }));
                handleDeleteRental();
              }}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rentalToRenew} onOpenChange={(open) => {
        if (!open) {
          setRentalToRenew(null);
          // ✅ CORREÇÃO: Limpeza agressiva de overlays
          setTimeout(() => {
            const overlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay], .fixed.inset-0, [role="dialog"], [role="alertdialog"]');
            overlays.forEach(overlay => {
              if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
              }
            });
            document.body.style.overflow = '';
            document.body.style.pointerEvents = '';
            document.body.style.paddingRight = '';
            document.body.classList.remove('overflow-hidden', 'pointer-events-none');
            document.documentElement.removeAttribute('data-radix-scroll-lock');
            document.body.removeAttribute('data-radix-scroll-lock');
          }, 100);
        }
      }}>
        <AlertDialogContent id="rentals-renew-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Renovação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que você deseja adicionar mais 1 ano de contrato a essa locação?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel id="rentals-renew-cancel">Não</AlertDialogCancel>
            <AlertDialogAction id="rentals-renew-confirm" onClick={handleRenewRental} className="bg-green-500 hover:bg-green-600">
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} page="rentals" />
    </Layout>
  );
}