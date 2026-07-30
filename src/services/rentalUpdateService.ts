import { supabase } from "@/integrations/supabase/client";
import type { Rental } from "@/types";

/**
 * Service para gerenciar atualizações de recebimentos quando uma locação é editada
 * 
 * REGRA PRINCIPAL:
 * Quando startDate ou endDate são alterados, os recebimentos devem ser:
 * 1. Deletados se não fazem mais sentido (apenas pending/overdue)
 * 2. Criados se faltam para o novo período
 * 3. Ajustados se eram proporcionais e agora não são mais
 */

interface RentalUpdateChanges {
  startDate?: string;
  endDate?: string | null;
  monthlyRent?: number;
  paymentDay?: number;
  hasGarage?: boolean;
  garageValue?: number;
}

/**
 * Calcula quantos dias tem entre duas datas
 */
function getDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula valor proporcional baseado em dias
 */
function calculateProportionalAmount(monthlyRent: number, days: number): number {
  return Number(((monthlyRent / 30) * days).toFixed(2));
}

/**
 * Gera a data de vencimento baseado em mês/ano de referência e dia do pagamento
 */
function calculateDueDate(referenceMonth: number, referenceYear: number, paymentDay: number): string {
  return new Date(referenceYear, referenceMonth - 1, paymentDay).toISOString().split('T')[0];
}

/**
 * FUNÇÃO PRINCIPAL: Sincroniza recebimentos quando datas da locação são alteradas
 * 
 * Esta função:
 * 1. Analisa mudanças em startDate e/ou endDate
 * 2. Deleta recebimentos que não fazem mais sentido (apenas pending/overdue)
 * 3. Cria recebimentos faltantes para o novo período
 * 4. Ajusta o último recebimento se ele era proporcional e agora não é mais
 * 5. Cria novo último recebimento proporcional se necessário
 */
