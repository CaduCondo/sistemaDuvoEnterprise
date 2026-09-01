import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, parseCurrencyToNumber, formatCurrencyInput } from "@/lib/masks";
import { Button } from "@/components/ui/button";
import { Download, Printer, ArrowUpDown, ArrowUp, ArrowDown, FileText, Wallet, HandCoins, TrendingUp } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// Interface estendida para incluir returned_deposit_amount até os tipos serem regenerados
interface RentalWithReturnedDeposit {
  rent_value: number;
  garage_value: number;
  security_deposit: number;
  has_partner_broker: boolean;
  status: string;
  returned_deposit_amount?: number;
  deposit_payment_date?: string;
  deposit_installment2_payment_date?: string;
  deposit_installment3_payment_date?: string;
  tenant: {
    name: string;
  };
  property: {
    complement: string;
    location: {
      name: string;
    };
  };
}

interface DepositInstallment {
  id: string;
  rental_id: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  pix_code: string | null;
  partner_commission: number;
  internal_commission: number;
  payment_date: string | null;
  status: string;
  due_date: string | null;
  rental: RentalWithReturnedDeposit;
}

interface DepositInstallmentsTableProps {
  userRole: string;
  allowedLocationIds?: string[];
}

type SortField = "location" | "complement" | "tenant" | "rentValue" | "totalDeposit" | "rent" | "deposit" | "partner" | "partnerCommission" | "internalCommission" | "installment" | "date" | "amount" | "pix" | "rental_property" | "tenant_name" | "installment_number" | "due_date" | "payment_date" | "status" | "dueDate" | "paymentDate";
type SortDirection = "asc" | "desc" | null;

