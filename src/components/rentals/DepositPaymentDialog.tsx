import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAlert } from "@/contexts/AlertContext";
import { formatCurrency, formatCurrencyInput, parseCurrencyToNumber } from "@/lib/masks";
import { supabase } from "@/integrations/supabase/client";
import type { DepositInstallment, Rental } from "@/types";
import { Calendar, DollarSign, FileText, Receipt, Paperclip, X } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getAllPaymentMethods } from "@/services/paymentMethodService";
import { LateFeeInterestBlock } from "@/components/payments/LateFeeInterestBlock";
import { PaymentAttachments } from "@/components/payments/PaymentAttachments";
import { validateAttachmentFile } from "@/lib/attachmentValidation";

interface DepositPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: DepositInstallment;
  rental: Rental;
  onSuccess: () => void;
}

interface AttachmentEntry {
  url: string;
  name: string;
  description?: string;
  uploadProgress?: number;
}

// ✅ Tela restaurada para o padrão anterior (forma de pagamento, observações, multa/juros
// por atraso, editar/excluir recebimento já feito), com os anexos usando exatamente o
// mesmo componente e mecanismo de upload da tela de Recebimento de Aluguel (Supabase
// Storage, não mais /api/upload, que não persiste em produção).
export function DepositPaymentDialog({
  open,
  onOpenChange,
  installment,
  rental,
  onSuccess,
}: DepositPaymentDialogProps) {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);

  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: number]: number }>({});
  const [includeLateFee, setIncludeLateFee] = useState(true);
  const [includeInterest, setIncludeInterest] = useState(true);
  const [paymentMethodsTable, setPaymentMethodsTable] = useState<Array<{ code: string; name: string }>>([]);

  useEffect(() => {
    const loadConfig = async () => {
      const { data } = await supabase.from("configs").select("*").single();
      setConfig(data);
    };

    const loadPaymentMethods = async () => {
      try {
        const methods = await getAllPaymentMethods();
        setPaymentMethodsTable(methods.filter(m => m.active).map(m => ({ code: m.code, name: m.name })));
      } catch (err) {
        console.error("Erro ao carregar formas de pagamento:", err);
        setPaymentMethodsTable([
          { code: "pix", name: "PIX" },
          { code: "dinheiro", name: "Dinheiro" },
        ]);
      }
    };

    loadConfig();
    loadPaymentMethods();
  }, []);

  useEffect(() => {
    if (open && installment) {
      if (installment.payment_date) {
        // Editando recebimento existente
        setPaymentDate(installment.payment_date);
        setPaymentMethod(installment.payment_method || "pix");
        setPaidAmount(formatCurrency(installment.paid_amount || installment.amount));
        setNotes(installment.notes || "");

        const existingAttachments = Array.isArray(installment.attachments) ? installment.attachments : [];
        setAttachments(
          existingAttachments.map((att: any) => {
            if (typeof att === "string") {
              return { url: att, name: att.split("/").pop() || "Arquivo" };
            }
            return { url: att.url, name: att.name || att.url?.split("/").pop() || "Arquivo", description: att.description };
          })
        );
      } else {
        // Novo recebimento
        setPaymentDate(new Date().toISOString().split("T")[0]);
        setPaymentMethod("pix");
        setPaidAmount(formatCurrency(installment.amount));
        setNotes("");
        setAttachments([]);
      }
    }
  }, [open, installment]);

  // Cálculos de multa e juros
  const calculations = useMemo(() => {
    if (!installment.due_date || !config) {
      return {
        daysLate: 0,
        lateFee: 0,
        interest: 0,
        totalWithFees: installment.amount,
        finalTotal: installment.amount,
      };
    }

    const due = new Date(installment.due_date + "T00:00:00");
    const payment = new Date(paymentDate + "T00:00:00");
    payment.setHours(0, 0, 0, 0);

    const daysLate = Math.max(0, differenceInDays(payment, due));

    let lateFee = 0;
    let interest = 0;

    if (daysLate > 0) {
      lateFee = installment.amount * (config.late_fee_percentage || 2) / 100;
      interest = installment.amount * (config.interest_rate_percentage || 0.033) / 100 * daysLate;
    }

    const totalWithFees = installment.amount + lateFee + interest;

    let finalTotal = installment.amount;
    if (daysLate > 0) {
      if (includeLateFee) finalTotal += lateFee;
      if (includeInterest) finalTotal += interest;
    }

    return {
      daysLate,
      lateFee,
      interest,
      totalWithFees,
      finalTotal,
    };
  }, [installment.due_date, installment.amount, config, includeLateFee, includeInterest, paymentDate]);

  useEffect(() => {
    setPaidAmount(formatCurrency(calculations.finalTotal));
  }, [calculations.finalTotal]);

  // ✅ Upload para o Supabase Storage - mesmo bucket/mecanismo já usado no recebimento
  // de aluguel. Antes ia para /api/upload (disco local do servidor), que não persiste
  // em produção no Vercel - por isso o anexo sumia ao reabrir a locação.
  const uploadToSupabase = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `deposit-attachments/${fileName}`;

    const { error } = await supabase.storage
      .from("uploads")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from("uploads")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const addAttachment = useCallback(() => {
    setAttachments(prev => [...prev, { url: "", name: "", description: "" }]);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateAttachmentFile(file);
    if (!validation.ok) {
      showAlert({
        title: "Arquivo não permitido",
        description: validation.message,
        type: "error",
      });
      return;
    }

    setUploadingFile(true);
    setUploadProgress(prev => ({ ...prev, [index]: 0 }));

    try {
      setUploadProgress(prev => ({ ...prev, [index]: 30 }));

      const publicUrl = await uploadToSupabase(file);

      setUploadProgress(prev => ({ ...prev, [index]: 100 }));

      setAttachments(prev => {
        const newAttachments = [...prev];
        newAttachments[index] = {
          ...newAttachments[index],
          url: publicUrl,
          name: file.name,
          uploadProgress: 100,
        };
        return newAttachments;
      });
    } catch (error) {
      console.error("❌ Upload error:", error);

      showAlert({
        title: "Erro ao enviar arquivo",
        description: error instanceof Error ? error.message : "Erro ao enviar arquivo. Tente novamente",
        type: "error",
      });

      setAttachments(prev => {
        const newAttachments = [...prev];
        newAttachments[index] = { ...newAttachments[index], url: "", name: "", uploadProgress: 0 };
        return newAttachments;
      });
    } finally {
      setUploadingFile(false);
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[index];
        return newProgress;
      });
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!installment) {
      showAlert({
        title: "Erro",
        description: "Parcela não encontrada",
        type: "error",
      });
      return;
    }

    try {
      setLoading(true);

      const { data: dbInstallment, error: fetchError } = await supabase
        .from("deposit_installments")
        .select("*")
        .eq("id", installment.id)
        .single();

      if (fetchError || !dbInstallment) {
        console.error("Erro ao buscar parcela:", fetchError);
        showAlert({
          title: "Erro",
          description: "Parcela não encontrada no banco de dados. Por favor, recarregue a página.",
          type: "error",
        });
        return;
      }

      const paidValue = parseCurrencyToNumber(paidAmount);
      if (paidValue <= 0) {
        showAlert({
          title: "Erro",
          description: "Informe um valor válido",
          type: "error",
        });
        return;
      }

      let status: "pending" | "paid" | "partial" | "overdue" = "pending";
      if (paidValue >= dbInstallment.amount) {
        status = "paid";
      } else if (paidValue > 0) {
        status = "partial";
      }

      const validAttachments = attachments.filter(a => a.url);

      const updateData = {
        payment_date: paymentDate,
        payment_method: paymentMethod,
        paid_amount: paidValue,
        penalty_amount: calculations.lateFee,
        interest_amount: calculations.interest,
        status,
        notes: notes || null,
        attachments: validAttachments as any,
      };

      const { error } = await supabase
        .from("deposit_installments")
        .update(updateData)
        .eq("id", installment.id);

      if (error) throw error;

      showAlert({
        title: "Sucesso",
        description: "Recebimento de caução registrado com sucesso!",
        type: "success",
        onConfirm: () => {
          onSuccess();
          onOpenChange(false);
        },
      });
    } catch (error) {
      console.error("Erro ao registrar recebimento:", error);
      showAlert({
        title: "Erro",
        description: "Não foi possível registrar o recebimento",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [paymentDate, paymentMethod, paidAmount, notes, attachments, calculations, installment, onSuccess, onOpenChange, showAlert]);

  const handleDelete = async () => {
    if (!confirm("Deseja realmente excluir este recebimento? O status voltará para Pendente.")) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("deposit_installments")
        .update({
          payment_date: null,
          payment_method: null,
          paid_amount: 0,
          penalty_amount: null,
          interest_amount: null,
          status: "pending",
          notes: null,
          attachments: null,
        })
        .eq("id", installment.id);

      if (error) throw error;

      showAlert({
        title: "Sucesso",
        description: "Recebimento excluído com sucesso!",
        type: "success",
        onConfirm: () => {
          onSuccess();
          onOpenChange(false);
        },
      });
    } catch (error) {
      console.error("Erro ao excluir recebimento:", error);
      showAlert({
        title: "Erro",
        description: "Não foi possível excluir o recebimento",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const isPaid = installment.status === "paid" && installment.payment_date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-5 w-5" />
            Registrar Recebimento de Caução - Parcela {installment.installment_number}/{installment.total_installments}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Informações do Caução */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Informações do Caução
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Parcela</span>
                  <span className="font-semibold">
                    {installment.installment_number}/{installment.total_installments}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Valor da Parcela</span>
                  <span className="font-bold text-green-600">{formatCurrency(installment.amount)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Data de Vencimento</span>
                  <span className="font-medium">
                    {installment.due_date
                      ? format(new Date(installment.due_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      installment.status === "paid"
                        ? "default"
                        : installment.status === "overdue"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {installment.status === "paid"
                      ? "Pago"
                      : installment.status === "overdue"
                      ? "Atrasado"
                      : "Pendente"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Dados do Recebimento do Caução */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Dados do Recebimento do Caução
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="paymentDate">Data do Recebimento *</Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="paymentMethod">Forma de Pagamento *</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(value) => setPaymentMethod(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a forma de pagamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethodsTable.map((method) => (
                          <SelectItem key={method.code} value={method.code}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="paidAmount">Valor Pago *</Label>
                    <Input
                      id="paidAmount"
                      type="text"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(formatCurrencyInput(e.target.value))}
                      placeholder="R$ 0,00"
                      required
                    />
                  </div>
                </div>

                {calculations.daysLate > 0 && (
                  <LateFeeInterestBlock
                    daysLate={calculations.daysLate}
                    lateFee={calculations.lateFee}
                    interest={calculations.interest}
                    finalTotal={calculations.finalTotal}
                    includeLateFee={includeLateFee}
                    includeInterest={includeInterest}
                    onIncludeLateFeeChange={setIncludeLateFee}
                    onIncludeInterestChange={setIncludeInterest}
                    lateFeePercentage={config?.late_fee_percentage || 2}
                    interestRatePercentage={config?.interest_rate_percentage || 0.033}
                  />
                )}

                {calculations.daysLate === 0 && (
                  <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex justify-between items-center font-bold text-base">
                      <span className="text-green-700 dark:text-green-400">VALOR TOTAL</span>
                      <span className="text-green-600">
                        {formatCurrency(installment.amount)}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações adicionais sobre o recebimento..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Anexos - mesmo componente/comportamento da tela de Recebimento de Aluguel:
              anexar (com opção de câmera no celular), visualizar e baixar. */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Anexos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentAttachments
                attachments={attachments}
                uploadingFile={uploadingFile}
                uploadProgress={uploadProgress}
                isReadOnly={false}
                onFileChange={handleFileChange}
                onRemoveAttachment={removeAttachment}
                onAddAttachment={addAttachment}
              />
            </CardContent>
          </Card>

          {/* Botões */}
          <div className="flex justify-between gap-3 pt-4 border-t">
            <div>
              {isPaid && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Excluir Recebimento
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : isPaid ? "Atualizar" : "Registrar Recebimento"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
