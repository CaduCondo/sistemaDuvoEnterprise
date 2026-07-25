import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import { Layout } from "@/components/Layout";
import { OverviewCards } from "@/components/dashboard/OverviewCards";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";
import { useRouter } from "next/router";
import { motion } from "framer-motion";

// Lazy load dos gráficos (não bloqueiam o carregamento inicial)
const FinancialCharts = dynamic(
  () => import("@/components/dashboard/FinancialCharts").then(mod => ({ default: mod.FinancialCharts })),
  {
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    ),
    ssr: false
  }
);

// Skeleton para os cards
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {[...Array(15)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const {
    metrics,
    topProperties,
    upcomingPayments,
    recentActivities,
    chartData,
    isLoading
  } = useDashboardData();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const handlePeriodChange = useCallback((month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  }, []);

  const userName = useMemo(() => 
    user?.name || user?.email?.split('@')[0] || "Usuário",
    [user]
  );

  // Calcular dados para os cards (agora muito mais rápido - apenas cálculos simples)
  const overviewData = useMemo(() => {
    const totalProperties = metrics.totalProperties;
    const occupiedProperties = metrics.occupiedProperties;
    const occupancyRate = totalProperties > 0 ? (occupiedProperties / totalProperties) * 100 : 0;

    // Receita Bruta Recebida = soma dos valores pagos
    const grossRevenue = metrics.grossRevenue;
    
    // Total Taxas e Contas = Taxa Admin + Taxa Gerenciamento + Contas do Local
    const totalFeesAndExpenses = metrics.adminFees + metrics.managementFees + metrics.locationExpenses;
    
    // Receita Líquida = Receita Bruta - (Taxas + Contas)
    const netRevenue = grossRevenue - totalFeesAndExpenses;

    return {
      totalProperties: metrics.totalProperties,
      availableProperties: metrics.availableProperties,
      unavailableProperties: metrics.unavailableProperties,
      occupancyRate,
      totalTenants: metrics.totalTenants,
      activeContracts: metrics.activeContracts,
      expiringContracts: metrics.expiringContracts,
      overduePayments: metrics.overduePayments,
      overdueAmount: metrics.overdueAmount,
      dueTodayPayments: metrics.dueTodayPayments,
      completedPayments: metrics.completedPayments,
      expectedAmount: metrics.expectedAmount,
      totalRevenue: grossRevenue,
      grossRevenue: grossRevenue,
      totalFeesAndExpenses,
      netRevenue,
      pendingPayments: metrics.pendingPayments,
    };
  }, [metrics]);

  return (
    <Layout>
      <Head>
        <title>Painel de Gestão - D&apos;Uvo Enterprise</title>
      </Head>
      <div id="dashboard-page" className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral do seu portfólio de locações
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <WelcomeCard userName={user?.name || "Usuário"} />
        </motion.div>

        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <OverviewCards 
              data={overviewData} 
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onPeriodChange={handlePeriodChange}
              userRole={user?.role}
            />

            {/* Gráficos carregam depois (lazy) */}
            <FinancialCharts
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              userId={user?.id}
              userRole={user?.role}
            />
          </>
        )}
      </div>
    </Layout>
  );
}