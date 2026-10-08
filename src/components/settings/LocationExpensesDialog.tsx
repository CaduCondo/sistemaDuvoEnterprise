import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Filter, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Printer } from "lucide-react";
import { LocationExpense, Location } from "@/types";
import { locationExpenseService } from "@/services/locationExpenseService";
import { formatCurrency, applyRealMask, parseCurrencyToNumber } from "@/lib/masks";

interface LocationExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location;
}

type SortField = "location_name" | "description" | "amount";
type SortDirection = "asc" | "desc" | null;

// Estilos para impressão - IGUAL AO FINANCIAL.TSX
const printStyles = `
  @media print {
    @page {
      size: portrait;
      margin: 15mm;
    }
    
    body * {
      visibility: hidden;
    }
    
    .print-area, .print-area *,
    .print-header, .print-header * {
      visibility: visible;
    }
    
    .print-header {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    
    .print-area {
      position: absolute;
      left: 0;
      top: 120px;
      width: 100%;
    }
    
    .no-print {
      display: none !important;
    }
    
    /* Estilos para o cabeçalho de impressão */
    .print-header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 4px;
      color: #000 !important;
    }
    
    .print-header p {
      font-size: 10pt;
      color: #666 !important;
      margin-bottom: 8px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .print-header .print-period {
      font-size: 11pt;
      font-weight: 600;
      color: #000 !important;
      margin-top: 8px;
    }
    
    table {
      font-size: 10pt !important;
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      padding: 8px !important;
      border: 1px solid #ddd !important;
      word-wrap: break-word;
    }
    
    th {
      background-color: #f0f0f0 !important;
      font-weight: bold !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .print-total {
      margin-top: 15px;
      padding: 10px;
      background-color: #f5f5f5 !important;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .print-total .total-value {
      color: #dc2626 !important;
      font-weight: bold !important;
      font-size: 14pt !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`;

