// Tela "Gerar contrato" da locação (issue #125).
//
// Busca tudo direto do banco pelo id da locação (locação, imóvel, local,
// inquilino e locador), monta o contrato com gerarContratoResidencial() e:
//   - se faltar algum dado, mostra a lista do que falta, em português simples;
//   - se estiver completo, mostra o contrato, deixa baixar em PDF e guardar
//     o PDF nos Anexos da locação (Supabase Storage, categoria "Contrato").
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadAttachment } from "@/lib/uploadAttachment";
import { useAlert } from "@/contexts/AlertContext";
import {
  gerarContratoResidencial,
  type ClausulaLocal,
  type ResultadoContrato,
} from "@/lib/contrato/contratoResidencial";

const db = supabase as any;

interface Props {
  rentalId: string;
  onClose: () => void;
  /** Chamado depois de guardar o PDF nos anexos (para a tela recarregar). */
  onSaved?: () => void;
}

function juntar(partes: (string | null | undefined)[], sep = ", "): string {
  return partes.map((p) => (p ?? "").toString().trim()).filter(Boolean).join(sep);
}

function enderecoCompleto(o: {
  rua?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}): string {
  const ruaNumero = juntar([o.rua, o.numero], ", ");
  const cidadeUf = juntar([o.cidade, o.uf], "/");
  return juntar([ruaNumero, o.complemento, o.bairro, cidadeUf, o.cep ? `CEP ${o.cep}` : ""]);
}

const ESTILO = `
  .contrato { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.45; color: #000; text-align: justify; }
  .contrato h1 { font-size: 14pt; text-align: center; margin: 0 0 14px; }
  .contrato h3 { font-size: 12pt; margin: 14px 0 4px; }
  .contrato p { margin: 0 0 6px; }
  .contrato .resumo { border: 1px solid #000; padding: 8px 10px; margin-bottom: 12px; }
  .contrato .data-assinatura { margin-top: 18px; text-align: right; }
  .contrato .assinaturas { display: flex; gap: 40px; margin-top: 36px; }
  .contrato .assinatura { flex: 1; text-align: center; font-size: 11pt; }
  .contrato .linha { border-top: 1px solid #000; margin-bottom: 4px; }
  .contrato .testemunhas { margin-top: 18px; }
`;

