import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Share2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DepositInstallment, Rental } from "@/types";

interface DepositReceiptEntry {
  amount: number;
  payment_date: string;
  payment_method: string;
  notes?: string | null;
  registered_at?: string;
}

interface DepositReceiptProps {
  installment: DepositInstallment;
  rental: Rental;
  entry: DepositReceiptEntry;
  onClose: () => void;
}

const numberToWords = (value: number): string => {
  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  const convertGroup = (num: number): string => {
    if (num === 0) return "";
    if (num === 100) return "cem";
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const u = num % 10;
    let result = "";
    if (h > 0) result += hundreds[h];
    if (t === 1) {
      if (result) result += " e ";
      result += teens[u];
    } else {
      if (t > 0) {
        if (result) result += " e ";
        result += tens[t];
      }
      if (u > 0) {
        if (result) result += " e ";
        result += units[u];
      }
    }
    return result;
  };

  const reais = Math.floor(value);
  const centavos = Math.round((value - reais) * 100);
  let result = "";
  const thousands = Math.floor(reais / 1000);
  const remainder = reais % 1000;

  if (thousands > 0) {
    result += thousands === 1 ? "mil" : `${convertGroup(thousands)} mil`;
  }
  if (remainder > 0) {
    if (result) result += " e ";
    result += convertGroup(remainder);
  }
  if (!result) result = "zero";
  result += reais === 1 ? " real" : " reais";
  if (centavos > 0) {
    result += ` e ${convertGroup(centavos)}`;
    result += centavos === 1 ? " centavo" : " centavos";
  }
  return result;
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "Data não informada";
  try {
    const dateStr = dateString.includes("T") ? dateString : `${dateString}T12:00:00`;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Data inválida";
    return date.toLocaleDateString("pt-BR");
  } catch {
    return "Data inválida";
  }
};

