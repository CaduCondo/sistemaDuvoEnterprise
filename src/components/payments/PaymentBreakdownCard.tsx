import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DollarSign, Loader2, Save } from "lucide-react";
import { memo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LateFeeInterestBlock } from "@/components/payments/LateFeeInterestBlock";

interface BreakdownItemProps {
  item: any;
  isDeduction?: boolean;
  igpmCorrection?: any;
  formatCurrency: (val: number) => string;
}

// Função para limpar o label removendo "- Parcela X/Y"
const cleanLabel = (text: string): string => {
  if (!text) return text;
  // Remove "- Parcela X/Y" do texto
  return text.replace(/\s*-\s*Parcela\s+\d+\/\d+/gi, '').trim();
};

export const BreakdownItem = memo(({ item, isDeduction, igpmCorrection, formatCurrency }: BreakdownItemProps) => {
  const isDepositDeduction = item.description?.includes("Devolução de Caução");
  
  const displayAmount = isDepositDeduction && igpmCorrection && igpmCorrection.correctedAmount > 0
    ? igpmCorrection.correctedAmount 
    : Math.abs(item.amount);

  // 🔥 NOVO: Detectar se é mudança de vencimento (tem extraValue e description adicional)
  const isDueDateChange = item.extraValue && item.extraValue > 0 && item.description && item.description.includes("De dia");

  // Limpar o label/description removendo "- Parcela X/Y"
  const cleanedLabel = cleanLabel(item.label || item.description);

  return (
    <div>
      {isDueDateChange ? (
        // Layout especial para mudança de vencimento
        <div className="space-y-1">
          <div className="text-sm font-medium">
            {cleanedLabel || "Mudança data de vencimento"}
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground ml-2">
              {item.description}
            </span>
            <span className="font-medium whitespace-nowrap ml-4">
              {formatCurrency(item.extraValue)}
            </span>
          </div>
        </div>
      ) : (
        // Layout padrão para outros itens
        <div className="flex justify-between items-start text-sm">
          <div className="flex-1">
            <span className={isDepositDeduction ? "block" : ""}>
              {cleanedLabel}
            </span>
            {isDepositDeduction && igpmCorrection && (
              <span className="block text-xs text-muted-foreground mt-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted hover:text-primary transition-colors">
                        (corrigido pela Taxa da Poupança)
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[450px] p-0 bg-white dark:bg-gray-900 border-2 shadow-xl z-50">
                      <div className="space-y-3 p-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-1.5">
                          <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                            💰 Resumo da Correção
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Valor Original:</span>
                              <p className="font-semibold text-blue-900 dark:text-blue-100">
                                {formatCurrency(igpmCorrection.originalAmount)}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Valor Corrigido:</span>
                              <p className="font-semibold text-green-600 dark:text-green-400">
                                {formatCurrency(igpmCorrection.correctedAmount)}
                              </p>
                            </div>
                          </div>
                          <div className="pt-1.5 border-t border-blue-200 dark:border-blue-800">
                            <span className="text-muted-foreground text-xs">Correção Total:</span>
                            <p className="font-bold text-base text-blue-900 dark:text-blue-100">
                              {(igpmCorrection.poupancaPercentage ?? igpmCorrection.igpmPercentage ?? 0).toFixed(2)}% ({igpmCorrection.months} {igpmCorrection.months === 1 ? 'mês' : 'meses'})
                            </p>
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                          <p className="font-semibold text-xs text-gray-700 dark:text-gray-300 mb-2">
                            📅 Taxas Mensais Aplicadas
                          </p>
                          <div className="text-[11px] font-mono leading-relaxed max-h-[250px] overflow-y-auto text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                            {igpmCorrection.poupancaDetails || igpmCorrection.igpmDetails || "Detalhes de correção não disponíveis."}
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            )}
          </div>
          <span className={`${isDeduction ? "text-red-600" : ""} font-medium whitespace-nowrap ml-4`}>
            {isDeduction ? "- " : ""}
            {formatCurrency(displayAmount)}
          </span>
        </div>
      )}
    </div>
  );
});

BreakdownItem.displayName = "BreakdownItem";

