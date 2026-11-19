// Contrato da locação (issue #125). Aparece UMA vez, logo depois de criar a locação.
//
// Busca tudo direto do banco pelo id da locação (locação, imóvel, local,
// inquilino e locador), monta o contrato com gerarContratoResidencial() e:
//   - se faltar algum dado, mostra a lista do que falta, em português simples;
//   - se estiver completo, mostra o contrato, guarda SOZINHO o PDF nos Anexos
//     da locação (Supabase Storage, categoria "contract") e deixa baixar.
//   - o contrato é criado uma vez só: se a locação já tem o PDF guardado, o
//     sistema não gera nem guarda outro.
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadAttachment } from "@/lib/uploadAttachment";
import { useAlert } from "@/contexts/AlertContext";
import type { ResultadoContrato } from "@/lib/contrato/contratoResidencial";
import { montarContrato } from "@/lib/contrato/montarContrato";

const db = supabase as any;

interface Props {
  rentalId: string;
  onClose: () => void;
  /** Chamado depois de guardar o PDF nos anexos (para a tela recarregar). */
  onSaved?: () => void;
}

const ESTILO = `
  .contrato { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.45; color: #000; text-align: justify; }
  .contrato h1 { font-size: 14pt; text-align: center; margin: 0 0 14px; }
  .contrato h3 { font-size: 12pt; margin: 14px 0 4px; }
  .contrato p { margin: 0 0 6px; }
  .contrato .resumo { border: 1px solid #000; padding: 8px 10px; margin-bottom: 12px; }
  .contrato .data-assinatura { margin-top: 18px; text-align: right; }
  .contrato .assinaturas { display: flex; gap: 40px; margin-top: 36px; align-items: flex-end; }
  .contrato .assinaturas.topo { align-items: flex-start; }
  .contrato .assinatura { flex: 1; text-align: center; font-size: 11pt; }
  .contrato .linha { border-top: 1px solid #000; margin-bottom: 4px; }
  .contrato .testemunhas { margin-top: 18px; }
  .contrato .capa { display: flex; flex-direction: column; justify-content: space-between; align-items: center; aspect-ratio: 180 / 255; text-align: center; page-break-after: always; break-after: page; }
  .contrato .capa-titulo { font-family: Arial, Helvetica, sans-serif; font-weight: bold; font-size: 15pt; }
  .contrato .capa-meio { display: flex; flex-direction: column; align-items: center; gap: 28px; }
  .contrato .capa-logo { width: 75%; max-width: 520px; height: auto; }
  .contrato .capa-site { font-family: Arial, Helvetica, sans-serif; font-size: 22pt; color: #1f2f6b; }
  .contrato .capa-rodape { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; line-height: 1.5; text-align: center; }
  .contrato .testemunhas .assinaturas { margin-top: 64px; }
`;