// ✅ Recibo de CAUÇÃO no mesmo padrão visual/textual do recibo de ALUGUEL
// (PaymentReceipt.tsx) - mesmo layout, mesmo texto "Recebi de...", mesma
// assinatura - só trocando o que é específico de aluguel (mês de referência
// do recebimento, texto "depósito de caução" em vez de "depósito de
// aluguel", sem a menção a contas de água/luz, e a linha de valor vira
// "Caução" em vez de "Aluguel"). Busca o endereço do imóvel e o nome do
// inquilino direto do banco a partir do rental_id, então funciona
// independente de onde for aberto (tela de Recebimentos ou tela de Locação).
export function DepositReceipt({ installment, rental, entry, onClose }: DepositReceiptProps) {
  const [propertyAddress, setPropertyAddress] = useState<string>("");
  const [tenantName, setTenantName] = useState<string>("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [{ data: property }, { data: tenant }] = await Promise.all([
          rental.propertyId
            ? supabase.from("properties").select("*, locations(*)").eq("id", rental.propertyId).maybeSingle()
            : Promise.resolve({ data: null }),
          rental.tenantId
            ? supabase.from("tenants").select("name").eq("id", rental.tenantId).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (tenant?.name) setTenantName(tenant.name);

        if (property) {
          const loc = property.locations;
          if (loc?.street) {
            let line = loc.street;
            if (loc.number) line += `, ${loc.number}`;
            if (property.complement) line += `, ${property.complement}`;
            if (loc.neighborhood) line += ` - ${loc.neighborhood}`;
            const cityState = [loc.city, loc.state].filter(Boolean).join(" - ");
            if (cityState) line += `, ${cityState}`;
            setPropertyAddress(line);
          } else if (loc?.name) {
            setPropertyAddress(property.complement ? `${loc.name} - ${property.complement}` : loc.name);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados do recibo de caução:", err);
      }
    };

    loadData();
  }, [rental.propertyId, rental.tenantId]);

  const handlePrint = () => window.print();

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const element = document.getElementById("deposit-receipt-content");
      if (!element) return;
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf()
        .set({
          margin: 1,
          filename: `recibo-caucao-${installment.installment_number}-${installment.total_installments}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        })
        .from(element)
        .save();
    } catch (err) {
      console.error("Erro ao gerar PDF do recibo de caução:", err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleShareWhatsApp = () => {
    const message = `📄 *RECIBO DE CAUÇÃO*\n\nLocatário: ${tenantName}\nValor Pago: ${formatCurrency(entry.amount)}\nParcela: ${installment.installment_number}/${installment.total_installments}\nVencimento: ${formatDate(installment.due_date)}\nImóvel: ${propertyAddress}\n\n✅ Pagamento confirmado e recibo gerado.`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const dueDate = installment.due_date ? new Date(installment.due_date + "T12:00:00") : null;
  const referenceMonthName = dueDate
    ? dueDate.toLocaleString("pt-BR", { month: "long" })
    : "N/A";
  const referenceYear = dueDate ? dueDate.getFullYear() : new Date().getFullYear();

  const contractStartDate = formatDate(rental.startDate || rental.start_date);

  const paymentDateTime = (() => {
    const dateStr = entry.payment_date;
    if (!dateStr) return "Data não informada";
    const d = new Date(`${dateStr}T12:00:00`);
    const formattedDate = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase();
    let timeStr = "12:00:00";
    if (entry.registered_at) {
      const registered = new Date(entry.registered_at);
      if (!isNaN(registered.getTime())) {
        timeStr = registered.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }
    }
    return `SÃO PAULO, ${formattedDate}, ${timeStr}`;
  })();

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>📄</span>
              Recibo de Caução
            </span>
          </DialogTitle>
        </DialogHeader>

        <div id="deposit-receipt-content" className="space-y-2 p-4 bg-white text-black">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-bold">RECIBO DE CAUÇÃO</h1>
            <p className="text-xs text-gray-600">
              ({installment.installment_number}/{installment.total_installments})
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-justify leading-relaxed">
              Recebi de <strong>{tenantName || "LOCATÁRIO NÃO INFORMADO"}</strong>, a importância de{" "}
              <strong>{formatCurrency(entry.amount)}</strong>{" "}
              (<strong>{numberToWords(entry.amount)}</strong>), proveniente ao depósito de caução referente ao mês de{" "}
              <strong>{referenceMonthName} de {referenceYear}</strong>, tendo seu vencimento em{" "}
              <strong>{formatDate(installment.due_date)}</strong>, do imóvel situado em{" "}
              <strong>{propertyAddress || "IMÓVEL NÃO INFORMADO"}</strong>, após a apresentação dos comprovantes de depósito bancário, sendo este vinculado ao{" "}
              <strong>INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO PARA FIM RESIDENCIAL</strong>, assinado entre as partes em{" "}
              <strong>{contractStartDate}</strong>.
            </p>
          </div>

          <div className="border-t border-gray-300 pt-2">
            <h3 className="font-semibold mb-2 text-sm">Valores:</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Caução:</span>
                <span className="font-medium">{formatCurrency(entry.amount)}</span>
              </div>
            </div>
            <div className="border-t border-gray-400 mt-2 pt-2 flex justify-between font-bold text-base">
              <span>Total Pago:</span>
              <span>{formatCurrency(entry.amount)}</span>
            </div>
          </div>

          <div className="text-center text-xs text-gray-600 pt-3 border-t border-gray-300">
            <p className="uppercase">{paymentDateTime}</p>

            <div className="pt-4"></div>

            <img
              src="/signature.png"
              alt="Assinatura Carlos Aparecido D'Uvo"
              className="w-24 h-auto mx-auto mb-1"
            />

            <div className="w-48 border-t border-gray-400 mx-auto mb-1"></div>

            <p className="text-[9pt] text-gray-600 font-medium">
              Carlos Aparecido D'Uvo
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-semibold">Vencimento:</span>{" "}
            {formatDate(installment.due_date)}
          </div>
          <div>
            <span className="font-semibold">Pagamento:</span>{" "}
            {formatDate(entry.payment_date)}
          </div>
        </div>

        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleShareWhatsApp} className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              WhatsApp
            </Button>

            <Button variant="outline" onClick={handleGeneratePDF} disabled={isGeneratingPDF} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {isGeneratingPDF ? "Gerando PDF..." : "Baixar PDF"}
            </Button>

            <Button variant="default" onClick={onClose} className="flex items-center gap-2">
              <X className="h-4 w-4" />
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