export async function syncPaymentsOnDateChange(
  rentalId: string,
  oldStartDate: string,
  oldEndDate: string | null,
  newStartDate: string,
  newEndDate: string | null,
  monthlyRent: number,
  paymentDay: number,
  hasGarage: boolean = false,
  garageValue: number = 0
): Promise<void> {
  console.log("🔄 [syncPaymentsOnDateChange] Iniciando sincronização de recebimentos...");
  console.log("📅 Datas antigas:", { startDate: oldStartDate, endDate: oldEndDate });
  console.log("📅 Datas novas:", { startDate: newStartDate, endDate: newEndDate });

  const startDateChanged = oldStartDate !== newStartDate;
  const endDateChanged = oldEndDate !== newEndDate;

  if (!startDateChanged && !endDateChanged) {
    console.log("ℹ️ Nenhuma mudança nas datas - nada a fazer");
    return;
  }

  // 1. Buscar todos os recebimentos existentes
  const { data: existingPayments, error: fetchError } = await supabase
    .from("payments")
    .select("*")
    .eq("rental_id", rentalId)
    .order("reference_year", { ascending: true })
    .order("reference_month", { ascending: true });

  if (fetchError) throw fetchError;

  console.log(`📊 ${existingPayments?.length || 0} recebimentos existentes encontrados`);

  // 2. Calcular período esperado com as novas datas
  const newStart = new Date(newStartDate + "T00:00:00");
  const newEnd = newEndDate ? new Date(newEndDate + "T00:00:00") : new Date(newStart.getFullYear() + 1, newStart.getMonth(), newStart.getDate());

  // 3. Gerar lista de meses esperados (reference_month/reference_year)
  const expectedMonths = new Set<string>();
  const startDay = newStart.getDate();
  let currentMonth: number, currentYear: number, isProportional: boolean;

  // Calcular primeiro recebimento
  if (startDay === paymentDay) {
    // Se iniciou exatamente no dia do pagamento, primeiro recebimento é mês seguinte (valor cheio)
    const nextMonth = newStart.getMonth() === 11 ? 0 : newStart.getMonth() + 1;
    const nextYear = newStart.getMonth() === 11 ? newStart.getFullYear() + 1 : newStart.getFullYear();
    currentMonth = nextMonth + 1; // +1 porque getMonth() retorna 0-11
    currentYear = nextYear;
    isProportional = false;
  } else if (startDay < paymentDay) {
    // Se iniciou antes do dia de pagamento no mês, primeiro recebimento é no mesmo mês (proporcional)
    currentMonth = newStart.getMonth() + 1;
    currentYear = newStart.getFullYear();
    isProportional = true;
  } else {
    // Se iniciou depois do dia de pagamento, primeiro recebimento é mês seguinte (proporcional)
    const nextMonth = newStart.getMonth() === 11 ? 0 : newStart.getMonth() + 1;
    const nextYear = newStart.getMonth() === 11 ? newStart.getFullYear() + 1 : newStart.getFullYear();
    currentMonth = nextMonth + 1;
    currentYear = nextYear;
    isProportional = true;
  }

  // Adicionar todos os meses até a data fim
  const maxIterations = 1000; // Proteção contra loops infinitos
  let iterations = 0;
  
  while (iterations < maxIterations) {
    const refKey = `${currentYear}-${currentMonth}`;
    const dueDate = new Date(currentYear, currentMonth - 1, paymentDay);
    
    // Parar se passou da data fim
    if (dueDate > newEnd) break;
    
    expectedMonths.add(refKey);
    
    // Próximo mês
    if (currentMonth === 12) {
      currentMonth = 1;
      currentYear++;
    } else {
      currentMonth++;
    }
    
    iterations++;
  }

  console.log(`📋 ${expectedMonths.size} meses esperados no novo período`);

  // 4. Identificar recebimentos a deletar (existem mas não deveriam existir mais)
  const paymentsToDelete: string[] = [];
  const paymentsToKeep = new Map<string, any>();

  for (const payment of existingPayments || []) {
    const refKey = `${payment.reference_year}-${payment.reference_month}`;
    
    // Só pode deletar se status = pending ou overdue
    if (payment.status === "paid" || payment.status === "partial") {
      paymentsToKeep.set(refKey, payment);
      console.log(`🔒 Mantendo recebimento PAGO/PARCIAL: ${refKey}`);
      continue;
    }

    if (!expectedMonths.has(refKey)) {
      paymentsToDelete.push(payment.id);
      console.log(`🗑️ Marcado para deletar: ${refKey}`);
    } else {
      paymentsToKeep.set(refKey, payment);
    }
  }

  // 5. Deletar recebimentos que não fazem mais sentido
  if (paymentsToDelete.length > 0) {
    console.log(`🗑️ Deletando ${paymentsToDelete.length} recebimentos pending/overdue...`);
    const { error: deleteError } = await supabase
      .from("payments")
      .delete()
      .in("id", paymentsToDelete);
    
    if (deleteError) throw deleteError;
    console.log("✅ Recebimentos deletados com sucesso");
  }

  // 6. Identificar recebimentos a criar (deveriam existir mas não existem)
  const monthsToCreate: string[] = [];
  for (const refKey of expectedMonths) {
    if (!paymentsToKeep.has(refKey)) {
      monthsToCreate.push(refKey);
    }
  }

  console.log(`➕ ${monthsToCreate.length} recebimentos faltantes para criar`);

  // 7. Criar recebimentos faltantes
  if (monthsToCreate.length > 0) {
    const totalRent = monthlyRent + (hasGarage ? garageValue : 0);
    const newPayments: any[] = [];

    for (const refKey of monthsToCreate) {
      const [yearStr, monthStr] = refKey.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const dueDate = new Date(year, month - 1, paymentDay);

      // Verificar se é o primeiro ou último recebimento (pode ser proporcional)
      const isFirst = refKey === `${newStart.getFullYear()}-${newStart.getMonth() + 1}` ||
                     (startDay > paymentDay && month === (newStart.getMonth() === 11 ? 1 : newStart.getMonth() + 2));
      
      const isLast = dueDate.getFullYear() === newEnd.getFullYear() && 
                     dueDate.getMonth() === newEnd.getMonth();

      let expectedAmount = totalRent;
      let breakdown = [
        { description: "Aluguel", amount: parseFloat(monthlyRent.toFixed(2)), type: "addition" }
      ];

      if (hasGarage && garageValue > 0) {
        breakdown.push({ 
          description: "Garagem", 
          amount: parseFloat(garageValue.toFixed(2)), 
          type: "addition" 
        });
      }

      // Calcular proporcional se necessário
      if (isFirst && startDay !== paymentDay) {
        let days: number;
        if (startDay < paymentDay) {
          days = paymentDay - startDay;
        } else {
          const daysInMonth = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0).getDate();
          days = (daysInMonth - startDay + 1) + (paymentDay - 1);
        }
        
        const proportionalRent = calculateProportionalAmount(monthlyRent, days);
        const proportionalGarage = hasGarage ? calculateProportionalAmount(garageValue, days) : 0;
        expectedAmount = proportionalRent + proportionalGarage;
        
        breakdown = [
          { description: `Aluguel (${days} dias)`, amount: parseFloat(proportionalRent.toFixed(2)), type: "addition" }
        ];
        if (hasGarage && proportionalGarage > 0) {
          breakdown.push({ 
            description: `Garagem (${days} dias)`, 
            amount: parseFloat(proportionalGarage.toFixed(2)), 
            type: "addition" 
          });
        }
      } else if (isLast && newEnd.getDate() !== paymentDay - 1) {
        const endDay = newEnd.getDate();
        const days = endDay < paymentDay ? endDay : paymentDay - 1;
        
        const proportionalRent = calculateProportionalAmount(monthlyRent, days);
        const proportionalGarage = hasGarage ? calculateProportionalAmount(garageValue, days) : 0;
        expectedAmount = proportionalRent + proportionalGarage;
        
        breakdown = [
          { description: `Aluguel (${days} dias)`, amount: parseFloat(proportionalRent.toFixed(2)), type: "addition" }
        ];
        if (hasGarage && proportionalGarage > 0) {
          breakdown.push({ 
            description: `Garagem (${days} dias)`, 
            amount: parseFloat(proportionalGarage.toFixed(2)), 
            type: "addition" 
          });
        }
      }

      newPayments.push({
        rental_id: rentalId,
        reference_month: monthStr,
        reference_year: yearStr,
        due_date: dueDate.toISOString().split('T')[0],
        expected_amount: parseFloat(expectedAmount.toFixed(2)),
        status: "pending",
        breakdown,
      });
    }

    if (newPayments.length > 0) {
      const { error: insertError } = await supabase
        .from("payments")
        .insert(newPayments);
      
      if (insertError) throw insertError;
      console.log(`✅ ${newPayments.length} novos recebimentos criados`);
    }
  }

  // 8. AJUSTAR RECEBIMENTO QUE ERA PROPORCIONAL MAS AGORA NÃO É MAIS
  // Se a data fim foi estendida, o que era o último recebimento pode não ser mais
  if (endDateChanged && newEndDate && oldEndDate && newEndDate > oldEndDate) {
    console.log("🔍 Verificando se há recebimento proporcional que precisa ser ajustado...");
    
    const oldEnd = new Date(oldEndDate + "T00:00:00");
    const oldLastMonth = oldEnd.getMonth() + 1;
    const oldLastYear = oldEnd.getFullYear();
    const oldLastRefKey = `${oldLastYear}-${oldLastMonth}`;
    
    const oldLastPayment = paymentsToKeep.get(oldLastRefKey);
    
    if (oldLastPayment && (oldLastPayment.status === "pending" || oldLastPayment.status === "overdue")) {
      const totalRent = monthlyRent + (hasGarage ? garageValue : 0);
      
      // Verificar se estava proporcional e agora não é mais
      if (oldLastPayment.expected_amount < totalRent) {
        console.log(`🔄 Ajustando recebimento ${oldLastRefKey} que era proporcional para valor cheio`);
        
        const breakdown = [
          { description: "Aluguel", amount: parseFloat(monthlyRent.toFixed(2)), type: "addition" }
        ];
        
        if (hasGarage && garageValue > 0) {
          breakdown.push({ 
            description: "Garagem", 
            amount: parseFloat(garageValue.toFixed(2)), 
            type: "addition" 
          });
        }
        
        const { error: updateError } = await supabase
          .from("payments")
          .update({
            expected_amount: totalRent,
            breakdown,
          })
          .eq("id", oldLastPayment.id);
        
        if (updateError) throw updateError;
        console.log("✅ Recebimento ajustado de proporcional para valor cheio");
      }
    }
  }

  // 9. Atualizar total_installments em todos os recebimentos
  const { data: allPayments } = await supabase
    .from("payments")
    .select("id")
    .eq("rental_id", rentalId);
  
  if (allPayments) {
    await supabase
      .from("payments")
      .update({ total_installments: allPayments.length })
      .eq("rental_id", rentalId);
  }

  console.log("✅ [syncPaymentsOnDateChange] Sincronização concluída com sucesso!");
}