export function DepositInstallmentsTable({
  userRole,
  allowedLocationIds = [],
}: DepositInstallmentsTableProps) {
  const [data, setData] = useState<DepositInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  // Recebimento de Rescisão mais recente de cada locação (payment_kind
  // 'termination' em `payments`) — alimenta as 4 colunas novas da aba
  // Cauções (#49). Fica vazio (undefined) para locação nunca rescindida.
  const [terminationByRental, setTerminationByRental] = useState<
    Record<string, { corrected: number; expenses: number; discount: number }>
  >({});
  const [statusFilter, setStatusFilter] = useState<string>("active"); // ✅ CORRIGIDO: Padrão "active"
  const [editingCell, setEditingCell] = useState<{ id: string; field: string; rentalId: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const { toast } = useToast();

  // 🔥 CORREÇÃO: Permitir acesso para admin E broker
  const isAdmin = userRole === "admin" || userRole === "broker";

  // SortIcon component
  const SortIcon = useCallback(({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-30" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    return <ArrowDown className="h-4 w-4 ml-1" />;
  }, [sortField, sortDirection]);

  const fetchData = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log("🔍 === INÍCIO BUSCA PARCELAS DE CAUÇÃO ===");

      const query = supabase
        .from("deposit_installments")
        .select(`
          id,
          rental_id,
          installment_number,
          installment_total,
          amount,
          pix_code,
          partner_commission,
          internal_commission,
          payment_date,
          status,
          due_date,
          rental:rentals!rental_id(
            id,
            rent_value,
            garage_value,
            security_deposit,
            has_partner_broker,
            status,
            returned_deposit_amount,
            tenant:tenants(name),
            property:properties(
              complement,
              location:locations(name)
            )
          )
        `)
        .order("due_date", { ascending: true, nullsFirst: false });

      const { data: installmentsData, error } = await query;

      if (error) {
        console.error("❌ Erro na query:", error);
        throw error;
      }

      console.log("✅ Query executada com sucesso");
      console.log("📊 Total de parcelas:", installmentsData?.length || 0);

      if (!installmentsData || installmentsData.length === 0) {
        console.log("⚠️ Nenhuma parcela encontrada");
        setData([]);
        setLoading(false);
        return;
      }

      const mappedInstallments = installmentsData.map((item: any) => ({
        ...item,
        total_installments: item.installment_total,
      }));

      console.log("✅ Dados mapeados, total:", mappedInstallments.length);
      setData(mappedInstallments as unknown as DepositInstallment[]);

      // Recebimento de Rescisão de cada locação (#49) - as 4 colunas novas.
      // Uma locação pode, em tese, ter mais de um (ex.: rescisão refeita) -
      // ordenando por due_date desc e mantendo só a primeira ocorrência de
      // cada rental_id, ficamos com o mais recente.
      // `(supabase as any)` a partir do primeiro `.from(...)`: os tipos
      // gerados do Supabase (src/integrations/supabase/types.ts) ainda não
      // conhecem as colunas de rescisão em "payments" (#49) - um `: any` só
      // na variável de destino não basta (o TS ainda infere a cadeia toda
      // antes de descartar o tipo), e a query de deposit_installments logo
      // acima já é pesada o bastante para estourar o limite de profundidade
      // de inferência do TS somada a mais uma cadeia .from/.select/.eq/.order
      // tipada. Cortando o tipo já no `supabase` evita a inferência inteira.
      const { data: terminationData, error: terminationError } = await (supabase as any)
        .from("payments")
        .select("rental_id, termination_corrected_deposit, termination_additional_expenses, termination_discount, due_date")
        .eq("payment_kind", "termination")
        .order("due_date", { ascending: false });

      if (terminationError) {
        console.error("❌ Erro ao buscar Recebimentos de Rescisão:", terminationError);
      } else {
        const porLocacao: Record<string, { corrected: number; expenses: number; discount: number }> = {};
        for (const pagamento of terminationData || []) {
          if (porLocacao[pagamento.rental_id]) continue;
          porLocacao[pagamento.rental_id] = {
            corrected: Number(pagamento.termination_corrected_deposit) || 0,
            expenses: Number(pagamento.termination_additional_expenses) || 0,
            discount: Number(pagamento.termination_discount) || 0,
          };
        }
        setTerminationByRental(porLocacao);
      }

      setLoading(false);
    } catch (error) {
      console.error("❌ Erro ao buscar dados:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados de caução.",
        variant: "destructive",
      });
      setData([]);
      setLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 🔥 FILTRAR DADOS APÓS CARREGAMENTO, BASEADO NO FILTRO SELECIONADO
  const filteredData = useMemo(() => {
    if (statusFilter === "all") {
      console.log("📊 Mostrando TODAS as locações:", data.length);
      return data;
    } else if (statusFilter === "active") {
      const activeData = data.filter((inst) => inst.rental?.status === "active");
      console.log("📊 Mostrando locações ATIVAS:", activeData.length);
      return activeData;
    } else if (statusFilter === "inactive") {
      const inactiveData = data.filter((inst) => inst.rental?.status !== "active");
      console.log("📊 Mostrando locações INATIVAS:", inactiveData.length);
      return inactiveData;
    }
    return data;
  }, [data, statusFilter]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Ciclo: asc → desc → null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField, sortDirection]);

  const handleStartEdit = useCallback((installment: DepositInstallment, field: string) => {
    setEditingCell({ id: installment.id, field, rentalId: installment.rental_id });
    
    // Definir valor inicial baseado no campo
    if (field === "pix_code") {
      setEditingValue(installment.pix_code || "");
    } else if (field === "partner_commission") {
      setEditingValue(formatCurrency(installment.partner_commission || 0));
    } else if (field === "internal_commission") {
      setEditingValue(formatCurrency(installment.internal_commission || 0));
    } else if (field === "amount") {
      setEditingValue(formatCurrency(installment.amount || 0));
    } else if (field === "returned_deposit_amount") {
      setEditingValue(formatCurrency(installment.rental?.returned_deposit_amount || 0));
    }
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingCell) return;

    const newValue = parseCurrencyToNumber(editingValue);

    try {
      if (editingCell.field === "returned_deposit_amount") {
        // Salvar valor devolvido na tabela rentals
        const { error: updateRentalError } = await supabase
          .from("rentals")
          .update({ returned_deposit_amount: newValue })
          .eq("id", editingCell.rentalId);

        if (updateRentalError) {
          console.error("Erro ao atualizar valor devolvido:", updateRentalError);
          toast({
            title: "Erro ao salvar",
            description: "Não foi possível atualizar o valor devolvido.",
            variant: "destructive",
          });
          return;
        }
      } else if (editingCell.field === "pix_code") {
        // Salvar código PIX como string
        const { error: updateInstallmentError } = await supabase
          .from("deposit_installments")
          .update({ pix_code: editingValue })
          .eq("id", editingCell.id);

        if (updateInstallmentError) {
          console.error("Erro ao atualizar código PIX:", updateInstallmentError);
          toast({
            title: "Erro ao salvar",
            description: "Não foi possível atualizar o código PIX.",
            variant: "destructive",
          });
          return;
        }
      } else {
        // Salvar outros campos numéricos na tabela deposit_installments
        const { error: updateInstallmentError } = await supabase
          .from("deposit_installments")
          .update({ [editingCell.field]: newValue })
          .eq("id", editingCell.id);

        if (updateInstallmentError) {
          console.error("Erro ao atualizar parcela:", updateInstallmentError);
          toast({
            title: "Erro ao salvar",
            description: "Não foi possível atualizar a parcela.",
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Valor atualizado",
        description: "O valor foi salvo com sucesso.",
      });

      await fetchData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar o valor.",
        variant: "destructive",
      });
    } finally {
      setEditingCell(null);
      setEditingValue("");
    }
  }, [editingCell, editingValue, toast, fetchData]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditingValue("");
  }, []);

  const exportToExcel = useCallback(() => {
    const excelData = data.map((inst) => ({
      Local: inst.rental?.property?.location?.name || "-",
      Complemento: inst.rental?.property?.complement || "-",
      Inquilino: inst.rental?.tenant?.name || "-",
      "Valor Aluguel": inst.rental?.rent_value || 0,
      "Valor Total Caução": inst.rental?.security_deposit || 0,
      "Corretor Parceiro": inst.rental?.has_partner_broker ? "Sim" : "Não",
      "Valor Pg Corretor Parceiro": inst.partner_commission || 0,
      "Valor Pg Corretor Interno": inst.internal_commission || 0,
      Parcela: `${inst.installment_number}/${inst.total_installments}`,
      "Data Pagamento": inst.payment_date || "-",
      "Valor Parcela": inst.amount || 0,
      "Código PIX": inst.pix_code || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cauções");

    const today = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Detalhamento_Caucoes_${today}.xlsx`);

    toast({
      title: "Sucesso",
      description: "Planilha exportada com sucesso!",
    });
  }, [data, toast]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ✅ Agrupa parcelas por rental_id (MEMOIZADO)
  const groupedData = useMemo(() => {
    return filteredData.reduce((acc, inst) => {
      if (!acc[inst.rental_id]) {
        acc[inst.rental_id] = [];
      }
      acc[inst.rental_id].push(inst);
      return acc;
    }, {} as Record<string, DepositInstallment[]>);
  }, [filteredData]);

  // ✅ Ordena parcelas dentro de cada grupo (MEMOIZADO)
  useMemo(() => {
    Object.values(groupedData).forEach((group) => {
      group.sort((a, b) => a.installment_number - b.installment_number);
    });
  }, [groupedData]);

  // ✅ Converte para array e ordena grupos (MEMOIZADO)
  const sortedGroups = useMemo(() => {
    let groups = Object.entries(groupedData)
      .sort((a, b) => {
        const dateA = new Date(a[1][0].due_date || a[1][0].payment_date || "");
        const dateB = new Date(b[1][0].due_date || b[1][0].payment_date || "");
        return dateA.getTime() - dateB.getTime();
      })
      .map(([_, group]) => group);

    // ✅ Aplicar ordenação customizada se houver
    if (sortField && sortDirection) {
      groups = [...groups].sort((groupA, groupB) => {
        const instA = groupA[0];
        const instB = groupB[0];
        let comparison = 0;

        switch (sortField) {
          case "location":
            comparison = (instA.rental?.property?.location?.name || "").localeCompare(
              instB.rental?.property?.location?.name || ""
            );
            break;
          case "complement":
            comparison = (instA.rental?.property?.complement || "").localeCompare(
              instB.rental?.property?.complement || ""
            );
            break;
          case "tenant":
            comparison = (instA.rental?.tenant?.name || "").localeCompare(
              instB.rental?.tenant?.name || ""
            );
            break;
          case "rent":
            comparison = (instA.rental?.rent_value || 0) - (instB.rental?.rent_value || 0);
            break;
          case "deposit":
            const depositA = groupA.reduce((acc, curr) => acc + (curr.amount || 0), 0);
            const depositB = groupB.reduce((acc, curr) => acc + (curr.amount || 0), 0);
            comparison = depositA - depositB;
            break;
          case "partner":
            comparison = (instA.rental?.has_partner_broker ? 1 : 0) - (instB.rental?.has_partner_broker ? 1 : 0);
            break;
          case "partnerCommission":
            comparison = (instA.partner_commission || 0) - (instB.partner_commission || 0);
            break;
          case "internalCommission":
            comparison = (instA.internal_commission || 0) - (instB.internal_commission || 0);
            break;
          case "installment":
            comparison = instA.installment_number - instB.installment_number;
            break;
          case "date":
            const dateA = new Date(instA.payment_date || instA.due_date || "");
            const dateB = new Date(instB.payment_date || instB.due_date || "");
            comparison = dateA.getTime() - dateB.getTime();
            break;
          case "amount":
            comparison = (instA.amount || 0) - (instB.amount || 0);
            break;
          case "pix":
            comparison = (instA.pix_code || "").localeCompare(instB.pix_code || "");
            break;
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return groups;
  }, [groupedData, sortField, sortDirection]);

  // Achatar os grupos para cálculo de totais (MEMOIZADO)
  const visibleData = useMemo(() => sortedGroups.flatMap(group => group), [sortedGroups]);

                          /**
   * Totais do rodape da tabela (28/ago/2026).
   *
   * Cuidado com as colunas MESCLADAS: "Valor Total Caução", "Valor Parceiro",
   * "Valor Corretor" e as quatro da rescisao aparecem uma vez por LOCACAO
   * (rowSpan), nao por parcela. Somar linha a linha multiplicaria esses
   * valores pelo numero de parcelas. Por isso cada locacao entra uma vez so.
   * "Valor Recebido" e por parcela e soma normalmente.
   */
  const totaisDoRodape = useMemo(() => {
    const locacoesJaSomadas = new Set<string>();
    let totalCaucao = 0;
    let totalParceiro = 0;
    let totalCorretor = 0;
    let totalRecebido = 0;
    let totalCorrigido = 0;
    let totalDespesas = 0;
    let totalDesconto = 0;

    for (const parcela of visibleData) {
      const inst = parcela as any;

      // Por parcela.
      totalRecebido += Number(inst.paid_amount || 0);

      const rentalId = inst.rental_id;
      if (!rentalId || locacoesJaSomadas.has(rentalId)) continue;
      locacoesJaSomadas.add(rentalId);

      // Uma vez por locacao (colunas mescladas).
      totalCaucao += Number(inst.rental?.security_deposit || 0);
      totalParceiro += Number(inst.partner_commission || 0);
      totalCorretor += Number(inst.internal_commission || 0);

      const rescisao = terminationByRental[rentalId];
      if (rescisao) {
        totalCorrigido += rescisao.corrected;
        totalDespesas += rescisao.expenses;
        totalDesconto += rescisao.discount;
      }
    }

    return {
      totalCaucao,
      totalParceiro,
      totalCorretor,
      totalRecebido,
      totalCorrigido,
      totalDespesas,
      totalDesconto,
      totalRescisao: totalCorrigido + totalDespesas + totalDesconto,
    };
  }, [visibleData, terminationByRental]);

  // Calcular rowSpan para cada linha (para mesclar células da mesma locação)
  const rowSpanMap = useMemo(() => {
    const map = new Map<string, { start: number; count: number }>();
    const grouped = new Map<string, number[]>();

    // Agrupar índices por rental_id
    visibleData.forEach((item, index) => {
      const rentalId = item.rental_id;
      if (!grouped.has(rentalId)) {
        grouped.set(rentalId, []);
      }
      grouped.get(rentalId)!.push(index);
    });

    // Calcular rowSpan para cada grupo
    grouped.forEach((indices, rentalId) => {
      if (indices.length > 0) {
        map.set(rentalId, {
          start: indices[0],
          count: indices.length,
        });
      }
    });

    return map;
  }, [visibleData]);

  // Helper para verificar se deve renderizar a célula
  const shouldRenderCell = useCallback((rentalId: string, currentIndex: number): boolean => {
    const info = rowSpanMap.get(rentalId);
    if (!info) return true;
    return info.start === currentIndex;
  }, [rowSpanMap]);

  // Helper para obter rowSpan
  const getRowSpan = useCallback((rentalId: string): number => {
    const info = rowSpanMap.get(rentalId);
    return info ? info.count : 1;
  }, [rowSpanMap]);

  const sortedData = useMemo(() => {
  }, [visibleData]);

  const { totalExpected, totalReceived, totalPartnerCommission, totalInternalCommission, totalCommission, netRevenue } = useMemo(() => {
    const totalExpected = visibleData.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const totalReceived = visibleData
      .filter((inst) => inst.pix_code && inst.pix_code.trim() !== "")
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const totalPartnerCommission = visibleData.reduce((acc, curr) => acc + (curr.partner_commission || 0), 0);
    const totalInternalCommission = visibleData.reduce((acc, curr) => acc + (curr.internal_commission || 0), 0);
    const totalCommission = totalPartnerCommission + totalInternalCommission;
    const netRevenue = totalReceived - totalCommission;

    return {
      totalExpected,
      totalReceived,
      totalPartnerCommission,
      totalInternalCommission,
      totalCommission,
      netRevenue
    };
  }, [visibleData]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Carregando dados...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Acesso restrito a administradores e corretores.
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Nenhum dado de caução encontrado.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div id="deposits-print-content" style={{ backgroundColor: 'white' }}>
        {/* ✅ CORRIGIDO: Cards com estrutura - ícone+título ACIMA, valor MEIO, descrição ABAIXO */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-5 w-5 text-blue-500" />
                  <p className="text-sm font-medium text-muted-foreground">Cauções Esperados</p>
                </div>
                <h3 className="text-2xl font-bold text-blue-500">
                  {formatCurrency(totalExpected)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Soma de todos os cauções esperados
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <HandCoins className="h-5 w-5 text-green-500" />
                  <p className="text-sm font-medium text-muted-foreground">Cauções Recebidos</p>
                </div>
                <h3 className="text-2xl font-bold text-green-500">
                  {formatCurrency(totalReceived)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Soma de todos os cauções recebidos
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-6">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  <p className="text-sm font-medium text-muted-foreground">Comissões Pagas</p>
                </div>
                <h3 className="text-2xl font-bold text-orange-500">
                  {formatCurrency(totalCommission)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Soma das comissões parceiro/corretor pagos
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-6">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-5 w-5 text-purple-500" />
                  <p className="text-sm font-medium text-muted-foreground">Receita Líquida</p>
                </div>
                <h3 className="text-2xl font-bold text-purple-500">
                  {formatCurrency(netRevenue)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Receita após comissões pagas
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ✅ CORRIGIDO: Removida margem extra - espaçamento padronizado */}
        <Card className="shadow-lg border-t-4 border-t-primary mt-4">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center text-lg">
                <FileText className="mr-2 h-5 w-5" />
                Detalhamento dos Cauções
              </CardTitle>
              
              {/* ✅ CORRIGIDO: Filtro com opções corretas e padrão "Ativas" */}
              <div className="flex gap-2 items-center">
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status da Locação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativas</SelectItem>
                    <SelectItem value="inactive">Canceladas</SelectItem>
                    <SelectItem value="all">Todas as Locações</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-100 hover:to-gray-50">
                    <TableHead className="text-center font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        Local
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleSort("location")}
                        >
                          {sortField === "location" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-4 w-4" />
                            ) : (
                              <ArrowDown className="h-4 w-4" />
                            )
                          ) : (
                            <ArrowUpDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        Complemento
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleSort("complement")}
                        >
                          {sortField === "complement" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-4 w-4" />
                            ) : (
                              <ArrowDown className="h-4 w-4" />
                            )
                          ) : (
                            <ArrowUpDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        Inquilino
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleSort("tenant")}
                        >
                          {sortField === "tenant" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-4 w-4" />
                            ) : (
                              <ArrowDown className="h-4 w-4" />
                            )
                          ) : (
                            <ArrowUpDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableHead>
                    <TableHead className="text-center font-semibold">Valor Aluguel</TableHead>
                    <TableHead className="text-center font-semibold">Valor Total Caução</TableHead>
                    <TableHead className="text-center font-semibold">Corretor Parceiro</TableHead>
                    <TableHead className="text-center font-semibold">Valor Parceiro</TableHead>
                    <TableHead className="text-center font-semibold">Valor Corretor</TableHead>
                    <TableHead className="text-center font-semibold">Parcela</TableHead>
                    <TableHead className="text-center font-semibold">Status</TableHead>
                    <TableHead className="text-center font-semibold">Data Vencimento</TableHead>
                    <TableHead className="text-center font-semibold">Data Pagamento</TableHead>
                    <TableHead className="text-center font-semibold">Valor Recebido</TableHead>
                    <TableHead className="text-center font-semibold">Código PIX</TableHead>
                    {statusFilter !== "active" && (
                      <TableHead className="text-center font-semibold">Valor Devolvido</TableHead>
                    )}
                    {/* As 4 colunas da rescisao ficam no FIM da tabela, depois do
                        Codigo PIX (28/ago/2026). Estavam no meio, separando as
                        colunas de caucao das de comissao. */}
                    <TableHead className="text-center font-semibold">Valor Corrigido p/ Devolução</TableHead>
                    <TableHead className="text-center font-semibold">Despesas Adicionais</TableHead>
                    <TableHead className="text-center font-semibold">Valor Desconto</TableHead>
                    <TableHead className="text-center font-semibold">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleData.map((installment, index) => {
                    const rental = installment.rental;
                    const property = rental?.property;
                    const tenant = rental?.tenant;
                    const location = property?.location;
                    const rentalId = installment.rental_id;

                    // Calcular valor total do caução (soma de todas as parcelas desta locação)
                    const allInstallmentsForRental = data.filter(i => i.rental_id === rentalId);
                    const totalDepositValue = allInstallmentsForRental.reduce((sum, i) => sum + (i.amount || 0), 0);

                    return (
                      <TableRow 
                        key={installment.id} 
                        className="hover:bg-gray-50"
                      >
                        {/* Local - mesclado - SEM COLORAÇÃO */}
                        {shouldRenderCell(rentalId, index) && (
                          <TableCell rowSpan={getRowSpan(rentalId)}>
                            {location?.name || "N/A"}
                          </TableCell>
                        )}
                        
                        {/* Complemento - mesclado - SEM COLORAÇÃO */}
                        {shouldRenderCell(rentalId, index) && (
                          <TableCell rowSpan={getRowSpan(rentalId)}>
                            {property?.complement || "-"}
                          </TableCell>
                        )}
                        
                        {/* Inquilino - mesclado - SEM COLORAÇÃO */}
                        {shouldRenderCell(rentalId, index) && (
                          <TableCell rowSpan={getRowSpan(rentalId)}>
                            {tenant?.name || "N/A"}
                          </TableCell>
                        )}

                        {/* Valor Aluguel - mesclado - SEM COLORAÇÃO */}
                        {shouldRenderCell(rentalId, index) && (
                          <TableCell className="text-right whitespace-nowrap" rowSpan={getRowSpan(rentalId)}>
                            {formatCurrency(rental?.rent_value || 0)}
                          </TableCell>
                        )}

                        {/* Valor Total Caução - mesclado - SEM COLORAÇÃO */}
                        {shouldRenderCell(rentalId, index) && (
                          <TableCell className="text-right font-semibold whitespace-nowrap" rowSpan={getRowSpan(rentalId)}>
                            {formatCurrency(totalDepositValue)}
                          </TableCell>
                        )}

                        {/* Corretor Parceiro - mesclado - SEM COLORAÇÃO */}
                        {shouldRenderCell(rentalId, index) && (
                          <TableCell className="text-center" rowSpan={getRowSpan(rentalId)}>
                            {rental?.has_partner_broker ? "Sim" : "Não"}
                          </TableCell>
                        )}
                        
                        {/* Valor Parceiro - mesclado com edição inline - SEM COLORAÇÃO */}
                        {shouldRenderCell(rentalId, index) && (
                          <TableCell className="text-right whitespace-nowrap" rowSpan={getRowSpan(rentalId)}>
                            {rental?.has_partner_broker ? (
                              editingCell?.id === installment.id && editingCell?.field === "partner_commission" ? (
                                <Input
                                  type="text"
                                  className="w-full h-9 text-right text-sm border-blue-500"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(formatCurrencyInput(e.target.value))}
                                  onBlur={handleSaveEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveEdit();
                                    if (e.key === "Escape") handleCancelEdit();
                                  }}
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="cursor-pointer hover:bg-blue-50 px-3 py-2 rounded block text-right"
                                  onClick={() => handleStartEdit(installment, "partner_commission")}
                                >
                                  {formatCurrency(installment.partner_commission || 0)}
                                </span>
                              )
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        )}
                        
                        {/* Valor Corretor - mesclado com edição inline - SEM COLORAÇÃO */}
                        {shouldRenderCell(rentalId, index) && (
                          <TableCell className="text-right whitespace-nowrap" rowSpan={getRowSpan(rentalId)}>
                            {editingCell?.id === installment.id && editingCell?.field === "internal_commission" ? (
                              <Input
                                type="text"
                                className="w-full h-9 text-right text-sm border-blue-500"
                                value={editingValue}
                                onChange={(e) => setEditingValue(formatCurrencyInput(e.target.value))}
                                onBlur={handleSaveEdit}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit();
                                  if (e.key === "Escape") handleCancelEdit();
                                }}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-pointer hover:bg-blue-50 px-3 py-2 rounded block text-right"
                                onClick={() => handleStartEdit(installment, "internal_commission")}
                              >
                                {formatCurrency(installment.internal_commission || 0)}
                              </span>
                            )}
                          </TableCell>
                        )}

                        {/* Parcela - NÃO mesclado - COM COLORAÇÃO */}
                        <TableCell 
                          className={`text-center font-medium ${installment.pix_code ? 'bg-green-50' : 'bg-red-50'}`}
                        >
                          {String(installment.installment_number).replace(/\$/g, '')}/{String(installment.total_installments).replace(/\$/g, '')}
                        </TableCell>

                        {/* Status - NÃO mesclado - COM COLORAÇÃO */}
                        <TableCell className={`text-center ${installment.pix_code ? 'bg-green-50' : 'bg-red-50'}`}>
                          <Badge
                            variant="outline"
                            className={
                              installment.status === "paid"
                                ? "bg-green-100 text-green-700 border-green-300"
                                : installment.status === "overdue"
                                ? "bg-red-100 text-red-700 border-red-300"
                                : installment.status === "cancelled"
                                ? "bg-gray-100 text-gray-500 border-gray-300"
                                : "bg-yellow-100 text-yellow-700 border-yellow-300"
                            }
                          >
                            {installment.status === "paid"
                              ? "Pago"
                              : installment.status === "overdue"
                              ? "Atrasado"
                              : installment.status === "cancelled"
                              ? "Cancelado (rescisão)"
                              : "Pendente"}
                          </Badge>
                        </TableCell>
                        
                        {/* Data Vencimento - NÃO mesclado - COM COLORAÇÃO - LÓGICA CORRETA */}
                        <TableCell className={`text-center ${installment.pix_code ? 'bg-green-50' : 'bg-red-50'}`}>
                          {(() => {
                            // REGRA:
                            // - Parcela 1 (de qualquer total): usa deposit_payment_date (Data Pagamento do campo caução)
                            // - Parcela 2: usa deposit_installment2_payment_date (Data Vencimento 2ª Parcela)
                            // - Parcela 3: usa deposit_installment3_payment_date (Data Vencimento 3ª Parcela)
                            
                            let dateToDisplay = installment.due_date; // fallback
                            
                            if (rental) {
                              if (installment.installment_number === 1) {
                                // Primeira parcela sempre usa Data Pagamento
                                dateToDisplay = rental.deposit_payment_date || installment.due_date;
                              } else if (installment.installment_number === 2) {
                                // Segunda parcela usa Data Vencimento 2ª Parcela
                                dateToDisplay = rental.deposit_installment2_payment_date || installment.due_date;
                              } else if (installment.installment_number === 3) {
                                // Terceira parcela usa Data Vencimento 3ª Parcela
                                dateToDisplay = rental.deposit_installment3_payment_date || installment.due_date;
                              }
                            }
                            
                            // ✅ CORREÇÃO: "new Date('2026-07-20')" sem horário é
                            // interpretado como meia-noite UTC - no fuso de Brasília
                            // (UTC-3) isso vira 19/07 às 21h, e o relatório mostrava
                            // um dia a menos que a data real cadastrada na Locação.
                            // Fixando o horário em meio-dia evita esse problema.
                            return dateToDisplay
                              ? new Date(dateToDisplay + "T12:00:00").toLocaleDateString("pt-BR")
                              : "-";
                          })()}
                        </TableCell>

                        {/* Data Pagamento - NÃO mesclado - COM COLORAÇÃO */}
                        <TableCell className={`text-center ${installment.pix_code ? 'bg-green-50' : 'bg-red-50'}`}>
                          {installment.payment_date
                            ? new Date(installment.payment_date + "T12:00:00").toLocaleDateString("pt-BR")
                            : "-"}
                        </TableCell>
                        
                        {/* Valor - NÃO mesclado - COM COLORAÇÃO - texto verde - edição inline */}
                        <TableCell className={`text-right font-semibold text-green-600 whitespace-nowrap ${installment.pix_code ? 'bg-green-50' : 'bg-red-50'}`}>
                          {editingCell?.id === installment.id && editingCell?.field === "amount" ? (
                            <Input
                              type="text"
                              className="w-full h-9 text-right text-sm font-semibold border-blue-500 text-green-600"
                              value={editingValue}
                              onChange={(e) => setEditingValue(formatCurrencyInput(e.target.value))}
                              onBlur={handleSaveEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit();
                                if (e.key === "Escape") handleCancelEdit();
                              }}
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:bg-blue-50 px-3 py-2 rounded block text-right"
                              onClick={() => handleStartEdit(installment, "amount")}
                            >
                              {formatCurrency(installment.amount)}
                            </span>
                          )}
                        </TableCell>
                        
                        {/* Código PIX - NÃO mesclado - COM COLORAÇÃO - edição inline */}
                        <TableCell className={`text-center text-xs ${installment.pix_code ? 'bg-green-50' : 'bg-red-50'}`}>
                          {editingCell?.id === installment.id && editingCell?.field === "pix_code" ? (
                            <Input
                              type="text"
                              className="w-full h-9 text-center text-xs border-blue-500"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={handleSaveEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit();
                                if (e.key === "Escape") handleCancelEdit();
                              }}
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:bg-blue-50 px-3 py-2 rounded block text-center"
                              onClick={() => handleStartEdit(installment, "pix_code")}
                            >
                              {installment.pix_code || "-"}
                            </span>
                          )}
                        </TableCell>

                        {/* Valor Devolvido - mesclado - somente para contratos cancelados - EDITÁVEL */}
                        {statusFilter !== "active" && shouldRenderCell(rentalId, index) && (
                          <TableCell className="text-right font-semibold text-red-600 whitespace-nowrap" rowSpan={getRowSpan(rentalId)}>
                            {editingCell?.id === installment.id && editingCell?.field === "returned_deposit_amount" ? (
                              <Input
                                type="text"
                                className="w-full h-9 text-right text-sm font-semibold border-blue-500 text-red-600"
                                value={editingValue}
                                onChange={(e) => setEditingValue(formatCurrencyInput(e.target.value))}
                                onBlur={handleSaveEdit}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit();
                                  if (e.key === "Escape") handleCancelEdit();
                                }}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-pointer hover:bg-blue-50 px-3 py-2 rounded block text-right"
                                onClick={() => handleStartEdit(installment, "returned_deposit_amount")}
                              >
                                {rental?.status !== "active" && rental?.returned_deposit_amount 
                                  ? formatCurrency(rental.returned_deposit_amount)
                                  : "-"}
                              </span>
                            )}
                          </TableCell>
                        )}

                        {/* As 4 colunas da rescisão (#49) — no FIM da tabela, depois do
                            Código PIX e do Valor Devolvido. Mescladas por locação,
                            vazias enquanto não houver rescisão. */}
                        {shouldRenderCell(rentalId, index) && (() => {
                          const rescisao = terminationByRental[rentalId];
                          const totalRescisao = rescisao
                            ? rescisao.corrected + rescisao.expenses + rescisao.discount
                            : null;
                          const span = getRowSpan(rentalId);
                          const corDoValor = (valor: number | null) =>
                            valor !== null && valor < 0 ? "text-red-600 font-semibold" : "";

  return (
                            <>
                              <TableCell
                                className={`text-right whitespace-nowrap ${corDoValor(rescisao ? rescisao.corrected : null)}`}
                                rowSpan={span}
                              >
                                {rescisao ? formatCurrency(rescisao.corrected) : "-"}
                              </TableCell>
                              <TableCell
                                className={`text-right whitespace-nowrap ${corDoValor(rescisao ? rescisao.expenses : null)}`}
                                rowSpan={span}
                              >
                                {rescisao ? formatCurrency(rescisao.expenses) : "-"}
                              </TableCell>
                              <TableCell
                                className={`text-right whitespace-nowrap ${corDoValor(rescisao ? rescisao.discount : null)}`}
                                rowSpan={span}
                              >
                                {rescisao ? formatCurrency(rescisao.discount) : "-"}
                              </TableCell>
                              <TableCell
                                className={`text-right font-semibold whitespace-nowrap ${corDoValor(totalRescisao)}`}
                                rowSpan={span}
                              >
                                {totalRescisao !== null ? formatCurrency(totalRescisao) : "-"}
                              </TableCell>
                            </>
                          );
                        })()}

                      </TableRow>
                    );
                  })}
                  {/* Linha de TOTAL (28/ago/2026). As colunas sem soma ficam
                      vazias de proposito — um traco ali sugeriria "zero". */}
                  {visibleData.length > 0 && (
                    <TableRow className="bg-muted/60 font-bold border-t-2 hover:bg-muted/60">
                      <TableCell className="text-right whitespace-nowrap" colSpan={4}>
                        TOTAL
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(totaisDoRodape.totalCaucao)}
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(totaisDoRodape.totalParceiro)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(totaisDoRodape.totalCorretor)}
                      </TableCell>
                      <TableCell colSpan={4} />
                      <TableCell className="text-right whitespace-nowrap text-green-700 dark:text-green-400">
                        {formatCurrency(totaisDoRodape.totalRecebido)}
                      </TableCell>
                      <TableCell />
                      {statusFilter !== "active" && <TableCell />}
                      <TableCell className={`text-right whitespace-nowrap ${totaisDoRodape.totalCorrigido < 0 ? "text-red-600" : ""}`}>
                        {formatCurrency(totaisDoRodape.totalCorrigido)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(totaisDoRodape.totalDespesas)}
                      </TableCell>
                      <TableCell className={`text-right whitespace-nowrap ${totaisDoRodape.totalDesconto < 0 ? "text-red-600" : ""}`}>
                        {formatCurrency(totaisDoRodape.totalDesconto)}
                      </TableCell>
                      <TableCell className={`text-right whitespace-nowrap ${totaisDoRodape.totalRescisao < 0 ? "text-red-600" : ""}`}>
                        {formatCurrency(totaisDoRodape.totalRescisao)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}