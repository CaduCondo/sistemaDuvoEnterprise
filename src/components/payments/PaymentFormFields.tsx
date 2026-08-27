import { memo, type ReactNode } from "react";
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
  isReadOnly: boolean;
  onFormDataChange: (data: any) => void;
  onPaymentHourChange: (value: string) => void;
  onPaymentMinuteChange: (value: string) => void;
  onPaymentSecondChange: (value: string) => void;
  formatCurrency: (value: string) => string;
  isTerminationPayment?: boolean;
  // Na tela de rescisao o campo "Parcela" (sempre 1/1) nao informa nada, entao
  // o combo "Forma de Pagamento" ocupa esse espaco. Ver ManagePaymentForm.
  paymentMethodSlot?: ReactNode;
}

export const PaymentFormFields = memo(function PaymentFormFields({
  formData,
  paymentHour,
  paymentMinute,
  paymentSecond,
  installmentInfo,
  isReadOnly,
  onFormDataChange,
  onPaymentHourChange,
  onPaymentMinuteChange,
  onPaymentSecondChange,
  formatCurrency,
  isTerminationPayment,
  paymentMethodSlot,
}: PaymentFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="payment_date">
            Data do Pagamento <span className="text-muted-foreground">*</span>
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
            <Label htmlFor="payment_time">Horário do Recebimento</Label>
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
            Valor a Pagar <span className="text-muted-foreground">*</span>
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

        {isTerminationPayment && paymentMethodSlot ? (
          paymentMethodSlot
        ) : (
          <div>
            <Label htmlFor="installment_info">Parcela</Label>
            <Input
              id="installment_info"
              type="text"
              value={installmentInfo}
              disabled
              className="bg-muted"
            />
          </div>
        )}
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