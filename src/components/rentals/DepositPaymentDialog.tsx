import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AttachmentViewer } from "@/components/AttachmentViewer";
import { Paperclip, Calendar, DollarSign, FileText, CheckCircle2 } from "lucide-react";
import { applyMoneyMask, parseMoneyMaskToNumber, parseCurrencyToNumber } from "@/lib/masks";
import { useAlert } from "@/contexts/AlertContext";
import type { Rental, Attachment } from "@/types";
import { getDepositInstallmentsByRental, updateDepositInstallment } from "@/services/depositInstallmentService";

interface DepositPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: Rental | null;
  onSuccess?: () => void;
}

export function DepositPaymentDialog({
  open,
  onOpenChange,
  rental,
  onSuccess,
}: DepositPaymentDialogProps) {
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [paidValue, setPaidValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const { showAlert } = useAlert();

  const loadInstallments = useCallback(async () => {
    if (!rental?.id) return;

    try {
      setLoading(true);
      const data = await getDepositInstallmentsByRental(rental.id);
      setInstallments(data || []);

      // Auto-selecionar primeira parcela pendente
      const pending = data?.find((i: any) => i.status === "pending");
      if (pending) {
        setSelectedInstallment(pending);
        setPaidValue(applyMoneyMask(pending.amount.toString()));
      }
    } catch (error) {
      console.error("Erro ao carregar parcelas:", error);
    } finally {
      setLoading(false);
    }
  }, [rental?.id]);

  useEffect(() => {
    if (open && rental) {
      loadInstallments();
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setAttachments([]);
    }
  }, [open, rental, loadInstallments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uuid = crypto.randomUUID();
    const extension = file.name.split(".").pop();
    const fileName = `deposit_${uuid}.${extension}`;

    const formData = new FormData();
    formData.append("file", file, fileName);

    try {
      await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const attachment: Attachment = {
        id: uuid,
        name: file.name,
        url: `/uploads/${fileName}`,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        category: "deposit",
      };

      setAttachments((prev) => [...prev, attachment]);
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
    }

    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("🚀 [DepositPaymentDialog.handleSubmit] INÍCIO");
    console.log("📎 [DepositPaymentDialog.handleSubmit] attachments:", attachments);
    console.log("📦 [DepositPaymentDialog.handleSubmit] paymentDate:", paymentDate);
    console.log("📦 [DepositPaymentDialog.handleSubmit] paidValue:", paidValue);

    if (!paidValue || !paymentDate) {
      alert("Preencha a data e o valor do pagamento.");
      return;
    }

    if (!selectedInstallment) {
      alert("Selecione uma parcela.");
      return;
    }

    const updateData = {
      payment_date: paymentDate,
      paid_value: parseCurrencyToNumber(paidValue),
      status: "paid" as const,
      attachments: attachments, // ✅ CRITICAL: Attachments sendo salvos
      pix_code: null,
    };

    console.log("📦 [DepositPaymentDialog.handleSubmit] Dados que serão enviados:");
    console.log("📎 [DepositPaymentDialog.handleSubmit] updateData.attachments:", updateData.attachments);
    console.log("📦 [DepositPaymentDialog.handleSubmit] updateData completo:", updateData);

    try {
      setLoading(true);
      await updateDepositInstallment(selectedInstallment.id, updateData);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
      alert("Erro ao registrar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedInstallment || !paymentDate || !paidValue) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      setLoading(true);

      console.log("💾 [DepositPaymentDialog.handlePayment] Salvando:");
      console.log("📎 Attachments:", attachments);

      await updateDepositInstallment(selectedInstallment.id, {
        payment_date: paymentDate,
        paid_value: parseMoneyMaskToNumber(paidValue),
        status: "paid",
        attachments: attachments,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
      alert("Erro ao registrar pagamento");
    } finally {
      setLoading(false);
    }
  };

  if (!rental) return null;

  const totalDeposit = rental.depositAmount || 0;
  const installmentCount = installments.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="h-5 w-5 text-primary" />
            Registrar Recebimento de Caução
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Resumo da Caução */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Valor Total da Caução</p>
                  <p className="text-2xl font-bold text-primary">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(totalDeposit)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Parcelas</p>
                  <p className="text-2xl font-bold">
                    {installmentCount} {installmentCount === 1 ? "parcela" : "parcelas"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seleção de Parcela */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Selecione a Parcela</Label>
            <div className="grid gap-3">
              {installments.map((inst) => (
                <Card
                  key={inst.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedInstallment?.id === inst.id
                      ? "border-primary shadow-md ring-2 ring-primary/20"
                      : inst.status === "paid"
                      ? "bg-green-50 border-green-200"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => {
                    if (inst.status !== "paid") {
                      setSelectedInstallment(inst);
                      setPaidValue(applyMoneyMask(inst.amount.toString()));
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedInstallment?.id === inst.id}
                          disabled={inst.status === "paid"}
                          className="h-5 w-5"
                        />
                        <div>
                          <p className="font-semibold flex items-center gap-2">
                            {inst.installment_number}ª Parcela
                            {inst.status === "paid" && (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Vencimento:{" "}
                            {new Date(inst.due_date).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(inst.amount)}
                        </p>
                        {inst.status === "paid" && (
                          <p className="text-xs text-green-600 font-medium">Pago</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {selectedInstallment && selectedInstallment.status !== "paid" && (
            <>
              <Separator />

              {/* Dados do Pagamento */}
              <div className="space-y-4">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Dados do Recebimento
                </h3>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paidValue" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Valor Recebido *
                    </Label>
                    <Input
                      id="paidValue"
                      value={paidValue}
                      onChange={(e) => setPaidValue(applyMoneyMask(e.target.value))}
                      placeholder="R$ 0,00"
                      className="text-lg font-semibold"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentDate" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Data do Recebimento *
                    </Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="text-lg"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Anexos */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Comprovantes
                </Label>

                {attachments.length > 0 && (
                  <AttachmentViewer
                    attachments={attachments}
                    onRemove={removeAttachment}
                  />
                )}

                <div>
                  <input
                    id="depositFileUpload"
                    type="file"
                    accept="image/*,.pdf"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => document.getElementById("depositFileUpload")?.click()}
                  >
                    <Paperclip className="mr-2 h-4 w-4" />
                    Anexar Comprovante
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rodapé com Totais e Ações */}
        <div className="sticky bottom-0 bg-background border-t pt-4 mt-4 space-y-4">
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Valor do Aluguel:
                </span>
                <span className="text-lg font-semibold">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(rental.monthlyRent || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Valor Total:
                </span>
                <span className="text-xl font-bold text-primary">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format((rental.monthlyRent || 0) + parseMoneyMaskToNumber(paidValue))}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePayment}
              disabled={loading || !selectedInstallment || selectedInstallment.status === "paid"}
              className="flex-1"
            >
              {loading ? "Salvando..." : "Atualizar Locação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}