interface PaymentBreakdownCardProps {
  isTerminationPayment: boolean;
  originalBreakdown: any[];
  igpmCorrection: any;
  repairExpenses: number;
  repairExpensesInput: string;
  removeLateFee: boolean;
  removeInterest: boolean;
  lateFeePercentage: number;
  interestRatePercentage: number;
  calculatedTotal: number;
  displayBreakdown: any;
  values: any;
  isEditMode: boolean;
  isReadOnly: boolean;
  formatCurrency: (val: number) => string;
  onRepairExpensesChange: (value: string) => void;
  onRemoveLateFeeChange: (checked: boolean) => void;
  onRemoveInterestChange: (checked: boolean) => void;
  discountAmount?: number;
  discountAmountInput?: string;
  onDiscountAmountChange?: (value: string) => void;
  paymentStatus?: string;
  paidAmount?: number;
  onSaveExpensesAndDiscount?: (e: any) => void;
  isSaving?: boolean;
  payment?: any;
  rental?: any;
}

export function PaymentBreakdownCard({
  isTerminationPayment,
  originalBreakdown,
  igpmCorrection,
  repairExpenses,
  repairExpensesInput,
  removeLateFee,
  removeInterest,
  lateFeePercentage,
  interestRatePercentage,
  calculatedTotal,
  displayBreakdown,
  values,
  isEditMode,
  isReadOnly,
  formatCurrency,
  onRepairExpensesChange,
  onRemoveLateFeeChange,
  onRemoveInterestChange,
  discountAmount = 0,
  discountAmountInput = "",
  onDiscountAmountChange = () => {},
  paymentStatus,
  paidAmount = 0,
  onSaveExpensesAndDiscount,
  isSaving,
  payment,
  rental,
}: PaymentBreakdownCardProps) {
  // 🔥 CORREÇÃO CRÍTICA: Calcular finalTotal baseado no total do breakdown (que já considera sinais)
  const finalTotal = isTerminationPayment 
    ? calculatedTotal // Para rescisões, usar calculatedTotal diretamente (já vem com sinal correto)
    : (displayBreakdown.total + ((removeLateFee ? 0 : values.multa) + (removeInterest ? 0 : values.juros)) - discountAmount);

  const remainingDue = Math.max(0, Math.abs(finalTotal) - (paidAmount || 0));
  const showPartialInfo = paymentStatus === 'partial' && (paidAmount || 0) > 0;

  return (
    <Card className={isTerminationPayment ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Formação de Valores {isTerminationPayment && "- Rescisão"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isTerminationPayment ? (
            <>
              {originalBreakdown
                .filter(item => 
                  !item.description?.includes("Despesas") && 
                  !item.description?.includes("Multa por Atraso") &&
                  !item.description?.includes("Juros por Atraso")
                )
                .map((item, index) => (
                  <BreakdownItem 
                    key={index} 
                    item={item} 
                    isDeduction={item.type === "deduction"}
                    igpmCorrection={igpmCorrection}
                    formatCurrency={formatCurrency}
                  />
                ))}

              <div className="border-t border-dashed my-2"></div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4 items-center text-sm">
                  <span>Despesas Adicionais *</span>
                  
                  {isEditMode ? (
                    <Input
                      id="breakdown-repair-expenses"
                      type="text"
                      placeholder="R$ 0,00"
                      value={repairExpensesInput}
                      onChange={(e) => onRepairExpensesChange(e.target.value)}
                      className="text-right"
                      disabled={isReadOnly}
                    />
                  ) : (
                    <span className="font-medium text-right">
                      {formatCurrency(repairExpenses)}
                    </span>
                  )}
                </div>
              </div>

              {values.diasAtraso > 0 && (
                <>
                  <div className="border-t border-dashed my-2"></div>
                  <LateFeeInterestBlock
                    daysLate={values.diasAtraso}
                    lateFee={values.multa}
                    interest={values.juros}
                    finalTotal={finalTotal}
                    includeLateFee={!removeLateFee}
                    includeInterest={!removeInterest}
                    onIncludeLateFeeChange={(checked) => onRemoveLateFeeChange(!checked)}
                    onIncludeInterestChange={(checked) => onRemoveInterestChange(!checked)}
                    lateFeePercentage={lateFeePercentage}
                    interestRatePercentage={interestRatePercentage}
                    showCheckboxes={isEditMode}
                    disabled={isReadOnly}
                  />
                </>
              )}

              <div className="border-t border-dashed my-2"></div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4 items-center text-sm">
                  <span>Valor de Desconto</span>
                  
                  {isEditMode ? (
                    <Input
                      id="breakdown-discount-termination"
                      type="text"
                      placeholder="- R$ 0,00"
                      value={discountAmountInput}
                      onChange={(e) => onDiscountAmountChange(e.target.value)}
                      className="text-right text-red-600 font-medium"
                      disabled={isReadOnly}
                    />
                  ) : (
                    <span className="font-medium text-right text-red-600">
                      {discountAmount > 0 ? "- " : ""}
                      {formatCurrency(discountAmount)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t-2 border-primary mt-2">
                <span className="font-bold text-base">VALOR TOTAL</span>
                <span className={`font-bold text-base ${finalTotal < 0 ? "text-red-600" : "text-primary"}`}>
                  {finalTotal < 0 ? "- " : ""}
                  {formatCurrency(Math.abs(finalTotal))}
                </span>
              </div>

              {showPartialInfo && (
                <div className="mt-4 pt-4 border-t border-dashed bg-gray-50 dark:bg-gray-900/50 p-3 rounded-md">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-muted-foreground font-medium flex items-center gap-2">
                      ✅ Valor Já Pago
                    </span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(paidAmount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-medium flex items-center gap-2">
                      ⏳ Valor Ainda Devido
                    </span>
                    <span className="font-bold text-orange-600">
                      {formatCurrency(remainingDue)}
                    </span>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-2 border-t mt-2">
                * Despesas Adicionais de Reforma/Limpeza/Pinturas ou reparos necessários após a saída do inquilino
              </div>
            </>
          ) : (
            <>
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                {displayBreakdown.items.map((item: any, index: number) => {
                  const itemValue = item.value || item.amount || 0;
                  // Limpar a descrição removendo "- Parcela X/Y"
                  const cleanedDescription = cleanLabel(item.description);
                  
                  return (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        {cleanedDescription}
                      </span>
                      <span className="text-lg font-semibold">
                        {formatCurrency(Math.abs(itemValue))}
                      </span>
                    </div>
                  );
                })}
              </div>

              {values.diasAtraso > 0 && (
                <>
                  <div className="border-t border-dashed my-2"></div>
                  <LateFeeInterestBlock
                    daysLate={values.diasAtraso}
                    lateFee={values.multa}
                    interest={values.juros}
                    finalTotal={finalTotal}
                    includeLateFee={!removeLateFee}
                    includeInterest={!removeInterest}
                    onIncludeLateFeeChange={(checked) => onRemoveLateFeeChange(!checked)}
                    onIncludeInterestChange={(checked) => onRemoveInterestChange(!checked)}
                    lateFeePercentage={lateFeePercentage}
                    interestRatePercentage={interestRatePercentage}
                    showCheckboxes={isEditMode}
                    disabled={isReadOnly}
                  />
                </>
              )}

              <div className="border-t border-dashed my-2"></div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4 items-center text-sm">
                  <span className="font-medium">Valor de Desconto</span>
                  
                  {isEditMode ? (
                    <Input
                      id="breakdown-discount"
                      type="text"
                      placeholder="R$ 0,00"
                      value={discountAmountInput}
                      onChange={(e) => onDiscountAmountChange(e.target.value)}
                      className="text-right"
                      disabled={isReadOnly}
                    />
                  ) : (
                    <span className="font-medium text-right text-red-600">
                      {discountAmount > 0 ? "- " : ""}
                      {formatCurrency(discountAmount)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t-2 border-primary mt-2">
                <span className="font-bold text-base">VALOR TOTAL</span>
                <span className="font-bold text-base text-primary">
                  {formatCurrency(Math.abs(finalTotal))}
                </span>
              </div>

              {showPartialInfo && (
                <div className="mt-4 pt-4 border-t border-dashed bg-gray-50 dark:bg-gray-900/50 p-3 rounded-md">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-muted-foreground font-medium flex items-center gap-2">
                      ✅ Valor Já Pago
                    </span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(paidAmount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-medium flex items-center gap-2">
                      ⏳ Valor Ainda Devido
                    </span>
                    <span className="font-bold text-orange-600">
                      {formatCurrency(remainingDue)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {isTerminationPayment && isEditMode && (
          <div className="flex justify-end pt-4 mt-2 border-t border-dashed">
            <Button 
              id="breakdown-save-expenses"
              size="sm" 
              onClick={onSaveExpensesAndDiscount}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}