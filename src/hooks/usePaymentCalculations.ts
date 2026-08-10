import { useMemo } from "react";

interface PaymentFormData {
  payment_date: string;
  amount_to_pay: string;
}

interface CalculateValuesParams {
  payment: any;
  formData: PaymentFormData;
  rentalValue: number;
  garageValue: number;
  isTerminationPayment: boolean;
  originalBreakdown: any[];
  removeFees: boolean;
  lateFeePercentage: number;
  interestRatePercentage: number;
}

interface UsePaymentCalculationsProps {
  payment: any;
  formData: any;
  rentalValue: number;
  garageValue: number;
  isTerminationPayment: boolean;
  originalBreakdown: any[];
  removeLateFee: boolean;
  removeInterest: boolean;
  lateFeePercentage: number;
  interestRatePercentage: number;
}

export function usePaymentCalculations({
  payment,
  formData,
  rentalValue,
  garageValue,
  isTerminationPayment,
  originalBreakdown,
  removeLateFee,
  removeInterest,
  lateFeePercentage,
  interestRatePercentage,
}: UsePaymentCalculationsProps) {
  return useMemo(() => {
    // CORREÇÃO: Usar sempre os valores separados de aluguel e garagem
    // rentalValue = valor do aluguel do imóvel
    // garageValue = valor da garagem (se houver)
    let calculatedRentalValue = rentalValue;
    let calculatedGarageValue = garageValue;
    
    // Se houver breakdown, extrair os valores SEPARADOS de aluguel e garagem
    if (payment?.breakdown) {
      try {
        const breakdownData = typeof payment.breakdown === 'string' 
          ? JSON.parse(payment.breakdown) 
          : (payment.breakdown || []);
          
        if (Array.isArray(breakdownData) && breakdownData.length > 0) {
          // Resetar valores
          calculatedRentalValue = 0;
          calculatedGarageValue = 0;
          
          // Processar cada item do breakdown
          breakdownData.forEach((item: any) => {
            const description = item.description || '';
            const amount = item.value || item.amount || 0;
            
            // Identificar aluguel (incluindo proporcional)
            if (description.includes('Aluguel') && !description.includes('Garagem')) {
              calculatedRentalValue += amount;
            }
            // Identificar garagem (incluindo proporcional)
            else if (description.includes('Garagem') || description.includes('Vaga')) {
              calculatedGarageValue += amount;
            }
          });
          
          // Se não encontrou valores no breakdown, usar os valores originais
          if (calculatedRentalValue === 0 && calculatedGarageValue === 0) {
            calculatedRentalValue = rentalValue;
            calculatedGarageValue = garageValue;
          }
        }
      } catch (e) {
        console.error("Erro parse breakdown calculateValues", e);
        // Em caso de erro, usar valores originais
        calculatedRentalValue = rentalValue;
        calculatedGarageValue = garageValue;
      }
    }

    // VALOR TOTAL DO ALUGUEL = Aluguel do Imóvel + Garagem (quando aplicável)
    const valorAluguel = Math.round((calculatedRentalValue + calculatedGarageValue) * 100) / 100;
    
    console.log("📊 CÁLCULO DE VALORES:");
    console.log("  - Aluguel Imóvel:", calculatedRentalValue);
    console.log("  - Garagem:", calculatedGarageValue);
    console.log("  - Total Aluguel:", valorAluguel);
    
    let isProportional = false;
    let proportionalDays = 0;
    
    if (payment?.breakdown) {
      try {
        const breakdownData = typeof payment.breakdown === 'string' 
          ? JSON.parse(payment.breakdown) 
          : (payment.breakdown || []);
        
        if (Array.isArray(breakdownData)) {
          const proportionalItem = breakdownData.find((item: any) =>
            item.description?.toLowerCase().includes("proporcional")
          );
          
          if (proportionalItem) {
            isProportional = true;
            // Aceita tanto o formato antigo "(5 dias)" quanto o novo
            // "Proporcional de 5 dia(s)" — só precisa achar o número antes de "dia".
            const match = proportionalItem.description.match(/(\d+)\s*dias?/i);
            if (match) {
              proportionalDays = parseInt(match[1]);
            }
          }
        }
      } catch (error) {
        console.error("Erro ao verificar proporcional:", error);
      }
    }
    
    let multa = 0;
    let juros = 0;
    let diasAtraso = 0;

    if (payment && formData.payment_date) {
      const dueDateStr = payment.due_date;
      const paymentDateStr = formData.payment_date;
      
      const dueDate = new Date(dueDateStr + "T12:00:00");
      const paymentDate = new Date(paymentDateStr + "T12:00:00");

      if (paymentDate > dueDate) {
        const diffTime = paymentDate.getTime() - dueDate.getTime();
        diasAtraso = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let baseCalculo = 0;
        
        if (isTerminationPayment && originalBreakdown.length > 0) {
          // Para rescisão, calcular base sem multas, juros e despesas
          baseCalculo = originalBreakdown
            .filter(item => 
              !item.description?.includes("Multa por Atraso") &&
              !item.description?.includes("Juros por Atraso") &&
              !item.description?.includes("Despesas")
            )
            .reduce((sum, item) => sum + item.amount, 0);
          
          baseCalculo = Math.abs(baseCalculo);
        } else {
          // Para pagamentos normais, usar o valor total do aluguel (imóvel + garagem)
          baseCalculo = Math.max(0, valorAluguel);
        }

        if (baseCalculo > 0) {
          multa = Math.round((baseCalculo * lateFeePercentage / 100) * 100) / 100;
          const jurosDiario = interestRatePercentage;
          juros = Math.round((baseCalculo * jurosDiario / 100 * diasAtraso) * 100) / 100;
        }
      }
    }

    const valorTotalSemIsencao = Math.round((valorAluguel + multa + juros) * 100) / 100;
    const valorAPagar = removeLateFee ? (removeInterest ? valorAluguel : Math.round((valorAluguel + juros) * 100) / 100) : Math.round((valorAluguel + multa) * 100) / 100;
    
    const valorJaPago = payment?.paid_amount || 0;
    
    // 🔥 CORREÇÃO CRÍTICA: Calcular o valor restante corretamente
    // Se o status é "paid", não há valor restante
    // Se o status é "partial" ou "pending", calcular a diferença
    let valorRestante = 0;
    if (payment?.status === "paid") {
      valorRestante = 0;
    } else {
      // Calcular quanto falta pagar baseado no valor esperado (expected_amount)
      const expectedAmount = payment?.expected_amount || valorAPagar;
      valorRestante = Math.max(0, Math.round((expectedAmount - valorJaPago) * 100) / 100);
    }
    
    console.log("💰 CÁLCULO VALOR RESTANTE:", {
      status: payment?.status,
      expected_amount: payment?.expected_amount,
      valorAPagar,
      valorJaPago,
      valorRestante
    });

    const getPaymentInstallmentLabel = (paymentItem: any): string => {
      if (!paymentItem.installment && paymentItem.notes?.toLowerCase().includes("proporcional")) {
        return "Proporcional";
      }

      if (!paymentItem.installment) {
        return "Única";
      }

      const total = paymentItem.totalInstallments || paymentItem.rental?.installments || 24;
      return `${paymentItem.installment}/${total}`;
    };

    return {
      valorAluguel: Math.round(valorAluguel * 100) / 100,
      multa: Math.round(multa * 100) / 100,
      juros: Math.round(juros * 100) / 100,
      valorTotal: Math.round(valorTotalSemIsencao * 100) / 100,
      valorAPagar: Math.round(valorAPagar * 100) / 100,
      valorJaPago: Math.round(valorJaPago * 100) / 100,
      valorRestante: Math.round(valorRestante * 100) / 100,
      diasAtraso,
      jurosDiario: interestRatePercentage,
      isProportional,
      proportionalDays,
      getPaymentInstallmentLabel,
    };
  }, [
    payment,
    formData.payment_date,
    rentalValue,
    garageValue,
    isTerminationPayment,
    originalBreakdown,
    removeLateFee,
    removeInterest,
    lateFeePercentage,
    interestRatePercentage,
  ]);
}