export function LocationExpensesDialog({ open, onOpenChange, location }: LocationExpensesDialogProps) {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<LocationExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingExpense, setEditingExpense] = useState<LocationExpense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LocationExpense | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Filtros
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  // Form - amount agora é string com máscara
  const [expenseType, setExpenseType] = useState<string>("water");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("R$ 0,00");
  const [referenceMonth, setReferenceMonth] = useState(new Date().getMonth() + 1);
  const [referenceYear, setReferenceYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (open && location?.id) {
      loadExpenses();
    }
  }, [open, location?.id, filterMonth, filterYear]);

  // Return null if location is not provided
  if (!location) {
    return null;
  }

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await locationExpenseService.getByLocation(location.id);
      
      const filtered = data.filter(
        (exp) => exp.referenceMonth === filterMonth && exp.referenceYear === filterYear
      );
      
      setExpenses(filtered);
    } catch (error) {
      console.error("Error loading expenses:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as contas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
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
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 text-slate-400" />;
    if (sortDirection === "asc") return <ArrowUp className="h-4 w-4 ml-1 text-blue-600" />;
    return <ArrowDown className="h-4 w-4 ml-1 text-blue-600" />;
  };

  const sortedExpenses = [...expenses].sort((a, b) => {
    if (!sortField || !sortDirection) return 0;

    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case "location_name":
        aValue = location.name.toLowerCase();
        bValue = location.name.toLowerCase();
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

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async () => {
    // Converter valor com máscara para número
    const numericValue = parseCurrencyToNumber(amount);
    
    if (!numericValue || numericValue <= 0) {
      toast({
        title: "Erro",
        description: "Informe um valor válido maior que zero.",
        variant: "destructive",
      });
      return;
    }

    try {
      // ⚠️ Corrigido em 08/out/2026: este trecho montava uma string
      // "AAAA-M-DD" (ex.: "2026-10-01") e criava um `new Date(...)` só pra
      // ler de volta o mês/ano com `.getMonth()+1`/`.getFullYear()` --
      // redundante, já que `referenceMonth`/`referenceYear` (estado dos
      // selects, linhas 147-148) já são os números certos, 1-based. O
      // problema: essa string ISO é interpretada pelo motor JS como
      // meia-noite EM UTC, e `.getMonth()`/`.getFullYear()` leem de volta
      // no fuso LOCAL do navegador. Para quem está num fuso atrás de UTC
      // (Brasil, UTC-3), meia-noite de 1º/10 em UTC ainda é 30/09 à noite
      // no horário local -- a conta virava Setembro mesmo com "Out"
      // selecionado no formulário. Usa os números do estado direto, sem
      // passar por Date nenhum.
      const expenseData = {
        locationId: location.id,
        expenseType: expenseType as LocationExpense["expenseType"],
        description,
        amount: numericValue,
        referenceMonth: referenceMonth,
        referenceYear: referenceYear,
        status: "pending" as LocationExpense["status"],
      };

      if (editingExpense) {
        await locationExpenseService.update(editingExpense.id, expenseData);
        toast({
          title: "Sucesso",
          description: "Conta atualizada com sucesso.",
        });
      } else {
        await locationExpenseService.create(expenseData);
        toast({
          title: "Sucesso",
          description: "Conta cadastrada com sucesso.",
        });
      }

      resetForm();
      loadExpenses();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a conta.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await locationExpenseService.delete(id);
      
      toast({
        title: "Sucesso",
        description: "Conta excluída com sucesso.",
      });
      
      setConfirmDelete(null);
      loadExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a conta.",
        variant: "destructive",
      });
    }
  };

  const handleView = (expense: LocationExpense) => {
    setEditingExpense(expense);
    setExpenseType(expense.expenseType);
    setDescription(expense.description || "");
    setAmount(formatCurrency(expense.amount));
    setReferenceMonth(expense.referenceMonth);
    setReferenceYear(expense.referenceYear);
    setIsEditing(false);
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setIsEditing(false);
    setEditingExpense(null);
    setExpenseType("water");
    setDescription("");
    setAmount("R$ 0,00");
    setReferenceMonth(new Date().getMonth() + 1);
    setReferenceYear(new Date().getFullYear());
  };

  const handleNewExpense = () => {
    resetForm();
    setIsEditing(true);
    setIsFormOpen(true);
  };

  const getExpenseTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      water: "Água",
      electricity: "Luz",
      gas: "Gás",
      internet: "Internet",
      maintenance: "Manutenção",
      other: "Outros",
    };
    return labels[type] || type;
  };

  const getMonthName = (month: number) => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return months[month - 1];
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      
      <Dialog open={open && !isFormOpen && !confirmDelete} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {/*
            ⚠️ Corrigido em 08/out/2026 (bug reportado pelo Cadu, print
            anexado): faltava "hidden" aqui -- o CSS de impressão
            (printStyles, acima) só esconde este bloco DENTRO de
            `@media print` (`.no-print { display: none }` só existe lá
            dentro). Fora da impressão, nada escondia este bloco, então
            ele aparecia JUNTO com o cabeçalho de tela logo abaixo --
            2 títulos "Detalhamento das Contas do Mês" na mesma tela.
            "hidden print:block" (mesmo padrão já usado nas colunas
            "Descrição"/"Valor" da tabela, mais abaixo) esconde por
            padrão e só mostra ao imprimir.
          */}
          {/* Cabeçalho para impressão */}
          <div className="print-header hidden print:block">
            <h1>Detalhamento das Contas do Mês - {location.name}</h1>
            <p>Controle de despesas mensais por localização</p>
            <div className="print-period">Período: {getMonthName(filterMonth)}/{filterYear}</div>
          </div>

          {/* Cabeçalho para tela */}
          <DialogHeader className="no-print">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold">
                  Detalhamento das Contas do Mês - {location.name}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Controle de despesas mensais por localização
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 print-area">
            {/* Filtros */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border no-print">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Filtrar por:</Label>
              <Select value={filterMonth.toString()} onValueChange={(v) => setFilterMonth(Number(v))}>
                <SelectTrigger className="h-9 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {getMonthName(i + 1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterYear.toString()} onValueChange={(v) => setFilterYear(Number(v))}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Tipo</TableHead>
                    <TableHead 
                      className="cursor-pointer select-none no-print" 
                      onClick={() => handleSort("description")}
                    >
                      <div className="flex items-center">
                        Descrição
                        <SortIcon field="description" />
                      </div>
                    </TableHead>
                    <TableHead className="hidden print:table-cell">Descrição</TableHead>
                    <TableHead className="w-28">Período</TableHead>
                    <TableHead 
                      className="text-right cursor-pointer select-none no-print w-32" 
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center justify-end">
                        Valor
                        <SortIcon field="amount" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right hidden print:table-cell w-32">Valor</TableHead>
                    <TableHead className="text-center w-24 no-print">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : sortedExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhuma conta cadastrada para {getMonthName(filterMonth)}/{filterYear}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedExpenses.map((expense) => (
                      <TableRow 
                        key={expense.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleView(expense)}
                      >
                        <TableCell>
                          <Badge variant="outline" className="no-print">{getExpenseTypeLabel(expense.expenseType)}</Badge>
                          <span className="hidden print:inline">{getExpenseTypeLabel(expense.expenseType)}</span>
                        </TableCell>
                        <TableCell>{expense.description || "-"}</TableCell>
                        <TableCell>
                          {getMonthName(expense.referenceMonth)}/{expense.referenceYear}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell className="no-print">
                          <div className="flex justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(expense);
                              }}
                              className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {sortedExpenses.length > 0 && (
              <div className="p-4 bg-muted rounded-lg print-total">
                <span className="font-semibold">
                  Total de Contas ({getMonthName(filterMonth)}/{filterYear}):
                </span>
                <span className="text-xl font-bold text-red-600 total-value">
                  {formatCurrency(sortedExpenses.reduce((sum, e) => sum + e.amount, 0))}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 no-print mt-6">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button size="sm" onClick={handleNewExpense}>
              Nova Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingExpense && !isEditing
                ? "Visualização da Conta a Pagar"
                : editingExpense && isEditing
                ? "Edição da Conta a Pagar"
                : "Inclusão de Conta a Pagar"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-6 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Tipo</Label>
                <Select value={expenseType} onValueChange={setExpenseType} disabled={!isEditing && !!editingExpense}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="water">Água</SelectItem>
                    <SelectItem value="electricity">Luz</SelectItem>
                    <SelectItem value="gas">Gás</SelectItem>
                    <SelectItem value="internet">Internet</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mês</Label>
                <Select 
                  value={referenceMonth.toString()} 
                  onValueChange={(v) => setReferenceMonth(Number(v))}
                  disabled={!isEditing && !!editingExpense}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {getMonthName(i + 1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ano</Label>
                <Select 
                  value={referenceYear.toString()} 
                  onValueChange={(v) => setReferenceYear(Number(v))}
                  disabled={!isEditing && !!editingExpense}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027, 2028].map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="expense-value">Valor</Label>
                <Input
                  id="expense-value"
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(applyRealMask(e.target.value))}
                  placeholder="R$ 0,00"
                  disabled={!isEditing && !!editingExpense}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Conta de luz do mês"
                disabled={!isEditing && !!editingExpense}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            {editingExpense && !isEditing ? (
              <>
                <Button variant="outline" onClick={() => resetForm()}>
                  Fechar
                </Button>
                <Button onClick={() => setIsEditing(true)}>
                  Editar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => resetForm()}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingExpense ? "Salvar" : "Adicionar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Card Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="max-w-md">
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-red-900">Confirmar Exclusão</CardTitle>
                  <CardDescription className="text-red-700">
                    Esta ação não pode ser desfeita
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {confirmDelete && (
                <div className="p-4 bg-white rounded-lg border border-red-200">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Tipo:</span>
                      <span className="font-medium">{getExpenseTypeLabel(confirmDelete.expenseType)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Período:</span>
                      <span className="font-medium">
                        {getMonthName(confirmDelete.referenceMonth)}/{confirmDelete.referenceYear}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Valor:</span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(confirmDelete.amount)}
                      </span>
                    </div>
                    {confirmDelete.description && (
                      <div className="pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Descrição:</span>
                        <p className="text-sm mt-1">{confirmDelete.description}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => confirmDelete && handleDelete(confirmDelete.id)}
                >
                  Excluir Conta
                </Button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  );
}