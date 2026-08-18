import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { DepositInstallment, DepositPartialPaymentEntry, Rental } from "@/types";
import { Calendar, DollarSign, CreditCard, Receipt, Paperclip, X, History, Trash2, Edit, ShieldCheck } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getAllPaymentMethods } from "@/services/paymentMethodService";
import { LateFeeInterestBlock } from "@/components/payments/LateFeeInterestBlock";
import { PaymentAttachments } from "@/components/payments/PaymentAttachments";
import { PaymentInfoCards } from "@/components/payments/PaymentInfoCards";
import { validateAttachmentFile } from "@/lib/attachmentValidation";
import { forceDialogCleanup } from "@/lib/forceCleanup";
import { DepositReceipt } from "@/components/rentals/DepositReceipt";

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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  transferencia: "Transferência Bancária",
  boleto: "Boleto",
  cartao: "Cartão",
};

// ✅ Tela de recebimento de CAUÇÃO redesenhada pra ficar o mais parecida
// possível com a tela de recebimento de ALUGUEL (mesmos cards, mesmo
// comportamento de trava quando já está pago - só editável clicando em
// "Editar", igual já funciona no aluguel), com a etiqueta "CAUÇÃO" e um
// destaque em índigo como diferencial visual, pra não confundir uma com a
// outra. Cada pagamento registrado vira uma entrada no histórico
// (`partial_payments`), com recibo e exclusão individual por entrada.
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

  // Dados "crus" da locação/imóvel/inquilino, buscados direto do banco só
  // pra reaproveitar o mesmo card de informações (PaymentInfoCards) que a
  // tela de aluguel usa - ele espera os campos no formato do banco
  // (snake_case), não no formato já traduzido do tipo Rental usado aqui.
  const [rawRental, setRawRental] = useState<any>(null);
  const [rawProperty, setRawProperty] = useState<any>(null);
  const [rawTenant, setRawTenant] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

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
  const [isEditMode, setIsEditMode] = useState(false);

  // Histórico de pagamentos já registrados nesta parcela
  const history: DepositPartialPaymentEntry[] = Array.isArray(installment.partial_payments)
    ? installment.partial_payments
    : [];
  const previousPaidTotal = history.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);

  const [entryIndexToDelete, setEntryIndexToDelete] = useState<number | null>(null);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);
  const [receiptEntry, setReceiptEntry] = useState<DepositPartialPaymentEntry | null>(null);

  // ✅ Igual ao recebimento de aluguel: uma vez PAGO, a tela fica travada
  // (só leitura) até clicar em "Editar" - evita mexer sem querer num
  // recebimento já concluído e parar de "contar" multa/juros como se ainda
  // estivesse em aberto.
  const isPaid = installment.status === "paid";
  const isReadOnly = isPaid && !isEditMode;

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

  // Busca os dados completos da locação/imóvel/inquilino (mesmo formato usado
  // pela tela de aluguel) pra mostrar no card de informações no topo.
  useEffect(() => {
    if (!open || !rental?.id) return;

    const loadInfo = async () => {
      setLoadingInfo(true);
      try {
        const { data, error } = await supabase
          .from("rentals")
          .select("*, properties(*, locations(*)), tenants(*)")
          .eq("id", rental.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setRawRental(data);
          setRawProperty((data as any).properties || null);
          setRawTenant((data as any).tenants || null);
        }
      } catch (err) {
        console.error("Erro ao carregar dados da locação para o recebimento de caução:", err);
      } finally {
        setLoadingInfo(false);
      }
    };

    loadInfo();
  }, [open, rental?.id]);

  // ✅ CORREÇÃO: mostra os dados REAIS do último pagamento registrado (data,
  // forma, observações, anexos) - antes sempre mostrava a data de HOJE no
  // campo "Data do Recebimento", mesmo pra uma parcela já paga com outra data
  // escolhida (o histórico ficava certo, mas o campo acima dele mentia).
  // Igual ao aluguel: parcela paga mostra os valores travados; parcela
  // pendente/parcial já vem pronta pra registrar um pagamento novo.
  const resetFieldsFromInstallment = useCallback(() => {
    const alreadyPaid = installment.status === "paid";

    setPaymentDate(installment.payment_date || new Date().toISOString().split("T")[0]);
    setPaymentMethod(installment.payment_method || "pix");
    setNotes(alreadyPaid ? (installment.notes || "") : "");

    const existingAttachments = Array.isArray(installment.attachments) ? installment.attachments : [];
    setAttachments(
      existingAttachments.map((att: any) =>
        typeof att === "string"
          ? { url: att, name: att.split("/").pop() || "Arquivo" }
          : { url: att.url, name: att.name || att.url?.split("/").pop() || "Arquivo", description: att.description }
      )
    );
  }, [installment]);

  useEffect(() => {
    if (open && installment) {
      resetFieldsFromInstallment();
      setIsEditMode(false);
    }
  }, [open, installment.id]);

  // Cálculos de multa e juros (sobre o saldo que ainda falta pagar da parcela)
  const calculations = useMemo(() => {
    const remainingBase = Math.max((installment.amount || 0) - previousPaidTotal, 0);

    // ✅ Parcela já paga e ainda não em modo Editar: mostra a multa/juros que
    // ficaram registrados no momento do pagamento (histórico), sem recalcular
    // com base na data de hoje - o recebimento já foi concluído.
    if (isReadOnly) {
      const lateFee = installment.penalty_amount || 0;
      const interest = installment.interest_amount || 0;
      return {
        daysLate: lateFee > 0 || interest > 0 ? 1 : 0,
        lateFee,
        interest,
        totalWithFees: remainingBase + lateFee + interest,
        finalTotal: remainingBase,
      };
    }

    if (!installment.due_date || !config) {
      return {
        daysLate: 0,
        lateFee: 0,
        interest: 0,
        totalWithFees: remainingBase,
        finalTotal: remainingBase,
      };
    }

    const due = new Date(installment.due_date + "T00:00:00");
    const paymentDay = new Date(paymentDate + "T00:00:00");
    paymentDay.setHours(0, 0, 0, 0);

    const daysLate = Math.max(0, differenceInDays(paymentDay, due));

    let lateFee = 0;
    let interest = 0;

    if (daysLate > 0) {
      lateFee = installment.amount * (config.late_fee_percentage || 2) / 100;
      interest = installment.amount * (config.interest_rate_percentage || 0.033) / 100 * daysLate;
    }

    const totalWithFees = remainingBase + lateFee + interest;

    let finalTotal = remainingBase;
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
  }, [installment.due_date, installment.amount, installment.penalty_amount, installment.interest_amount, previousPaidTotal, config, includeLateFee, includeInterest, paymentDate, isReadOnly]);

  useEffect(() => {
    if (isReadOnly) {
      setPaidAmount(formatCurrency(previousPaidTotal || installment.amount));
      return;
    }
    // ✅ Igual ao aluguel: só recalcula o "Valor Pago" sozinho enquanto a
    // parcela NÃO está paga (pendente/parcial). Quando já está paga e o
    // usuário clicou em "Editar", quem controla o valor é o handleEnableEdit
    // (reseta pra R$ 0,00) - não sobrescreve o que ele decidir digitar.
    if (!isPaid) {
      setPaidAmount(formatCurrency(calculations.finalTotal));
    }
  }, [calculations.finalTotal, isReadOnly, isPaid, previousPaidTotal, installment.amount]);

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

  // ✅ "Editar" mantém a data/forma/observações/anexos JÁ registrados (edição
  // no lugar, igual ao aluguel) - só o valor volta pra R$ 0,00, pronto pra
  // registrar um pagamento adicional se for o caso.
  const handleEnableEdit = useCallback(() => {
    setIsEditMode(true);
    setPaidAmount(formatCurrency(0));
  }, []);

  // Descarta qualquer alteração feita em modo Editar e volta a mostrar os
  // dados reais já registrados.
  const handleCancelEdit = useCallback(() => {
    setIsEditMode(false);
    resetFieldsFromInstallment();
  }, [resetFieldsFromInstallment]);

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

      const currentHistory: DepositPartialPaymentEntry[] = Array.isArray(dbInstallment.partial_payments)
        ? (dbInstallment.partial_payments as unknown as DepositPartialPaymentEntry[])
        : [];
      const currentPaidTotal = currentHistory.reduce((sum, entry) => sum + Math.abs(entry.amount || 0), 0);
      const finalPaidAmount = currentPaidTotal + paidValue;

      let status: "pending" | "paid" | "partial" | "overdue" = "pending";
      if (finalPaidAmount >= dbInstallment.amount - 0.01) {
        status = "paid";
      } else if (finalPaidAmount > 0) {
        status = "partial";
      }

      const validAttachments = attachments.filter(a => a.url);

      const newEntry: DepositPartialPaymentEntry = {
        amount: paidValue,
        expected_amount: parseFloat(Math.max(dbInstallment.amount - currentPaidTotal, 0).toFixed(2)),
        payment_date: paymentDate,
        payment_method: paymentMethod,
        notes: notes || null,
        attachments: validAttachments,
        registered_at: new Date().toISOString(),
      };

      const updatedHistory = [...currentHistory, newEntry];

      const updateData = {
        payment_date: paymentDate,
        payment_method: paymentMethod,
        paid_amount: finalPaidAmount,
        penalty_amount: calculations.lateFee,
        interest_amount: calculations.interest,
        status,
        notes: notes || null,
        attachments: validAttachments as any,
        partial_payments: updatedHistory as any,
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

  // ✅ Reseta a parcela inteira (todos os pagamentos e o histórico) de volta
  // pra Pendente - equivalente ao "Cancelar Pagamento" do aluguel.
  const handleDelete = async () => {
    if (!confirm("Deseja realmente excluir todos os recebimentos desta parcela? O status voltará para Pendente e o histórico será apagado.")) {
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
          partial_payments: [],
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

  // ✅ Exclui só UMA entrada do histórico (um recibo específico), recalculando
  // o total pago e o status da parcela a partir do que sobrar.
  const handleConfirmDeleteEntry = useCallback(async () => {
    if (entryIndexToDelete === null) return;

    setIsDeletingEntry(true);
    try {
      const { data: dbInstallment, error: fetchError } = await supabase
        .from("deposit_installments")
        .select("*")
        .eq("id", installment.id)
        .single();

      if (fetchError || !dbInstallment) {
        throw fetchError || new Error("Parcela não encontrada");
      }

      const currentHistory: DepositPartialPaymentEntry[] = Array.isArray(dbInstallment.partial_payments)
        ? (dbInstallment.partial_payments as unknown as DepositPartialPaymentEntry[])
        : [];
      const updatedHistory = currentHistory.filter((_, i) => i !== entryIndexToDelete);
      const newPaidAmount = updatedHistory.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);

      let newStatus: "pending" | "paid" | "partial" | "overdue" = "pending";
      if (newPaidAmount <= 0) {
        newStatus = "pending";
      } else if (newPaidAmount >= dbInstallment.amount - 0.01) {
        newStatus = "paid";
      } else {
        newStatus = "partial";
      }

      const lastEntry = updatedHistory[updatedHistory.length - 1];

      const { error: updateError } = await supabase
        .from("deposit_installments")
        .update({
          partial_payments: updatedHistory as any,
          paid_amount: newPaidAmount,
          status: newStatus,
          payment_date: lastEntry ? lastEntry.payment_date : null,
          payment_method: lastEntry ? lastEntry.payment_method : null,
          notes: lastEntry ? lastEntry.notes : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", installment.id);

      if (updateError) throw updateError;

      showAlert({
        title: "Sucesso",
        description: "Recibo excluído com sucesso!",
        type: "success",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao excluir recibo do histórico:", error);
      showAlert({
        title: "Erro",
        description: "Não foi possível excluir o recibo",
        type: "error",
      });
    } finally {
      setIsDeletingEntry(false);
      setEntryIndexToDelete(null);
    }
  }, [entryIndexToDelete, installment.id, showAlert, onSuccess, onOpenChange]);

  const remainingBalance = Math.max((installment.amount || 0) - previousPaidTotal, 0);
  const canRegisterExtra = !isPaid || isEditMode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto border-l-4 border-l-indigo-500">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold justify-center">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            Recebimento de Caução
            <Badge className="bg-indigo-600 text-white hover:bg-indigo-600">CAUÇÃO</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="text-center -mt-2 mb-2">
          <span className="text-sm text-muted-foreground">
            Parcela {installment.installment_number}/{installment.total_installments}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <PaymentInfoCards
            tenant={loadingInfo ? null : rawTenant}
            property={loadingInfo ? null : rawProperty}
            rental={loadingInfo ? null : rawRental}
          />

          {/* Histórico de pagamentos já registrados nesta parcela, cada um com
              seu próprio recibo e opção de excluir só aquela entrada - mesmo
              formato/posição do histórico de aluguel. */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Pagamentos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.map((entry, index) => (
                  <div
                    key={index}
                    className="rounded-md bg-muted/50 p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1"
                  >
                    <span className="font-medium">{formatCurrency(entry.amount)}</span>
                    <span className="text-muted-foreground">
                      {entry.payment_date
                        ? format(new Date(entry.payment_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </span>
                    {entry.payment_method && (
                      <span className="text-muted-foreground uppercase">
                        {PAYMENT_METHOD_LABELS[entry.payment_method] || entry.payment_method}
                      </span>
                    )}
                    {entry.notes && <span className="text-muted-foreground italic">{entry.notes}</span>}
                    <div className="ml-auto flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => setReceiptEntry(entry)}
                      >
                        Recibo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-red-600 hover:text-red-700"
                        onClick={() => setEntryIndexToDelete(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Valores da parcela de caução - equivalente ao card de "Formação de
                Valores" do aluguel, só que sem Aluguel/Garagem (é um valor fixo). */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Valores da Caução
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Valor da Parcela</span>
                  <span className="font-bold text-green-600">{formatCurrency(installment.amount)}</span>
                </div>
                {previousPaidTotal > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Já Pago</span>
                    <span className="font-semibold text-green-600">{formatCurrency(previousPaidTotal)}</span>
                  </div>
                )}
                {!isPaid && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Saldo Restante</span>
                    <span className="font-semibold">{formatCurrency(remainingBalance)}</span>
                  </div>
                )}
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
                      : installment.status === "partial"
                      ? "Parcial"
                      : installment.status === "overdue"
                      ? "Atrasado"
                      : "Pendente"}
                  </Badge>
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
              </CardContent>
            </Card>

            {/* Dados do pagamento a registrar - mesmo card/ícone que o
                aluguel usa ("Informações do Pagamento"). */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {canRegisterExtra ? "Informações do Pagamento" : "Recebimento Concluído"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!canRegisterExtra && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400">
                    ✅ Esta parcela já está totalmente paga. Clique em "Editar" pra alterar os dados ou registrar um pagamento adicional.
                  </div>
                )}
                <div>
                  <Label htmlFor="paymentDate">Data do Recebimento *</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    disabled={isReadOnly}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="paymentMethod">Forma de Pagamento *</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value)}
                    disabled={isReadOnly}
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
                    disabled={isReadOnly}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações adicionais sobre o recebimento..."
                    rows={3}
                    disabled={isReadOnly}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Anexos - mesmo componente/comportamento da tela de Recebimento de Aluguel:
              anexar (com opção de câmera no celular), visualizar e baixar. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Anexos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentAttachments
                attachments={attachments}
                uploadingFile={uploadingFile}
                uploadProgress={uploadProgress}
                isReadOnly={isReadOnly}
                onFileChange={handleFileChange}
                onRemoveAttachment={removeAttachment}
                onAddAttachment={addAttachment}
              />
            </CardContent>
          </Card>

          {/* Botões - mesmo padrão do aluguel: quando pago e não em modo Editar,
              só "Fechar"/"Editar"; "Excluir Todos os Recebimentos" sempre visível
              à esquerda quando já tem algo pago/parcial. */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t">
            <div>
              {(isPaid || installment.status === "partial") && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Excluir Todos os Recebimentos
                </Button>
              )}
            </div>

            <div className="flex gap-3">
              {isReadOnly ? (
                <>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    <X className="mr-2 h-4 w-4" />
                    Fechar
                  </Button>
                  <Button type="button" onClick={handleEnableEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={isPaid ? handleCancelEdit : () => onOpenChange(false)}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading} size="lg">
                    {loading ? "Salvando..." : "Registrar Recebimento"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </form>
      </DialogContent>

      {/* Confirmação de exclusão de UMA entrada do histórico */}
      <AlertDialog
        open={entryIndexToDelete !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEntryIndexToDelete(null);
            setTimeout(() => {
              if (document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]').length === 0) {
                forceDialogCleanup();
              }
            }, 100);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este recibo?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O valor total pago e o status da parcela serão recalculados
              a partir dos recibos restantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingEntry}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteEntry}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingEntry}
            >
              {isDeletingEntry ? "Excluindo..." : "Excluir recibo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {receiptEntry && (
        <DepositReceipt
          installment={installment}
          rental={rental}
          entry={receiptEntry}
          onClose={() => setReceiptEntry(null)}
        />
      )}
    </Dialog>
  );
}
