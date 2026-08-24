import { supabase } from "@/integrations/supabase/client";
import type { Rental } from "@/types";
import { calcularProporcional } from "@/lib/rentalCalculations";

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
 * Calcula valor proporcional baseado em dias.
 *
 * Delega para `calcularProporcional`, em src/lib/rentalCalculations.ts: a
 * conta do proporcional tem UMA implementação no sistema. Ver o comentário
 * de lá para entender por que isso importa.
 */
function calculateProportionalAmount(monthlyRent: number, days: number): number {
  return calcularProporcional(monthlyRent, days);
}

/**
 * FUNÇÃO PRINCIPAL: Sincroniza recebimentos quando datas da locação são alteradas
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
  console.log("🔄 [syncPaymentsOnDateChange] Iniciando sincronização...");
  console.log("📅 Datas antigas:", { startDate: oldStartDate, endDate: oldEndDate });
  console.log("📅 Datas novas:", { startDate: newStartDate, endDate: newEndDate });

  const startDateChanged = oldStartDate !== newStartDate;
  const endDateChanged = oldEndDate !== newEndDate;

  if (!startDateChanged && !endDateChanged) {
    console.log("ℹ️ Nenhuma mudança nas datas");
    return;
  }

  const totalRent = monthlyRent + (hasGarage ? garageValue : 0);

  // 1. Buscar todos os recebimentos existentes
  const { data: existingPayments, error: fetchError } = await supabase
    .from("payments")
    .select("*")
    .eq("rental_id", rentalId)
    .order("installment", { ascending: true });

  if (fetchError) throw fetchError;

  console.log(`📊 ${existingPayments?.length || 0} recebimentos existentes`);

  // 2. Calcular período esperado com as novas datas
  const newStart = new Date(newStartDate + "T00:00:00");
  const newEnd = newEndDate 
    ? new Date(newEndDate + "T00:00:00") 
    : new Date(newStart.getFullYear() + 1, newStart.getMonth(), newStart.getDate());

  // 3. Gerar lista de competências (mes/ano) esperadas
  const expectedPayments: Array<{
    refMonth: string;
    refYear: string;
    dueDate: string;
    isProportional: boolean;
    days?: number;
  }> = [];

  const startDay = newStart.getDate();
  const currentDate = new Date(newStart);
  
  // Primeiro recebimento
  let firstDueDate: Date;
  let firstIsProportional = false;
  let firstDays = 0;

  if (startDay === paymentDay) {
    // Se iniciou no dia de pagamento, primeiro recebimento é mês seguinte (cheio)
    firstDueDate = new Date(newStart.getFullYear(), newStart.getMonth() + 1, paymentDay);
  } else if (startDay < paymentDay) {
    // Iniciou antes do dia de pagamento, primeiro recebimento é no mesmo mês (proporcional)
    firstDueDate = new Date(newStart.getFullYear(), newStart.getMonth(), paymentDay);
    firstIsProportional = true;
    firstDays = paymentDay - startDay;
  } else {
    // Iniciou depois do dia de pagamento, primeiro recebimento é mês seguinte (proporcional)
    firstDueDate = new Date(newStart.getFullYear(), newStart.getMonth() + 1, paymentDay);
    firstIsProportional = true;
    const daysInMonth = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0).getDate();
    firstDays = (daysInMonth - startDay + 1) + (paymentDay - 1);
  }

  // Adicionar primeiro recebimento
  if (firstDueDate <= newEnd) {
    expectedPayments.push({
      refMonth: String(firstDueDate.getMonth() + 1).padStart(2, '0'),
      refYear: String(firstDueDate.getFullYear()),
      dueDate: firstDueDate.toISOString().split('T')[0],
      isProportional: firstIsProportional,
      days: firstIsProportional ? firstDays : undefined,
    });
  }

  // Adicionar recebimentos seguintes (cheios)
  const nextDueDate = new Date(firstDueDate);
  nextDueDate.setMonth(nextDueDate.getMonth() + 1);

  while (nextDueDate <= newEnd) {
    // Verificar se é o último recebimento (pode ser proporcional)
    const isLast = nextDueDate.getMonth() === newEnd.getMonth() && 
                   nextDueDate.getFullYear() === newEnd.getFullYear();
    
    let isProportional = false;
    let days = 0;

    if (isLast) {
      const endDay = newEnd.getDate();
      // Se termina antes do dia de pagamento, é proporcional
      if (endDay < paymentDay - 1) {
        isProportional = true;
        days = endDay;
      }
    }

    expectedPayments.push({
      refMonth: String(nextDueDate.getMonth() + 1).padStart(2, '0'),
      refYear: String(nextDueDate.getFullYear()),
      dueDate: nextDueDate.toISOString().split('T')[0],
      isProportional,
      days: isProportional ? days : undefined,
    });

    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  }

  console.log(`📋 ${expectedPayments.length} recebimentos esperados no novo período`);

  // 4. Identificar recebimentos a deletar (existem mas não deveriam)
  const paymentsToDelete: string[] = [];
  const paymentsToKeep = new Map<string, any>();

  for (const payment of existingPayments || []) {
    // Só pode deletar se status = pending ou overdue
    if (payment.status === "paid" || payment.status === "partial") {
      const refKey = `${payment.reference_year}-${payment.reference_month}`;
      paymentsToKeep.set(refKey, payment);
      console.log(`🔒 Mantendo recebimento PAGO: ${refKey}`);
      continue;
    }

    const refKey = `${payment.reference_year}-${payment.reference_month}`;
    const shouldExist = expectedPayments.some(
      exp => exp.refYear === payment.reference_year && exp.refMonth === payment.reference_month
    );

    if (!shouldExist) {
      paymentsToDelete.push(payment.id);
      console.log(`🗑️ Marcado para deletar: ${refKey} (parcela ${payment.installment})`);
    } else {
      paymentsToKeep.set(refKey, payment);
    }
  }

  // 5. Deletar recebimentos
  if (paymentsToDelete.length > 0) {
    console.log(`🗑️ Deletando ${paymentsToDelete.length} recebimentos...`);
    const { error: deleteError } = await supabase
      .from("payments")
      .delete()
      .in("id", paymentsToDelete);
    
    if (deleteError) throw deleteError;
  }

  // 6. Identificar recebimentos a criar
  const paymentsToCreate: Array<{
    refMonth: string;
    refYear: string;
    dueDate: string;
    amount: number;
    breakdown: any[];
    installmentNumber: number;
  }> = [];

  // 6b. Identificar recebimentos MANTIDOS (já existiam) cujo valor precisa
  // ser recalculado porque a mudança de data alterou se a parcela é
  // proporcional (e quantos dias) — ex.: corrigir a data de início depois
  // que a parcela do mês já tinha sido criada com o mês cheio.
  // ⚠️ Nunca mexe em pagamentos 'paid' ou 'partial' (histórico, imutável) —
  // só em 'pending'/'overdue', mesma regra usada no restante deste arquivo.
  const paymentsToUpdate: Array<{
    id: string;
    amount: number;
    breakdown: any[];
  }> = [];

  // Calcular qual será o próximo installment number
  const existingNumbers = (existingPayments || [])
    .filter(p => !paymentsToDelete.includes(p.id))
    .map(p => p.installment)
    .sort((a, b) => a - b);
  
  let nextInstallmentNumber = existingNumbers.length > 0 
    ? Math.max(...existingNumbers) + 1 
    : 1;

  for (const expected of expectedPayments) {
    const refKey = `${expected.refYear}-${expected.refMonth}`;
    
    // Se já existe (e não foi deletado), conferir se o valor ainda bate com
    // o que é esperado agora (pode ter virado proporcional, ou deixado de
    // ser, por causa da mudança de data) — só recalcula se ainda estiver
    // pending/overdue; 'paid'/'partial' nunca são tocados.
    if (paymentsToKeep.has(refKey)) {
      const kept = paymentsToKeep.get(refKey);
      if (kept.status === "pending" || kept.status === "overdue") {
        let correctAmount: number;
        let correctBreakdown: any[];

        if (expected.isProportional && expected.days) {
          const proportionalRent = calculateProportionalAmount(monthlyRent, expected.days);
          const proportionalGarage = hasGarage ? calculateProportionalAmount(garageValue, expected.days) : 0;
          correctAmount = parseFloat((proportionalRent + proportionalGarage).toFixed(2));
          correctBreakdown = [
            { description: `Aluguel (${expected.days} dias)`, amount: proportionalRent, type: "addition" }
          ];
          if (hasGarage && proportionalGarage > 0) {
            correctBreakdown.push({
              description: `Garagem (${expected.days} dias)`,
              amount: proportionalGarage,
              type: "addition"
            });
          }
        } else {
          correctAmount = parseFloat(totalRent.toFixed(2));
          correctBreakdown = [
            { description: "Aluguel", amount: monthlyRent, type: "addition" }
          ];
          if (hasGarage && garageValue > 0) {
            correctBreakdown.push({ description: "Garagem", amount: garageValue, type: "addition" });
          }
        }

        if (Math.abs(correctAmount - Number(kept.expected_amount)) > 0.01) {
          console.log(`🔄 Recalculando parcela mantida ${refKey} (parcela ${kept.installment}): R$ ${Number(kept.expected_amount).toFixed(2)} → R$ ${correctAmount.toFixed(2)}`);
          paymentsToUpdate.push({ id: kept.id, amount: correctAmount, breakdown: correctBreakdown });
        }
      }
      continue;
    }

    // Calcular valor e breakdown
    let amount: number;
    let breakdown: any[];

    if (expected.isProportional && expected.days) {
      const proportionalRent = calculateProportionalAmount(monthlyRent, expected.days);
      const proportionalGarage = hasGarage ? calculateProportionalAmount(garageValue, expected.days) : 0;
      amount = proportionalRent + proportionalGarage;
      
      breakdown = [
        { description: `Aluguel (${expected.days} dias)`, amount: proportionalRent, type: "addition" }
      ];
      if (hasGarage && proportionalGarage > 0) {
        breakdown.push({ 
          description: `Garagem (${expected.days} dias)`, 
          amount: proportionalGarage, 
          type: "addition" 
        });
      }
    } else {
      amount = totalRent;
      breakdown = [
        { description: "Aluguel", amount: monthlyRent, type: "addition" }
      ];
      if (hasGarage && garageValue > 0) {
        breakdown.push({ 
          description: "Garagem", 
          amount: garageValue, 
          type: "addition" 
        });
      }
    }

    paymentsToCreate.push({
      refMonth: expected.refMonth,
      refYear: expected.refYear,
      dueDate: expected.dueDate,
      amount: parseFloat(amount.toFixed(2)),
      breakdown,
      installmentNumber: nextInstallmentNumber++,
    });

    console.log(`➕ Criar: ${refKey} (parcela ${nextInstallmentNumber - 1})`);
  }

  // 7. Criar recebimentos
  if (paymentsToCreate.length > 0) {
    const insertData = paymentsToCreate.map(p => ({
      rental_id: rentalId,
      reference_month: p.refMonth,
      reference_year: p.refYear,
      due_date: p.dueDate,
      expected_amount: p.amount,
      status: "pending",
      breakdown: p.breakdown,
      installment: p.installmentNumber,
      total_installments: existingNumbers.length + paymentsToCreate.length,
    }));

    const { error: insertError } = await supabase
      .from("payments")
      .insert(insertData);
    
    if (insertError) throw insertError;
    console.log(`✅ ${paymentsToCreate.length} recebimentos criados`);
  }

  // 7b. Atualizar recebimentos mantidos cujo valor mudou (ver passo 6b)
  if (paymentsToUpdate.length > 0) {
    console.log(`🔄 Atualizando ${paymentsToUpdate.length} recebimento(s) mantido(s) com valor desatualizado...`);
    for (const p of paymentsToUpdate) {
      const { error: updateKeptError } = await supabase
        .from("payments")
        .update({ expected_amount: p.amount, breakdown: p.breakdown })
        .eq("id", p.id);

      if (updateKeptError) throw updateKeptError;
    }
    console.log(`✅ ${paymentsToUpdate.length} recebimento(s) mantido(s) atualizado(s)`);
  }

  // 8. AJUSTAR RECEBIMENTO QUE ERA PROPORCIONAL MAS AGORA NÃO É MAIS
  if (endDateChanged && newEndDate && oldEndDate && newEndDate > oldEndDate) {
    console.log("🔍 Verificando recebimento proporcional que precisa ser ajustado...");
    
    // Calcular qual mês/ano era o ÚLTIMO recebimento ANTES da mudança
    const oldEnd = new Date(oldEndDate + "T00:00:00");
    const oldLastMonth = oldEnd.getMonth() + 1;
    const oldLastYear = oldEnd.getFullYear();
    const oldLastRefMonth = String(oldLastMonth).padStart(2, '0');
    const oldLastRefYear = String(oldLastYear);
    
    console.log(`🔍 Buscando recebimento do mês ${oldLastRefYear}-${oldLastRefMonth} (que era o último antes da mudança)`);
    
    // Buscar o recebimento daquele mês/ano específico
    const { data: oldLastPayments, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .eq("rental_id", rentalId)
      .eq("reference_month", oldLastRefMonth)
      .eq("reference_year", oldLastRefYear)
      .eq("status", "pending");
    
    if (fetchError) throw fetchError;
    
    if (oldLastPayments && oldLastPayments.length > 0) {
      const oldLastPayment = oldLastPayments[0];
      
      // Verificar se está proporcional (valor menor que o total)
      if (oldLastPayment.expected_amount < totalRent) {
        console.log(`🔄 Ajustando parcela ${oldLastPayment.installment} (${oldLastRefYear}-${oldLastRefMonth}) de proporcional (R$ ${oldLastPayment.expected_amount.toFixed(2)}) para valor cheio (R$ ${totalRent.toFixed(2)})`);
        
        const breakdown = [
          { description: "Aluguel", amount: monthlyRent, type: "addition" }
        ];
        if (hasGarage && garageValue > 0) {
          breakdown.push({ 
            description: "Garagem", 
            amount: garageValue, 
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
      } else {
        console.log(`ℹ️ Parcela ${oldLastPayment.installment} já estava com valor cheio (R$ ${oldLastPayment.expected_amount.toFixed(2)})`);
      }
    } else {
      console.log(`⚠️ Nenhum recebimento encontrado para ${oldLastRefYear}-${oldLastRefMonth}`);
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

  console.log("✅ [syncPaymentsOnDateChange] Sincronização concluída!");
}

/**
 * Ajusta o valor do aluguel de uma locação ativa e recalcula os recebimentos
 * ainda não pagos (pending ou overdue).
 *
 * ✅ CORREÇÃO (pedido do Cadu): antes só atualizava recebimentos com
 * due_date >= hoje ("futuros"), deixando de fora o mês já vencido mas ainda
 * não pago. Na prática, quando o corretor demora pra registrar o reajuste,
 * o mês atual já está atrasado e ficava sem o aumento. Agora atualiza
 * QUALQUER recebimento pending/overdue da locação, seja o vencimento no
 * passado ou no futuro — só não mexe em pagamentos 'paid' ou 'partial'
 * (esses são histórico e nunca são alterados).
 */
