import { memo } from "react";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PaymentFormFieldsProps {
  formData: {
    payment_date: string;
    payment_method: string;
    payment_time: string;
    amount_to_pay: string;
    notes: string;
  };
  paymentHour: string;
  paymentMinute: string;
  paymentSecond: string;
  installmentInfo: string;
  /** Combo de Forma de Pagamento, renderizado ao lado do Valor a Pagar. */
  paymentMethodField?: ReactNode;
  isReadOnly: boolean;
  onFormDataChange: (data: any) => void;
  onPaymentHourChange: (value: string) => void;
  onPaymentMinuteChange: (value: string) => void;
  onPaymentSecondChange: (value: string) => void;
  formatCurrency: (value: string) => string;
  isTerminationPayment?: boolean;
}

export const PaymentFormFields = memo(function PaymentFormFields({
  formData,
  paymentHour,
  paymentMinute,
  paymentSecond,
  installmentInfo,
  paymentMethodField,
  isReadOnly,
  onFormDataChange,
  onPaymentHourChange,
  onPaymentMinuteChange,
  onPaymentSecondChange,
  formatCurrency,
  isTerminationPayment,
}: PaymentFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="payment_date">
            Data do Pagamento *
          </Label>
          <Input
            id="payment_date"
            type="date"
            value={formData.payment_date}
            onChange={(e) => onFormDataChange({ ...formData, payment_date: e.target.value })}
            required
            disabled={isReadOnly}
          />
        </div>

        {formData.payment_method === "pix" && (
          <div>
            <Label htmlFor="payment_time">Horário do Recebimento *</Label>
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-center">
              <Input
                id="payment_hour"
                type="text"
                inputMode="numeric"
                placeholder="HH"
                maxLength={2}
                value={paymentHour}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 23)) {
                    onPaymentHourChange(value);
                  }
                }}
                disabled={isReadOnly}
              />
              <span className="text-2xl font-bold">:</span>
              <Input
                id="payment_minute"
                type="text"
                inputMode="numeric"
                placeholder="MM"
                maxLength={2}
                value={paymentMinute}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 59)) {
                    onPaymentMinuteChange(value);
                  }
                }}
                disabled={isReadOnly}
              />
              <span className="text-2xl font-bold">:</span>
              <Input
                id="payment_second"
                type="text"
                inputMode="numeric"
                placeholder="SS"
                maxLength={2}
                value={paymentSecond}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 59)) {
                    onPaymentSecondChange(value);
                  }
                }}
                disabled={isReadOnly}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount_to_pay">
            Valor a Pagar *
          </Label>
          <Input
            id="amount_to_pay"
            type="text"
            value={formData.amount_to_pay}
            onChange={(e) => {
              const value = e.target.value;
              
              // 🔥 CORREÇÃO CRÍTICA: Preservar sinal negativo corretamente
              if (isTerminationPayment) {
                // Detecta se começou a digitar o sinal negativo
                const isNegative = value.startsWith('-');
                
                // Remove tudo exceto números
                const cleanValue = value.replace(/[^\d]/g, '');
                
                // Se tem números, formata
                if (cleanValue.length > 0) {
                  // Formata como moeda
                  const formatted = formatCurrency(cleanValue);
                  
                  // Adiciona o sinal negativo de volta se estava presente
                  const finalValue = isNegative ? `-${formatted}` : formatted;
                  onFormDataChange({ ...formData, amount_to_pay: finalValue });
                } else {
                  // Permite apenas o sinal negativo sozinho ou vazio
                  onFormDataChange({ ...formData, amount_to_pay: isNegative ? '-' : '' });
                }
              } else {
                // Para pagamentos normais, não permite negativo
                onFormDataChange({ ...formData, amount_to_pay: formatCurrency(value) });
              }
            }}
            required
            disabled={isReadOnly}
            placeholder={isTerminationPayment ? "Digite um valor (use - para negativo)" : "R$ 0,00"}
          />
        </div>

        {/* Aqui ficava o campo "Parcela", so de leitura. A parcela passou a
            ser exibida sob o titulo da tela, e este espaco -- ao lado do
            Valor a Pagar -- foi para a Forma de Pagamento, que antes ficava
            solta embaixo do bloco. */}
        <div>{paymentMethodField}</div>
      </div>

      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          placeholder="Observações sobre o pagamento..."
          value={formData.notes}
          onChange={(e) => onFormDataChange({ ...formData, notes: e.target.value })}
          rows={2}
          disabled={isReadOnly}
          className="resize-none"
        />
      </div>
    </div>
  );
});