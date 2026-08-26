/**
 * ⚠️ COMPONENTE SEM USO. Nada no projeto importa este arquivo.
 *
 * O "Histórico de Pagamentos" que abre de verdade e montado a mao em
 * src/pages/rentals.tsx (handleViewHistory), como um pop-up de HTML puro.
 * Mexer aqui NAO muda o que o usuario ve -- foi o que aconteceu em
 * 26/ago/2026, quando as alteracoes da issue #49 foram feitas neste arquivo e
 * a tela continuou igual.
 *
 * Mantido em paridade com a versao de rentals.tsx para nao virar uma armadilha
 * pior do que ja e. Se for reativar, prefira substituir o pop-up por este
 * componente em vez de manter as duas implementacoes.
 */
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer } from "lucide-react";
import { formatCurrency } from "@/lib/masks";
import { supabase } from "@/integrations/supabase/client";
import type { Rental } from "@/types";
import { Badge } from "@/components/ui/badge";

/** Aluguel e Rescisao vem de `payments`; Caucao vem de `deposit_installments`. */
type TipoRecebimento = "Aluguel" | "Caução" | "Rescisão";

interface Payment {
  id: string;
  due_date: string;
  payment_date: string | null;
  amount_paid: number;
  expected_amount: number;
  status: string;
  installment_number: number;
  tipo: TipoRecebimento;
}

interface RentalPaymentHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: Rental | null;
}

