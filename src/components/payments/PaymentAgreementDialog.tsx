import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useAlert } from "@/contexts/AlertContext";
import { formatMoneyForDisplay } from "@/lib/masks";
import { MAX_PARCELAS_ACORDO, montarAcordo, somarMeses } from "@/lib/paymentAgreement";
import {
  carregarDebitoDaLocacao,
  criarAcordo,
  type DadosDaLocacaoDoAcordo,
} from "@/services/paymentAgreementService";

/**
 * Assistente "Parcelar débito" (#119). Três passos:
 *   1. o que entra no acordo: recebimentos em aberto da locação (a partir de
 *      2026), já marcados, cada um com multa e juros por atraso até hoje; o
 *      Recebimento de Rescisão com caução corrigido, despesas e desconto
 *      SALVOS nele;
 *   2. nº de parcelas (até 6) e vencimento da 1ª, com prévia ao vivo; as
 *      seguintes vencem no mesmo dia dos meses seguintes;
 *   3. confirmar (os valores ficam congelados).
 * As contas ficam em src/lib/paymentAgreement.ts; a gravação é uma chamada só
 * ao banco (criar_acordo_parcelamento), que confere tudo de novo.
 */

interface PaymentAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId: string;
  onCreated?: (acordoId: string) => void;
}

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const dataBR = (iso: string) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "-");