/**
 * Ajusta o valor do aluguel de uma locação ativa e recalcula os recebimentos futuros
 * 
 * REGRA CRÍTICA: Atualiza APENAS pagamentos FUTUROS (due_date >= hoje) e status = 'pending'
 * NUNCA toca em pagamentos PAGOS ou PASSADOS
 */
export async function adjustRentalValue(
  rentalId: string,
  oldValue: number,
  newValue: number,
  effectiveDate: string
): Promise<void> {
  console.log("💰 [adjustRentalValue] Iniciando ajuste de valor do aluguel...");
  console.log("📋 Dados do ajuste:", { rentalId, oldValue, newValue, effectiveDate });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", rentalId)
    .single();

  if (rentalError || !rental) {
    console.error("❌ Erro ao buscar locação:", rentalError);
    throw new Error("Locação não encontrada");
  }

  // ✅ CRÍTICO: Buscar APENAS pagamentos FUTUROS e PENDING
  const { data: futurePayments, error: paymentsError } = await supabase
    .from("payments")
    .select("*")
    .eq("rental_id", rentalId)
    .eq("status", "pending")
    .gte("due_date", todayStr)
    .order("due_date", { ascending: true });

  if (paymentsError) throw paymentsError;
  if (!futurePayments || futurePayments.length === 0) {
    console.log("ℹ️ Nenhum pagamento futuro pendente para atualizar");
    return;
  }

  console.log(`📊 ${futurePayments.length} pagamentos futuros serão atualizados`);

  const garageAmount = (rental.has_garage && rental.garage_value) ? rental.garage_value : 0;
  const totalNewValue = newValue + garageAmount;

  const updates: Array<{ id: string; changes: any }> = [];

  for (const payment of futurePayments) {
    const breakdown = [{ type: "addition", amount: parseFloat(newValue.toFixed(2)), description: "Aluguel" }];
    if (garageAmount > 0) {
      breakdown.push({ type: "addition", amount: parseFloat(garageAmount.toFixed(2)), description: "Garagem" });
    }
    updates.push({ 
      id: payment.id, 
      changes: { 
        expected_amount: parseFloat(totalNewValue.toFixed(2)), 
        breakdown 
      } 
    });
  }

  for (const update of updates) {
    const { error: updateError } = await supabase.from("payments").update(update.changes).eq("id", update.id);
    if (updateError) throw updateError;
  }

  console.log(`✅ ${updates.length} pagamentos futuros atualizados com sucesso`);
}