export function RentalPaymentHistoryDialog({
  open,
  onOpenChange,
  rental,
}: RentalPaymentHistoryDialogProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Payment;
    direction: "asc" | "desc";
  } | null>(null);

  const location = rental?.property?.location || "-";
  const complement = rental?.property?.complement || "-";
  const tenantName = rental?.tenant?.name || "-";

  useEffect(() => {
    if (open && rental) {
      loadPayments();
    }
  }, [open, rental]);

  const loadPayments = async () => {
    if (!rental) return;

    try {
      setLoading(true);
      /**
       * O historico mostra TUDO que o inquilino paga nesta locacao, e nao so
       * o aluguel: as parcelas do caucao vivem em outra tabela
       * (`deposit_installments`) e por isso nunca apareciam aqui. O
       * Recebimento de Rescisao ja estava em `payments`, mas sem distincao
       * ficava indistinguivel de uma parcela de aluguel.
       */
      const [recebimentos, parcelasCaucao] = await Promise.all([
        supabase
          .from("payments")
          .select("*")
          .eq("rental_id", rental.id)
          .order("installment", { ascending: true }),
        supabase
          .from("deposit_installments")
          .select("*")
          .eq("rental_id", rental.id)
          .order("installment_number", { ascending: true }),
      ]);

      if (recebimentos.error) throw recebimentos.error;
      if (parcelasCaucao.error) throw parcelasCaucao.error;

      const doAluguel: Payment[] = (recebimentos.data || []).map((p: any) => ({
        id: p.id,
        due_date: p.due_date,
        payment_date: p.payment_date,
        amount_paid: p.paid_amount || 0,
        expected_amount: p.expected_amount || 0,
        status: p.status === "paid" || p.status === "partial" ? "pago" : "pendente",
        installment_number: p.installment || 0,
        tipo: p.payment_kind === "termination" ? "Rescisão" : "Aluguel",
      }));

      const doCaucao: Payment[] = (parcelasCaucao.data || []).map((c: any) => ({
        id: c.id,
        due_date: c.due_date,
        payment_date: c.payment_date,
        // ⚠️ Parcelas pagas antes de 26/ago/2026 tem paid_amount zerado
        // (ver 20260826100000_fix_paid_amount_parcelas_caucao.sql). Para uma
        // parcela marcada como paga, o valor pago e o valor da parcela.
        amount_paid: Number(c.paid_amount || 0) > 0
          ? Number(c.paid_amount)
          : c.status === "paid"
            ? Number(c.amount || 0)
            : 0,
        expected_amount: Number(c.amount || 0),
        status: c.status === "paid" || c.status === "partial" ? "pago" : "pendente",
        installment_number: c.installment_number || 0,
        tipo: "Caução",
      }));

      // Ordem padrao por vencimento: misturando duas origens, o numero da
      // parcela sozinho nao diz nada (existe "1" de aluguel e "1" de caucao).
      const todos = [...doAluguel, ...doCaucao].sort((a, b) =>
        a.due_date.localeCompare(b.due_date)
      );

      setPayments(todos);
    } catch (error) {
      console.error("Erro ao carregar pagamentos:", error);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: keyof Payment) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedPayments = useMemo(() => {
    const sortablePayments = [...payments];
    if (sortConfig !== null) {
      sortablePayments.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortablePayments;
  }, [payments, sortConfig]);

  const totalPaid = useMemo(
    () =>
      sortedPayments
        .filter((p) => p.status === "pago")
        .reduce((sum, p) => sum + p.amount_paid, 0),
    [sortedPayments]
  );

  const handlePrint = () => {
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
              font-size: 24px;
              margin-bottom: 20px;
            }
            .info-box {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 16px;
              background: #f9f9f9;
              margin-bottom: 20px;
            }
            .info-box div {
              margin-bottom: 8px;
              font-size: 14px;
            }
            .info-box strong {
              font-weight: 600;
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
              font-size: 14px;
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
            <div><strong>Local:</strong> ${location}</div>
            <div><strong>Complemento:</strong> ${complement}</div>
            <div><strong>Nome Inquilino:</strong> ${tenantName}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Parcela</th>
                <th>Vencimento</th>
                <th>Pagamento</th>
                <th>Status</th>
                <th class="text-right">Valor Esperado</th>
                <th class="text-right">Valor Pago</th>
              </tr>
            </thead>
            <tbody>
              ${sortedPayments.map(payment => `
                <tr>
                  <td>${payment.tipo}</td>
                  <td>${payment.installment_number}</td>
                  <td>${new Date(payment.due_date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                  <td>${payment.payment_date ? new Date(payment.payment_date + "T00:00:00").toLocaleDateString("pt-BR") : "-"}</td>
                  <td>
                    <span class="${payment.status === "pago" ? "status-pago" : "status-pendente"}">
                      ${payment.status === "pago" ? "Pago" : "Pendente"}
                    </span>
                  </td>
                  <td class="text-right ${payment.expected_amount < 0 ? 'valor-negativo' : ''}">${formatCurrency(payment.expected_amount)}</td>
                  <td class="text-right ${payment.amount_paid < 0 ? 'valor-negativo' : 'text-green'}">
                    ${payment.status === "pago" ? formatCurrency(payment.amount_paid) : "-"}
                  </td>
                </tr>
              `).join("")}
              <tr class="total-row">
                <td colspan="6" class="text-right">Total Pago:</td>
                <td class="text-right text-green">${formatCurrency(totalPaid)}</td>
              </tr>
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    // Abrir pop-up
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Histórico de Pagamentos</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Informações do Imóvel e Inquilino */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="grid gap-3">
                <div className="text-base">
                  <span className="font-semibold">Local:</span> {location}
                </div>
                <div className="text-base">
                  <span className="font-semibold">Complemento:</span> {complement}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-base">
                    <span className="font-semibold">Nome Inquilino:</span> {tenantName}
                  </div>
                  <Button
                    onClick={handlePrint}
                    variant="outline"
                    size="sm"
                    className="print:hidden"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">Carregando pagamentos...</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer text-base text-center"
                        onClick={() => handleSort("tipo")}
                      >
                        Tipo
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-base text-center"
                        onClick={() => handleSort("installment_number")}
                      >
                        Parcela
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-base text-center"
                        onClick={() => handleSort("due_date")}
                      >
                        Vencimento
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-base text-center"
                        onClick={() => handleSort("payment_date")}
                      >
                        Pagamento
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-base text-center"
                        onClick={() => handleSort("status")}
                      >
                        Status
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-base text-right"
                        onClick={() => handleSort("expected_amount")}
                      >
                        Valor Esperado
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-base text-right"
                        onClick={() => handleSort("amount_paid")}
                      >
                        Valor Pago
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="text-base text-center">
                          <Badge
                            variant="outline"
                            className={
                              payment.tipo === "Caução"
                                ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                                : payment.tipo === "Rescisão"
                                  ? "bg-purple-100 text-purple-800 border-purple-300"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
                            }
                          >
                            {payment.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-base text-center">
                          {payment.installment_number}
                        </TableCell>
                        <TableCell className="text-base text-center">
                          {new Date(payment.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-base text-center">
                          {payment.payment_date
                            ? new Date(payment.payment_date + "T00:00:00").toLocaleDateString("pt-BR")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-base text-center">
                          <Badge
                            variant="outline"
                            className={
                              payment.status === "pago"
                                ? "bg-green-100 text-green-700 border-green-300 status-pago"
                                : "bg-red-100 text-red-700 border-red-300 status-pendente"
                            }
                          >
                            {payment.status === "pago" ? "Pago" : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-base text-right ${
                            payment.expected_amount < 0 ? "text-red-600 font-semibold" : ""
                          }`}
                        >
                          {formatCurrency(payment.expected_amount)}
                        </TableCell>
                        <TableCell
                          className={`text-base text-right font-semibold ${
                            payment.amount_paid < 0 ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {payment.status === "pago" ? formatCurrency(payment.amount_paid) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={6} className="text-base text-right">
                        Total Pago:
                      </TableCell>
                      <TableCell className="text-base text-right text-green-600">
                        {formatCurrency(totalPaid)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}