export function PaymentAgreementDialog({ open, onOpenChange, rentalId, onCreated }: PaymentAgreementDialogProps) {
  const { showAlert } = useAlert();
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dados, setDados] = useState<DadosDaLocacaoDoAcordo | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [quantidade, setQuantidade] = useState(1);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(somarMeses(hojeISO(), 1));
  const dataAcordo = hojeISO();

  useEffect(() => {
    if (!open || !rentalId) return;
    let cancelado = false;
    setPasso(1);
    setCarregando(true);
    setDados(null);
    carregarDebitoDaLocacao(rentalId)
      .then((d) => {
        if (cancelado) return;
        setDados(d);
        setSelecionados(d.recebimentos.map((r) => r.id));
      })
      .catch((e) => {
        if (cancelado) return;
        showAlert({ title: "Erro", description: e?.message || "Não foi possível carregar os recebimentos.", type: "error" });
      })
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [open, rentalId, showAlert]);

  const itens = useMemo(
    () => (dados?.recebimentos || []).filter((r) => selecionados.includes(r.id)),
    [dados, selecionados]
  );

  const acordo = useMemo(
    () =>
      montarAcordo({
        itens,
        dataAcordo,
        incluirAtraso: true,
        multaPercentual: dados?.multaPercentual || 0,
        jurosDiarioPercentual: dados?.jurosDiarioPercentual || 0,
        desconto: 0,
        entrada: 0,
        entradaData: null,
        quantidadeParcelas: quantidade,
        primeiroVencimento,
      }),
    [itens, dataAcordo, dados, quantidade, primeiroVencimento]
  );

  const alternar = (id: string) =>
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const confirmar = async () => {
    if (acordo.erros.length > 0) return;
    setSalvando(true);
    try {
      const id = await criarAcordo({
        rentalId,
        itens,
        atrasos: acordo.atrasos,
        parcelas: acordo.parcelas,
        desconto: 0,
        entrada: 0,
        entradaData: null,
        dataAcordo,
      });
      showAlert({
        title: "Acordo criado",
        description: `${acordo.parcelas.length} parcela(s) criada(s). Os recebimentos originais ficaram como "Renegociado".`,
        type: "success",
      });
      onOpenChange(false);
      onCreated?.(id);
    } catch (e: any) {
      showAlert({ title: "Não foi possível criar o acordo", description: e?.message || String(e), type: "error" });
    } finally {
      setSalvando(false);
    }
  };

  const errosDoPasso1 = itens.length === 0 ? ["Escolha pelo menos um recebimento."] : acordo.total <= 0 ? ["Não há débito para parcelar: o saldo é a favor do inquilino."] : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !salvando && onOpenChange(o)}>
      <DialogContent id="acordo-dialog" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Parcelar débito {dados?.inquilino ? `– ${dados.inquilino}` : ""}</DialogTitle>
          <DialogDescription>
            {dados?.imovel ? `${dados.imovel} · ` : ""}Passo {passo} de 3:{" "}
            {passo === 1 ? "o que entra no acordo" : passo === 2 ? "condições" : "confirmar"}
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando recebimentos...
          </div>
        ) : !dados ? null : dados.recebimentos.length === 0 ? (
          <p id="acordo-sem-debito" className="py-8 text-center text-muted-foreground">
            Esta locação não tem recebimentos em aberto para parcelar.
          </p>
        ) : passo === 1 ? (
          <div className="space-y-3">
            <div className="border rounded-md divide-y">
              {dados.recebimentos.map((r) => (
                <label
                  key={r.id}
                  htmlFor={`acordo-item-${r.id}`}
                  className="flex items-center gap-3 p-3 text-sm cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    id={`acordo-item-${r.id}`}
                    checked={selecionados.includes(r.id)}
                    onCheckedChange={() => alternar(r.id)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{r.descricao}</div>
                    <div className="text-xs text-muted-foreground">
                      Vencimento {dataBR(r.dueDate)}
                      {r.paidAmount > 0 && ` · já pago ${formatMoneyForDisplay(r.paidAmount)} de ${formatMoneyForDisplay(r.expectedAmount)}`}
                    </div>
                    {r.tipo === "termination" && (
                      <div className="text-xs text-muted-foreground" data-testid={`acordo-rescisao-${r.id}`}>
                        Caução corrigido {formatMoneyForDisplay(r.caucao || 0)} · Despesas Adicionais{" "}
                        {formatMoneyForDisplay(r.despesas || 0)} · Desconto {formatMoneyForDisplay(r.desconto || 0)}
                      </div>
                    )}
                    {(() => {
                      const a = acordo.atrasos[r.id];
                      if (!a || a.multa + a.juros <= 0) return null;
                      return (
                        <div className="text-xs text-orange-700" data-testid={`acordo-atraso-${r.id}`}>
                          {a.diasAtraso} dia(s) de atraso: multa {formatMoneyForDisplay(a.multa)} + juros {formatMoneyForDisplay(a.juros)}
                        </div>
                      );
                    })()}
                  </div>
                  <div className={`font-semibold ${r.saldo < 0 ? "text-red-600" : ""}`}>
                    {r.saldo < 0 ? "- " : ""}
                    {formatMoneyForDisplay(Math.abs(r.saldo))}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-between font-bold text-base pt-2">
              <span>Total do acordo (com multa e juros até hoje)</span>
              <span id="acordo-total-debito">{formatMoneyForDisplay(acordo.total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Valores em vermelho abatem do total. Despesas Adicionais e Desconto entram como estão SALVOS no
              Recebimento de Rescisão (botão "Salvar" da Formação de Valores). Recebimentos pagos e os de 2025 para
              trás não aparecem aqui.
            </p>
          </div>
        ) : passo === 2 ? (
          <div className="space-y-4">
            <div className="space-y-1 max-w-xs">
              <Label htmlFor="acordo-primeiro-vencimento">Vencimento da 1ª parcela</Label>
              <Input id="acordo-primeiro-vencimento" type="date" value={primeiroVencimento} onChange={(e) => setPrimeiroVencimento(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Número de parcelas</Label>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: MAX_PARCELAS_ACORDO }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    id={`acordo-parcelas-${n}`}
                    type="button"
                    size="sm"
                    variant={quantidade === n ? "default" : "outline"}
                    onClick={() => setQuantidade(n)}
                  >
                    {n}x
                  </Button>
                ))}
              </div>
            </div>
            <ResumoEPrevia acordo={acordo} />
          </div>
        ) : (
          <div id="acordo-resumo" className="space-y-3 text-sm">
            <p>
              Ao confirmar, os <strong>{itens.length}</strong> recebimento(s) escolhido(s) ficam como{" "}
              <Badge className="bg-slate-200 text-slate-800">Renegociado</Badge> com os valores congelados (nada é
              apagado), o caução corrigido abatido é registrado como devolvido na aba Cauções, e o sistema cria{" "}
              <strong>{acordo.parcelas.length}</strong> parcela(s) novas, cobradas normalmente em Recebimentos. Multa e
              juros voltam a contar só se uma parcela do acordo atrasar.
            </p>
            <ResumoEPrevia acordo={acordo} />
            <p className="text-xs text-muted-foreground">
              Enquanto nenhuma parcela for paga, o acordo pode ser desfeito (abra uma parcela em Recebimentos).
            </p>
          </div>
        )}

        {(passo === 2 || passo === 3) && acordo.erros.length > 0 && (
          <ul id="acordo-erros" className="text-sm text-red-600 list-disc pl-5">
            {acordo.erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {passo === 1 && dados && dados.recebimentos.length > 0 && errosDoPasso1.length > 0 && (
          <p id="acordo-erros" className="text-sm text-red-600">{errosDoPasso1[0]}</p>
        )}

        <DialogFooter className="gap-2">
          {passo > 1 && (
            <Button id="acordo-voltar" type="button" variant="outline" disabled={salvando} onClick={() => setPasso((p) => (p - 1) as 1 | 2)}>
              Voltar
            </Button>
          )}
          {passo < 3 ? (
            <Button
              id="acordo-avancar"
              type="button"
              disabled={carregando || !dados || dados.recebimentos.length === 0 || (passo === 1 ? errosDoPasso1.length > 0 : acordo.erros.length > 0)}
              onClick={() => setPasso((p) => (p + 1) as 2 | 3)}
            >
              Avançar
            </Button>
          ) : (
            <Button id="acordo-confirmar" type="button" disabled={salvando || acordo.erros.length > 0} onClick={confirmar}>
              {salvando ? "Criando acordo..." : "Criar acordo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResumoEPrevia({ acordo }: { acordo: ReturnType<typeof montarAcordo> }) {
  const linha = (rotulo: string, valor: number, id?: string, negativo = false) => (
    <div className="flex justify-between">
      <span>{rotulo}</span>
      <span id={id} className={negativo ? "text-red-600" : ""}>
        {negativo && valor > 0 ? "- " : ""}
        {formatMoneyForDisplay(valor)}
      </span>
    </div>
  );
  return (
    <div className="rounded-md border bg-blue-50 dark:bg-blue-950 p-3 space-y-1 text-sm">
      {linha("Recebimentos em aberto (caução, despesas e desconto já incluídos)", acordo.saldo, "acordo-resumo-saldo")}
      {linha("Multa por atraso", acordo.multa, "acordo-resumo-multa")}
      {linha("Juros por atraso", acordo.juros, "acordo-resumo-juros")}
      {acordo.desconto > 0 && linha("Desconto", acordo.desconto, "acordo-resumo-desconto", true)}
      <div className="flex justify-between font-bold border-t pt-1">
        <span>Total do acordo</span>
        <span id="acordo-resumo-total">{formatMoneyForDisplay(acordo.total)}</span>
      </div>
      <table id="acordo-previa" className="w-full mt-2 text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="font-normal">Parcela</th>
            <th className="font-normal">Vencimento</th>
            <th className="font-normal text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {acordo.parcelas.map((p) => (
            <tr key={p.numero} data-parcela={p.numero}>
              <td>
                {p.numero}/{acordo.parcelas.length}
              </td>
              <td>{dataBR(p.vencimento)}</td>
              <td className="text-right">{formatMoneyForDisplay(p.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