export async function adjustRentalValue(
  rentalId: string,
  oldValue: number,
  newValue: number,
  effectiveDate: string
): Promise<void> {
  console.log("💰 [adjustRentalValue] Ajustando valor do aluguel...");

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", rentalId)
    .single();

  if (rentalError || !rental) throw new Error("Locação não encontrada");

  const { data: unpaidPayments, error: paymentsError } = await supabase
    .from("payments")
    .select("*")
    .eq("rental_id", rentalId)
    .in("status", ["pending", "overdue"])
    .order("due_date", { ascending: true });

  if (paymentsError) throw paymentsError;
  if (!unpaidPayments || unpaidPayments.length === 0) {
    console.log("ℹ️ Nenhum pagamento pendente/atrasado para atualizar");
    return;
  }

  console.log(`📊 ${unpaidPayments.length} pagamentos pendentes/atrasados serão atualizados`);

  const garageAmount = (rental.has_garage && rental.garage_value) ? rental.garage_value : 0;
  const totalNewValue = newValue + garageAmount;

  for (const payment of unpaidPayments) {
    const breakdown = [
      { type: "addition", amount: parseFloat(newValue.toFixed(2)), description: "Aluguel" }
    ];
    if (garageAmount > 0) {
      breakdown.push({
        type: "addition",
        amount: parseFloat(garageAmount.toFixed(2)),
        description: "Garagem"
      });
    }

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        expected_amount: parseFloat(totalNewValue.toFixed(2)),
        breakdown
      })
      .eq("id", payment.id);

    if (updateError) throw updateError;
  }

  console.log(`✅ ${unpaidPayments.length} pagamentos atualizados`);
}

