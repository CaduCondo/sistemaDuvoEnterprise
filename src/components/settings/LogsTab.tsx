import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, Download, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  user_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  old_values: any;
  new_values: any;
  changes_summary: string | null;
  ip_address: string | null;
  user_agent: string | null;
  page_url: string | null;
  created_at: string;
  user_name?: string;
}

export function LogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const query = supabase
        .from("audit_logs")
        .select(`
          *,
          user:system_users(name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      const { data, error } = await query;

      if (error) throw error;

      const logsWithUserNames = (data || []).map((log: any) => ({
        ...log,
        user_name: log.user?.name || "Sistema",
      }));

      setLogs(logsWithUserNames);
    } catch (error) {
      console.error("Erro ao buscar logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    // Filtro de busca
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      log.changes_summary?.toLowerCase().includes(searchLower) ||
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.entity_type.toLowerCase().includes(searchLower) ||
      log.action_type.toLowerCase().includes(searchLower);

    // Filtro de ação
    const matchesAction = actionFilter === "all" || log.action_type === actionFilter;

    // Filtro de entidade
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;

    // Filtro de data
    const logDate = new Date(log.created_at);
    const matchesDateFrom = !dateFrom || logDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || logDate <= new Date(dateTo + "T23:59:59");

    return matchesSearch && matchesAction && matchesEntity && matchesDateFrom && matchesDateTo;
  });

  const getActionBadge = (action: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      create: { variant: "default", label: "Criação" },
      update: { variant: "secondary", label: "Edição" },
      delete: { variant: "destructive", label: "Exclusão" },
      login: { variant: "outline", label: "Login" },
      logout: { variant: "outline", label: "Logout" },
      password_change: { variant: "secondary", label: "Senha" },
      status_change: { variant: "secondary", label: "Status" },
    };
    const config = variants[action] || { variant: "outline" as const, label: action };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getEntityLabel = (entity: string) => {
    const labels: Record<string, string> = {
      property: "Imóvel",
      tenant: "Inquilino",
      rental: "Locação",
      payment: "Pagamento",
      user: "Usuário",
      location: "Local",
      config: "Configuração",
      system: "Sistema",
    };
    return labels[entity] || entity;
  };

  const exportToCSV = () => {
    const headers = ["Data/Hora", "Usuário", "Ação", "Entidade", "Resumo"];
    const rows = filteredLogs.map((log) => [
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      log.user_name,
      log.action_type,
      log.entity_type,
      log.changes_summary || "-",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `logs_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Logs de Auditoria</CardTitle>
            <CardDescription>Histórico completo de ações no sistema</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ação</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="create">Criação</SelectItem>
                <SelectItem value="update">Edição</SelectItem>
                <SelectItem value="delete">Exclusão</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="password_change">Senha</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Entidade</Label>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="property">Imóveis</SelectItem>
                <SelectItem value="tenant">Inquilinos</SelectItem>
                <SelectItem value="rental">Locações</SelectItem>
                <SelectItem value="payment">Pagamentos</SelectItem>
                <SelectItem value="user">Usuários</SelectItem>
                <SelectItem value="location">Locais</SelectItem>
                <SelectItem value="config">Configurações</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        {/* Tabela de Logs */}
        <div className="border rounded-lg overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[180px]">Data/Hora</TableHead>
                <TableHead className="w-[150px]">Usuário</TableHead>
                <TableHead className="w-[100px]">Ação</TableHead>
                <TableHead className="w-[120px]">Entidade</TableHead>
                <TableHead>Resumo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando logs...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{log.user_name || "-"}</TableCell>
                    <TableCell>
                      {getActionBadge(log.action_type)}
                    </TableCell>
                    <TableCell>
                      {getEntityLabel(log.entity_type)}
                    </TableCell>
                    <TableCell className="max-w-md">
                      {log.changes_summary ? (
                        <div className="whitespace-pre-wrap break-words">
                          {log.changes_summary.includes(": ") ? (
                            // ✅ CORREÇÃO: Se tiver mudanças de campos, quebrar cada uma em uma linha
                            <div className="space-y-1">
                              {log.changes_summary.split(", ").map((change, idx) => (
                                <div key={idx} className="text-sm">
                                  {change}
                                </div>
                              ))}
                            </div>
                          ) : (
                            // Mensagem simples (ex: "Imóvel criado")
                            log.changes_summary
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="text-sm text-muted-foreground text-center">
          Mostrando {filteredLogs.length} de {logs.length} registros
        </div>
      </CardContent>
    </Card>
  );
}