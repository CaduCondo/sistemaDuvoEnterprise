import { useAssinaturaDoUsuario } from "@/hooks/useAssinaturaDoUsuario";
import { useRef, useState } from "react";
import { X, Printer, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Property, Tenant } from "@/types";

interface DepositReceiptProps {
  depositAmount: number;
  depositPaymentDate: string;
  property: Property;
  tenant: Tenant;
  contractDate: string;
  location?: { 
    name?: string; 
    address?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
  onClose: () => void;
}

export function DepositReceipt({
  depositAmount,
  depositPaymentDate,
  property,
  tenant,
  contractDate,
  location,
  onClose,
}: DepositReceiptProps) {
  const assinatura = useAssinaturaDoUsuario();
  const printRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const formatCurrency = (value: number): string => {
    if (!Number.isFinite(value)) {
      return "R$ 0,00";
    }
    
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "Data não informada";
    
    try {
      const dateStr = dateString.includes('T') ? dateString : dateString + "T12:00:00";
      const date = new Date(dateStr);
      
      if (isNaN(date.getTime())) return "Data inválida";
      
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return "Data inválida";
    }
  };

  const extenso = (num: number): string => {
    if (!Number.isFinite(num) || num === 0) return "ZERO REAIS";
    
    const unidades = ["", "UM", "DOIS", "TRÊS", "QUATRO", "CINCO", "SEIS", "SETE", "OITO", "NOVE"];
    const especiais = ["DEZ", "ONZE", "DOZE", "TREZE", "QUATORZE", "QUINZE", "DEZESSEIS", "DEZESSETE", "DEZOITO", "DEZENOVE"];
    const dezenas = ["", "", "VINTE", "TRINTA", "QUARENTA", "CINQUENTA", "SESSENTA", "SETENTA", "OITENTA", "NOVENTA"];
    const centenas = ["", "CENTO", "DUZENTOS", "TREZENTOS", "QUATROCENTOS", "QUINHENTOS", "SEISCENTOS", "SETECENTOS", "OITOCENTOS", "NOVECENTOS"];
    
    const inteiro = Math.floor(Math.abs(num));
    const centavos = Math.round((Math.abs(num) - inteiro) * 100);
    
    let resultado = "";
    
    const milhares = Math.floor(inteiro / 1000);
    const restante = inteiro % 1000;
    
    if (milhares > 0) {
      if (milhares === 1) {
        resultado = "MIL";
      } else {
        const milharesExtenso = converterCentenas(milhares);
        resultado = `${milharesExtenso} MIL`;
      }
      
      if (restante > 0) {
        resultado += " E ";
      }
    }
    
    if (restante > 0) {
      resultado += converterCentenas(restante);
    }
    
    resultado += " REAIS";
    
    if (centavos > 0) {
      resultado += " E " + converterCentenas(centavos) + " CENTAVOS";
    }
    
    return resultado;
    
    function converterCentenas(n: number): string {
      if (n === 0) return "";
      if (n === 100) return "CEM";
      
      const c = Math.floor(n / 100);
      const d = Math.floor((n % 100) / 10);
      const u = n % 10;
      
      let texto = "";
      
      if (c > 0) {
        texto = centenas[c];
      }
      
      if (d === 1) {
        if (texto) texto += " E ";
        texto += especiais[u];
      } else {
        if (d > 0) {
          if (texto) texto += " E ";
          texto += dezenas[d];
        }
        if (u > 0) {
          if (texto) texto += " E ";
          texto += unidades[u];
        }
      }
      
      return texto;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const element = document.getElementById("deposit-receipt-content");
      if (!element) return;

      const html2pdf = (await import("html2pdf.js")).default;
      
      const opt = {
        margin: 1,
        filename: `recibo-caucao-${tenant.name.replace(/\s+/g, '-')}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getPropertyAddress = () => {
    const parts = [];
    
    // Usar dados do location (endereço principal)
    if (location?.address) {
      parts.push(location.address.toUpperCase());
    }
    
    if (location?.number) {
      parts.push(`Nº ${location.number}`);
    }
    
    // Complement do imóvel específico (ex: APTO 04)
    if (property?.complement) {
      parts.push(property.complement.toUpperCase());
    }
    
    if (location?.neighborhood) {
      parts.push(location.neighborhood.toUpperCase());
    }
    
    if (location?.city) {
      parts.push(location.city.toUpperCase());
    }
    
    if (location?.state) {
      parts.push(location.state.toUpperCase());
    }
    
    return parts.length > 0 ? parts.join(", ") : "LOCAL NÃO INFORMADO";
  };

  const propertyAddress = getPropertyAddress();
  const tenantName = tenant?.name?.toUpperCase() || "LOCATÁRIO NÃO INFORMADO";

  const handleShareWhatsApp = () => {
    const message = `📄 *RECIBO DE CAUÇÃO*\n\nLocatário: ${tenantName}\nValor: ${formatCurrency(depositAmount)}\nData de Pagamento: ${formatDate(depositPaymentDate)}\nImóvel: ${propertyAddress}\n\n✅ Caução recebida e recibo gerado.`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>📄</span>
              Recibo de Recebimento
            </span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div id="deposit-receipt-content" className="space-y-2 p-4 bg-white text-black">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-bold">RECIBO DE CAUÇÃO</h1>
          </div>

          <div className="space-y-2 text-justify leading-tight text-sm">
            <p>
              Recebi dos Srs. <strong>{tenantName}</strong>, a importância de{" "}
              <strong>{extenso(depositAmount)} ({formatCurrency(depositAmount)})</strong>, proveniente ao depósito do caução, 
              tendo seu vencimento em <strong>{formatDate(depositPaymentDate)}</strong>, 
              do imóvel situado em{" "}
              <strong>{propertyAddress}</strong>, sendo este vinculado ao INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO PARA FIM RESIDENCIAL, assinado entre as partes em{" "}
              <strong>{formatDate(contractDate)}</strong>.
            </p>
          </div>

          <div className="border-t border-gray-300 pt-2">
            <h3 className="font-semibold mb-2 text-sm">Valores:</h3>
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Valor do Caução:</span>
                <span className="font-medium">{formatCurrency(depositAmount)}</span>
              </div>
            </div>

            <div className="border-t border-gray-400 mt-2 pt-2 flex justify-between font-bold text-base">
              <span>Total Pago:</span>
              <span>{formatCurrency(depositAmount)}</span>
            </div>
          </div>

          <div className="text-center text-xs text-gray-600 pt-3 border-t border-gray-300">
            <p className="uppercase">
              SÃO PAULO, {new Date().toLocaleDateString("pt-BR", { 
                day: "2-digit", 
                month: "long", 
                year: "numeric" 
              }).toUpperCase()}, {new Date().toLocaleTimeString("pt-BR", { 
                hour: "2-digit", 
                minute: "2-digit" 
              })}
            </p>
            
            <div className="pt-4"></div>
            
            {assinatura.assinaturaUrl && (
              <img
                src={assinatura.assinaturaUrl}
                crossOrigin="anonymous" 
                alt={`Assinatura ${assinatura.nome}`} 
                className="w-24 h-auto mx-auto mb-1"
              
              />
            )}
            
            <div className="w-48 border-t border-gray-400 mx-auto mb-1"></div>
            
            <p className="text-[9pt] text-gray-600 font-medium">
              {assinatura.nome}
            </p>
          </div>
        </div>

        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleShareWhatsApp}
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              WhatsApp
            </Button>
            
            <Button
              variant="outline"
              onClick={handleGeneratePDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {isGeneratingPDF ? "Gerando PDF..." : "Baixar PDF"}
            </Button>
            
            <Button
              variant="default"
              onClick={onClose}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}