export const rentalUpdateService = {
  syncPaymentsOnDateChange,
  adjustRentalValue,

  async updatePaymentsOnRentalEdit(
    rentalId: string, 
    oldRental: Rental, 
    newChanges: RentalUpdateChanges
  ): Promise<void> {
    try {
      console.log("🚀 [rentalUpdateService] Analisando mudanças...");

      const startDateChanged = newChanges.startDate && newChanges.startDate !== oldRental.startDate;
      const endDateChanged = newChanges.endDate !== undefined && newChanges.endDate !== oldRental.endDate;
      
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

      const valueChanged = (newChanges.monthlyRent !== undefined && newChanges.monthlyRent !== oldRental.monthlyRent) ||
                          (newChanges.hasGarage !== undefined && newChanges.hasGarage !== oldRental.hasGarage) ||
                          (newChanges.garageValue !== undefined && newChanges.garageValue !== oldRental.garageValue);

      if (valueChanged && !startDateChanged && !endDateChanged) {
        const newRent = newChanges.monthlyRent ?? oldRental.monthlyRent;
        await adjustRentalValue(rentalId, oldRental.monthlyRent, newRent, new Date().toISOString().split('T')[0]);
      }

      console.log("✅ [rentalUpdateService] Concluído");
    } catch (error) {
      console.error("❌ [rentalUpdateService] ERRO:", error);
      throw error;
    }
  }
};