export const rentalUpdateService = {
  syncPaymentsOnDateChange,
  adjustRentalValue,

  /**
   * WRAPPER: Detecta mudanças e chama a função apropriada
   */
  async updatePaymentsOnRentalEdit(
    rentalId: string, 
    oldRental: Rental, 
    newChanges: RentalUpdateChanges
  ): Promise<void> {
    try {
      console.log("🚀 [rentalUpdateService] Iniciando análise de mudanças...");

      const startDateChanged = newChanges.startDate && newChanges.startDate !== oldRental.startDate;
      const endDateChanged = newChanges.endDate !== undefined && newChanges.endDate !== oldRental.endDate;
      
      // Se alguma data mudou, sincronizar recebimentos
      if (startDateChanged || endDateChanged) {
        const monthlyRent = newChanges.monthlyRent ?? oldRental.monthlyRent;
        const paymentDay = newChanges.paymentDay ?? oldRental.paymentDay;
        const hasGarage = newChanges.hasGarage ?? oldRental.hasGarage;
        const garageValue = newChanges.garageValue ?? oldRental.garageValue ?? 0;

        await syncPaymentsOnDateChange(
          rentalId,
          oldRental.startDate,
          oldRental.endDate,
          newChanges.startDate ?? oldRental.startDate,
          newChanges.endDate ?? oldRental.endDate,
          monthlyRent,
          paymentDay,
          hasGarage,
          garageValue
        );
      }

      // Se apenas o valor mudou (sem mudança de datas), ajustar valores futuros
      const valueChanged = (newChanges.monthlyRent !== undefined && newChanges.monthlyRent !== oldRental.monthlyRent) ||
                          (newChanges.hasGarage !== undefined && newChanges.hasGarage !== oldRental.hasGarage) ||
                          (newChanges.garageValue !== undefined && newChanges.garageValue !== oldRental.garageValue);

      if (valueChanged && !startDateChanged && !endDateChanged) {
        const newRent = newChanges.monthlyRent ?? oldRental.monthlyRent;
        await adjustRentalValue(rentalId, oldRental.monthlyRent, newRent, new Date().toISOString().split('T')[0]);
      }

      console.log("✅ [rentalUpdateService] Análise concluída com sucesso");
    } catch (error) {
      console.error("❌ [rentalUpdateService] ERRO CRÍTICO:", error);
      throw error;
    }
  }
};