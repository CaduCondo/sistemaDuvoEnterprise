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
import { Handshake } from "lucide-react";
import { useAlert } from "@/contexts/AlertContext";
import { formatMoneyForDisplay } from "@/lib/masks";
import { buscarAcordo, desfazerAcordo, type AcordoDetalhado } from "@/services/paymentAgreementService";

/**
 * Bloco "Acordo de parcelamento #N" (#119), mostrado ao abrir uma parcela do
 * acordo ou um recebimento que entrou nele. Lista as parcelas e os originais e
 * permite DESFAZER o acordo enquanto nenhuma parcela tiver pagamento.
 */

const STATUS_PARCELA: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-800" },
  overdue: { label: "Atrasado", className: "bg-red-100 text-red-800" },
  partial: { label: "Parcial", className: "bg-orange-100 text-orange-800" },
  paid: { label: "Pago", className: "bg-green-100 text-green-800" },
};

const dataBR = (iso: string) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "-");

export function PaymentAgreementInfo({ acordoId, onChanged }: { acordoId: string; onChanged?: () => void }) {
  const { showAlert } = useAlert();
  const [acordo, setAcordo] = useState<AcordoDetalhado | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);

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

  return (
    <Card id="acordo-info" className="border-slate-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Handshake className="h-4 w-4" />
          Acordo de parcelamento #{acordo.numero}
          {acordo.status === "undone" && <Badge className="bg-slate-200 text-slate-700">Desfeito</Badge>}
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
        <table className="w-full">
          <tbody>
            {acordo.parcelas.map((p) => {
              const st = STATUS_PARCELA[p.status] || STATUS_PARCELA.pending;
              return (
                <tr key={p.id} className="border-t">
                  <td className="py-1">{p.descricao}</td>
                  <td>{dataBR(p.vencimento)}</td>
                  <td className="text-right">{formatMoneyForDisplay(p.valor)}</td>
                  <td className="text-right">
                    <Badge className={st.className}>{st.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">
          {acordo.originais.length} recebimento(s) original(is) ficaram como "Renegociado".
        </p>
        {acordo.status === "active" && (
          acordo.podeDesfazer ? (
            <Button id="acordo-desfazer" type="button" variant="outline" size="sm" onClick={() => setConfirmando(true)}>
              Desfazer acordo
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Já há parcela paga: o acordo não pode mais ser desfeito.</p>
          )
        )}
      </CardContent>

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
            <AlertDialogAction id="acordo-desfazer-confirmar" disabled={desfazendo} onClick={(e) => { e.preventDefault(); desfazer(); }}>
              {desfazendo ? "Desfazendo..." : "Desfazer acordo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
