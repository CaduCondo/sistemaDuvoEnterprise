import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { format, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Eye,
  FileText,
  HandCoins,
  Home,
  Printer,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Wallet,
  Percent,
  Settings,
  Receipt,
  MapPin,
  ChevronDown,
  Check,
  Edit2,
  HelpCircle,
} from "lucide-react";
import { DepositInstallmentsTable } from "@/components/financial/DepositInstallmentsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useDashboardData } from "@/hooks/useDashboardData";
import { supabase } from "@/integrations/supabase/client";
import { useAlert } from "@/contexts/AlertContext";
import * as XLSX from "xlsx";
import { Payment, Property, Rental, Tenant } from "@/types";
import { formatCurrency } from "@/lib/masks";
import { HelpDialog } from "@/components/HelpDialog";

type SortField = "parc" | "local" | "complement" | "tenant" | "period" | "status" | "dueDate" | "paymentDate" | "expectedAmount" | "paidAmount";
type SortDirection = "asc" | "desc" | null;

type ExpenseSortField = "location_name" | "description" | "amount";

// Array de meses
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Adicionar estilos para impressão
const printStyles = `
  @media print {
    @page {
      size: landscape;
      margin: 10mm;
    }
    
    /* Esconder sidebar/menu SEMPRE */
    aside,
    nav,
    header:not(.print-header),
    [role="navigation"] {
      display: none !important;
    }
    
    /* Esconder botões SEMPRE */
    button,
    .no-print {
      display: none !important;
    }
    
    /* ================================================== */
    /* IMPRESSÃO DO DIALOG DE DESPESAS (PRIORIDADE 1) */
    /* ================================================== */
    
    /* Esconder elementos de navegação e overlay quando dialog de despesas está aberto */
    body:has([data-expenses-dialog="true"]) aside,
    body:has([data-expenses-dialog="true"]) nav,
    body:has([data-expenses-dialog="true"]) header:not([data-expenses-dialog] header),
    body:has([data-expenses-dialog="true"]) button,
    body:has([data-expenses-dialog="true"]) [data-radix-dialog-overlay],
    body:has([data-expenses-dialog="true"]) .no-print {
      display: none !important;
    }
    
    /* Forçar dialog a expandir completamente para paginação natural */
    [data-expenses-dialog="true"] {
      display: block !important;
      max-width: 100% !important;
      max-height: none !important;
      overflow: visible !important;
      height: auto !important;
      position: static !important;
      transform: none !important;
      margin: 20px auto !important;
      padding: 20px !important;
      box-shadow: none !important;
      border: none !important;
    }
    
    .print-expenses-title {
      font-size: 22pt !important;
      font-weight: bold !important;
      text-align: center !important;
      margin: 0 0 12px 0 !important;
      padding: 0 !important;
      color: #000 !important;
      visibility: visible !important;
      display: block !important;
    }
    
    .print-expenses-subtitle {
      font-size: 16pt !important;
      text-align: center !important;
      color: #666 !important;
      margin: 0 0 30px 0 !important;
      padding: 0 !important;
      visibility: visible !important;
      display: block !important;
    }
    
    .print-expenses-content {
      width: 100% !important;
      max-width: 100% !important;
      visibility: visible !important;
      display: block !important;
      margin: 0 auto !important;
      padding: 0 !important;
    }
    
    .print-expenses-content table {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
      margin: 0 auto !important;
    }
    
    .print-expenses-content thead {
      display: table-header-group !important;
      visibility: visible !important;
    }
    
    .print-expenses-content tbody {
      display: table-row-group !important;
      visibility: visible !important;
    }
    
    .print-expenses-content tr {
      display: table-row !important;
      page-break-inside: avoid !important;
      visibility: visible !important;
    }
    
    .print-expenses-content th,
    .print-expenses-content td {
      display: table-cell !important;
      padding: 10px 15px !important;
      border: 1px solid #ddd !important;
      font-size: 13pt !important;
      visibility: visible !important;
      text-align: left !important;
      vertical-align: middle !important;
    }
    
    .print-expenses-content th:first-child,
    .print-expenses-content td:first-child {
      width: 25% !important;
    }
    
    .print-expenses-content th:nth-child(2),
    .print-expenses-content td:nth-child(2) {
      width: 50% !important;
    }
    
    .print-expenses-content th:last-child,
    .print-expenses-content td:last-child {
      width: 25% !important;
      text-align: right !important;
    }
    
    .print-expenses-content th {
      background-color: #f5f5f5 !important;
      font-weight: bold !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    /* ================================================== */
    /* IMPRESSÃO DA PÁGINA PRINCIPAL (quando dialog NÃO está aberto) */
    /* ================================================== */
    
    /* Esconder APENAS sidebar/nav/buttons quando NÃO há dialog de despesas */
    body:not(:has([data-expenses-dialog="true"])) aside,
    body:not(:has([data-expenses-dialog="true"])) nav,
    body:not(:has([data-expenses-dialog="true"])) header:not(.print-header),
    body:not(:has([data-expenses-dialog="true"])) [role="navigation"],
    body:not(:has([data-expenses-dialog="true"])) button,
    body:not(:has([data-expenses-dialog="true"])) .no-print {
      display: none !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-header,
    body:not(:has([data-expenses-dialog="true"])) .print-header *,
    body:not(:has([data-expenses-dialog="true"])) .print-cards,
    body:not(:has([data-expenses-dialog="true"])) .print-cards *,
    body:not(:has([data-expenses-dialog="true"])) .print-area,
    body:not(:has([data-expenses-dialog="true"])) .print-area *,
    body:not(:has([data-expenses-dialog="true"])) .print-title,
    body:not(:has([data-expenses-dialog="true"])) .print-title * {
      visibility: visible !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) {
      margin: 0 !important;
      padding: 0 !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-header {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 0 15px 0 !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-header h1 {
      font-size: 18pt !important;
      font-weight: bold !important;
      margin: 0 0 8px 0 !important;
      padding: 0 !important;
      color: #000 !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-header p {
      font-size: 11pt !important;
      color: #666 !important;
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1.5 !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-cards {
      position: absolute !important;
      top: 80px !important;
      left: 0 !important;
      width: 100% !important;
      display: grid !important;
      grid-template-columns: repeat(5, 1fr) !important;
      gap: 8px !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card {
      border: 1px solid #ddd !important;
      padding: 8px 4px !important;
      background: white !important;
      break-inside: avoid !important;
      margin: 0 !important;
      min-height: 80px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      visibility: visible !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card-icon {
      width: 20px !important;
      height: 20px !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card:nth-child(1) { 
      border-left: 4px solid #22c55e !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card:nth-child(2) { 
      border-left: 4px solid #f97316 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card:nth-child(3) { 
      border-left: 4px solid #3b82f6 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card:nth-child(4) { 
      border-left: 4px solid #ef4444 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card:nth-child(5) { 
      border-left: 4px solid #a855f7 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card-title {
      font-size: 9pt !important;
      color: #666 !important;
      margin-bottom: 6px !important;
      line-height: 1.3 !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card-value {
      font-size: 15pt !important;
      font-weight: bold !important;
      line-height: 1.1 !important;
      word-break: keep-all !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card:nth-child(1) .card-value { 
      color: #22c55e !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card:nth-child(2) .card-value { 
      color: #f97316 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card:nth-child(3) .card-value { 
      color: #3b82f6 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card:nth-child(4) .card-value { 
      color: #ef4444 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body:not(:has([data-expenses-dialog="true"])) .print-cards .card:nth-child(5) .card-value { 
      color: #a855f7 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-area {
      position: absolute !important;
      top: 225px !important;
      left: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) .print-title {
      font-size: 14pt !important;
      font-weight: bold !important;
      text-align: center !important;
      margin: 0 0 10px 0 !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) th,
    body:not(:has([data-expenses-dialog="true"])) td {
      padding: 2px 4px !important;
      border: 1px solid #ddd !important;
      font-size: 9pt !important;
    }
    
    body:not(:has([data-expenses-dialog="true"])) th {
      background-color: #f0f0f0 !important;
      font-weight: bold !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    /* Cores dos status na impressão */
    .status-paid {
      background-color: #dcfce7 !important;
      color: #166534 !important;
      border: 1px solid #86efac !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .status-partial {
      background-color: #fef3c7 !important;
      color: #92400e !important;
      border: 1px solid #fcd34d !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .status-pending {
      background-color: #fee2e2 !important;
      color: #991b1b !important;
      border: 1px solid #fca5a5 !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .col-parcela { width: 50px; }
    .col-local { width: 80px; }
    .col-compl { width: 70px; }
    .col-inquilino { width: 80px; }
    .col-mes { width: 70px; }
    .col-status { width: 50px; }
    .col-venc { width: 60px; }
    .col-rec { width: 60px; }
    .col-hora { width: 45px; }
    .col-val-esp { width: 65px; }
    .col-val-pg { width: 65px; }
    .col-pix { width: 120px; font-size: 6pt !important; }
  }
`;