export function ContratoLocacaoDialog({ rentalId, onClose, onSaved }: Props) {
  const { showAlert } = useAlert();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoContrato | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("contrato.pdf");
  const [trabalhando, setTrabalhando] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const { data: loc, error: e1 } = await db.from("rentals").select("*").eq("id", rentalId).single();
        if (e1 || !loc) throw new Error("Não consegui abrir a locação.");

        const [imovelR, inquilinoR, locadorR, pagamentoR, caucaoR] = await Promise.all([
          db.from("properties").select("*, locations(*)").eq("id", loc.property_id).single(),
          db.from("tenants").select("*").eq("id", loc.tenant_id).single(),
          loc.landlord_user_id
            ? db.from("system_users").select("*").eq("id", loc.landlord_user_id).single()
            : Promise.resolve({ data: null }),
          db
            .from("payments")
            .select("due_date")
            .eq("rental_id", rentalId)
            .eq("payment_kind", "rent")
            .order("due_date", { ascending: true })
            .limit(1),
          db.from("deposit_installments").select("id").eq("rental_id", rentalId),
        ]);

        const imovel = imovelR.data;
        const inquilino = inquilinoR.data;
        const locador = locadorR.data;
        if (!imovel || !inquilino) throw new Error("Não consegui abrir o imóvel ou o inquilino da locação.");
        const local = imovel.locations || {};

        // Local "Outros" é um coringa: o endereço está no próprio imóvel.
        const usaManual = String(local.name || "").toLowerCase() === "outros" && !!imovel.manual_street;
        const enderecoImovel = enderecoCompleto({
          rua: usaManual ? imovel.manual_street : local.street,
          numero: usaManual ? imovel.manual_number : local.number,
          complemento: imovel.complement,
          bairro: usaManual ? imovel.manual_neighborhood : local.neighborhood,
          cidade: usaManual ? imovel.manual_city : local.city,
          uf: usaManual ? imovel.manual_state : local.state,
          cep: usaManual ? imovel.manual_zip_code : local.zip_code,
        });
        const cidadeUf = juntar(
          [usaManual ? imovel.manual_city : local.city, usaManual ? imovel.manual_state : local.state],
          "/"
        );

        const clausulas: ClausulaLocal[] = Array.isArray(local.contract_clauses) ? local.contract_clauses : [];
        const parcelasCaucao = (caucaoR.data || []).length || Number(loc.deposit_installments || 1) || 1;
        const hoje = new Date();
        const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

        const r = gerarContratoResidencial({
          locador: {
            nome: locador?.name,
            cpf: locador?.cpf,
            rg: locador?.rg,
            endereco: locador?.landlord_address,
            cidade: locador?.landlord_city,
            banco: locador?.landlord_bank_name,
            agencia: locador?.landlord_bank_agency,
            operacao: locador?.landlord_bank_operation,
            poupanca: locador?.landlord_bank_savings,
            conta: locador?.landlord_bank_account,
            pix: locador?.landlord_pix_key,
            whatsapp: locador?.landlord_whatsapp || locador?.phone,
          },
          locatario: {
            nome: inquilino.name,
            sexo: inquilino.gender,
            estadoCivil: inquilino.marital_status,
            profissao: inquilino.occupation,
            rg: inquilino.rg,
            cpf: inquilino.document_type === "cnpj" ? null : inquilino.cpf || inquilino.document,
            tipoDocumento: inquilino.document_type,
            endereco: enderecoCompleto({
              rua: inquilino.street,
              numero: inquilino.number,
              complemento: inquilino.complement,
              bairro: inquilino.neighborhood,
              cidade: inquilino.city,
              uf: inquilino.state,
              cep: inquilino.zip_code,
            }),
          },
          imovel: {
            clausulasLocal: clausulas,
            quartos: imovel.rooms,
            banheiros: imovel.bathrooms,
            temGaragem: !!loc.has_garage,
            endereco: enderecoImovel,
            cidadeUf,
          },
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
          dataAssinatura: hojeIso,
        });

        if (cancelado) return;
        setNomeArquivo(`Contrato - ${String(inquilino.name).replace(/[\\/:*?"<>|]/g, "")}.pdf`);
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
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };
    return (await html2pdf().set(opt).from(el).outputPdf("blob")) as Blob;
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

  async function guardarNosAnexos() {
    setTrabalhando(true);
    try {
      const blob = await gerarPdf();
      const arquivo = new File([blob], nomeArquivo, { type: "application/pdf" });
      const url = await uploadAttachment(arquivo, "rental-attachments");

      const { data: atual, error: eLer } = await db.from("rentals").select("attachments").eq("id", rentalId).single();
      if (eLer) throw eLer;
      const lista = Array.isArray(atual?.attachments) ? atual.attachments : [];
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

      showAlert({
        title: "Contrato guardado",
        description: "O PDF foi guardado nos Anexos da locação (categoria Contrato).",
        type: "success",
      });
      onSaved?.();
    } catch (e: any) {
      showAlert({ title: "Não consegui guardar o contrato", description: e?.message || "Tente de novo.", type: "error" });
    } finally {
      setTrabalhando(false);
    }
  }

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
            <div className="flex flex-wrap justify-end gap-2">
              <Button id="contrato-baixar" variant="outline" onClick={baixar} disabled={trabalhando}>
                <Download className="mr-2 h-4 w-4" />
                Baixar PDF
              </Button>
              <Button id="contrato-guardar" onClick={guardarNosAnexos} disabled={trabalhando}>
                <Save className="mr-2 h-4 w-4" />
                Guardar nos anexos
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
