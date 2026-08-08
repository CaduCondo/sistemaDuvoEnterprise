import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculateContractAlert } from "@/lib/contractAlerts";

interface DashboardCounts {
  totalProperties: number;
  availableProperties: number;
  unavailableProperties: number;
  occupiedProperties: number;
  totalTenants: number;
  activeContracts: number;
  expiringContracts: number;
  overduePayments: number;
  overdueAmount: number;
  dueTodayPayments: number;
  completedPayments: number;
  expectedAmount: number;
  grossRevenue: number;
  locationExpenses: number;
  pendingPayments: number;
  adminFees: number;
  managementFees: number;
}

interface DashboardData {
  loading: boolean;
  counts: DashboardCounts;
  exemptLocationIds: string[];
}

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 segundos durante debug

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Limpar cache ao carregar o módulo (força reload)
cache.clear();

export function useDashboardData(
  month: number,
  year: number,
  userId: string | undefined,
  userRole: string | undefined
): DashboardData {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<DashboardCounts>({
    totalProperties: 0,
    availableProperties: 0,
    unavailableProperties: 0,
    occupiedProperties: 0,
    totalTenants: 0,
    activeContracts: 0,
    expiringContracts: 0,
    overduePayments: 0,
    overdueAmount: 0,
    dueTodayPayments: 0,
    completedPayments: 0,
    expectedAmount: 0,
    grossRevenue: 0,
    locationExpenses: 0,
    pendingPayments: 0,
    adminFees: 0,
    managementFees: 0,
  });
  const [exemptLocationIds, setExemptLocationIds] = useState<string[]>([]);
  const [managementFeeExemptLocationIds, setManagementFeeExemptLocationIds] = useState<string[]>([]);

  const isFinancialUser = useMemo(() => userRole === "financial", [userRole]);
  const cacheKey = useMemo(
    () => `dashboard_${userId}_${month}_${year}_${userRole}`,
    [userId, month, year, userRole]
  );

  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      if (loadingRef.current && abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const cached = getCached<DashboardCounts>(cacheKey);
      if (cached) {
        setCounts(cached);
        setLoading(false);
        return;
      }

      try {
        loadingRef.current = true;
        setLoading(true);
        abortControllerRef.current = new AbortController();

        // 1. Buscar permissões de localização (se financeiro)
        let allowedLocations: string[] | null = null;
        if (isFinancialUser) {
          const { data: permData } = await supabase
            .from("user_location_permissions")
            .select("location_id")
            .eq("user_id", userId);
          
          if (abortControllerRef.current?.signal.aborted) {
            loadingRef.current = false;
            return;
          }
          
          allowedLocations = permData?.map(p => p.location_id) || [];
          
          if (allowedLocations.length === 0) {
            setCounts({
              totalProperties: 0,
              availableProperties: 0,
              unavailableProperties: 0,
              occupiedProperties: 0,
              totalTenants: 0,
              activeContracts: 0,
              expiringContracts: 0,
              overduePayments: 0,
              overdueAmount: 0,
              dueTodayPayments: 0,
              completedPayments: 0,
              expectedAmount: 0,
              grossRevenue: 0,
              locationExpenses: 0,
              pendingPayments: 0,
              adminFees: 0,
              managementFees: 0,
            });
            setLoading(false);
            loadingRef.current = false;
            return;
          }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        const twoMonthsFromNow = new Date(today);
        twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
        const twoMonthsStr = twoMonthsFromNow.toISOString().split('T')[0];

        // Buscar dados em paralelo
        const [
          exemptLocationsResult,
          managementFeeExemptLocationsResult,
          propertiesResult,
          tenantsResult,
          rentalsResult,
          financialPaymentsResult,
          currentMonthPaymentsResult,
          expensesResult,
          configResult,
        ] = await Promise.all([
          // Locais isentos de taxa admin
          supabase
            .from("admin_fee_exempt_locations")
            .select("location_id"),

          // Locais isentos de taxa de gerenciamento
          supabase
            .from("management_fee_exempt_locations")
            .select("location_id"),

          // Propriedades (com filtro de localização para financeiro)
          (async () => {
            let query = supabase
              .from("properties")
              .select("id, status, location_id");
            
            if (isFinancialUser && allowedLocations && allowedLocations.length > 0) {
              query = query.in("location_id", allowedLocations);
            }
            
            return query;
          })(),

          // Inquilinos (via locações com filtro de localização)
          (async () => {
            if (isFinancialUser && allowedLocations && allowedLocations.length > 0) {
              const { data: allowedRentals } = await supabase
                .from("rentals")
                .select("tenant_id, properties!inner(location_id)")
                .in("properties.location_id", allowedLocations)
                .eq("status", "active");
              
              const tenantIds = [...new Set(allowedRentals?.map(r => r.tenant_id) || [])];
              
              return supabase
                .from("tenants")
                .select("id")
                .in("id", tenantIds);
            } else {
              return supabase
                .from("tenants")
                .select("id");
            }
          })(),

          // Locações (com filtro de localização para financeiro)
          (async () => {
            let query = supabase
              .from("rentals")
              .select("id, status, end_date, properties!inner(location_id)");
            
            if (isFinancialUser && allowedLocations && allowedLocations.length > 0) {
              query = query.in("properties.location_id", allowedLocations);
            }
            
            return query;
          })(),

          // Pagamentos para Resumo Financeiro (DO MÊS SELECIONADO NO FILTRO)
          (async () => {
            let query = supabase
              .from("payments")
              .select(`
                id,
                status,
                due_date,
                expected_amount,
                paid_amount,
                rentals!inner(
                  id,
                  properties!inner(
                    location_id
                  )
                )
              `)
              .eq("reference_month", month.toString().padStart(2, '0'))
              .eq("reference_year", year.toString());
            
            if (isFinancialUser && allowedLocations && allowedLocations.length > 0) {
              query = query.in("rentals.properties.location_id", allowedLocations);
            }
            
            return query;
          })(),

          // Pagamentos para Contratos e Pagamentos (DO MÊS ATUAL - IGNORA FILTRO)
          (async () => {
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            
            let query = supabase
              .from("payments")
              .select(`
                id,
                status,
                due_date,
                expected_amount,
                paid_amount,
                rentals!inner(
                  id,
                  properties!inner(
                    location_id
                  )
                )
              `)
              .eq("reference_month", currentMonth.toString().padStart(2, '0'))
              .eq("reference_year", currentYear.toString());
            
            if (isFinancialUser && allowedLocations && allowedLocations.length > 0) {
              query = query.in("rentals.properties.location_id", allowedLocations);
            }
            
            return query;
          })(),

          // Despesas do mês (com filtro de localização)
          (async () => {
            let query = supabase
              .from("location_expenses")
              .select("amount, location_id")
              .eq("reference_month", month)
              .eq("reference_year", year);
            
            if (isFinancialUser && allowedLocations && allowedLocations.length > 0) {
              query = query.in("location_id", allowedLocations);
            }
            
            return query;
          })(),

          // Configurações
          supabase
            .from("configs")
            .select("*")
            .maybeSingle(),
        ]);

        if (abortControllerRef.current?.signal.aborted) {
          loadingRef.current = false;
          return;
        }

        // 3. Processar resultados
        const exemptIds = exemptLocationsResult.data?.map(e => e.location_id) || [];
        setExemptLocationIds(exemptIds);

        const managementFeeExemptIds = managementFeeExemptLocationsResult.data?.map(e => e.location_id) || [];
        setManagementFeeExemptLocationIds(managementFeeExemptIds);

        const config = configResult.data;
        const adminFeePercent = config?.admin_fee_percentage || 0;
        const managementFeePercent = config?.management_fee_percentage || 0;

        // Processar propriedades
        const properties = propertiesResult.data || [];
        const totalProperties = properties.length;
        const availableProperties = properties.filter(p => p.status === "available").length;
        const unavailableProperties = properties.filter(p => p.status === "unavailable").length;
        const occupiedProperties = properties.filter(p => p.status === "occupied").length;

        // Processar inquilinos
        const totalTenants = tenantsResult.data?.length || 0;

        // Processar locações
        const rentals = rentalsResult.data || [];
        const activeContracts = rentals.filter(r => r.status === "active").length;
        
        // Contratos a vencer nos próximos 60 dias (status=active E end_date dentro de 60 dias)
        const expiringContracts = rentals.filter(r => {
          if (r.status !== "active" || !r.end_date) return false;
          
          const endDate = new Date(r.end_date);
          const todayCheck = new Date();
          todayCheck.setHours(0, 0, 0, 0);
          
          if (endDate < todayCheck) return false;
          
          const alert = calculateContractAlert(r.end_date);
          return alert.level === "warning" || alert.level === "critical";
        }).length;

        // 🔥 PROCESSAR PAGAMENTOS DO MÊS ATUAL (para linha "Contratos e Pagamentos")
        const currentMonthPaymentsData = currentMonthPaymentsResult.data || [];
        let overduePayments = 0;
        let dueTodayPayments = 0;
        let completedPayments = 0;
        let pendingPayments = 0;

        currentMonthPaymentsData.forEach((payment: any) => {
          const dueDate = payment.due_date;
          const status = payment.status;
          
          if (status === 'paid') {
            completedPayments++;
          }
          
          if ((status === 'pending' || status === 'partial') && dueDate < todayStr) {
            overduePayments++;
            pendingPayments++;
          } 
          else if ((status === 'pending' || status === 'partial') && dueDate === todayStr) {
            dueTodayPayments++;
            pendingPayments++;
          }
          else if (status === 'pending' || status === 'partial') {
            pendingPayments++;
          }
        });

        // 🔥 PROCESSAR PAGAMENTOS DO MÊS DO FILTRO (para "Resumo Financeiro")
        const financialPaymentsData = financialPaymentsResult.data || [];
        
        let expectedAmount = 0;
        let grossRevenue = 0;
        let adminFees = 0;
        let managementFees = 0;
        let overdueAmount = 0;

        financialPaymentsData.forEach((payment: any) => {
          const dueDate = payment.due_date;
          const status = payment.status;
          const locationId = payment.rentals?.properties?.location_id;
          const paidAmount = payment.paid_amount || 0;
          const expectedAmountValue = payment.expected_amount || 0;
          
          expectedAmount += expectedAmountValue;
          
          if (status === 'paid' || status === 'partial') {
            grossRevenue += paidAmount;
            
            if (paidAmount > 0) {
              const isAdminFeeExempt = locationId && exemptIds.includes(locationId);
              const isManagementFeeExempt = locationId && managementFeeExemptIds.includes(locationId);
              
              if (!isAdminFeeExempt) {
                adminFees += paidAmount * (adminFeePercent / 100);
              }
              
              if (!isManagementFeeExempt) {
                managementFees += paidAmount * (managementFeePercent / 100);
              }
            }
          }
          
          if ((status === 'pending' || status === 'partial') && dueDate < todayStr) {
            overdueAmount += expectedAmountValue;
          }
        });

        // Processar despesas do mês
        const expensesData = expensesResult.data || [];
        const locationExpenses = expensesData.reduce(
          (sum: number, e: any) => sum + (Number(e.amount) || 0), 
          0
        );

        const newCounts: DashboardCounts = {
          totalProperties,
          availableProperties,
          unavailableProperties,
          occupiedProperties,
          totalTenants,
          activeContracts,
          expiringContracts,
          overduePayments,
          overdueAmount,
          dueTodayPayments,
          completedPayments,
          expectedAmount,
          grossRevenue,
          locationExpenses,
          pendingPayments,
          adminFees,
          managementFees,
        };

        setCache(cacheKey, newCounts);
        setCounts(newCounts);

      } catch (error: any) {
        if (error.name === 'AbortError') {
          return;
        }
        
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    };

    loadData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      loadingRef.current = false;
    };
  }, [month, year, userId, userRole, isFinancialUser, cacheKey]);

  return {
    loading,
    counts,
    exemptLocationIds,
  };
}