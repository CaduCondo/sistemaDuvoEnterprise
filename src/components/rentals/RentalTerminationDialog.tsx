import { useState, useEffect } from "react";
import { format, differenceInMonths, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, AlertTriangle, Info } from "lucide-react";
import type { Rental } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { calculateCorrectedDeposit } from "@/services/igpmService";
import { 
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { calcularProporcionalAluguelEGaragem } from "@/lib/rentalCalculations";

interface RentalTerminationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: Rental | null;
  onConfirm: (data: {
    terminationDate: string;
    applyPenalty: boolean;
    penaltyAmount: number;
    depositAmount: number;
  }) => Promise<void>;
}

export function RentalTerminationDialog({
  open,
  onOpenChange,
  rental,
  onConfirm,
}: RentalTerminationDialogProps) {
  const [terminationDate, setTerminationDate] = useState<string>("");
  const [applyFullContractPenalty, setApplyFullContractPenalty] = useState<boolean>(false);
  const [apply12MonthsPenalty, setApply12MonthsPenalty] = useState<boolean>(false);
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [proportionalDays, setProportionalDays] = useState<number>(0);
  const [proportionalRent, setProportionalRent] = useState<number>(0);
  const [fullMonthRent, setFullMonthRent] = useState<number>(0);
  const [isAfterDueDate, setIsAfterDueDate] = useState<boolean>(false);
  const [lastPaymentDateStr, setLastPaymentDateStr] = useState<string>("");

  const [currentMonth, setCurrentMonth] = useState<number>(0);
  const [totalMonths, setTotalMonths] = useState<number>(0);
  
  const [correctedDepositAmount, setCorrectedDepositAmount] = useState<number>(0);
  const [poupancaPercentage, setPoupancaPercentage] = useState<number>(0);
  const [lastInstallmentDate, setLastInstallmentDate] = useState<string>("");

  useEffect(() => {
    if (!rental || !open) {
      setTerminationDate("");
      setApplyFullContractPenalty(false);
      setApply12MonthsPenalty(false);
      setPenaltyAmount(0);
      setIsSubmitting(false);
      setCurrentMonth(0);
      setTotalMonths(0);
      setDepositAmount(0);
      setCorrectedDepositAmount(0);
      setPoupancaPercentage(0);
      setLastInstallmentDate("");
      setProportionalDays(0);
      setProportionalRent(0);
      setFullMonthRent(0);
      setIsAfterDueDate(false);
      setLastPaymentDateStr("");
      return;
    }

    const startDate = parseISO(rental.startDate);
    const endDate = parseISO(rental.endDate);
    const today = new Date();

    const total = differenceInMonths(endDate, startDate) + 1;
    const current = differenceInMonths(today, startDate) + 1;

    setTotalMonths(total);
    setCurrentMonth(Math.min(current, total));
    setTerminationDate(format(today, "yyyy-MM-dd"));

    const fetchTotalDeposit = async () => {
      try {
        let totalDeposit = 0;
        let source = "";
        let lastPaidDate = "";

        const { data: installments, error: installmentsError } = await supabase
          .from("deposit_installments")
          .select("amount, payment_date, installment_number")
          .eq("rental_id", rental.id);

        if (installmentsError) {
          console.error("❌ Erro ao buscar parcelas:", installmentsError);
        } else if (installments && installments.length > 0) {
          const paidInstallments = installments
            .filter(inst => inst.payment_date)
            .sort((a, b) => b.installment_number - a.installment_number);
          
          if (paidInstallments.length > 0) {
            const lastPaidInstallment = paidInstallments[0];
            lastPaidDate = lastPaidInstallment.payment_date;
          } else {
            lastPaidDate = rental.startDate;
          }

          totalDeposit = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
          source = "deposit_installments (tabela de parcelas)";
        }

        if (totalDeposit === 0) {
          const securityDepositValue = Number(rental.security_deposit) || 0;
          if (securityDepositValue > 0) {
            totalDeposit = securityDepositValue;
            source = "security_deposit";
            lastPaidDate = rental.startDate;
          }
        }

        if (totalDeposit === 0) {
          const { data: rentalData } = await supabase
            .from("rentals")
            .select("deposit_value")
            .eq("id", rental.id)
            .single();

          if (rentalData) {
            const depositValue = Number(rentalData.deposit_value) || 0;
            if (depositValue > 0) {
              totalDeposit = depositValue;
              source = "deposit_value";
              lastPaidDate = rental.startDate;
            }
          }
        }

        setDepositAmount(totalDeposit);
        setLastInstallmentDate(lastPaidDate);
        
        if (totalDeposit > 0 && lastPaidDate) {
          try {
            const poupancaCorrection = calculateCorrectedDeposit(
              totalDeposit,
              lastPaidDate,
              format(today, "yyyy-MM-dd")
            );
            
            setCorrectedDepositAmount(poupancaCorrection.correctedAmount);
            setPoupancaPercentage(poupancaCorrection.poupancaPercentage);
          } catch (error) {
            console.error("❌ Erro ao calcular Poupança:", error);
            setCorrectedDepositAmount(totalDeposit);
            setPoupancaPercentage(0);
          }
        } else {
          setCorrectedDepositAmount(totalDeposit);
          setPoupancaPercentage(0);
        }

      } catch (error) {
        console.error("❌ ERRO CRÍTICO:", error);
        setDepositAmount(0);
        setCorrectedDepositAmount(0);
        setPoupancaPercentage(0);
        setLastInstallmentDate("");
      }
    };

    fetchTotalDeposit();
  }, [rental, open]);

  useEffect(() => {
    if (!rental || !terminationDate) {
      setPenaltyAmount(0);
      setProportionalDays(0);
      setProportionalRent(0);
      setFullMonthRent(0);
      setIsAfterDueDate(false);
      setLastPaymentDateStr("");
      return;
    }

    try {
      const termDate = parseISO(terminationDate);
      const startDate = parseISO(rental.startDate);
      const endDate = parseISO(rental.endDate);
      
      const currentMonthFromDate = differenceInMonths(termDate, startDate) + 1;
      const remaining = Math.max(0, differenceInMonths(endDate, termDate));

      const monthlyRent = rental.value || 0;
      // A garagem entra na conta junto com o aluguel — antes de 24/ago/2026 a
      // prévia mostrava um valor menor do que o devido porque a ignorava (#49).
      const garageValue = rental.hasGarage ? (rental.garageValue || 0) : 0;
      const paymentDay = rental.paymentDay || 1;
      
      const terminationMonth = termDate.getMonth();
      const terminationYear = termDate.getFullYear();
      
      // Data de vencimento do mês atual
      const dueDateOfTerminationMonth = new Date(terminationYear, terminationMonth, paymentDay);
      
      let daysUsed = 0;
      let lastPaymentDate: Date;
      let fullMonth = 0;
      let proportional = 0;
      let afterDue = false;

      if (termDate >= dueDateOfTerminationMonth) {
        afterDue = true;
        lastPaymentDate = dueDateOfTerminationMonth;
        fullMonth = monthlyRent + garageValue;
        daysUsed = differenceInDays(termDate, lastPaymentDate) + 1;
        proportional = calcularProporcionalAluguelEGaragem(monthlyRent, garageValue, daysUsed).total;
      } else {
        afterDue = false;
        const previousMonth = terminationMonth === 0 ? 11 : terminationMonth - 1;
        const previousYear = terminationMonth === 0 ? terminationYear - 1 : terminationYear;
        lastPaymentDate = new Date(previousYear, previousMonth, paymentDay);
        daysUsed = differenceInDays(termDate, lastPaymentDate) + 1;
        proportional = calcularProporcionalAluguelEGaragem(monthlyRent, garageValue, daysUsed).total;
      }
      
      setProportionalDays(daysUsed);
      setProportionalRent(proportional);
      setFullMonthRent(fullMonth);
      setIsAfterDueDate(afterDue);
      setLastPaymentDateStr(format(lastPaymentDate, "dd/MM/yyyy"));

      // Cálculo de multas
      if (applyFullContractPenalty && remaining > 0) {
        const threeTimesRent = 3 * monthlyRent;
        const penalty = ((threeTimesRent / totalMonths) * remaining);
        setPenaltyAmount(Math.round(penalty * 100) / 100);
      } 
      else if (apply12MonthsPenalty) {
        if (currentMonthFromDate < 12) {
          const monthsTo12th = Math.max(0, 12 - currentMonthFromDate);
          const threeTimesRent = 3 * monthlyRent;
          const penalty = ((threeTimesRent / 12) * monthsTo12th);
          setPenaltyAmount(Math.round(penalty * 100) / 100);
        } else {
          setPenaltyAmount(0);
        }
      } 
      else {
        setPenaltyAmount(0);
      }
    } catch (error) {
      console.error("Error calculating values:", error);
      setPenaltyAmount(0);
      setProportionalDays(0);
      setProportionalRent(0);
      setFullMonthRent(0);
      setIsAfterDueDate(false);
      setLastPaymentDateStr("");
    }
  }, [rental, terminationDate, applyFullContractPenalty, apply12MonthsPenalty, totalMonths]);

  const handleConfirm = async () => {
    if (!terminationDate) {
      return;
    }

    // REMOVIDO: Bloqueio quando depositAmount === 0
    // O sistema deve permitir rescisão mesmo sem caução

    setIsSubmitting(true);
    try {
      // SEMPRE usar o valor corrigido quando disponível
      const finalDepositAmount = correctedDepositAmount > 0 ? correctedDepositAmount : depositAmount;

      // A multa e SEMPRE uma das duas clausulas do contrato. Um campo de valor
      // livre existiu aqui por um dia e foi retirado a pedido do Cadu
      // (28/ago/2026): desconto, arredondamento ou perdao da multa se fazem no
      // campo "Valor de Desconto" da tela do Recebimento de Rescisao, que fica
      // registrado como desconto — e nao escondido dentro da multa.
      await onConfirm({
        terminationDate,
        applyPenalty: applyFullContractPenalty || apply12MonthsPenalty,
        penaltyAmount,
        depositAmount: finalDepositAmount,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error terminating rental:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!rental) return null;

  const monthlyRent = rental.value || 0;

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Rescisão de Contrato
            </DialogTitle>
            <DialogDescription>
              Encerramento de contrato de locação
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Imóvel:</span>
                <span className="font-medium">
                  {typeof rental.property?.location === 'object' 
                    ? (rental.property?.location as any)?.name 
                    : rental.property?.location} - {rental.property?.complement}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inquilino:</span>
                <span className="font-medium">{rental.tenant?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aluguel:</span>
                <span className="font-medium">
                  R$ {monthlyRent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {depositAmount > 0 ? (
              <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                      🔔 ATENÇÃO: VALOR DO CAUÇÃO
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Esta rescisão devolverá:
                    </p>
                    {correctedDepositAmount > 0 && poupancaPercentage > 0 ? (
                      <>
                        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                          <p>Valor original: R$ {depositAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          <p>Data base: {lastInstallmentDate ? format(parseISO(lastInstallmentDate), "dd/MM/yyyy", { locale: ptBR }) : "N/A"}</p>
                          <p className="font-medium">Correção Poupança: +{poupancaPercentage.toFixed(4)}%</p>
                        </div>
                        <p className="text-2xl font-bold text-center text-blue-900 dark:text-blue-100">
                          R$ {correctedDepositAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="underline decoration-dotted cursor-help hover:text-blue-900 dark:hover:text-blue-100">
                                Valor corrigido pela Taxa da Poupança
                              </button>
                            </TooltipTrigger>
                            {/* ⚠️ `text-foreground` e obrigatorio aqui (28/ago/2026). O TooltipContent
                                padrao vem com `bg-primary text-primary-foreground` — texto BRANCO.
                                Este trecho sobrescrevia so o fundo para branco e esquecia a cor do
                                texto, entao o tooltip abria com texto branco sobre fundo branco: so
                                as linhas que tinham cor propria (a verde da correcao e as muted das
                                taxas) apareciam, e o resto ficava invisivel. */}
                            <TooltipContent className="max-w-md p-4 bg-white dark:bg-gray-800 text-foreground border border-gray-200 dark:border-gray-700 shadow-lg">
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <p className="font-semibold text-sm">💰 Resumo da Correção:</p>
                                  <div className="text-xs space-y-1 pl-2">
                                    <div className="flex justify-between">
                                      <span>Valor Original:</span>
                                      <span className="font-medium">R$ {depositAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-green-600 dark:text-green-400">
                                      <span>Correção Poupança:</span>
                                      <span className="font-medium">
                                        +R$ {(correctedDepositAmount - depositAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                        {' '}(+{poupancaPercentage.toFixed(4)}%)
                                      </span>
                                    </div>
                                    <div className="flex justify-between font-semibold border-t pt-1">
                                      <span>Valor Corrigido:</span>
                                      <span>R$ {correctedDepositAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                    </div>
                                  </div>
                                </div>
                                {(() => {
                                  try {
                                    const poupancaData = calculateCorrectedDeposit(
                                      depositAmount,
                                      lastInstallmentDate,
                                      format(new Date(), "yyyy-MM-dd")
                                    );
                                    return (
                                      <div className="space-y-2 border-t pt-2">
                                        <p className="font-semibold text-sm">📅 Taxas Mensais Aplicadas:</p>
                                        <div className="text-xs space-y-0.5 max-h-40 overflow-y-auto pl-2">
                                          {poupancaData.poupancaDetails.split('\n').map((line, idx) => (
                                            <div key={idx} className="text-muted-foreground">
                                              {line}
                                            </div>
                                          ))}
                                        </div>
                                        <div className="text-xs font-medium border-t pt-1">
                                          Total Acumulado: +{poupancaPercentage.toFixed(4)}%
                                        </div>
                                      </div>
                                    );
                                  } catch (error) {
                                    return null;
                                  }
                                })()}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          {' '}desde {lastInstallmentDate ? format(parseISO(lastInstallmentDate), "dd/MM/yyyy", { locale: ptBR }) : "data início"} até hoje.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                          <p>Valor original: R$ {depositAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          {lastInstallmentDate && (
                            <p>Data base: {format(parseISO(lastInstallmentDate), "dd/MM/yyyy", { locale: ptBR })}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            (Sem correção aplicável ou período muito curto)
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-center text-blue-900 dark:text-blue-100">
                          R$ {depositAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Será adicionado ao recebimento final.
                        </p>
                      </>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold text-amber-900 dark:text-amber-100">
                      ℹ️ INFORMAÇÃO: SEM CAUÇÃO
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Esta locação não possui valor de caução cadastrado.
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      A rescisão pode ser realizada normalmente. Apenas os valores de aluguel e multa (se aplicável) serão considerados.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="termination-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data da Saída do Inquilino *
              </Label>
              <Input
                id="termination-date"
                type="date"
                value={terminationDate}
                onChange={(e) => setTerminationDate(e.target.value)}
                required
              />
              {proportionalDays > 0 && terminationDate && rental && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <div>
                      {isAfterDueDate ? (
                        <>
                          <p className="font-medium">Rescisão APÓS vencimento (dia {rental.paymentDay}):</p>
                          <ul className="list-disc list-inside ml-2 space-y-0.5">
                            <li>Mês cheio: R$ {fullMonthRent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</li>
                            <li>Dias extras ({lastPaymentDateStr} até {format(parseISO(terminationDate), "dd/MM/yyyy")}): {proportionalDays} dias × R$ {(monthlyRent / 30).toFixed(2)}/dia = R$ {proportionalRent.toFixed(2)}</li>
                          </ul>
                        </>
                      ) : (
                        <>
                          <p className="font-medium">Rescisão ANTES do vencimento (dia {rental.paymentDay}):</p>
                          <p className="ml-2">Proporcional ({lastPaymentDateStr} até {format(parseISO(terminationDate), "dd/MM/yyyy")}): {proportionalDays} dias × R$ {(monthlyRent / 30).toFixed(2)}/dia = R$ {proportionalRent.toFixed(2)}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold">Multa Rescisória</Label>
              
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="termination-apply-full-penalty"
                    checked={applyFullContractPenalty}
                    onCheckedChange={(checked) => {
                      setApplyFullContractPenalty(checked as boolean);
                      if (checked) setApply12MonthsPenalty(false);
                    }}
                  />
                  <div className="grid gap-1 leading-none">
                    <Label htmlFor="termination-apply-full-penalty" className="cursor-pointer font-normal">
                      Multa Proporcional ao Tempo Restante
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      (3 aluguéis ÷ meses totais) × meses restantes
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="termination-apply-12months-penalty"
                    checked={apply12MonthsPenalty}
                    onCheckedChange={(checked) => {
                      setApply12MonthsPenalty(checked as boolean);
                      if (checked) setApplyFullContractPenalty(false);
                    }}
                    disabled={currentMonth >= 12}
                  />
                  <div className="grid gap-1 leading-none">
                    <Label 
                      htmlFor="termination-apply-12months-penalty" 
                      className={`cursor-pointer font-normal ${currentMonth >= 12 ? "opacity-50" : ""}`}
                    >
                      Multa Cláusula 12 Meses
                    </Label>
                    {currentMonth >= 12 ? (
                      <span className="text-xs text-green-600 font-medium">Isento (após 12 meses)</span>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        (3 aluguéis ÷ 12) × meses até completar 12
                      </p>
                    )}
                  </div>
                </div>

                {penaltyAmount > 0 && (
                  <div className="flex justify-between items-center bg-red-50 dark:bg-red-950 p-2 rounded">
                    <span className="text-sm text-red-700 dark:text-red-300 font-medium">Valor da Multa:</span>
                    <span className="font-bold text-red-700 dark:text-red-300">
                      R$ {penaltyAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-xs space-y-1">
                <p className="font-medium">O que vai acontecer:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Recebimento do mês será atualizado com valores proporcionais corretos</li>
                  <li>Se rescisão APÓS vencimento: mês cheio + dias extras desde vencimento</li>
                  <li>Se rescisão ANTES do vencimento: proporcional desde último vencimento</li>
                  <li>Recebimentos futuros serão excluídos</li>
                  <li>Multa e caução serão adicionados ao recebimento</li>
                  <li>Despesas de reforma podem ser adicionadas depois na tela de Recebimentos</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              id="termination-cancel"
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              id="termination-confirm"
              type="button"
              onClick={handleConfirm}
              disabled={!terminationDate || isSubmitting}
            >
              {isSubmitting ? "Processando..." : "Confirmar Rescisão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}