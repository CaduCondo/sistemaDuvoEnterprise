import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ChevronDown, ChevronUp, Handshake, Receipt } from "lucide-react";
import { useAlert } from "@/contexts/AlertContext";
import { formatMoneyForDisplay } from "@/lib/masks";
import { PaymentReceipt } from "@/components/PaymentReceipt";
import {
  buscarAcordo,
  desfazerAcordo,
  type AcordoDetalhado,
  type LinhaDoAcordo,
} from "@/services/paymentAgreementService";

/**
 * Bloco "Acordo de parcelamento #N" (#119), mostrado ao abrir uma parcela do
 * acordo ou um recebimento que entrou nele.
 *  - cada linha (parcela ou recebimento original) abre o PRÓPRIO recebimento;
 *  - coluna "Recibo": recibo de cada pagamento das parcelas pagas (uma parcela
 *    paga em mais de uma vez tem um recibo por pagamento);
 *  - "Desfazer acordo" enquanto nenhuma parcela tiver pagamento.
 */

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-800" },
  overdue: { label: "Atrasado", className: "bg-red-100 text-red-800" },
  partial: { label: "Parcial", className: "bg-orange-100 text-orange-800" },
  paid: { label: "Pago", className: "bg-green-100 text-green-800" },
  renegotiated: { label: "Renegociado", className: "bg-slate-200 text-slate-700" },
};

const dataBR = (iso: string) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "-");

interface Props {
  acordoId: string;
  /** Recebimento que está aberto agora (a linha dele fica destacada). */
  paymentIdAtual?: string;
  onChanged?: () => void;
  /** Abre outro recebimento (parcela ou original) no lugar do atual. */
  onOpenPayment?: (paymentId: string) => void;
  rental?: any;
  property?: any;
  tenant?: any;
}

/** Um recibo por pagamento: o histórico de parciais, ou o pagamento único. */
function pagamentosDaParcela(linha: LinhaDoAcordo): { indice: number; entrada: any | null }[] {
  if (linha.status !== "paid" && linha.status !== "partial") return [];
  const historico = Array.isArray(linha.bruto?.partial_payments) ? linha.bruto.partial_payments : [];
  if (historico.length > 0) return historico.map((entrada: any, indice: number) => ({ indice, entrada }));
  return [{ indice: 0, entrada: null }];
}