// Cache em memória para financial data
let financialCache: {
  data: {
    payments: Payment[];
    locations: Map<string, string>;
    exemptLocationIds: string[];
    config: any;
  } | null;
  key: string;
  timestamp: number;
} = { data: null, key: "", timestamp: 0 };

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

export default function Financial() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const isAdmin = user?.role === "admin" || user?.role === "broker";
  const isFinancial = user?.role === "financial";
  
  // Data fetching state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowedLocationIds, setAllowedLocationIds] = useState<string[]>([]);
  const [exemptLocationIds, setExemptLocationIds] = useState<string[]>([]);
  const [managementFeeExemptLocationIds, setManagementFeeExemptLocationIds] = useState<string[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [locationsMap, setLocationsMap] = useState<Map<string, string>>(new Map());
  const [helpOpen, setHelpOpen] = useState(false);
  
  // Novo estado para armazenar as despesas com location_id
  const [locationExpensesData, setLocationExpensesData] = useState<Array<{amount: number, location_id: string}>>([]);
  
  // Estado para controlar o dialog de detalhamento de contas
  const [expensesDetails, setExpensesDetails] = useState<Array<{
    id: string;
    location_name: string;
    amount: number;
    description: string;
    reference_month: number;
    reference_year: number;
    location_id: string;
  }>>([]);

  // Date State
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState<number>(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState<number>(now.getFullYear());
  const [locationExpenses, setLocationExpenses] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("rentals");

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Sorting state for expenses dialog
  const [expenseSortField, setExpenseSortField] = useState<ExpenseSortField | null>(null);
  const [expenseSortDirection, setExpenseSortDirection] = useState<SortDirection>(null);
  
  const [sortExpenses, setSortExpenses] = useState<{
    field: ExpenseSortField;
    direction: SortDirection;
  }>({ field: "location_name", direction: "asc" });

  const expensesContentRef = useRef<HTMLDivElement>(null);

  // Ref para controlar execuções simultâneas
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [editingPixCode, setEditingPixCode] = useState<{
    id: string;
    value: string;
  } | null>(null);
  
  // Estados para edição inline do Código PIX na tabela Locações
  const [editingPixCell, setEditingPixCell] = useState<{ id: string } | null>(null);
  const [editingPixValue, setEditingPixValue] = useState<string>("");
  
  const [showExpensesDialog, setShowExpensesDialog] = useState(false);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, filterMonth, filterYear]);

  const loadData = async () => {
    // Prevenir execuções simultâneas
    if (loadingRef.current) {
      return;
    }

    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Verificar cache
    const cacheKey = `${filterMonth}-${filterYear}-${user?.id}`;
    const now = Date.now();
    
    if (
      financialCache.data &&
      financialCache.key === cacheKey &&
      (now - financialCache.timestamp) < CACHE_DURATION
    ) {
      setPayments(financialCache.data.payments);
      setLocationsMap(financialCache.data.locations);
      setExemptLocationIds(financialCache.data.exemptLocationIds);
      setConfig(financialCache.data.config);
      setLoading(false);
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      abortControllerRef.current = new AbortController();
      
      // QUERY OTIMIZADA: já filtra por location_id quando necessário
      const paymentsQuery: any = supabase
        .from("payments")
        .select(`
          id,
          rental_id,
          expected_amount,
          paid_amount,
          due_date,
          payment_date,
          payment_time,
          status,
          reference_month,
          reference_year,
          discount_amount,
          late_fee,
          interest,
          breakdown,
          payment_method,
          installment,
          total_installments,
          pix_code,
          partial_payments,
          rentals!payments_rental_id_fkey (
            id,
            rent_value,
            garage_value,
            has_garage,
            rent_due_day,
            start_date,
            end_date,
            properties!rentals_property_id_fkey (
              id,
              property_identifier,
              location_id,
              complement,
              locations!properties_location_id_fkey (
                id,
                name
              )
            ),
            tenants!rentals_tenant_id_fkey (
              id,
              name,
              cpf,
              email,
              phone
            )
          )
        `)
        .eq("reference_month", String(filterMonth).padStart(2, '0'))
        .eq("reference_year", String(filterYear))
        .order("due_date", { ascending: true });

      if (abortControllerRef.current) {
        paymentsQuery.abortSignal(abortControllerRef.current.signal);
      }

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;

      if (paymentsError) throw paymentsError;

      // Processar dados e extrair locations
      const locationsMapTemp = new Map<string, string>();
      const formattedPayments = (paymentsData || []).flatMap((payment: any) => {
        const rental = payment.rentals;
        const property = rental?.properties;
        const tenant = rental?.tenants;
        const location = property?.locations;

        // Adicionar location ao map
        if (location && !locationsMapTemp.has(location.id)) {
          locationsMapTemp.set(location.id, location.name);
        }

        const base = {
          id: payment.id,
          rentalId: payment.rental_id,
          expectedAmount: payment.expected_amount,
          paidAmount: payment.paid_amount || 0,
          dueDate: payment.due_date,
          paymentDate: payment.payment_date,
          paymentTime: payment.payment_time,
          status: payment.status as "paid" | "pending" | "overdue" | "partial",
          referenceMonth: Number(payment.reference_month),
          referenceYear: Number(payment.reference_year),
          lateFee: payment.late_fee || 0,
          interest: payment.interest || 0,
          breakdown: payment.breakdown,
          paymentMethod: payment.payment_method,
          installment: payment.installment,
          totalInstallments: payment.total_installments,
          pixCode: payment.pix_code,
          createdAt: payment.created_at,
          updatedAt: payment.updated_at,
          rental: rental ? {
            id: rental.id,
            monthlyRent: rental.rent_value,
            garageValue: rental.garage_value,
            hasGarage: rental.has_garage,
            paymentDay: rental.rent_due_day,
            startDate: rental.start_date,
            endDate: rental.end_date,
            propertyId: property?.id || "",
            tenantId: tenant?.id || "",
            value: rental.rent_value || 0,
            depositAmount: 0,
            status: "active",
            isActive: true,
            attachments: [],
            contractAttachments: [],
            autoRenew: false,
            hasPartnerBroker: false,
            installments: 1,
            totalInstallments: 1
          } : undefined,
          property: property ? {
            id: property.id,
            propertyIdentifier: property.property_identifier,
            locationId: property.location_id,
            complement: property.complement,
            location: location?.name || "Carregando...",
            description: "",
            rooms: 0,
            bathrooms: 0,
            area: 0,
            value: 0,
            hasGarage: false,
            hasFurniture: false,
            acceptsPets: false,
            status: "unavailable",
            images: [],
            createdAt: "",
            address: "",
            features: []
          } : undefined,
          tenant: tenant ? {
            id: tenant.id,
            name: tenant.name,
            cpf: tenant.cpf,
            email: tenant.email,
            phone: tenant.phone,
            document: tenant.cpf || "",
            status: "active"
          } : undefined,
          propertyId: property?.id || "",
          tenantId: tenant?.id || "",
        } as any;

        // ✅ CORREÇÃO: um recebimento pago em mais de uma vez (parcial) ficava
        // sendo mostrado como 1 linha só, com o valor esperado do boleto
        // inteiro — perdendo o registro de cada pagamento e mostrando um
        // "valor esperado" que não bateu com nenhum dos pagamentos reais.
        // Expande em 1 linha por pagamento realmente feito (partial_payments),
        // usando o valor esperado que era válido NAQUELE momento (guardado em
        // cada entrada desde a correção do histórico), e mantém uma linha
        // extra para o saldo ainda em aberto quando o boleto não está 100% pago.
        const history = Array.isArray(payment.partial_payments) ? payment.partial_payments : [];
        if (history.length === 0) {
          return [base];
        }

        const totalExpectedBase = Math.abs(base.expectedAmount || 0);
        let cumulativePaid = 0;
        const rows = history.map((entry: any, index: number) => {
          const paidAmount = Number(entry.amount || 0);
          const expectedAmount = entry.expected_amount != null
            ? Math.abs(Number(entry.expected_amount))
            : Math.max(totalExpectedBase - cumulativePaid, Math.abs(paidAmount));
          cumulativePaid += Math.abs(paidAmount);

          return {
            ...base,
            _rowKey: `${base.id}-${index}`,
            // Valor esperado desse boleto como um todo (o mais atual, já
            // com multa/juros do último pagamento) — usado para somar os
            // totais 1 vez por boleto, não 1 vez por linha exibida.
            _billExpectedAmount: totalExpectedBase,
            paidAmount,
            expectedAmount,
            // ✅ Zerar breakdown/lateFee/interest nas linhas expandidas: a
            // função getExpectedAmount() re-soma esses campos a partir do
            // breakdown do boleto INTEIRO — como todas as linhas copiam o
            // mesmo breakdown da linha original, isso contava o valor
            // esperado várias vezes nos totais. Cada linha usa só seu
            // próprio `expectedAmount`, já calculado corretamente acima.
            breakdown: null,
            lateFee: 0,
            interest: 0,
            paymentDate: entry.payment_date || null,
            paymentTime: entry.payment_time || null,
            paymentMethod: entry.payment_method || null,
            attachments: Array.isArray(entry.attachments)
              ? entry.attachments.map((a: any) => (typeof a === "string" ? a : a?.url)).filter(Boolean)
              : [],
            status: "paid",
          };
        });

        const remaining = totalExpectedBase - cumulativePaid;
        if (base.status !== "paid" && remaining > 0.01) {
          rows.push({
            ...base,
            _rowKey: `${base.id}-remaining`,
            _billExpectedAmount: totalExpectedBase,
            paidAmount: 0,
            expectedAmount: remaining,
            breakdown: null,
            lateFee: 0,
            interest: 0,
            paymentDate: null,
            paymentTime: null,
            paymentMethod: null,
            attachments: [],
          });
        }

        return rows;
      }) as Payment[];

      // Buscar configurações, isenções e permissões
      const exemptionsQuery: any = supabase.from("admin_fee_exempt_locations").select("location_id");
      const managementFeeExemptionsQuery: any = supabase.from("management_fee_exempt_locations").select("location_id");
      const configQuery: any = supabase.from("configs").select("*").maybeSingle();
      
      // ✅ CORREÇÃO: Incluir location_id na query de despesas
      const expensesQuery: any = supabase
        .from("location_expenses")
        .select("id, amount, location_id, description, reference_month, reference_year")
        .eq("reference_month", filterMonth)
        .eq("reference_year", filterYear);

      const exemptionsResult: any = await exemptionsQuery;
      const managementFeeExemptionsResult: any = await managementFeeExemptionsQuery;
      const configResult: any = await configQuery;
      const expensesResult: any = await expensesQuery;

      // 🔥 FILTRO DE LOCALIZAÇÃO: Buscar permissões para usuários financeiros
      let allowedLocations: string[] = [];
      if (user?.role === "financial") {
        const permResult: any = await supabase
          .from("user_location_permissions")
          .select("location_id")
          .eq("user_id", user.id);
        allowedLocations = permResult.data?.map((p: any) => p.location_id) || [];
      }

      const exemptIds: string[] = exemptionsResult.data?.map((e: any) => e.location_id) || [];
      const managementFeeExemptIds: string[] = managementFeeExemptionsResult.data?.map((e: any) => e.location_id) || [];
      const configData: any = configResult.data;
      
      // ✅ CORREÇÃO: Armazenar array completo de despesas com location_id
      const expensesData = expensesResult.data || [];
      
      // Processar despesas com nome da localização
      const expensesWithLocationName = expensesData.map((expense: any) => ({
        id: expense.id,
        location_name: locationsMapTemp.get(expense.location_id) || "N/A",
        amount: expense.amount || 0,
        description: expense.description || "Sem descrição",
        reference_month: expense.reference_month,
        reference_year: expense.reference_year,
        location_id: expense.location_id
      }));

      setExemptLocationIds(exemptIds);
      setManagementFeeExemptLocationIds(managementFeeExemptIds);
      setConfig(configData);
      setLocationExpensesData(expensesData);
      setExpensesDetails(expensesWithLocationName);
      setAllowedLocationIds(allowedLocations);
      setLocationsMap(locationsMapTemp);

      // 🔥 APLICAR FILTRO DE LOCALIZAÇÃO NOS PAGAMENTOS
      let filteredPayments = formattedPayments;
      if (user?.role === "financial" && allowedLocations.length > 0) {
        filteredPayments = formattedPayments.filter(payment => {
          const locationId = payment.property?.locationId;
          return locationId && allowedLocations.includes(locationId);
        });
      }

      // Atualizar cache com dados já filtrados
      financialCache = {
        data: {
          payments: filteredPayments,
          locations: locationsMapTemp,
          exemptLocationIds: exemptIds,
          config: configData,
        },
        key: cacheKey,
        timestamp: now,
      };

      setPayments(filteredPayments);

    } catch (error: any) {
      // Ignorar erros de abort
      if (error?.name === 'AbortError') {
        return;
      }
      
      console.error("❌ Error loading financial data:", error);
      showAlert({
        title: "Erro",
        description: "Não foi possível carregar os dados financeiros.",
        type: "error",
      });
    } finally {
      loadingRef.current = false;
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Filtrar pagamentos por localização selecionada
  const locationFilteredPayments = useMemo(() => {
    if (selectedLocationIds.length === 0) {
      return payments;
    }
    return payments.filter(payment => 
      payment.property?.locationId && selectedLocationIds.includes(payment.property.locationId)
    );
  }, [payments, selectedLocationIds]);

  // Memoizar função de obter detalhes do pagamento
  const getPaymentDetails = useCallback((payment: Payment) => {
    const property = payment.property;
    const tenant = payment.tenant;
    const rental = payment.rental;

    return {
      local: property?.location || "N/A",
      complemento: property?.complement || "N/A",
      tenantName: tenant?.name || "N/A",
      rental: rental,
      pixCode: payment.pixCode || "",
      paymentTime: payment.paymentTime || "",
    };
  }, []);

  // Memoizar cálculo de número de parcela
  const calculatePaymentNumber = useCallback((payment: Payment, rental: Rental | undefined) => {
    const rentalData = rental || payment.rental;
    
    // PRIORIDADE 1: Usar valores do banco se existirem
    if (payment.installment && payment.totalInstallments) {
      return `${payment.installment}/${payment.totalInstallments}`;
    }
    
    // PRIORIDADE 2: Calcular apenas se não existir no banco
    if (!rentalData || !rentalData.startDate || !rentalData.endDate) {
      return "N/A";
    }
    
    try {
      const contractStartDate = new Date(rentalData.startDate + "T00:00:00");
      const contractEndDate = new Date(rentalData.endDate + "T00:00:00");
      const totalMonths = differenceInMonths(contractEndDate, contractStartDate);
      
      const referenceDate = new Date(payment.referenceYear || 0, (payment.referenceMonth || 1) - 1, 1);
      const currentPaymentNumber = differenceInMonths(referenceDate, contractStartDate) + 1;
      
      if (isNaN(currentPaymentNumber) || isNaN(totalMonths)) {
        return "N/A";
      }
      
      return `${currentPaymentNumber}/${totalMonths}`;
    } catch (error) {
      return "N/A";
    }
  }, []);

  // Função para calcular valor esperado total (breakdown + late_fee + interest)
  const getExpectedAmount = useCallback((payment: Payment): number => {
    let baseTotal = 0;
    
    // Somar items do breakdown (aluguel, garagem, etc.)
    if (payment.breakdown) {
      try {
        const breakdownData = typeof payment.breakdown === 'string' 
          ? JSON.parse(payment.breakdown) 
          : payment.breakdown;

        if (Array.isArray(breakdownData) && breakdownData.length > 0) {
          baseTotal = breakdownData.reduce((sum: number, item: any) => {
            const value = Number(item.value || item.amount || 0);
            return sum + value;
          }, 0);
        }
      } catch (error) {
        console.error("Erro ao processar breakdown:", error);
        baseTotal = payment.expectedAmount;
      }
    } else {
      // Se não houver breakdown, usar expected_amount como base
      baseTotal = payment.expectedAmount;
    }
    
    // Adicionar late_fee e interest (que estão em campos separados)
    const lateFee = Number(payment.lateFee || 0);
    const interest = Number(payment.interest || 0);
    
    const total = baseTotal + lateFee + interest;
    
    return total;
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortField(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField, sortDirection]);

  const handleExpenseSort = useCallback((field: ExpenseSortField) => {
    if (expenseSortField === field) {
      if (expenseSortDirection === "asc") {
        setExpenseSortDirection("desc");
      } else if (expenseSortDirection === "desc") {
        setExpenseSortDirection(null);
        setExpenseSortField(null);
      } else {
        setExpenseSortDirection("asc");
      }
    } else {
      setExpenseSortField(field);
      setExpenseSortDirection("asc");
    }
  }, [expenseSortField, expenseSortDirection]);

  const ExpenseSortIcon = ({ field }: { field: ExpenseSortField }) => {
    if (expenseSortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 text-slate-400" />;
    if (expenseSortDirection === "asc") return <ArrowUp className="h-4 w-4 ml-1 text-blue-600" />;
    return <ArrowDown className="h-4 w-4 ml-1 text-blue-600" />;
  };

  // Memoizar pagamentos ordenados COM FILTRO DE LOCALIZAÇÃO
  const getSortedPayments = useMemo(() => {
    const filtered = payments.filter(p => {
      if (selectedLocationIds.length > 0) {
        const locationId = p.property?.locationId;
        if (!locationId || !selectedLocationIds.includes(locationId)) return false;
      }
      return true;
    });

    // Aplicar ordenação se houver um campo selecionado
    if (sortField) {
      filtered.sort((a, b) => {
        let aVal: any = "";
        let bVal: any = "";

        switch (sortField) {
          case "parc":
            aVal = a.installment || 0;
            bVal = b.installment || 0;
            break;
          case "local":
            aVal = (a.property?.location || "").toLowerCase();
            bVal = (b.property?.location || "").toLowerCase();
            break;
          case "complement":
            aVal = (a.property?.complement || "").toLowerCase();
            bVal = (b.property?.complement || "").toLowerCase();
            break;
          case "tenant":
            aVal = (a.tenant?.name || "").toLowerCase();
            bVal = (b.tenant?.name || "").toLowerCase();
            break;
          case "period":
            aVal = `${a.referenceYear}-${String(a.referenceMonth).padStart(2, "0")}`;
            bVal = `${b.referenceYear}-${String(b.referenceMonth).padStart(2, "0")}`;
            break;
          case "status":
            aVal = a.status;
            bVal = b.status;
            break;
          case "dueDate":
            aVal = a.dueDate || "";
            bVal = b.dueDate || "";
            break;
          case "paymentDate":
            aVal = a.paymentDate || "";
            bVal = b.paymentDate || "";
            break;
          case "expectedAmount":
            aVal = a.expectedAmount || 0;
            bVal = b.expectedAmount || 0;
            break;
          case "paidAmount":
            aVal = a.paidAmount || 0;
            bVal = b.paidAmount || 0;
            break;
        }

        if (typeof aVal === "string") {
          const comparison = aVal.localeCompare(bVal, 'pt-BR');
          return sortDirection === "asc" ? comparison : -comparison;
        } else {
          if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
          if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
          return 0;
        }
      });
    }

    return filtered;
  }, [payments, selectedLocationIds, sortField, sortDirection]);

  // ✅ Um boleto pago em mais de uma vez vira várias linhas (1 por pagamento).
  // Para a tabela mesclar (rowSpan) as colunas que são iguais nas duas linhas
  // (Local/Compl/Inquilino/Parc/Período), as linhas do mesmo boleto precisam
  // ficar adjacentes — reagrupa preservando a ordem de 1ª aparição, porque
  // ordenar por uma coluna que DIFERE entre as parcelas (Rec, Hora, Val.Esp,
  // Val.Pg) poderia intercalar linhas de boletos diferentes.
  const displayPayments = useMemo(() => {
    const groups = new Map<string, any[]>();
    const order: string[] = [];
    getSortedPayments.forEach((p: any) => {
      if (!groups.has(p.id)) {
        groups.set(p.id, []);
        order.push(p.id);
      }
      groups.get(p.id)!.push(p);
    });
    return order.flatMap((id) => groups.get(id)!);
  }, [getSortedPayments]);

  const rowSpanCounts = useMemo(() => {
    const counts = new Map<string, number>();
    displayPayments.forEach((p: any) => {
      counts.set(p.id, (counts.get(p.id) || 0) + 1);
    });
    return counts;
  }, [displayPayments]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 text-slate-400" />;
    if (sortDirection === "asc") return <ArrowUp className="h-4 w-4 ml-1 text-blue-600" />;
    return <ArrowDown className="h-4 w-4 ml-1 text-blue-600" />;
  };

  const handlePrint = useCallback(async () => {
    try {
      if (getSortedPayments.length === 0) {
        showAlert({
          title: "Aviso",
          description: "Não há dados para imprimir.",
          type: "error",
        });
        return;
      }

      // Disparar impressão nativa do navegador
      window.print();

    } catch (error) {
      console.error("❌ [handlePrint] Erro ao imprimir:", error);
      showAlert({
        title: "Erro",
        description: "Não foi possível iniciar a impressão. Veja o console para detalhes.",
        type: "error",
      });
    }
  }, [getSortedPayments, showAlert]);

  const handleExportExpenses = () => {
    if (!filteredExpensesDetails || filteredExpensesDetails.length === 0) {
      showAlert({
        title: "Erro ao exportar",
        description: "Não há dados para exportar.",
        type: "error",
      });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(
      filteredExpensesDetails.map((expense) => ({
        Local: expense.location_name,
        Descrição: expense.description || "-",
        Valor: expense.amount,
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Despesas");

    XLSX.writeFile(wb, `despesas_${selectedMonth}_${selectedYear}.xlsx`);

    showAlert({
      title: "Exportado com sucesso!",
      description: "O arquivo foi baixado.",
      type: "success",
    });
  };

  const handleShowExpenses = async (locationIds: string[]) => {
    try {
      // Buscar despesas da localização e mês selecionados
      let query = supabase
        .from("location_expenses")
        .select(`
          *,
          location:locations(name)
        `)
        .eq("reference_month", selectedMonth)
        .eq("reference_year", selectedYear);

      // Se nenhum local selecionado
      if (locationIds.length === 0) {
        if (isFinancial && allowedLocationIds.length > 0) {
          // Para usuários financeiros, filtrar pelos locais permitidos
          query = query.in("location_id", allowedLocationIds);
        }
        // Para admin/broker, busca todos
      } else {
        // Locais específicos selecionados
        query = query.in("location_id", locationIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      const expenses = (data || []).map((exp) => ({
        id: exp.id,
        location_name: exp.location?.name || "Desconhecido",
        description: exp.description || "",
        amount: exp.amount || 0,
      }));

      if (expenses.length === 0) {
        showAlert({
          title: "Sem despesas",
          description: "Não há despesas cadastradas para este período.",
          type: "info",
        });
        return;
      }

      const locationName = locationIds.length === 0 ? "Todos os Locais" : 
                          locationIds.length === 1 ? (expenses[0]?.location_name || "Local") :
                          `${locationIds.length} Locais`;
      const monthName = months[selectedMonth - 1];
      const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);

      // Criar conteúdo HTML para o pop-up
      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Detalhamento das Contas do Mês</title>
            <style>
              @page {
                size: portrait;
                margin: 15mm;
              }
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
              }
              h1 {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 8px;
              }
              .subtitle {
                font-size: 14px;
                color: #666;
                margin-bottom: 16px;
              }
              .period {
                font-size: 16px;
                font-weight: 600;
              }
              .period-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                gap: 20px;
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
                font-size: 16px;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 10px 8px;
                word-wrap: break-word;
              }
              th {
                background-color: #f0f0f0;
                font-weight: bold;
                text-align: left;
                cursor: pointer;
                user-select: none;
              }
              th:hover {
                background-color: #e5e5e5;
              }
              th.sortable::after {
                content: ' ⇅';
                opacity: 0.5;
              }
              th.sorted-asc::after {
                content: ' ↑';
                opacity: 1;
              }
              th.sorted-desc::after {
                content: ' ↓';
                opacity: 1;
              }
              .text-right {
                text-align: right;
              }
              .value-cell {
                color: #15803d;
                font-weight: bold;
              }
              .total-row {
                font-weight: bold;
                background-color: #f9f9f9;
              }
              .total-value {
                color: #15803d;
                font-weight: bold;
                font-size: 18px;
              }
              @media print {
                body {
                  padding: 0;
                }
                button {
                  display: none !important;
                }
                th {
                  cursor: default;
                }
                th.sortable::after,
                th.sorted-asc::after,
                th.sorted-desc::after {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <h1>Detalhamento das Contas do Mês - ${locationName}</h1>
            <div class="subtitle">Controle de despesas mensais por localização</div>
            
            <div class="period-row">
              <div class="period">Período: ${monthName}/${selectedYear}</div>
              
              <button onclick="window.print()" class="print-button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Imprimir
              </button>
            </div>

            <table id="expensesTable">
              <thead>
                <tr>
                  <th class="sortable" onclick="sortTable(0)" style="width: 25%;">Local</th>
                  <th class="sortable" onclick="sortTable(1)" style="width: 50%;">Descrição</th>
                  <th class="sortable text-right" onclick="sortTable(2)" style="width: 25%;">Valor</th>
                </tr>
              </thead>
              <tbody id="tableBody">
                ${expenses.map(expense => `
                  <tr>
                    <td>${expense.location_name}</td>
                    <td>${expense.description || "-"}</td>
                    <td class="text-right value-cell">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expense.amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="2" class="text-right">Total de Contas (${monthName}/${selectedYear}):</td>
                  <td class="text-right total-value">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</td>
                </tr>
              </tfoot>
            </table>

            <script>
              let currentSort = { column: -1, direction: 'asc' };

              function sortTable(columnIndex) {
                const table = document.getElementById('expensesTable');
                const tbody = document.getElementById('tableBody');
                const rows = Array.from(tbody.rows);
                
                // Toggle direction
                if (currentSort.column === columnIndex) {
                  currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                  currentSort.column = columnIndex;
                  currentSort.direction = 'asc';
                }
                
                // Sort rows
                rows.sort((a, b) => {
                  let aVal = a.cells[columnIndex].textContent.trim();
                  let bVal = b.cells[columnIndex].textContent.trim();
                  
                  // Para valores monetários (coluna 2)
                  if (columnIndex === 2) {
                    aVal = parseFloat(aVal.replace(/[^0-9,-]/g, '').replace(',', '.'));
                    bVal = parseFloat(bVal.replace(/[^0-9,-]/g, '').replace(',', '.'));
                    return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
                  }
                  
                  // Para texto (colunas 0 e 1)
                  const comparison = aVal.localeCompare(bVal, 'pt-BR');
                  return currentSort.direction === 'asc' ? comparison : -comparison;
                });
                
                // Clear tbody and re-append sorted rows
                tbody.innerHTML = '';
                rows.forEach(row => tbody.appendChild(row));
                
                // Update header classes
                const headers = table.querySelectorAll('th.sortable');
                headers.forEach((header, index) => {
                  header.classList.remove('sorted-asc', 'sorted-desc');
                  if (index === columnIndex) {
                    header.classList.add(currentSort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
                  }
                });
              }
            </script>
          </body>
        </html>
      `;

      // Abrir pop-up
      const printWindow = window.open("", "_blank", "width=900,height=800");
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
      }
    } catch (error) {
      console.error("Erro ao abrir despesas:", error);
      showAlert({
        title: "Erro ao abrir despesas",
        description: "Ocorreu um erro ao carregar os dados.",
        type: "error",
      });
    }
  };
  
  const handleEditPixCode = async (paymentId: string, pixCode: string) => {
    try {
      // ✅ CORREÇÃO: Salvar na tabela payments, não rentals
      const { error } = await supabase
        .from("payments")
        .update({ pix_code: pixCode })
        .eq("id", paymentId);

      if (error) throw error;

      showAlert({
        title: "Sucesso",
        description: "Código PIX atualizado com sucesso!",
        type: "success",
      });

      // ✅ Atualizar estado local corretamente
      setPayments(prevPayments =>
        prevPayments.map(p => {
          if (p.id === paymentId) {
            return {
              ...p,
              pixCode: pixCode
            };
          }
          return p;
        })
      );
      
      setEditingPixCode(null);
      
      // Invalidar cache para garantir dados atualizados
      financialCache = { data: null, key: "", timestamp: 0 };
      
    } catch (error) {
      console.error("Erro ao atualizar código PIX:", error);
      showAlert({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível atualizar o código PIX.",
        type: "error",
      });
    }
  };

  const handleStartPixEdit = (payment: Payment) => {
    setEditingPixCell({ id: payment.id });
    setEditingPixValue(payment.pixCode || "");
  };

  const handleSavePixEdit = async () => {
    if (!editingPixCell) return;

    try {
      const { error } = await supabase
        .from("payments")
        .update({ pix_code: editingPixValue })
        .eq("id", editingPixCell.id);

      if (error) throw error;

      // Atualizar estado local
      setPayments(prevPayments =>
        prevPayments.map(p =>
          p.id === editingPixCell.id
            ? { ...p, pixCode: editingPixValue }
            : p
        )
      );

      showAlert({
        title: "Código PIX atualizado",
        description: "O código foi atualizado com sucesso.",
        type: "success",
      });

      setEditingPixCell(null);
      setEditingPixValue("");

      // Invalidar cache
      financialCache = { data: null, key: "", timestamp: 0 };
    } catch (error) {
      console.error("Erro ao atualizar código PIX:", error);
      showAlert({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
        type: "error",
      });
    }
  };

  const handleCancelPixEdit = () => {
    setEditingPixCell(null);
    setEditingPixValue("");
  };

  const handleExport = useCallback(() => {
    const sortedPayments = getSortedPayments;
    const monthName = format(new Date(filterYear, filterMonth - 1), "MMMM", { locale: ptBR });

    const excelData = sortedPayments.map(payment => {
      const details = getPaymentDetails(payment);
      const paymentNumber = calculatePaymentNumber(payment, details.rental);
      
      return {
        "Parcela": paymentNumber,
        "Local": details.local,
        "Complemento": details.complemento,
        "Inquilino": details.tenantName,
        "Período": format(new Date(filterYear, filterMonth - 1), "MMM/yyyy", { locale: ptBR }),
        "Status": payment.status === "paid" ? "Pago" : 
                 payment.status === "pending" ? "Pendente" :
                 payment.status === "overdue" ? "Atrasado" : "Parcial",
        "Data Vencimento": format(new Date(payment.dueDate + "T00:00:00"), "dd/MM/yyyy"),
        "Data Recebida": payment.paymentDate ? format(new Date(payment.paymentDate + "T00:00:00"), "dd/MM/yyyy") : "-",
        "Horário Recebido": details.paymentTime || "-",
        "Valor Esperado": getExpectedAmount(payment),
        "Valor Pago": payment.paidAmount || 0,
        "Código PIX": details.pixCode || "-",
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    
    ws["!cols"] = [
      { wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, 
      { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
      { wch: 15 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${monthName} ${filterYear}`);
    XLSX.writeFile(wb, `Financeiro_${monthName}_${filterYear}.xlsx`);

    showAlert({
      title: "Sucesso!",
      description: "Planilha exportada com sucesso.",
      type: "success",
    });
  }, [getSortedPayments, filterMonth, filterYear, getPaymentDetails, calculatePaymentNumber, getExpectedAmount, showAlert]);

  // KPI Calculations (MEMOIZADOS COM FILTRO DE LOCALIZAÇÃO!)
  const kpiCalculations = useMemo(() => {
    /**
     * ⚠️ O Recebimento de Rescisão fica DE FORA de todo cálculo daqui (#49).
     *
     * Ele guarda devolução de caução, despesas adicionais e desconto. Caução
     * é dinheiro do inquilino em custódia, não é receita da imobiliária —
     * então não pode entrar na base das taxas de administração (5%) e
     * gerenciamento (3%), nem nos totais de recebido/esperado.
     *
     * Antes da #49 esses valores vinham grudados no recebimento do aluguel,
     * e era exatamente isso que distorcia as taxas.
     *
     * `payment_kind` só existe a partir da migração 20260824120000; os
     * recebimentos antigos vêm com 'rent' pelo default da coluna. As
     * rescisões antigas continuam contaminadas até a migração de dados
     * (issue #51) — o relatório da #50 é que vai medir o tamanho disso.
     */
    const paymentsToCalculate = locationFilteredPayments.filter(
      (p: any) => p.payment_kind !== "termination"
    );
    
    // ✅ CORREÇÃO: Filtrar despesas considerando permissões do usuário financeiro
    let filteredExpenses = locationExpensesData;
    
    if (selectedLocationIds.length === 0) {
      // Quando nenhum local selecionado, para financeiros filtrar pelos permitidos
      if (isFinancial && allowedLocationIds.length > 0) {
        filteredExpenses = locationExpensesData.filter(expense => 
          allowedLocationIds.includes(expense.location_id)
        );
      }
      // Para admin/broker, usa todos
    } else {
      // Locais específicos selecionados
      filteredExpenses = locationExpensesData.filter(expense => 
        selectedLocationIds.includes(expense.location_id)
      );
    }
    
    const totalLocationExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    // ✅ CORREÇÃO: um boleto pago em várias parcelas vira várias linhas na
    // lista (ver formattedPayments), mas o "valor esperado" é do BOLETO,
    // não de cada linha — soma só 1 vez por boleto (id real), senão o
    // total ficava maior do que o valor de fato devido.
    const seenExpectedIds = new Set<string>();
    const totalExpected = paymentsToCalculate.reduce((sum, p: any) => {
      if (seenExpectedIds.has(p.id)) return sum;
      seenExpectedIds.add(p.id);
      return sum + (p._billExpectedAmount != null ? p._billExpectedAmount : getExpectedAmount(p));
    }, 0);
    
    const totalReceived = paymentsToCalculate
      .filter((p) => p.status === "paid" || p.status === "partial")
      .reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    
    const feePercentage = config?.admin_fee_percentage ?? 5;
    const feeRate = feePercentage / 100;
    
    // ✅ CORREÇÃO: Excluir valores negativos do cálculo de Taxa Adm
    const adminFee = paymentsToCalculate
      .filter((p) => (p.status === "paid" || p.status === "partial") && (p.paidAmount || 0) > 0)
      .reduce((sum, p) => {
        const property = p.property;
        const isExempt = property && exemptLocationIds.includes(property.locationId);
        const fee = isExempt ? 0 : ((p.paidAmount || 0) * feeRate);
        return sum + fee;
      }, 0);

    const mgmtPercentage = config?.management_fee_percentage ?? 3;
    const mgmtRate = mgmtPercentage / 100;
    
    // ✅ CORREÇÃO: Excluir valores negativos do cálculo de Taxa Ger
    const managementFee = paymentsToCalculate
      .filter((p) => (p.status === "paid" || p.status === "partial") && (p.paidAmount || 0) > 0)
      .reduce((sum, p) => {
        const property = p.property;
        const isManagementFeeExempt = property && managementFeeExemptLocationIds.includes(property.locationId);
        const fee = isManagementFeeExempt ? 0 : ((p.paidAmount || 0) * mgmtRate);
        return sum + fee;
      }, 0);

    const netRevenue = totalReceived - adminFee - managementFee - totalLocationExpenses;
    
    const totalPaid = paymentsToCalculate
      .filter(p => p.status === "paid" || p.status === "partial")
      .reduce((sum, p) => sum + (p.paidAmount || 0), 0);

    return {
      totalExpected,
      totalReceived,
      adminFee,
      managementFee,
      netRevenue,
      totalPaid,
      locationExpenses: totalLocationExpenses,
    };
  }, [locationFilteredPayments, config, exemptLocationIds, managementFeeExemptLocationIds, locationExpensesData, selectedLocationIds, getExpectedAmount, isFinancial, allowedLocationIds]);

  const filteredPayments = getSortedPayments;

  // Preparar lista de locais para o Select
  const locationOptions = useMemo(() => {
    let options = Array.from(locationsMap.entries()).map(([id, name]) => ({
      id,
      name
    }));
    
    // 🔥 FILTRO: Para usuários financeiros, mostrar apenas locais permitidos
    if (isFinancial && allowedLocationIds.length > 0) {
      options = options.filter(opt => allowedLocationIds.includes(opt.id));
    }
    
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [locationsMap, isFinancial, allowedLocationIds]);
  
  // Filtrar despesas detalhadas por localização
  const filteredExpensesDetails = useMemo(() => {
    let filtered = selectedLocationIds.includes("all") && selectedLocationIds.length === 1 
      ? expensesDetails 
      : expensesDetails.filter(expense => 
          locationsMap.get(expense.location_id) === locationsMap.get(selectedLocationIds[0])
        );
    
    // Aplicar ordenação
    if (expenseSortField && expenseSortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (expenseSortField) {
          case "location_name":
            aValue = a.location_name.toLowerCase();
            bValue = b.location_name.toLowerCase();
            break;
          case "description":
            aValue = (a.description || "").toLowerCase();
            bValue = (b.description || "").toLowerCase();
            break;
          case "amount":
            aValue = a.amount;
            bValue = b.amount;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return expenseSortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return expenseSortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    
    return filtered;
  }, [expensesDetails, selectedLocationIds, locationsMap, expenseSortField, expenseSortDirection]);

  if (!mounted) return null;

  const isLoading = loading;

  return (
    <Layout>
      {/* Adicionar estilos de impressão */}
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      
      <div id="financial-page" className="space-y-6">
        <ScrollReveal>
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-1">Financeiro</h1>
                <p className="text-sm text-muted-foreground">
                  Acompanhe receitas, despesas e comissões
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHelpOpen(true)}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </ScrollReveal>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
            <TabsList className="grid w-full max-w-md grid-cols-2 h-auto p-1">
              <TabsTrigger id="financial-tab-rentals" value="rentals" className="gap-2 text-xs sm:text-base py-3 px-4 sm:px-6">
                Locações
              </TabsTrigger>
              {(isAdmin || user?.role === "broker") && (
                <TabsTrigger id="financial-tab-deposits" value="deposits" className="gap-2 text-xs sm:text-base py-3 px-4 sm:px-6">
                  Cauções
                </TabsTrigger>
              )}
            </TabsList>

            {activeTab === "rentals" && (
              <PeriodSelector 
                selectedMonth={selectedMonth} 
                selectedYear={selectedYear}
                onMonthChange={(m) => setSelectedMonth(m === 'all' ? new Date().getMonth() + 1 : Number(m))}
                onYearChange={(y) => setSelectedYear(y === 'all' ? new Date().getFullYear() : Number(y))}
                onFilterMonthChange={(m) => setFilterMonth(m === 'all' ? new Date().getMonth() + 1 : Number(m))}
                onFilterYearChange={(y) => setFilterYear(y === 'all' ? new Date().getFullYear() : Number(y))}
                showAllOption={false}
              />
            )}
          </div>

          <TabsContent value="rentals" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            {/* Cards de Métricas - Locações */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 print-cards">
              {/* Card 1: AZUL - Receita Bruta */}
              <Card className="border-l-4 border-l-blue-500 card">
                <CardContent className="pt-6">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-blue-500 card-icon" />
                      <p className="text-sm font-medium text-muted-foreground card-title">Receita Bruta</p>
                    </div>
                    <h3 className="text-2xl font-bold text-blue-500 card-value">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(kpiCalculations.totalReceived)}
                    </h3>
                  </div>
                </CardContent>
              </Card>

              {/* Para perfil Financeiro: card único de Taxas */}
              {isFinancial ? (
                /* Card 2: LARANJA - Taxas (Financeiro) */
                <Card className="border-l-4 border-l-orange-500 card">
                  <CardContent className="pt-6">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <Percent className="h-5 w-5 text-orange-500 card-icon" />
                        <p className="text-sm font-medium text-muted-foreground card-title">Taxas</p>
                      </div>
                      <h3 className="text-2xl font-bold text-orange-500 card-value">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(kpiCalculations.adminFee + kpiCalculations.managementFee)}
                      </h3>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Card 2: LARANJA - Taxa Adm (Admin e Broker) */}
                  <Card className="border-l-4 border-l-orange-500 card">
                    <CardContent className="pt-6">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <Percent className="h-5 w-5 text-orange-500 card-icon" />
                          <p className="text-sm font-medium text-muted-foreground card-title">
                            Taxa Adm ({config?.admin_fee_percentage || 5}%)
                          </p>
                        </div>
                        <h3 className="text-2xl font-bold text-orange-500 card-value">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(kpiCalculations.adminFee)}
                        </h3>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 3: ROXA - Taxa Ger (Admin e Broker) */}
                  <Card className="border-l-4 border-l-purple-500 card">
                    <CardContent className="pt-6">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <Settings className="h-5 w-5 text-purple-500 card-icon" />
                          <p className="text-sm font-medium text-muted-foreground card-title">
                            Taxa Ger ({config?.management_fee_percentage || 3}%)
                          </p>
                        </div>
                        <h3 className="text-2xl font-bold text-purple-500 card-value">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(kpiCalculations.managementFee)}
                        </h3>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Card 4: VERMELHA - Contas do Mês */}
              <Card 
                id="financial-expenses-card" 
                className="border-l-4 border-l-red-500 card cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleShowExpenses(selectedLocationIds)}
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-red-500 card-icon" />
                      <p className="text-sm font-medium text-muted-foreground card-title">Contas do Mês</p>
                    </div>
                    <h3 className="text-2xl font-bold text-red-500 card-value">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(kpiCalculations.locationExpenses)}
                    </h3>
                  </div>
                </CardContent>
              </Card>

              {/* Card 5: VERDE - Receita Líquida */}
              <Card className="border-l-4 border-l-green-500 card">
                <CardContent className="pt-6">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="h-5 w-5 text-green-500 card-icon" />
                      <p className="text-sm font-medium text-muted-foreground card-title">Receita Líquida</p>
                    </div>
                    <h3 className="text-2xl font-bold text-green-500 card-value">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(kpiCalculations.netRevenue)}
                    </h3>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Pagamentos */}
            <Card className="overflow-hidden shadow-lg border-t-4 border-t-primary print-area">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 no-print">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle className="flex items-center text-base sm:text-lg print-title">
                    <FileText className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Detalhamento de Locações - {format(new Date(filterYear, filterMonth - 1), "MMMM yyyy", { locale: ptBR })}
                  </CardTitle>
                  <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="financial-location-filter"
                          variant="outline"
                          className="w-full sm:w-[200px] justify-between h-8 sm:h-9"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="truncate">
                              {selectedLocationIds.length === 0
                                ? "Todos os Locais"
                                : selectedLocationIds.length === 1
                                ? locationsMap.get(selectedLocationIds[0])
                                : `${selectedLocationIds.length} Locais`}
                            </span>
                          </div>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar local..." />
                          <CommandList>
                            <CommandEmpty>Nenhum local encontrado.</CommandEmpty>
                            <CommandGroup>
                              {/* Opção "Todos os Locais" */}
                              <CommandItem
                                onSelect={() => {
                                  setSelectedLocationIds([]);
                                }}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <Checkbox
                                    checked={selectedLocationIds.length === 0}
                                    onCheckedChange={(checked) => {
                                      setSelectedLocationIds([]);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span>Todos os Locais</span>
                                </div>
                              </CommandItem>
                              
                              {/* Lista de locais com checkboxes */}
                              {locationOptions.map(location => (
                                <CommandItem
                                  key={location.id}
                                  onSelect={() => {
                                    setSelectedLocationIds(prev => {
                                      if (prev.includes(location.id)) {
                                        return prev.filter(id => id !== location.id);
                                      } else {
                                        return [...prev, location.id];
                                      }
                                    });
                                  }}
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <Checkbox
                                      checked={selectedLocationIds.includes(location.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedLocationIds(prev => [...prev, location.id]);
                                        } else {
                                          setSelectedLocationIds(prev => prev.filter(id => id !== location.id));
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span>{location.name}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    
                    <Button
                      id="financial-print-button"
                      variant="outline"
                      size="sm"
                      onClick={handlePrint}
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Imprimir
                    </Button>
                    <Button
                      id="financial-export-button"
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Exportar Excel
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {/* Título para impressão */}
              <div className="hidden print:block print-title p-4">
                Detalhamento de Locações - {format(new Date(filterYear, filterMonth - 1), "MMMM yyyy", { locale: ptBR })}
                {selectedLocationIds.length === 1 && ` - ${locationsMap.get(selectedLocationIds[0])}`}
                {selectedLocationIds.length > 1 && ` - ${selectedLocationIds.length} Locais Selecionados`}
              </div>
              
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : getSortedPayments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Nenhum recebimento encontrado para {format(new Date(filterYear, filterMonth - 1), "MMMM yyyy", { locale: ptBR })}.
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <div className="inline-block min-w-full align-middle">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center w-[100px]">
                              <div className="flex items-center justify-center gap-1">
                                Local
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleSort("local")}
                                >
                                  {sortField === "local" ? (
                                    sortDirection === "asc" ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableHead>
                            <TableHead className="text-center w-[80px]">
                              <div className="flex items-center justify-center gap-1">
                                Compl
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleSort("complement")}
                                >
                                  {sortField === "complement" ? (
                                    sortDirection === "asc" ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableHead>
                            <TableHead className="text-center min-w-[150px]">
                              <div className="flex items-center justify-center gap-1">
                                Inquilino
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleSort("tenant")}
                                >
                                  {sortField === "tenant" ? (
                                    sortDirection === "asc" ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableHead>
                            <TableHead className="text-center w-[60px]">
                              <div className="flex items-center justify-center gap-1">
                                Parc
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleSort("parc")}
                                >
                                  {sortField === "parc" ? (
                                    sortDirection === "asc" ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableHead>
                            <TableHead className="text-center w-[90px]">
                              <div className="flex items-center justify-center gap-1">
                                Período
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleSort("period")}
                                >
                                  {sortField === "period" ? (
                                    sortDirection === "asc" ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableHead>
                            <TableHead className="text-center w-[90px]">
                              <div className="flex items-center justify-center gap-1">
                                Status
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleSort("status")}
                                >
                                  {sortField === "status" ? (
                                    sortDirection === "asc" ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableHead>
                            <TableHead className="text-center w-[90px]">
                              <div className="flex items-center justify-center gap-1">
                                Venc
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleSort("dueDate")}
                                >
                                  {sortField === "dueDate" ? (
                                    sortDirection === "asc" ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableHead>
                            <TableHead className="text-center w-[90px]">
                              <div className="flex items-center justify-center gap-1">
                                Rec
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleSort("paymentDate")}
                                >
                                  {sortField === "paymentDate" ? (
                                    sortDirection === "asc" ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableHead>
                            <TableHead className="text-center w-[80px]">Hora</TableHead>
                            <TableHead className="text-right w-[100px]">
                              <div className="flex items-center justify-end gap-1">
                                Val.Esp
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleSort("expectedAmount")}
                                >
                                  {sortField === "expectedAmount" ? (
                                    sortDirection === "asc" ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableHead>
                            <TableHead className="text-right w-[100px]">
                              <div className="flex items-center justify-end gap-1">
                                Val.Pg
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleSort("paidAmount")}
                                >
                                  {sortField === "paidAmount" ? (
                                    sortDirection === "asc" ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableHead>
                            <TableHead className="text-center w-[100px]">Código PIX</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayPayments.map((payment: any, rowIndex: number) => {
                            const isFirstOfGroup = rowIndex === 0 || displayPayments[rowIndex - 1].id !== payment.id;
                            const span = rowSpanCounts.get(payment.id) || 1;
                            return (
                              <TableRow key={payment._rowKey || payment.id} className="hover:bg-gray-50">
                                {/* Local — mesclado quando o boleto tem mais de 1 linha */}
                                {isFirstOfGroup && (
                                  <TableCell className="text-center text-xs" rowSpan={span}>
                                    {payment.property?.location || "N/A"}
                                  </TableCell>
                                )}

                                {/* Compl (Complemento) */}
                                {isFirstOfGroup && (
                                  <TableCell className="text-center text-xs" rowSpan={span}>
                                    {payment.property?.complement || "-"}
                                  </TableCell>
                                )}

                                {/* Inquilino */}
                                {isFirstOfGroup && (
                                  <TableCell className="text-left text-sm" rowSpan={span}>
                                    {payment.tenant?.name || "N/A"}
                                  </TableCell>
                                )}

                                {/* Parc (Parcela) - MOVIDA PARA CÁ */}
                                {isFirstOfGroup && (
                                  <TableCell className="text-center text-xs" rowSpan={span}>
                                    {payment.installment || 1}/{payment.totalInstallments || 24}
                                  </TableCell>
                                )}

                                {/* Período */}
                                {isFirstOfGroup && (
                                  <TableCell className="text-center text-xs" rowSpan={span}>
                                    {months[payment.referenceMonth - 1]}/{payment.referenceYear}
                                  </TableCell>
                                )}

                                {/* Status */}
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className={
                                      payment.status === "paid"
                                        ? "bg-green-100 text-green-700 border-green-300 text-xs"
                                        : payment.status === "overdue"
                                        ? "bg-red-100 text-red-700 border-red-300 text-xs"
                                        : payment.status === "partial"
                                        ? "bg-yellow-100 text-yellow-700 border-yellow-300 text-xs"
                                        : "bg-gray-100 text-gray-700 border-gray-300 text-xs"
                                    }
                                  >
                                    {payment.status === "paid"
                                      ? "Pago"
                                      : payment.status === "overdue"
                                      ? "Atrasado"
                                      : payment.status === "partial"
                                      ? "Parcial"
                                      : "Pendente"}
                                  </Badge>
                                </TableCell>
                                
                                {/* Venc (Vencimento) */}
                                <TableCell className="text-center text-xs">
                                  {payment.dueDate
                                    ? new Date(payment.dueDate + "T00:00:00").toLocaleDateString("pt-BR")
                                    : "-"}
                                </TableCell>
                                
                                {/* Rec (Data Recebimento) */}
                                <TableCell className="text-center text-xs">
                                  {payment.paymentDate
                                    ? new Date(payment.paymentDate + "T00:00:00").toLocaleDateString("pt-BR")
                                    : "-"}
                                </TableCell>
                                
                                {/* Hora (Hora do Pagamento) */}
                                <TableCell className="text-center text-xs">
                                  {payment.paymentTime || "-"}
                                </TableCell>
                                
                                {/* Val.Esp (Valor Esperado) */}
                                <TableCell className="text-right text-xs">
                                  {formatCurrency(payment.expectedAmount)}
                                </TableCell>
                                
                                {/* Val.Pg (Valor Pago) */}
                                <TableCell className={`text-right text-xs font-semibold ${
                                  (payment.paidAmount || 0) < 0 ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {formatCurrency(payment.paidAmount || 0)}
                                </TableCell>
                                
                                {/* Código PIX */}
                                <TableCell className="text-center text-xs">
                                  {editingPixCell?.id === payment.id ? (
                                    <Input
                                      type="text"
                                      className="w-full h-8 text-center text-xs border-blue-500"
                                      value={editingPixValue}
                                      onChange={(e) => setEditingPixValue(e.target.value)}
                                      onBlur={handleSavePixEdit}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSavePixEdit();
                                        if (e.key === "Escape") handleCancelPixEdit();
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded block text-center"
                                      onClick={() => handleStartPixEdit(payment)}
                                    >
                                      {payment.pixCode || "-"}
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          
                          {/* Linha de Totais */}
                          <TableRow className="bg-muted font-bold border-t-2 border-primary">
                            <TableCell colSpan={9} className="text-right text-sm print:text-[9px]">
                              TOTAIS:
                            </TableCell>
                            <TableCell className="text-right text-sm print:text-[9px] text-blue-600">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format((() => {
                                // ✅ mesmo boleto pode aparecer em várias linhas (1 por
                                // pagamento parcial) — soma o valor esperado 1x por boleto
                                const seen = new Set<string>();
                                return getSortedPayments.reduce((sum: number, p: any) => {
                                  if (seen.has(p.id)) return sum;
                                  seen.add(p.id);
                                  return sum + (p._billExpectedAmount != null ? p._billExpectedAmount : getExpectedAmount(p));
                                }, 0);
                              })())}
                            </TableCell>
                            <TableCell className="text-right text-sm print:text-[9px] text-green-600 font-semibold">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(getSortedPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0))}
                            </TableCell>
                            <TableCell className="text-sm print:text-[9px]"></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {(isAdmin || user?.role === "broker") && (
            <TabsContent value="deposits" className="space-y-6 mt-6">
              <div className="overflow-x-auto w-full">
                <DepositInstallmentsTable 
                  userRole={user?.role || "user"}
                  allowedLocationIds={allowedLocationIds}
                />
              </div>
            </TabsContent>
          )}
        </Tabs>

        <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} page="financial" />
      </div>
    </Layout>
  );
}