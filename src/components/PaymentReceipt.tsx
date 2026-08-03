import { useRef, useEffect, useState, useMemo } from "react";
import { X, Printer, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Payment, Rental, Property, Tenant } from "@/types";
import html2pdf from "html2pdf.js";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentReceiptProps {
  payment: Payment;
  rental: Rental;
  property: Property;
  tenant: Tenant;
  onClose: () => void;
  lateFee?: number;
  interest?: number;
}

interface BreakdownItem {
  description: string;
  amount: number;
  type: "addition" | "deduction";
}

export function PaymentReceipt({
  payment,
  rental,
  property,
  tenant,
  onClose,
  lateFee: propLateFee,
  interest: propInterest,
}: PaymentReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [paymentFromDB, setPaymentFromDB] = useState<any>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    const fetchPaymentDetails = async () => {
      if (!payment.id) return;
      
      console.log("🔍 BUSCANDO DADOS COMPLETOS DO PAGAMENTO:", payment.id);
      
      try {
        const { data, error } = await supabase
          .from("payments")
          .select("*")
          .eq("id", payment.id)
          .maybeSingle();

        if (error) {
          console.error("❌ Erro Supabase:", error);
          return;
        }

        console.log("✅ DADOS DO PAGAMENTO:", JSON.stringify(data, null, 2));

        if (data) {
          setPaymentFromDB(data);
        }
      } catch (error) {
        console.error("❌ Erro ao buscar detalhes do pagamento:", error);
      }
    };

    fetchPaymentDetails();
  }, [payment.id]);

  // Usar dados do banco se disponíveis, senão usar props
  const paymentData = paymentFromDB || payment;
  
  // Valores seguros do pagamento
  const lateFee = Number(paymentData.late_fee || propLateFee || 0);
  const interest = Number(paymentData.interest || propInterest || 0);
  const paidAmount = Number(paymentData.paid_amount || payment.paidAmount || 0);
  const expectedAmount = Number(paymentData.expected_amount || payment.expectedAmount || 0);
  const discount = Number(paymentData.discount_amount || 0);
  
  console.log("💰 VALORES SEGUROS:", { lateFee, interest, paidAmount, expectedAmount, discount });
  console.log("📊 DISCOUNT DO BANCO:", paymentData.discount_amount, "CONVERTIDO:", discount);
  console.log("🔍 PAID_AMOUNT DO BANCO:", paymentData.paid_amount, "CONVERTIDO:", paidAmount);
  console.log("🔍 RENTAL COMPLETO:", rental);
  
  // 🔥 CORREÇÃO: Verificar se rental existe antes de acessar propriedades
  if (rental) {
    console.log("🔍 START_DATE:", rental.start_date, "| STARTDATE:", rental.startDate);
  } else {
    console.warn("⚠️ RENTAL está undefined - pode causar problemas no recibo");
  }

  // Usar breakdown do banco
  const paymentBreakdown = paymentData.breakdown;
  
  // Estrutura para armazenar os itens do breakdown
  const breakdownItems: BreakdownItem[] = [];
  
  // Detectar rescisão baseada no conteúdo do breakdown
  let isTermination = false;

  if (paymentBreakdown) {
    const breakdownStr = JSON.stringify(paymentBreakdown);
    if (breakdownStr.includes("Multa Rescisória") || 
        breakdownStr.includes("Devolução de Caução") || 
        breakdownStr.includes("Aluguel Proporcional") ||
        breakdownStr.includes("terminationFee") ||
        breakdownStr.includes("depositRefund") ||
        breakdownStr.includes("proportionalRent")) {
      isTermination = true;
    }
  }
  
  console.log("🔍 TIPO DE PAGAMENTO:", isTermination ? "RESCISÃO" : "NORMAL");
  
  // Se é rescisão e tem breakdown, processar os valores específicos
  if (isTermination && paymentBreakdown) {
    console.log("✅ PROCESSANDO BREAKDOWN DE RESCISÃO");
    try {
      let breakdownData = paymentBreakdown;
      
      // Se for string, fazer parse
      if (typeof breakdownData === "string") {
        breakdownData = JSON.parse(breakdownData);
      }

      console.log("📊 BREAKDOWN PARSEADO:", JSON.stringify(breakdownData, null, 2));

      // Se o breakdown já é um array (formato novo do banco)
      if (Array.isArray(breakdownData)) {
        console.log("✅ BREAKDOWN É UM ARRAY");
        
        breakdownData.forEach((item: any) => {
          const amount = Number(item.amount || 0);
          const description = String(item.description || "");
          const type = item.type || "addition";
          
          // Só adicionar se tiver valor válido e maior que zero
          if (Number.isFinite(amount) && Math.abs(amount) > 0) {
            console.log(`  ✅ Item: ${description} = ${amount} (${type})`);
            breakdownItems.push({
              description,
              amount: Math.abs(amount),
              type: type as "addition" | "deduction"
            });
          }
        });
      } else {
        // Formato antigo (objeto com propriedades)
        console.log("✅ BREAKDOWN É UM OBJETO");
        
        const proportionalRent = Number(breakdownData.proportionalRent || 0);
        const terminationFee = Number(breakdownData.terminationFee || 0);
        const depositRefund = Number(breakdownData.depositRefund || 0);
        const additionalExpenses = Number(breakdownData.additionalExpenses || 0);

        if (proportionalRent > 0) {
          breakdownItems.push({
            description: "Aluguel Proporcional",
            amount: proportionalRent,
            type: "addition"
          });
        }

        if (terminationFee > 0) {
          breakdownItems.push({
            description: "Multa Rescisória",
            amount: terminationFee,
            type: "addition"
          });
        }

        if (depositRefund !== 0) {
          breakdownItems.push({
            description: "Devolução de Caução",
            amount: Math.abs(depositRefund),
            type: depositRefund < 0 ? "deduction" : "addition"
          });
        }

        if (additionalExpenses > 0) {
          breakdownItems.push({
            description: "Despesas Adicionais",
            amount: additionalExpenses,
            type: "addition"
          });
        }
      }
      
      console.log("📋 BREAKDOWN DE RESCISÃO PROCESSADO:", breakdownItems);
    } catch (e) {
      console.error("❌ ERRO ao processar breakdown de rescisão:", e);
    }
  } else {
    // PAGAMENTO NORMAL
    console.log("✅ PROCESSANDO PAGAMENTO NORMAL");
    
    // CRÍTICO: Usar valores do breakdown do banco para separar Aluguel e Garagem
    let rentAmount = 0;
    let garageAmount = 0;
    const otherItems: BreakdownItem[] = [];
    
    if (paymentBreakdown) {
      try {
        let breakdownData = paymentBreakdown;
        
        if (typeof breakdownData === "string") {
          breakdownData = JSON.parse(breakdownData);
        }

        if (Array.isArray(breakdownData)) {
          breakdownData.forEach((item: any) => {
            const amount = Number(item.amount || 0);
            const description = String(item.description || "").toLowerCase();
            
            if (!Number.isFinite(amount) || amount === 0) return;
            
            // Identificar Aluguel (SEM garagem no nome)
            if (description.includes("aluguel") && !description.includes("garagem") && !description.includes("vaga")) {
              rentAmount += Math.abs(amount);
            }
            // Identificar Garagem
            else if (description.includes("garagem") || description.includes("vaga")) {
              garageAmount += Math.abs(amount);
            }
            // Outros itens (multa, juros, etc)
            else {
              const type = item.type || "addition";
              otherItems.push({
                description: item.description,
                amount: Math.abs(amount),
                type: type as "addition" | "deduction"
              });
            }
          });
        }
      } catch (e) {
        console.error("❌ Erro ao processar breakdown:", e);
      }
    }
    
    // 🔥 CORREÇÃO: Se não encontrou no breakdown E rental existe, usar valores da rental
    if (rentAmount === 0 && rental) {
      rentAmount = Number(rental.monthlyRent || rental.value || 0);
      garageAmount = (rental.hasGarage || rental.has_garage) ? Number(rental.garageValue || 0) : 0;
    }
    
    // Adicionar Aluguel ao breakdown
    if (rentAmount > 0) {
      console.log(`  ✅ Aluguel: ${rentAmount}`);
      breakdownItems.push({
        description: "Aluguel",
        amount: rentAmount,
        type: "addition"
      });
    }

    // Adicionar Garagem ao breakdown (se houver)
    if (garageAmount > 0) {
      console.log(`  ✅ Garagem: ${garageAmount}`);
      breakdownItems.push({
        description: "Garagem",
        amount: garageAmount,
        type: "addition"
      });
    }
    
    // Adicionar MULTA se existir e for maior que zero
    if (lateFee > 0) {
      console.log(`  ✅ Multa por Atraso: ${lateFee}`);
      breakdownItems.push({
        description: "Multa por Atraso",
        amount: lateFee,
        type: "addition"
      });
    }

    // Adicionar JUROS se existir e for maior que zero
    if (interest > 0) {
      console.log(`  ✅ Juros por Atraso: ${interest}`);
      breakdownItems.push({
        description: "Juros por Atraso",
        amount: interest,
        type: "addition"
      });
    }
    
    // Adicionar outros itens do breakdown
    otherItems.forEach(item => {
      console.log(`  ✅ Item adicional: ${item.description} = ${item.amount}`);
      breakdownItems.push(item);
    });
  }
  
  // CRÍTICO: Adicionar desconto AO FINAL do processamento (tanto para rescisão quanto para pagamento normal)
  // Isso garante que o desconto sempre apareça no breakdown, independente do tipo de pagamento
  if (discount > 0) {
    console.log(`  ✅ Desconto Aplicado (adicionado ao final): ${discount}`);
    // Verificar se já não existe no breakdown (evitar duplicação)
    const descontoJaExiste = breakdownItems.some(item => 
      item.description.toLowerCase().includes("desconto")
    );
    
    if (!descontoJaExiste) {
      breakdownItems.push({
        description: "Desconto Aplicado",
        amount: discount,
        type: "deduction"
      });
      console.log("  ✅ Desconto adicionado ao breakdown!");
    } else {
      console.log("  ⚠️ Desconto já existe no breakdown, não duplicar");
    }
  }

  console.log("📋 BREAKDOWN ITEMS FINAIS:", JSON.stringify(breakdownItems, null, 2));
  console.log("🔍 VERIFICAR SE DESCONTO ESTÁ NO BREAKDOWN:", breakdownItems.find(item => item.description.includes("Desconto")));

  // CRÍTICO: O Total Pago SEMPRE deve ser o valor digitado em "Valor a Pagar" (paid_amount)
  const totalAmount = paidAmount;

  console.log("💰 TOTAL USADO NO RECIBO (paid_amount):", totalAmount);

  // 🔥 CORREÇÃO: Verificar se rental existe antes de acessar propriedades
  const currentInstallment = payment.installment || 1;
  const totalInstallments = isTermination 
    ? currentInstallment
    : (payment.totalInstallments || (rental?.installments) || (rental?.totalInstallments) || 24);

  const formatCurrency = (value: number): string => {
    if (!Number.isFinite(value)) {
      console.error("❌ Tentando formatar valor inválido:", value);
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
      console.error("❌ Erro ao formatar data:", dateString, e);
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
      const element = document.getElementById("receipt-content");
      if (!element) return;

      const html2pdf = (await import("html2pdf.js")).default;
      
      const opt = {
        margin: 1,
        filename: `recibo-${payment.id}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Buscar dados relacionados
  const rentals = rental ? [rental] : [];
  const property = rental ? properties.find(p => p.id === rental.propertyId) : null;
  const tenant = rental ? tenants.find(t => t.id === rental.tenantId) : null;
  const location = property ? locations.find(l => l.id === property.locationId) : null;

  // ✅ CORREÇÃO 1: Nome do inquilino
  const tenantName = payment.tenant?.name || tenant?.name || "LOCATÁRIO NÃO INFORMADO";

  // ✅ CORREÇÃO 2: Endereço completo do imóvel com complemento concatenado
  const getPropertyAddress = () => {
    if (!property || !location) return "IMÓVEL NÃO INFORMADO";
    
    const address = location.address || "";
    const number = location.number || "";
    const complement = property.complement || "";
    const neighborhood = location.neighborhood || "";
    const city = location.city || "";
    const state = location.state || "";
    const zipCode = location.zip_code || "";
    
    // Formato: Rua das Acácias, 70 - [COMPLEMENTO] - Parque Assunção, Taboão da Serra - SP - CEP 06753-420
    let fullAddress = `${address}${number ? ', ' + number : ''}`;
    
    if (complement) {
      fullAddress += ` - ${complement}`;
    }
    
    fullAddress += ` - ${neighborhood}${city ? ', ' + city : ''}`;
    
    if (state) {
      fullAddress += ` - ${state}`;
    }
    
    if (zipCode) {
      fullAddress += ` - CEP ${zipCode}`;
    }
    
    return fullAddress;
  };

  const propertyAddress = getPropertyAddress();

  // ✅ CORREÇÃO 3: Data de início da locação
  const rentalStartDate = payment.rental?.startDate || rental?.startDate || null;
  const formattedStartDate = rentalStartDate 
    ? new Date(rentalStartDate + "T12:00:00").toLocaleDateString("pt-BR")
    : "Data não informada";

  // ✅ CORREÇÃO 4: Data e hora em que o pagamento foi REALIZADO (IMUTÁVEL)
  // NÃO usar a data atual - usar paymentDate do banco
  const getPaymentDateTime = () => {
    if (!payment.paymentDate) {
      return "Data não informada";
    }
    
    const paymentDate = new Date(payment.paymentDate + "T12:00:00");
    const formattedDate = paymentDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).toUpperCase();
    
    // Tentar pegar a hora do campo payment_time se existir
    // Se não, usar 12:00 como padrão
    const timeStr = payment.paymentTime || "12:00";
    
    return `SÃO PAULO, ${formattedDate}, ${timeStr}`;
  };

  const paymentDateTime = getPaymentDateTime();

  const handleShareWhatsApp = () => {
    const referenceMonthName = payment.referenceMonth 
      ? new Date(2000, payment.referenceMonth - 1).toLocaleString("pt-BR", { month: "long" })
      : "N/A";
    const referenceYear = payment.referenceYear || new Date().getFullYear();

    const message = isTermination
      ? `📄 *RECIBO DE RESCISÃO DE CONTRATO*\n\nLocatário: ${tenantName}\nValor Total: ${formatCurrency(totalAmount)}\nReferência: ${referenceMonthName} de ${referenceYear}\nImóvel: ${propertyAddress}\n\n✅ Rescisão processada e recibo gerado.`
      : `📄 *RECIBO DE PAGAMENTO*\n\nLocatário: ${tenantName}\nValor Pago: ${formatCurrency(totalAmount)}\nReferência: ${referenceMonthName} de ${referenceYear}\nVencimento: ${formatDate(payment.dueDate)}\nImóvel: ${propertyAddress}\n\n✅ Pagamento confirmado e recibo gerado.`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const referenceMonthName = payment.referenceMonth 
    ? new Date(2000, payment.referenceMonth - 1).toLocaleString("pt-BR", { month: "long" })
    : "N/A";

  const referenceYear = payment.referenceYear || new Date().getFullYear();

  // 🔥 CORREÇÃO: Obter data do contrato com verificação de segurança
  const contractDate = rental?.start_date || rental?.startDate || "";
  
  console.log("\n📅 ===== DEBUG DATA DO CONTRATO =====");
  console.log("📅 RENTAL OBJECT:", JSON.stringify(rental, null, 2));
  if (rental) {
    console.log("📅 rental.start_date:", rental.start_date);
    console.log("📅 rental.startDate:", rental.startDate);
  } else {
    console.log("⚠️ RENTAL está undefined!");
  }
  console.log("📅 contractDate FINAL:", contractDate);
  console.log("📅 typeof contractDate:", typeof contractDate);
  
  if (contractDate) {
    console.log("📅 Tentando formatar:", contractDate);
    const formatted = formatDate(contractDate);
    console.log("📅 DATA FORMATADA:", formatted);
  } else {
    console.log("⚠️ contractDate está VAZIO!");
  }
  console.log("📅 =====================================\n");
  
  // Garantir que sempre temos uma data válida
  const displayContractDate = contractDate ? formatDate(contractDate) : "Data não informada";
  
  console.log("📅 DISPLAY CONTRACT DATE:", displayContractDate);

  // ✅ SNAPSHOT: Preservar informações do contrato no momento do pagamento
  // Se o pagamento está pago, usar os valores que estavam no breakdown
  // Se está pendente, usar os valores atuais da locação
  const contractSnapshot = useMemo(() => {
    if (payment.status === 'paid' || payment.status === 'partial') {
      // ✅ Pagamento PAGO: usar valores do breakdown (snapshot do momento do pagamento)
      const breakdownAluguel = payment.breakdown?.find((b: any) => 
        b.description?.toLowerCase().includes('aluguel') || b.description?.toLowerCase().includes('rent')
      );
      const breakdownGaragem = payment.breakdown?.find((b: any) => 
        b.description?.toLowerCase().includes('garagem') || b.description?.toLowerCase().includes('garage')
      );
      
      return {
        aluguel: breakdownAluguel?.amount || payment.expectedAmount || 0,
        garagem: breakdownGaragem?.amount || 0,
        hasGarage: !!breakdownGaragem,
        total: payment.expectedAmount || 0
      };
    } else {
      // ❌ Pagamento PENDENTE: usar valores ATUAIS da locação
      const aluguel = rental?.monthlyRent || rental?.value || 0;
      const garagem = (rental?.hasGarage && rental?.garageValue) ? rental.garageValue : 0;
      
      return {
        aluguel,
        garagem,
        hasGarage: rental?.hasGarage || false,
        total: aluguel + garagem
      };
    }
  }, [payment.status, payment.breakdown, payment.expectedAmount, rental]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>📄</span>
              {isTermination ? "Recibo de Rescisão de Contrato" : "Recibo de Pagamento"}
            </span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div id="receipt-content" className="space-y-2 p-4 bg-white text-black">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-bold">
              {isTermination ? "RECIBO DE RESCISÃO DE CONTRATO" : "RECIBO DE ALUGUEL"}
            </h1>
            {!isTermination && (
              <p className="text-xs text-gray-600">({currentInstallment}/{totalInstallments})</p>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-justify leading-relaxed">
              Recebi dos Srs. <strong>{tenantName}</strong>, a importância de{" "}
              <strong>{formatCurrency(totalAmount)}</strong>, proveniente ao depósito de aluguel referente ao mês de{" "}
              <strong>{monthName} de {payment.referenceYear}</strong>, tendo seu vencimento em{" "}
              <strong>{new Date(payment.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}</strong>, do imóvel situado em{" "}
              <strong>{propertyAddress}</strong>, após a apresentação dos comprovantes de depósito bancário e contas de água e luz do mês anterior pagos, sendo este vinculado ao{" "}
              <strong>INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO PARA FIM RESIDENCIAL</strong>, assinado entre as partes em{" "}
              <strong>{formattedStartDate}</strong>.
            </p>

            {/* Tabela de valores */}
          </div>

          <div className="border-t border-gray-300 pt-2">
            <h3 className="font-semibold mb-2 text-sm">Valores:</h3>
            
            {breakdownItems.length > 0 ? (
              <div className="space-y-1 text-sm">
                {breakdownItems.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.description}:</span>
                    <span className={`font-medium ${item.type === "deduction" ? "text-red-600" : ""}`}>
                      {item.type === "deduction" ? "- " : ""}
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Valor:</span>
                  <span className="font-medium">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            )}

            <div className="border-t border-gray-400 mt-2 pt-2 flex justify-between font-bold text-base">
              <span>{isTermination ? "Valor Total:" : "Total Pago:"}</span>
              <span className={totalAmount < 0 ? "text-red-600" : ""}>
                {formatCurrency(totalAmount)}
              </span>
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
            {format(new Date(payment.dueDate + "T12:00:00"), "dd/MM/yyyy")}
          </div>
          <div>
            <span className="font-semibold">Pagamento:</span>{" "}
            {payment.paymentDate 
              ? format(new Date(payment.paymentDate + "T12:00:00"), "dd/MM/yyyy")
              : "-"}
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