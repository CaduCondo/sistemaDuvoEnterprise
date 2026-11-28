import { calcularValoresDoPagamento } from "@/lib/calculoPagamento";
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
    // A conta (aluguel, garagem, multa, juros, valor a pagar, o que falta) é a função pura
    // calcularValoresDoPagamento (src/lib/calculoPagamento.ts, issue #141) -- testada à parte.
    const calculo = calcularValoresDoPagamento({
      payment: payment as any,
      paymentDate: formData.payment_date,
      rentalValue,
      garageValue,
      isTerminationPayment,
      originalBreakdown,
      removeLateFee,
      removeInterest,
      lateFeePercentage,
      interestRatePercentage,
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
      ...calculo,
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