export function ContratoLocacaoDialog({ rentalId, onClose, onSaved }: Props) {
  const { showAlert } = useAlert();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoContrato | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("contrato.pdf");
  const [trabalhando, setTrabalhando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const guardouRef = useRef(false);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const { data: loc, error: e1 } = await db.from("rentals").select("*").eq("id", rentalId).single();
        if (e1 || !loc) throw new Error("Não consegui abrir a locação.");

        const [pagamentoR, caucaoR] = await Promise.all([
          db
            .from("payments")
            .select("due_date")
            .eq("rental_id", rentalId)
            .eq("payment_kind", "rent")
            .order("due_date", { ascending: true })
            .limit(1),
          db.from("deposit_installments").select("id").eq("rental_id", rentalId),
        ]);
        const parcelasCaucao = (caucaoR.data || []).length || Number(loc.deposit_installments || 1) || 1;

        const { resultado: r, nomeInquilino } = await montarContrato(db, {
          tenantId: loc.tenant_id,
          tenant2Id: loc.second_tenant_id ?? null,
          propertyId: loc.property_id,
          landlordUserId: loc.landlord_user_id,
          temGaragem: !!loc.has_garage,
          locacao: {
            inicio: loc.start_date,
            termino: loc.original_end_date || loc.end_date,
            aluguel: Number(loc.rent_value),
            garagem: loc.has_garage ? Number(loc.garage_value || 0) : 0,
            diaVencimento: loc.rent_due_day,
            primeiroVencimento: pagamentoR.data?.[0]?.due_date || null,
            caucao: Number(loc.deposit_value || 0),
            parcelasCaucao,
          },
        });

        if (cancelado) return;
        setNomeArquivo(`Contrato - ${String(nomeInquilino).replace(/[\\/:*?"<>|]/g, "")}.pdf`);
        setResultado(r);
      } catch (e: any) {
        if (!cancelado) setErro(e?.message || "Erro ao montar o contrato.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [rentalId]);

  async function gerarPdf(): Promise<Blob> {
    const html2pdf = (await import("html2pdf.js")).default;
    const el = docRef.current;
    if (!el) throw new Error("Contrato não está na tela.");
    const opt = {
      margin: [15, 15, 15, 15],
      filename: nomeArquivo,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };
    // A capa é a página 1 e não leva número; as demais vão de "Página 1 de N".
    const pdf: any = await html2pdf().set(opt).from(el).toPdf().get("pdf");
    const total = pdf.internal.getNumberOfPages();
    const largura = pdf.internal.pageSize.getWidth();
    const altura = pdf.internal.pageSize.getHeight();
    pdf.setFont("times", "normal");
    pdf.setFontSize(9);
    for (let i = 2; i <= total; i++) {
      pdf.setPage(i);
      pdf.text(`Página ${i - 1} de ${total - 1}`, largura / 2, altura - 7, { align: "center" });
    }
    return pdf.output("blob") as Blob;
  }

  async function baixar() {
    setTrabalhando(true);
    try {
      const blob = await gerarPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showAlert({ title: "Não consegui gerar o PDF", description: e?.message || "Tente de novo.", type: "error" });
    } finally {
      setTrabalhando(false);
    }
  }

  // Guarda o contrato nos anexos da locação, automaticamente e uma única vez.
  async function guardarAutomaticamente() {
    if (guardouRef.current) return;
    guardouRef.current = true;
    setGuardando(true);
    try {
      const { data: atual, error: eLer } = await db.from("rentals").select("attachments").eq("id", rentalId).single();
      if (eLer) throw eLer;
      const lista = Array.isArray(atual?.attachments) ? atual.attachments : [];
      if (lista.some((a: any) => a?.category === "contract")) return; // já existe: nunca gera outro

      const blob = await gerarPdf();
      const arquivo = new File([blob], nomeArquivo, { type: "application/pdf" });
      const url = await uploadAttachment(arquivo, "rental-attachments");
      const novo = {
        id: crypto.randomUUID(),
        name: nomeArquivo,
        url,
        type: "application/pdf",
        uploadedAt: new Date().toISOString(),
        category: "contract",
      };
      const { error: eGravar } = await db
        .from("rentals")
        .update({ attachments: [...lista, novo] })
        .eq("id", rentalId);
      if (eGravar) throw eGravar;
      onSaved?.();
    } catch (e: any) {
      guardouRef.current = false;
      showAlert({
        title: "Contrato não foi guardado nos anexos",
        description: (e?.message || "Erro desconhecido") + "\nUse Baixar PDF e anexe na locação manualmente.",
        type: "error",
      });
    } finally {
      setGuardando(false);
    }
  }

  useEffect(() => {
    if (resultado && resultado.html && resultado.faltando.length === 0 && !carregando) {
      // espera o contrato aparecer na tela e a assinatura carregar
      const t = setTimeout(() => void guardarAutomaticamente(), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado, carregando]);

  return (
    <Dialog open={true} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent id="contrato-locacao-dialog" className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contrato de Locação
          </DialogTitle>
        </DialogHeader>

        {carregando && (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Montando o contrato...
          </div>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {resultado?.semModelo && <p className="text-sm">{resultado.semModelo}</p>}

        {resultado && resultado.faltando.length > 0 && (
          <div id="contrato-faltando" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold mb-2">Falta preencher no sistema para gerar o contrato:</p>
            <ul className="list-disc pl-5 space-y-1">
              {resultado.faltando.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {resultado && resultado.html && (
          <>
            <div className="border rounded-md bg-white p-6">
              <style>{ESTILO}</style>
              <div id="contrato-documento" ref={docRef} className="contrato" dangerouslySetInnerHTML={{ __html: resultado.html }} />
            </div>
            {guardando && (
              <p id="contrato-guardando" className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                <Loader2 className="h-3 w-3 animate-spin" /> Guardando o contrato nos anexos...
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button id="contrato-baixar" variant="outline" onClick={baixar} disabled={trabalhando || guardando}>
                <Download className="mr-2 h-4 w-4" />
                Baixar PDF
              </Button>
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button id="contrato-fechar" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