export function PaymentAgreementInfo({ acordoId, paymentIdAtual, onChanged, onOpenPayment, rental, property, tenant }: Props) {
  const { showAlert } = useAlert();
  const [acordo, setAcordo] = useState<AcordoDetalhado | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [mostrarOriginais, setMostrarOriginais] = useState(false);
  const [recibo, setRecibo] = useState<any | null>(null);

  const carregar = useCallback(async () => {
    try {
      setAcordo(await buscarAcordo(acordoId));
    } catch (e: any) {
      showAlert({ title: "Erro", description: e?.message || "Não foi possível carregar o acordo.", type: "error" });
    }
  }, [acordoId, showAlert]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!acordo) return null;

  const desfazer = async () => {
    setDesfazendo(true);
    try {
      await desfazerAcordo(acordo.id);
      showAlert({
        title: "Acordo desfeito",
        description: "As parcelas foram apagadas e os recebimentos originais voltaram como estavam.",
        type: "success",
      });
      setConfirmando(false);
      onChanged?.();
    } catch (e: any) {
      showAlert({ title: "Não foi possível desfazer", description: e?.message || String(e), type: "error" });
    } finally {
      setDesfazendo(false);
    }
  };

  /** Monta o "Payment" que o recibo espera (mesmo formato do recibo de parcial). */
  const abrirRecibo = (linha: LinhaDoAcordo, entrada: any | null) => {
    const p = linha.bruto;
    const pago = entrada ? Number(entrada.amount) || 0 : Number(p.paid_amount) || 0;
    setRecibo({
      id: p.id,
      dueDate: p.due_date,
      referenceMonth: Number(p.reference_month),
      referenceYear: Number(p.reference_year),
      installment: p.installment,
      totalInstallments: p.total_installments,
      status: entrada ? "partial" : p.status,
      paymentKind: "agreement",
      property,
      tenant,
      rental,
      paidAmount: pago,
      expectedAmount: entrada ? pago : Number(p.expected_amount) || 0,
      paymentDate: entrada ? entrada.payment_date : p.payment_date,
      paymentTime: entrada ? entrada.payment_time : p.payment_time,
      paymentMethod: entrada ? entrada.payment_method : p.payment_method,
      // o recibo usa a 1ª linha da Formação de Valores como nome da parcela
      notes: linha.descricao,
      breakdown: [{ description: linha.descricao, amount: pago, type: "addition" }],
      payment_kind: "agreement",
      late_fee: entrada ? 0 : p.late_fee || 0,
      interest: entrada ? 0 : p.interest || 0,
      paid_amount: pago,
      expected_amount: entrada ? pago : p.expected_amount,
      discount_amount: 0,
      payment_time: entrada ? entrada.payment_time : p.payment_time,
    });
  };

  const linhaClicavel = (linha: LinhaDoAcordo) => ({
    className: `border-t ${onOpenPayment ? "cursor-pointer hover:bg-accent" : ""} ${
      linha.id === paymentIdAtual ? "bg-sky-50 dark:bg-sky-950 font-medium" : ""
    }`,
    onClick: onOpenPayment && linha.id !== paymentIdAtual ? () => onOpenPayment(linha.id) : undefined,
    title: onOpenPayment && linha.id !== paymentIdAtual ? "Abrir este recebimento" : undefined,
  });

  return (
    <Card id="acordo-info" className="border-slate-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Handshake className="h-4 w-4" />
          Acordo de parcelamento #{acordo.numero}
          {acordo.status === "undone" && <Badge className="bg-slate-200 text-slate-700">Desfeito</Badge>}
          {acordo.status === "paid" && <Badge className="bg-green-100 text-green-800">Quitado</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <div className="text-xs text-muted-foreground">Feito em</div>
            {dataBR(acordo.dataAcordo)}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Saldo original</div>
            {formatMoneyForDisplay(acordo.totalOriginal)}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Multa + juros − desconto</div>
            {formatMoneyForDisplay(acordo.multaJuros - acordo.desconto)}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total do acordo</div>
            <strong>{formatMoneyForDisplay(acordo.totalAcordado)}</strong>
          </div>
        </div>

        <table id="acordo-parcelas" className="w-full">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="font-normal py-1">Parcela</th>
              <th className="font-normal">Vencimento</th>
              <th className="font-normal text-right">Valor</th>
              <th className="font-normal text-right">Status</th>
              <th className="font-normal text-right">Recibo</th>
            </tr>
          </thead>
          <tbody>
            {acordo.parcelas.map((p) => {
              const st = STATUS[p.status] || STATUS.pending;
              const recibos = pagamentosDaParcela(p);
              return (
                <tr key={p.id} data-parcela-id={p.id} {...linhaClicavel(p)}>
                  <td className="py-1">{p.descricao}</td>
                  <td>{dataBR(p.vencimento)}</td>
                  <td className="text-right">{formatMoneyForDisplay(p.valor)}</td>
                  <td className="text-right">
                    <Badge className={st.className}>{st.label}</Badge>
                  </td>
                  <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {recibos.length === 0
                      ? "-"
                      : recibos.map((r) => (
                          <Button
                            key={r.indice}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            title={recibos.length > 1 ? `Recibo do ${r.indice + 1}º pagamento` : "Recibo"}
                            data-testid={`acordo-recibo-${p.id}-${r.indice}`}
                            onClick={() => abrirRecibo(p, r.entrada)}
                          >
                            <Receipt className="h-4 w-4" />
                            {recibos.length > 1 && <span className="ml-1 text-xs">{r.indice + 1}</span>}
                          </Button>
                        ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div>
          <button
            id="acordo-ver-originais"
            type="button"
            className="text-xs text-muted-foreground flex items-center gap-1 hover:underline"
            onClick={() => setMostrarOriginais((v) => !v)}
          >
            {mostrarOriginais ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {acordo.originais.length} recebimento(s) original(is) ficaram como "Renegociado"
          </button>
          {mostrarOriginais && (
            <table id="acordo-originais" className="w-full mt-1 text-xs">
              <tbody>
                {acordo.originais.map((o) => (
                  <tr key={o.id} data-original-id={o.id} {...linhaClicavel(o)}>
                    <td className="py-1">{o.descricao}</td>
                    <td>{dataBR(o.vencimento)}</td>
                    <td className={`text-right ${o.valor < 0 ? "text-red-600" : ""}`}>
                      {o.valor < 0 ? "- " : ""}
                      {formatMoneyForDisplay(Math.abs(o.valor))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {acordo.status === "active" &&
          (acordo.podeDesfazer ? (
            <Button id="acordo-desfazer" type="button" variant="outline" size="sm" onClick={() => setConfirmando(true)}>
              Desfazer acordo
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Já há parcela paga: o acordo não pode mais ser desfeito.</p>
          ))}
      </CardContent>

      {recibo && rental && property && tenant && (
        <PaymentReceipt
          payment={recibo}
          rental={rental}
          property={property}
          tenant={tenant}
          onClose={() => setRecibo(null)}
          skipFetch
        />
      )}

      <AlertDialog open={confirmando} onOpenChange={(o) => !desfazendo && setConfirmando(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer o acordo #{acordo.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              As {acordo.parcelas.length} parcela(s) do acordo serão apagadas e os recebimentos originais voltam ao status que
              tinham antes (pendente, parcial ou atrasado).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desfazendo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              id="acordo-desfazer-confirmar"
              disabled={desfazendo}
              onClick={(e) => {
                e.preventDefault();
                desfazer();
              }}
            >
              {desfazendo ? "Desfazendo..." : "Desfazer acordo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
