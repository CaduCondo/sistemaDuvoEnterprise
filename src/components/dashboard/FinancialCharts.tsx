import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface FinancialChartsProps {
  selectedMonth: number;
  selectedYear: number;
  userId?: string;
  userRole?: string;
}

const COLORS = {
  occupied: '#10b981',
  available: '#3b82f6',
  unavailable: '#ef4444',
  bruta: '#10b981',
  liquida: '#3b82f6',
  taxas: '#ef4444',
  contas: '#f59e0b'
};

export function FinancialCharts({ selectedMonth, selectedYear, userId, userRole }: FinancialChartsProps) {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any>(null);

  const isFinancialUser = useMemo(() => userRole === "financial", [userRole]);

  useEffect(() => {
    let isMounted = true;

    const loadChartData = async () => {
      if (!userId) {
        console.log("⚠️ [FinancialCharts] Sem userId, abortando");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log("🔍 [FinancialCharts] Iniciando carregamento de dados dos gráficos");
        console.log("📋 Parâmetros:", { selectedMonth, selectedYear, userId, userRole, isFinancialUser });

        // Buscar permissões se necessário
        let allowedLocations: string[] | null = null;
        if (isFinancialUser) {
          console.log("🔐 Usuário financial - buscando permissões de localização");
          const { data: permData, error: permError } = await supabase
            .from("user_location_permissions")
            .select("location_id")
            .eq("user_id", userId);
          
          if (permError) {
            console.error("❌ Erro ao buscar permissões:", permError);
            allowedLocations = [];
          } else {
            // Type assertion necessária para bypass do erro de tipo complexo do Supabase
            allowedLocations = (permData || []).map((p: any) => p.location_id);
          }
          
          console.log("📍 Localizações permitidas:", allowedLocations);
          
          if (allowedLocations.length === 0) {
            console.log("⚠️ Usuário financial sem permissões - retornando dados vazios");
            setChartData({
              monthlyRevenueData: [],
              monthlyExpensesData: [],
              occupancyPieData: [],
              contractsData: [],
              paymentsStatusData: [],
              occupancyTrendData: []
            });
            setLoading(false);
            return;
          }
        }

        // Gerar últimos 6 meses
        const months = [];
        const currentDate = new Date(selectedYear, selectedMonth - 1, 1);
        
        for (let i = 5; i >= 0; i--) {
          const date = new Date(currentDate);
          date.setMonth(date.getMonth() - i);
          months.push({
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
          });
        }
        console.log("📅 Meses para gráficos:", months);

        // Buscar dados agregados
        console.log("🔍 Buscando contagens de propriedades...");
        const propertiesResult = await (async () => {
          const buildQuery = (status: string) => {
            let query = supabase
              .from("properties")
              .select("id", { count: "exact", head: true })
              .eq("status", status);

            if (isFinancialUser && allowedLocations && allowedLocations.length > 0) {
              query = query.in("location_id", allowedLocations);
            }

            return query;
          };

          const [available, occupied, unavailable] = await Promise.all([
            buildQuery("available"),
            buildQuery("occupied"),
            buildQuery("unavailable")
          ]);

          console.log("📊 Contagens de propriedades:", {
            available: available.count,
            occupied: occupied.count,
            unavailable: unavailable.count
          });

          return {
            available: available.count || 0,
            occupied: occupied.count || 0,
            unavailable: unavailable.count || 0
          };
        })();

        // Buscar contratos ativos e vencendo
        console.log("🔍 Buscando dados de contratos...");
        const contractsResult = await (async () => {
          const today = new Date();
          const next30Days = new Date();
          next30Days.setDate(today.getDate() + 30);

          let activeQuery = supabase
            .from("rentals")
            .select("id", { count: "exact", head: true })
            .eq("status", "active");

          let expiringQuery = supabase
            .from("rentals")
            .select("id", { count: "exact", head: true })
            .eq("status", "active")
            .gte("end_date", today.toISOString().split('T')[0])
            .lte("end_date", next30Days.toISOString().split('T')[0]);

          if (isFinancialUser && allowedLocations && allowedLocations.length > 0) {
            const propertiesInLocations = await supabase.from("properties").select("id").in("location_id", allowedLocations);
            
            if (propertiesInLocations.error) {
              console.error("❌ Erro ao buscar propriedades:", propertiesInLocations.error);
            } else if (propertiesInLocations.data) {
              const propertyIds = propertiesInLocations.data.map((p: any) => p.id);
              activeQuery = activeQuery.in("property_id", propertyIds);
              expiringQuery = expiringQuery.in("property_id", propertyIds);
            }
          }

          const [active, expiring] = await Promise.all([activeQuery, expiringQuery]);

          return {
            active: active.count || 0,
            expiring: expiring.count || 0
          };
        })();

        console.log("📊 Contratos:", contractsResult);

        console.log("🔍 Buscando pagamentos dos últimos 6 meses...");
        const paymentsResult = await (async () => {
          const monthsData = months.map(m => ({
            month: m.month.toString().padStart(2, '0'),
            year: m.year.toString()
          }));

          const promises = monthsData.map(async ({ month, year }) => {
            // Buscar TODOS os pagamentos (não só paid) para mostrar receita esperada
            let queryAll = supabase
              .from("payments")
              .select("expected_amount, paid_amount, status, payment_kind, rental:rentals!inner(properties!inner(location_id))")
              .eq("reference_month", month)
              .eq("reference_year", year);

            let queryPaid = supabase
              .from("payments")
              .select("paid_amount, status, payment_kind, rental:rentals!inner(properties!inner(location_id))")
              .eq("status", "paid")
              .eq("reference_month", month)
              .eq("reference_year", year);

            if (isFinancialUser && allowedLocations && allowedLocations.length > 0) {
              queryAll = queryAll.in("rental.properties.location_id", allowedLocations);
              queryPaid = queryPaid.in("rental.properties.location_id", allowedLocations);
            }

            const [allPayments, paidPayments] = await Promise.all([queryAll, queryPaid]);

            // #120: Recebimento de Rescisao (devolucao de caucao) nao e
            // aluguel -- nao pode entrar nos graficos de receita, mesma
            // regra que o Financeiro ja segue desde #49.
            const semRescisao = (rows: any[]) => rows.filter((p: any) => p.payment_kind !== "termination");

            return {
              all: semRescisao(allPayments.data || []),
              paid: semRescisao(paidPayments.data || [])
            };
          });

          return Promise.all(promises);
        })();

        console.log("📊 Pagamentos carregados para cada mês");

        // Buscar despesas reais de location_expenses
        console.log("🔍 Buscando despesas de location_expenses...");
        const expensesResult = await (async () => {
          const data = [];
          
          for (const m of months) {
            const month = m.month.toString().padStart(2, '0');
            const year = m.year.toString();

            let query = supabase
              .from("location_expenses")
              .select("amount")
              .eq("reference_month", month)
              .eq("reference_year", year);

            if (isFinancialUser && allowedLocations && allowedLocations.length > 0) {
              query = query.in("location_id", allowedLocations);
            }

            const { data: expenses, error: expensesError } = await query;
            
            if (expensesError) {
              console.error("❌ Erro ao buscar despesas:", expensesError);
              data.push({ month: m.label, total: 0 });
            } else {
              const total = (expenses || []).reduce((sum, e: any) => sum + (e.amount || 0), 0);
              data.push({ month: m.label, total });
            }
          }
          
          return data;
        })();

        console.log("💸 Despesas de location_expenses:", expensesResult);

        const occupancyTrendData = await (async () => {
          const data = [];
          
          for (const m of months) {
            const total = propertiesResult.available + propertiesResult.occupied + propertiesResult.unavailable;
            const occupied = propertiesResult.occupied;
            const rate = total > 0 ? (occupied / total) * 100 : 0;
            
            data.push({
              month: m.label,
              taxa: parseFloat(rate.toFixed(1))
            });
          }
          
          return data;
        })();

        console.log("📊 Histórico de ocupação:", occupancyTrendData);

        // Buscar distribuição de imóveis por localização
        console.log("🔍 Buscando distribuição por localização...");
        const locationDistributionResult = await (async () => {
          let query = supabase
            .from("properties")
            .select("location:locations!inner(name)")
            .neq("status", "unavailable");

          if (isFinancialUser && allowedLocations && allowedLocations.length > 0) {
            query = query.in("location_id", allowedLocations);
          }

          const { data } = await query;
          
          // Agrupar por localização
          const grouped = (data || []).reduce((acc: any, item: any) => {
            const locationName = item.location?.name || "Sem localização";
            acc[locationName] = (acc[locationName] || 0) + 1;
            return acc;
          }, {});

          return Object.entries(grouped).map(([name, count]) => ({
            name,
            value: count
          }));
        })();

        console.log("🏢 Distribuição por localização:", locationDistributionResult);

        // Buscar taxa de inadimplência dos últimos 6 meses
        console.log("🔍 Buscando taxa de inadimplência...");
        const defaultRateData = await (async () => {
          const data = [];
          
          for (const m of months) {
            const month = m.month.toString().padStart(2, '0');
            const year = m.year.toString();

            let totalQuery = supabase
              .from("payments")
              .select("id", { count: "exact", head: true })
              .eq("reference_month", month)
              .eq("reference_year", year);

            let overdueQuery = supabase
              .from("payments")
              .select("id", { count: "exact", head: true })
              .in("status", ["pending", "partial"])
              .eq("reference_month", month)
              .eq("reference_year", year)
              .lt("due_date", new Date().toISOString().split('T')[0]);

            if (isFinancialUser && allowedLocations && allowedLocations.length > 0) {
              const { data: propertiesData, error: propertiesError } = await supabase
                .from("properties")
                .select("id")
                .in("location_id", allowedLocations);

              if (propertiesError) {
                console.error("❌ Erro ao buscar propriedades:", propertiesError);
              } else if (propertiesData) {
                const propertiesInLocation = propertiesData.map((p: any) => p.id);

                const { data: rentalsData, error: rentalsError } = await supabase
                  .from("rentals")
                  .select("id")
                  .in("property_id", propertiesInLocation);

                if (rentalsError) {
                  console.error("❌ Erro ao buscar locações:", rentalsError);
                } else if (rentalsData) {
                  const rentalsInProperties = rentalsData.map((r: any) => r.id);

                  if (rentalsInProperties.length > 0) {
                    totalQuery = totalQuery.in("rental_id", rentalsInProperties);
                    overdueQuery = overdueQuery.in("rental_id", rentalsInProperties);
                  }
                }
              }
            }

            const [total, overdue] = await Promise.all([totalQuery, overdueQuery]);
            const rate = total.count && total.count > 0 ? (overdue.count || 0) / total.count * 100 : 0;
            
            data.push({
              month: m.label,
              taxa: parseFloat(rate.toFixed(1))
            });
          }
          
          return data;
        })();

        console.log("📉 Taxa de inadimplência:", defaultRateData);

        if (!isMounted) return;

        const occupancyPieData = [
          { name: 'Ocupados', value: propertiesResult.occupied, color: COLORS.occupied },
          { name: 'Disponíveis', value: propertiesResult.available, color: COLORS.available },
          { name: 'Indisponíveis', value: propertiesResult.unavailable, color: COLORS.unavailable }
        ].filter(item => item.value > 0);

        const contractsData = [
          { name: 'Ativos', value: contractsResult.active - contractsResult.expiring, color: COLORS.occupied },
          { name: 'Vencendo (30 dias)', value: contractsResult.expiring, color: COLORS.unavailable }
        ].filter(item => item.value > 0);

        // Processar dados de receita - ESPERADA vs RECEBIDA
        const monthlyRevenueData = months.map((m, index) => {
          const allPayments = paymentsResult[index]?.all || [];
          const paidPayments = paymentsResult[index]?.paid || [];
          
          // Renegociado (#119): só o que dele já foi pago; o resto é esperado
          // nas parcelas do acordo (não contar duas vezes).
          const esperada = allPayments.reduce(
            (sum, p: any) => sum + (p.status === "renegotiated" ? p.paid_amount || 0 : p.expected_amount || 0),
            0
          );
          const recebida = paidPayments.reduce((sum, p: any) => sum + (p.paid_amount || 0), 0);
          
          console.log(`💰 [DEBUG] Receita ${m.label}: esperada=${esperada}, recebida=${recebida}`);
          console.log(`💰 [DEBUG] ${m.label}: ${allPayments.length} pagamentos totais, ${paidPayments.length} pagos`);
          
          return { 
            month: m.label, 
            esperada,
            recebida
          };
        });

        console.log("📈 Dados de receita mensal:", monthlyRevenueData);

        const monthlyExpensesData = months.map((m, index) => {
          const paidPayments = paymentsResult[index]?.paid || [];
          const bruta = paidPayments.reduce((sum, p: any) => sum + (p.paid_amount || 0), 0);
          
          // Taxas: admin (5%) + mgmt (3%) = 8%
          const taxas = bruta * 0.08;
          
          // Contas/despesas reais de location_expenses
          const contas = expensesResult[index]?.total || 0;
          
          console.log(`💸 [DEBUG] Despesas ${m.label}: taxas=${taxas}, contas=${contas}`);
          
          return { 
            month: m.label, 
            taxas,
            contas
          };
        });

        setChartData({
          monthlyRevenueData,
          monthlyExpensesData,
          occupancyPieData,
          contractsData,
          occupancyTrendData,
          locationDistributionData: locationDistributionResult,
          defaultRateData
        });

        console.log("✅ [FinancialCharts] Dados carregados com sucesso!");

      } catch (error) {
        console.error("❌ [FinancialCharts] Erro ao carregar dados:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadChartData();

    return () => {
      isMounted = false;
    };
  }, [selectedMonth, selectedYear, userId, userRole, isFinancialUser]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Nenhum dado disponível para exibir gráficos.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasRevenueData = chartData.monthlyRevenueData?.some((d: any) => d.esperada > 0 || d.recebida > 0);
  const hasExpensesData = chartData.monthlyExpensesData?.some((d: any) => d.taxas > 0 || d.contas > 0);
  const hasOccupancyData = chartData.occupancyPieData?.length > 0;
  const hasContractsData = chartData.contractsData?.length > 0;
  const hasOccupancyTrendData = chartData.occupancyTrendData?.length > 0;
  const hasLocationDistributionData = chartData.locationDistributionData?.length > 0;
  const hasDefaultRateData = chartData.defaultRateData?.some((d: any) => d.taxa > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico de Receita Mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receita Esperada vs Recebida (Últimos 6 Meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {hasRevenueData ? (
            <div style={{ width: '100%', height: 300, minHeight: 300 }}>
              <LineChart width={500} height={300} data={chartData.monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                <Legend />
                <Line type="monotone" dataKey="esperada" stroke="#3b82f6" name="Esperada" strokeWidth={2} />
                <Line type="monotone" dataKey="recebida" stroke="#10b981" name="Recebida" strokeWidth={2} />
              </LineChart>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Nenhum dado de receita nos últimos 6 meses</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Despesas Mensais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Despesas Mensais (Últimos 6 Meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {hasExpensesData ? (
            <div className="flex justify-center">
              <BarChart width={500} height={300} data={chartData.monthlyExpensesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="taxas" fill={COLORS.taxas} name="Taxas" />
                <Bar dataKey="contas" fill={COLORS.contas} name="Contas" />
              </BarChart>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Nenhuma despesa registrada nos últimos 6 meses</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Status de Ocupação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status de Ocupação</CardTitle>
        </CardHeader>
        <CardContent>
          {hasOccupancyData ? (
            <div className="flex justify-center">
              <PieChart width={500} height={300}>
                <Pie
                  data={chartData.occupancyPieData}
                  cx={250}
                  cy={150}
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.occupancyPieData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Nenhum imóvel cadastrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Status de Contratos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status dos Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          {hasContractsData ? (
            <div className="flex justify-center">
              <PieChart width={500} height={300}>
                <Pie
                  data={chartData.contractsData}
                  cx={250}
                  cy={150}
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.contractsData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Nenhum contrato ativo</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Evolução da Taxa de Ocupação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução da Taxa de Ocupação</CardTitle>
        </CardHeader>
        <CardContent>
          {hasOccupancyTrendData ? (
            <div style={{ width: '100%', height: 300, minHeight: 300 }}>
              <LineChart width={500} height={300} data={chartData.occupancyTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="taxa" 
                  stroke={COLORS.occupied} 
                  name="Taxa de Ocupação (%)" 
                  strokeWidth={2}
                />
              </LineChart>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Nenhum dado de ocupação disponível</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Distribuição por Localização */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição de Imóveis por Localização</CardTitle>
        </CardHeader>
        <CardContent>
          {hasLocationDistributionData ? (
            <div style={{ width: '100%', height: 300, minHeight: 300 }}>
              <PieChart width={500} height={300}>
                <Pie
                  data={chartData.locationDistributionData}
                  cx={250}
                  cy={150}
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.locationDistributionData.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Nenhum imóvel cadastrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Taxa de Inadimplência */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Taxa de Inadimplência (Últimos 6 Meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {hasDefaultRateData ? (
            <div style={{ width: '100%', height: 300, minHeight: 300 }}>
              <LineChart width={500} height={300} data={chartData.defaultRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="taxa" 
                  stroke={COLORS.unavailable} 
                  name="Taxa de Inadimplência (%)" 
                  strokeWidth={2}
                />
              </LineChart>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Nenhum dado de inadimplência disponível</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}