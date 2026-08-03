import { supabase } from "@/integrations/supabase/client";
import { format, setDate } from "date-fns";
import type { Payment, Rental, Property, Tenant } from "@/types";
import type { Tables } from "@/integrations/supabase/types";
import { logAudit } from "./auditService";

type PaymentResponse = Tables<"payments"> & {
  rental: (Tables<"rentals"> & {
    properties: Pick<Tables<"properties">, "id" | "property_identifier" | "location_id" | "complement"> | null;
    tenants: Pick<Tables<"tenants">, "id" | "name" | "cpf" | "email" | "phone"> | null;
  }) | null;
};

/**
 * Calcula a data válida de vencimento considerando o dia escolhido e o mês/ano
 * 
 * Regra: Se o mês não possui o dia escolhido (ex: dia 31 em fevereiro),
 * retrocede 1 dia por vez até encontrar uma data válida
 * 
 * Exemplos:
 * - Dia 31 em fevereiro -> dia 28 (ou 29 em ano bissexto)
 * - Dia 31 em abril -> dia 30
 * - Dia 15 em qualquer mês -> dia 15
 * 
 * @param chosenDay - Dia escolhido na locação (1-31)
 * @param year - Ano do vencimento
 * @param month - Mês do vencimento (1-12)
 * @returns String no formato YYYY-MM-DD
 */
function getValidDueDate(chosenDay: number, year: number, month: number): string {
  // Descobrir o número máximo de dias no mês
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  
  // Se o dia escolhido existe no mês, usar ele
  if (chosenDay <= lastDayOfMonth) {
    const validDate = new Date(year, month - 1, chosenDay);
    return format(validDate, "yyyy-MM-dd");
  }
  
  // Se não existe, voltar 1 dia por vez até encontrar válido
  let validDay = chosenDay;
  while (validDay > lastDayOfMonth) {
    validDay--;
  }
  
  const validDate = new Date(year, month - 1, validDay);
  return format(validDate, "yyyy-MM-dd");
}

export const getAll = async (): Promise<Payment[]> => {
  const { data, error } = await supabase
    .from("payments")
    .select(
      `
      id,
      rental_id,
      expected_amount,
      paid_amount,
      due_date,
      payment_date,
      status,
      reference_month,
      reference_year,
      discount_amount,
      late_fee,
      interest,
      notes,
      payment_method,
      breakdown,
      installment,
      total_installments,
      rental:rentals(
        id,
        rent_value,
        has_garage,
        rent_due_day,
        start_date,
        end_date,
        properties(id, property_identifier, location_id, complement),
        tenants(id, name, cpf, email, phone)
      )
    `
    )
    .order("reference_year", { ascending: false })
    .order("reference_month", { ascending: false })
    .limit(500);

  if (error) throw error;

  return (data || []).map((payment: any) => ({
    ...payment,
    dueDate: payment.due_date,
    expectedAmount: payment.expected_amount,
    paidAmount: payment.paid_amount,
    paymentDate: payment.payment_date,
    referenceMonth: Number(payment.reference_month),
    referenceYear: Number(payment.reference_year),
    discount: payment.discount_amount,
    lateFee: payment.late_fee,
    rentalId: payment.rental_id,
    paymentMethod: payment.payment_method,
    totalInstallments: payment.total_installments,
    rental: payment.rental as unknown as Rental,
    property: payment.rental?.properties as unknown as Property,
    tenant: payment.rental?.tenants as unknown as Tenant,
    propertyId: payment.rental?.properties?.id || "",
    tenantId: payment.rental?.tenants?.id || "",
    receiptUrl: undefined,
  }));
};

export const getById = async (id: string): Promise<Payment> => {
  const { data, error } = await supabase
    .from("payments")
    .select(
      `
      *,
      rental:rentals(
        *,
        properties(id, property_identifier, location_id, complement, value, has_garage),
        tenants(id, name, cpf, email, phone)
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    rentalId: data.rental_id,
    expectedAmount: data.expected_amount,
    paidAmount: Number(data.paid_amount || 0),
    status: data.status as "pending" | "paid" | "overdue" | "partial",
    paymentDate: data.payment_date,
    paymentMethod: data.payment_method,
    lateFee: data.late_fee,
    interest: data.interest || 0,
    notes: data.notes,
    breakdown: data.breakdown,
    installment: data.installment,
    totalInstallments: data.total_installments,
    rental: data.rental as unknown as Rental,
    property: data.rental?.properties as unknown as Property,
    tenant: data.rental?.tenants as unknown as Tenant,
    propertyId: data.rental?.properties?.id || "",
    tenantId: data.rental?.tenants?.id || "",
    attachments: (data.attachments as unknown as string[]) || [],
  } as Payment;  // ← adicionado manualmente
};

export const create = async (payment: Partial<Payment>): Promise<Payment> => {
  const insertData = {
    rental_id: payment.rentalId,
    expected_amount: payment.expectedAmount,
    paid_amount: payment.paidAmount || 0,
    due_date: payment.dueDate,
    payment_date: payment.paymentDate,
    status: payment.status || "pending",
    reference_month: String(payment.referenceMonth),
    reference_year: String(payment.referenceYear),
    late_fee: payment.lateFee || 0,
    interest: payment.interest || 0,
    notes: payment.notes,
    payment_method: payment.paymentMethod,
    breakdown: payment.breakdown,
    installment: payment.installment,
    total_installments: payment.totalInstallments,
  };

  const { data, error } = await supabase
    .from("payments")
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  
  // Return Payment object with explicit type assertion
  return {
    id: data.id,
    rentalId: data.rental_id,
    propertyId: "",
    tenantId: "",
    referenceMonth: Number(data.reference_month) || 1,
    referenceYear: Number(data.reference_year) || new Date().getFullYear(),
    dueDate: data.due_date || new Date().toISOString().split('T')[0],
    expectedAmount: data.expected_amount,
    paidAmount: data.paid_amount,
    status: data.status as "paid" | "pending" | "overdue" | "partial",
    paymentDate: data.payment_date,
    paymentMethod: data.payment_method,
    notes: data.notes,
    lateFee: data.late_fee || 0,
    interest: data.interest || 0,
    breakdown: data.breakdown,
    installment: data.installment || 1,
    totalInstallments: data.total_installments || 24,
    attachments: (data.attachments as unknown as string[]) || [],
  } as Payment;
};

export const update = async (
  id: string,
  updatePaymentData: Partial<Payment>
): Promise<Payment> => {
  // ✅ Buscar dados ANTES de atualizar
  const { data: oldData } = await supabase
    .from("payments")
    .select(`
      *,
      rental:rentals(
        id,
        properties(
          complement,
          locations!properties_location_id_fkey(name)
        ),
        tenants(name)
      )
    `)
    .eq("id", id)
    .single();

  const updateData: any = {
    expected_amount: updatePaymentData.expectedAmount,
    paid_amount: updatePaymentData.paidAmount,
    due_date: updatePaymentData.dueDate,
    payment_date: updatePaymentData.paymentDate,
    status: updatePaymentData.status,
    reference_month: updatePaymentData.referenceMonth ? String(updatePaymentData.referenceMonth) : undefined,
    reference_year: updatePaymentData.referenceYear ? String(updatePaymentData.referenceYear) : undefined,
    late_fee: updatePaymentData.lateFee,
    interest: updatePaymentData.interest,
    notes: updatePaymentData.notes,
    payment_method: updatePaymentData.paymentMethod,
    breakdown: updatePaymentData.breakdown,
    installment: updatePaymentData.installment,
    total_installments: updatePaymentData.totalInstallments,
  };

  Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

  const { data, error } = await supabase
    .from("payments")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // ✅ NOVO FORMATO: Local + Complemento + Inquilino + Parcela + mudanças
  if (oldData) {
    const locationName = (oldData.rental as any)?.properties?.locations?.name || "Local não informado";
    const complement = (oldData.rental as any)?.properties?.complement || "Sem complemento";
    const tenantName = (oldData.rental as any)?.tenants?.name || "Inquilino não informado";
    const installmentInfo = `${data.installment || '?'}/${data.total_installments || '?'}`;

    const changes: string[] = [];
    if (oldData.status !== data.status) {
      changes.push(`status: de=${oldData.status} -> para=${data.status}`);
    }
    if (oldData.paid_amount !== data.paid_amount) {
      changes.push(`paid_amount: de=${oldData.paid_amount} -> para=${data.paid_amount}`);
    }
    if (oldData.payment_date !== data.payment_date) {
      changes.push(`payment_date: de=${oldData.payment_date || 'null'} -> para=${data.payment_date || 'null'}`);
    }

    const changesSummary = changes.length > 0
      ? `Local: ${locationName} - Complemento: ${complement} - Inquilino: ${tenantName} - Parcela: ${installmentInfo}\n${changes.join('\n')}`
      : `Local: ${locationName} - Complemento: ${complement} - Inquilino: ${tenantName} - Parcela: ${installmentInfo}`;

    // Se foi um recebimento (mudou status para paid), usar action_type "payment"
    const actionType = (oldData.status !== "paid" && data.status === "paid") ? "payment" : "update";

    await logAudit({
      action_type: actionType,
      entity_type: "payment",
      entity_id: id,
      changes_summary: changesSummary,
      old_values: {
        status: oldData.status,
        paid_amount: oldData.paid_amount,
      },
      new_values: {
        status: data.status,
        paid_amount: data.paid_amount,
      },
    });
  }
  
  const updatedPayment: Payment = { 
    id: data.id,
    rentalId: data.rental_id,
    expectedAmount: data.expected_amount,
    paidAmount: data.paid_amount,
    dueDate: data.due_date,
    paymentDate: data.payment_date,
    status: data.status as "paid" | "pending" | "overdue" | "partial",
    referenceMonth: Number(data.reference_month),
    referenceYear: Number(data.reference_year),
    lateFee: data.late_fee,
    interest: data.interest || 0,
    notes: data.notes,
    paymentMethod: data.payment_method,
    breakdown: data.breakdown,
    installment: data.installment,
    totalInstallments: data.total_installments,
    propertyId: "",
    tenantId: "",
    attachments: (data.attachments as unknown as string[]) || [],
  };
  
  return updatedPayment;
};

export const remove = async (id: string): Promise<void> => {
  // ✅ Buscar dados ANTES de deletar
  const { data: paymentData } = await supabase
    .from("payments")
    .select(`
      *,
      rental:rentals(
        id,
        properties(
          complement,
          locations!properties_location_id_fkey(name)
        ),
        tenants(name)
      )
    `)
    .eq("id", id)
    .single();

  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;

  // ✅ NOVO FORMATO: Local + Complemento + Inquilino + Parcela
  if (paymentData) {
    const locationName = (paymentData.rental as any)?.properties?.locations?.name || "Local não informado";
    const complement = (paymentData.rental as any)?.properties?.complement || "Sem complemento";
    const tenantName = (paymentData.rental as any)?.tenants?.name || "Inquilino não informado";
    const installmentInfo = `${paymentData.installment || '?'}/${paymentData.total_installments || '?'}`;

    await logAudit({
      action_type: "delete",
      entity_type: "payment",
      entity_id: id,
      changes_summary: `Local: ${locationName} - Complemento: ${complement} - Inquilino: ${tenantName} - Parcela: ${installmentInfo}`,
      old_values: {
        status: paymentData.status,
        expected_amount: paymentData.expected_amount,
      },
    });
  }
};

/**
 * ✅ PROTEÇÃO CRÍTICA: Detecta recebimentos de rescisão que podem estar em risco
 * 
 * Esta função verifica se existem recebimentos de outras locações que podem ser
 * confundidos ou apagados acidentalmente ao criar uma nova locação para o mesmo imóvel.
 * 
 * Casos protegidos:
 * 1. Rescisão do inquilino anterior + Primeira parcela do novo inquilino no mesmo mês
 * 2. Múltiplas locações do mesmo imóvel com períodos sobrepostos
 * 
 * @param propertyId - ID do imóvel
 * @param month - Mês de referência (01-12)
 * @param year - Ano de referência
 * @returns Lista de recebimentos que podem estar em conflito
 */
export async function detectTerminationPaymentConflicts(
  propertyId: string,
  month: string,
  year: string
): Promise<{
  hasConflict: boolean;
  terminationPayments: Array<{
    id: string;
    rentalId: string;
    status: string;
    amount: number;
    notes?: string;
  }>;
  message?: string;
}> {
  try {
    // Buscar todos os recebimentos deste imóvel neste mês
    const { data: payments, error } = await supabase
      .from("payments")
      .select(`
        id,
        rental_id,
        status,
        expected_amount,
        notes,
        breakdown,
        installment,
        total_installments,
        rental:rentals!inner(
          property_id,
          properties!inner(
            id
          )
        )
      `)
      .eq("reference_month", month)
      .eq("reference_year", year);

    if (error) throw error;

    // Filtrar apenas pagamentos deste imóvel
    const propertyPayments = (payments || []).filter(
      (p: any) => p.rental?.properties?.id === propertyId
    );

    if (propertyPayments.length <= 1) {
      return { hasConflict: false, terminationPayments: [] };
    }

    // Detectar recebimentos de rescisão
    const terminationPayments = propertyPayments.filter((p: any) => {
      const isLastInstallment = p.installment === p.total_installments;
      const hasTerminationNote = p.notes?.toLowerCase().includes("rescisão") || 
                                 p.notes?.toLowerCase().includes("rescis");
      const hasTerminationBreakdown = Array.isArray(p.breakdown) && p.breakdown.some((b: any) => 
        b.description?.toLowerCase().includes("rescisão") ||
        b.description?.toLowerCase().includes("multa rescisória") ||
        b.description?.toLowerCase().includes("multa rescis")
      );

      return isLastInstallment || hasTerminationNote || hasTerminationBreakdown;
    });

    if (terminationPayments.length > 0) {
      return {
        hasConflict: true,
        terminationPayments: terminationPayments.map((p: any) => ({
          id: p.id,
          rentalId: p.rental_id,
          status: p.status,
          amount: p.expected_amount,
          notes: p.notes
        })),
        message: `⚠️ ATENÇÃO: Existem ${terminationPayments.length} recebimento(s) de rescisão neste mês. NUNCA delete estes recebimentos!`
      };
    }

    return { hasConflict: false, terminationPayments: [] };
  } catch (error) {
    console.error("❌ Erro ao detectar conflitos de rescisão:", error);
    return { hasConflict: false, terminationPayments: [] };
  }
}

export const deletePaymentsByRentalId = async (rentalId: string): Promise<void> => {
  const { error } = await supabase.from("payments").delete().eq("rental_id", rentalId);
  if (error) throw error;
};

/**
 * Deleta recebimentos de uma locação de forma seletiva
 * @param rentalId - ID da locação
 * @param deletePending - Se true, deleta recebimentos pendentes
 * @param deletePaid - Se true, deleta recebimentos pagos/parciais
 */
export const deletePaymentsByRentalIdSelective = async (
  rentalId: string,
  deletePending: boolean,
  deletePaid: boolean
): Promise<void> => {
  if (!deletePending && !deletePaid) {
    // Não deletar nada
    return;
  }

  if (deletePending && deletePaid) {
    // Deletar tudo
    const { error } = await supabase.from("payments").delete().eq("rental_id", rentalId);
    if (error) throw error;
    return;
  }

  // Deletar seletivamente
  const statusToDelete: string[] = [];
  
  if (deletePending) {
    statusToDelete.push("pending", "overdue");
  }
  
  if (deletePaid) {
    statusToDelete.push("paid", "partial");
  }

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("rental_id", rentalId)
    .in("status", statusToDelete);
  
  if (error) throw error;
};

/**
 * NOVA LÓGICA DE GERAÇÃO DE RECEBIMENTOS
 * 
 * Regras:
 * 1. Primeiro recebimento (sempre parcela 1/XX):
 *    - Se dia_inicio <= dia_vencimento: criar no mesmo mês, proporcional
 *    - Se dia_inicio > dia_vencimento: criar no mês seguinte, proporcional (~30 dias)
 * 
 * 2. Recebimentos intermediários: valor integral, 1 por mês
 * 
 * 3. Último recebimento: proporcional aos dias do último mês
 * 
 * 4. Não pular meses, não duplicar meses
 * 
 * 5. CRÍTICO: Aplicar regra de ajuste de datas para meses sem o dia escolhido
 */
export function generateExpectedPayments(params: {
  rentalId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  monthlyRent: number;
  paymentDay: number;
  hasGarage?: boolean;
  garageValue?: number;
}) {
  const { rentalId, startDate, endDate, monthlyRent, paymentDay, hasGarage, garageValue } = params;
  
  console.log("🔄 [generateExpectedPayments] Iniciando geração de recebimentos:", {
    rentalId,
    startDate,
    endDate,
    monthlyRent,
    paymentDay,
    hasGarage,
    garageValue
  });
  
  // ✅ CRÍTICO: monthlyRent deve ser APENAS o valor do aluguel (sem garagem)
  // A garagem é adicionada separadamente no breakdown
  const rentValue = monthlyRent;
  const garage = hasGarage && garageValue ? garageValue : 0;
  const totalMonthlyValue = rentValue + garage;

  const paymentsToCreate: any[] = [];
  
  // Parse das datas
  const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
  const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
  
  console.log("📅 Datas parseadas:", { sYear, sMonth, sDay, eYear, eMonth, eDay });

  // **ETAPA 1: Determinar o primeiro mês de cobrança**
  let firstPaymentMonth: number;
  let firstPaymentYear: number;
  let daysToChargeFirstPayment: number;
  
  // REGRA: Se dia de início === dia de vencimento, primeira parcela no mês seguinte (integral)
  if (sDay === paymentDay) {
    console.log("🎯 REGRA ESPECIAL: Dia início === Dia vencimento → Primeira parcela no MÊS SEGUINTE (integral)");
    
    firstPaymentMonth = sMonth === 12 ? 1 : sMonth + 1;
    firstPaymentYear = sMonth === 12 ? sYear + 1 : sYear;
    daysToChargeFirstPayment = 30;
    
    console.log("✅ Primeira parcela no PRÓXIMO mês (INTEGRAL):", { 
      firstPaymentMonth, 
      firstPaymentYear, 
      daysToChargeFirstPayment: 30,
      reason: "Dia início = Dia vencimento"
    });
  } else if (sDay < paymentDay) {
    // Primeiro recebimento no mesmo mês (proporcional)
    firstPaymentMonth = sMonth;
    firstPaymentYear = sYear;
    // Contar dias do início até o vencimento (NÃO-INCLUSIVO do dia vencimento)
    // Exemplo: dia 1 até dia 5 = dias 1,2,3,4 = 4 dias
    daysToChargeFirstPayment = paymentDay - sDay;
    console.log("✅ Primeiro recebimento no MESMO mês (PROPORCIONAL):", { 
      firstPaymentMonth, 
      firstPaymentYear, 
      daysToChargeFirstPayment,
      calculation: `${paymentDay} - ${sDay} = ${daysToChargeFirstPayment} dias`
    });
  } else {
    // Primeiro recebimento no mês seguinte (proporcional)
    firstPaymentMonth = sMonth === 12 ? 1 : sMonth + 1;
    firstPaymentYear = sMonth === 12 ? sYear + 1 : sYear;
    
    // ✅ CORREÇÃO CRÍTICA: Cálculo proporcional correto
    // Exemplo: início dia 10/07, vencimento dia 5
    // - Dias de 10/07 até 31/07 (incluindo dia 10) = 22 dias
    // - Dias de 01/08 até 04/08 (NÃO-inclusivo do dia 5) = 4 dias
    // - Total = 26 dias
    const daysInStartMonth = new Date(sYear, sMonth, 0).getDate();
    const daysUntilEndOfStartMonth = (daysInStartMonth - sDay) + 1; // +1 para incluir o dia de início
    const daysInNextMonthUntilDue = paymentDay - 1; // -1 porque o dia de vencimento não é inclusivo
    daysToChargeFirstPayment = daysUntilEndOfStartMonth + daysInNextMonthUntilDue;
    
    console.log("✅ Primeiro recebimento no PRÓXIMO mês (PROPORCIONAL):", { 
      firstPaymentMonth, 
      firstPaymentYear, 
      daysToChargeFirstPayment,
      daysInCurrentMonth: daysUntilEndOfStartMonth,
      daysInNextMonth: daysInNextMonthUntilDue,
      calculation: `${daysUntilEndOfStartMonth} (mês atual) + ${daysInNextMonthUntilDue} (próximo mês até venc-1) = ${daysToChargeFirstPayment}`,
      example: `Exemplo: 10/07 até 31/07 (${daysUntilEndOfStartMonth} dias) + 01/08 até 04/08 (${daysInNextMonthUntilDue} dias) = ${daysToChargeFirstPayment} dias total`
    });
  }

  // **ETAPA 2: Criar o primeiro recebimento (sempre parcela 1/XX)**
  // ✅ CORREÇÃO CRÍTICA: Calcular due_date PRIMEIRO, depois extrair reference dela
  const firstPaymentDueDate = getValidDueDate(paymentDay, firstPaymentYear, firstPaymentMonth);
  
  // ✅ CORREÇÃO CRÍTICA: Extrair reference_month/year DA DUE_DATE final
  // Isso garante 100% de sincronia entre filtro e vencimento
  const dueDateObj = new Date(firstPaymentDueDate);
  const referenceMonth = dueDateObj.getMonth() + 1; // getMonth() retorna 0-11
  const referenceYear = dueDateObj.getFullYear();
  
  console.log("✅ Reference extraído da due_date:", {
    due_date: firstPaymentDueDate,
    reference_month: referenceMonth,
    reference_year: referenceYear,
    explanation: "Agora reference é SEMPRE igual ao mês/ano da due_date"
  });
  
  // ✅ CORREÇÃO CRÍTICA: Garantir que aluguel e garagem usem os MESMOS dias
  const proportionalRent = (rentValue / 30) * daysToChargeFirstPayment;
  const proportionalGarage = garage > 0 ? (garage / 30) * daysToChargeFirstPayment : 0;
  const firstPaymentAmount = proportionalRent + proportionalGarage;

  const firstPaymentBreakdown: Array<{ description: string; amount: number; type: string }> = [
    {
      description: `Aluguel - Parcela 1 (${daysToChargeFirstPayment} dias)`,
      amount: parseFloat(proportionalRent.toFixed(2)),
      type: "addition",
    }
  ];

  if (garage > 0) {
    firstPaymentBreakdown.push({
      description: `Garagem (${daysToChargeFirstPayment} dias)`,
      amount: parseFloat(proportionalGarage.toFixed(2)),
      type: "addition",
    });
  }

  paymentsToCreate.push({
    rental_id: rentalId,
    reference_month: String(referenceMonth).padStart(2, '0'), // ✅ CORRETO: extraído da due_date
    reference_year: String(referenceYear), // ✅ CORRETO: extraído da due_date
    due_date: firstPaymentDueDate,
    expected_amount: parseFloat(firstPaymentAmount.toFixed(2)),
    status: "pending",
    breakdown: firstPaymentBreakdown,
    installment: 1,
  });

  console.log("📝 Primeiro recebimento criado:", paymentsToCreate[0]);

  // **ETAPA 3: Criar recebimentos intermediários (valor integral)**
  // ✅ CORRIGIDO: Avançar a partir do PRÓXIMO mês após o reference do primeiro recebimento
  let currentMonth = firstPaymentMonth + 1;
  let currentYear = firstPaymentYear;
  
  if (currentMonth > 12) {
    currentMonth = 1;
    currentYear++;
  }

  let installmentNumber = 2; // Começa da parcela 2

  // ✅ CRÍTICO: Loop até o penúltimo mês (o último será tratado separadamente)
  // NUNCA incluir o mês final no loop para evitar duplicatas
  while (
    currentYear < eYear || 
    (currentYear === eYear && currentMonth < eMonth)
  ) {
    // ✅ CORREÇÃO CRÍTICA: Usar getValidDueDate para calcular a data correta
    const dueDate = getValidDueDate(paymentDay, currentYear, currentMonth);
    
    const breakdown: Array<{ description: string; amount: number; type: string }> = [
      {
        description: "Aluguel",
        amount: parseFloat(rentValue.toFixed(2)),
        type: "addition",
      }
    ];

    if (garage > 0) {
      breakdown.push({
        description: "Garagem",
        amount: parseFloat(garage.toFixed(2)),
        type: "addition",
      });
    }

    paymentsToCreate.push({
      rental_id: rentalId,
      reference_month: String(currentMonth).padStart(2, '0'), // ✅ OK: currentMonth é o período de cobrança
      reference_year: String(currentYear), // ✅ OK: currentYear é o ano de cobrança
      due_date: dueDate,
      expected_amount: parseFloat(totalMonthlyValue.toFixed(2)),
      status: "pending",
      breakdown: breakdown,
      installment: installmentNumber,
    });

    console.log(`📝 Recebimento intermediário criado - Parcela ${installmentNumber}:`, {
      month: currentMonth,
      year: currentYear,
      amount: totalMonthlyValue,
      dueDate
    });

    installmentNumber++;
    currentMonth++;
    
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  // **ETAPA 4: Criar o último recebimento (proporcional)**
  // ✅ CORREÇÃO: Só criar se ainda não foi criado pelo loop acima
  // O último mês SEMPRE deve ser proporcional, nunca integral
  if (currentYear === eYear && currentMonth === eMonth) {
    // Contagem de dias até o final (NÃO-INCLUSIVO)
    const daysToChargeLastPayment = eDay;
    
    // ✅ CORREÇÃO CRÍTICA: Garantir que aluguel e garagem usem os MESMOS dias no último recebimento
    const lastProportionalRent = (rentValue / 30) * daysToChargeLastPayment;
    const lastProportionalGarage = garage > 0 ? (garage / 30) * daysToChargeLastPayment : 0;
    const lastPaymentAmount = lastProportionalRent + lastProportionalGarage;

    // ✅ CORREÇÃO CRÍTICA: Usar getValidDueDate para calcular a data correta
    const lastDueDate = getValidDueDate(paymentDay, eYear, eMonth);

    const lastPaymentBreakdown: Array<{ description: string; amount: number; type: string }> = [
      {
        description: `Aluguel - Última Parcela (${daysToChargeLastPayment} dias)`,
        amount: parseFloat(lastProportionalRent.toFixed(2)),
        type: "addition",
      }
    ];

    if (garage > 0) {
      lastPaymentBreakdown.push({
        description: `Garagem (${daysToChargeLastPayment} dias)`,
        amount: parseFloat(lastProportionalGarage.toFixed(2)),
        type: "addition",
      });
    }

    paymentsToCreate.push({
      rental_id: rentalId,
      reference_month: String(eMonth).padStart(2, '0'), // ✅ SEMPRE com padding
      reference_year: String(eYear),
      due_date: lastDueDate,
      expected_amount: parseFloat(lastPaymentAmount.toFixed(2)),
      status: "pending",
      breakdown: lastPaymentBreakdown,
      installment: installmentNumber,
    });

    console.log(`📝 Último recebimento criado - Parcela ${installmentNumber}:`, {
      month: eMonth,
      year: eYear,
      days: daysToChargeLastPayment,
      amount: lastPaymentAmount,
      dueDate: lastDueDate
    });
  }

  // **ETAPA 5: Adicionar total_installments a todos os recebimentos**
  const totalInstallments = paymentsToCreate.length;
  
  paymentsToCreate.forEach(payment => {
    payment.total_installments = totalInstallments;
  });

  console.log("✅ [generateExpectedPayments] Recebimentos gerados:", {
    total: totalInstallments,
    payments: paymentsToCreate.map(p => ({
      month: p.reference_month,
      year: p.reference_year,
      installment: p.installment,
      amount: p.expected_amount,
      dueDate: p.due_date
    }))
  });

  return paymentsToCreate;
}

export async function createPaymentsForRental(params: {
  rental: Rental;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  paymentDay: number;
  hasGarage?: boolean;
  garageValue?: number;
}): Promise<void> {
  const { rental, startDate, endDate, monthlyRent, paymentDay, hasGarage, garageValue } = params;

  console.log("🔄 [createPaymentsForRental] Iniciando criação de recebimentos...");
  console.log("📋 [createPaymentsForRental] Parâmetros recebidos:", {
    rentalId: rental.id,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    monthlyRent,
    paymentDay,
    hasGarage,
    garageValue
  });

  const expectedPayments = generateExpectedPayments({
    rentalId: rental.id,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    monthlyRent,
    paymentDay,
    hasGarage,
    garageValue
  });

  console.log(`📊 [createPaymentsForRental] ${expectedPayments.length} recebimentos esperados`);

  // ✅ CRÍTICO: Verificar recebimentos existentes APENAS para este rental_id
  // NUNCA deletar ou modificar recebimentos de outras locações!
  const { data: existingPayments, error: selectError } = await supabase
    .from("payments")
    .select("id, reference_month, reference_year")
    .eq("rental_id", rental.id);

  if (selectError) {
    console.error("❌ [createPaymentsForRental] Erro ao verificar recebimentos existentes:", selectError);
    throw selectError;
  }

  console.log(`📊 [createPaymentsForRental] ${existingPayments?.length || 0} recebimentos já existem PARA ESTA LOCAÇÃO`);

  // ✅ PROTEÇÃO CRÍTICA: Verificar se há recebimentos de OUTRAS locações no mesmo mês
  // Isso pode acontecer quando há rescisão + nova locação no mesmo mês
  const firstExpectedMonth = expectedPayments[0]?.reference_month;
  const firstExpectedYear = expectedPayments[0]?.reference_year;
  
  if (firstExpectedMonth && firstExpectedYear) {
    const { data: otherRentalsPayments } = await supabase
      .from("payments")
      .select(`
        id, 
        rental_id, 
        reference_month, 
        reference_year, 
        status,
        notes,
        breakdown
      `)
      .eq("reference_month", firstExpectedMonth)
      .eq("reference_year", firstExpectedYear)
      .neq("rental_id", rental.id);

    if (otherRentalsPayments && otherRentalsPayments.length > 0) {
      console.warn("⚠️ [createPaymentsForRental] ATENÇÃO: Existem recebimentos de OUTRAS locações no mês " + 
        `${firstExpectedMonth}/${firstExpectedYear}. Isso pode ser um recebimento de rescisão.`);
      console.warn("⚠️ Recebimentos encontrados:", otherRentalsPayments.map(p => ({
        id: p.id,
        rental_id: p.rental_id,
        status: p.status,
        notes: p.notes,
        is_termination: p.notes?.toLowerCase().includes("rescisão") || 
                        (Array.isArray(p.breakdown) && p.breakdown.some((b: any) => 
                          b.description?.toLowerCase().includes("rescisão") || 
                          b.description?.toLowerCase().includes("multa")))
      })));
      console.warn("⚠️ [createPaymentsForRental] NUNCA deletar estes recebimentos! Eles pertencem a outra locação.");
    }
  }

  const existingRefs = new Set(
    (existingPayments || []).map((p) => `${p.reference_year}-${p.reference_month}`)
  );

  const paymentsToCreate = expectedPayments.filter(
    p => !existingRefs.has(`${p.reference_year}-${p.reference_month}`)
  );

  console.log(`➕ [createPaymentsForRental] ${paymentsToCreate.length} recebimentos serão criados`);

  if (paymentsToCreate.length > 0) {
    console.log("💾 [createPaymentsForRental] Inserindo recebimentos no banco...");
    console.log("📋 [createPaymentsForRental] Dados a serem inseridos (primeiro item):", {
      rental_id: paymentsToCreate[0].rental_id,
      reference_month: paymentsToCreate[0].reference_month,
      reference_month_type: typeof paymentsToCreate[0].reference_month,
      reference_year: paymentsToCreate[0].reference_year,
      reference_year_type: typeof paymentsToCreate[0].reference_year,
      due_date: paymentsToCreate[0].due_date,
      expected_amount: paymentsToCreate[0].expected_amount,
    });
    
    const { data: insertedData, error } = await supabase.from("payments").insert(paymentsToCreate).select('id, rental_id, reference_month, reference_year');
    
    if (error) {
      console.error("❌ [createPaymentsForRental] Erro ao inserir recebimentos:", error);
      console.error("❌ Dados que tentaram ser inseridos:", JSON.stringify(paymentsToCreate, null, 2));
      throw error;
    }
    
    console.log("✅ [createPaymentsForRental] Recebimentos inseridos com sucesso!");
    console.log(`📊 [createPaymentsForRental] ${insertedData?.length || 0} recebimentos inseridos no banco`);
    if (insertedData && insertedData.length > 0) {
      console.log("📋 [createPaymentsForRental] Primeiros 3 recebimentos inseridos:", 
        insertedData.slice(0, 3).map((p: any) => ({
          id: p.id,
          rental_id: p.rental_id,
          reference: `${p.reference_month}/${p.reference_year}`
        }))
      );
    }
  } else {
    console.log("ℹ️ [createPaymentsForRental] Nenhum recebimento novo para criar (todos já existem)");
  }
}

/**
 * Atualiza valores de pagamentos FUTUROS quando a locação é editada
 * 
 * REGRA CRÍTICA:
 * - Atualiza APENAS pagamentos com due_date >= HOJE
 * - Atualiza APENAS pagamentos com status = 'pending' ou 'overdue'
 * - NUNCA toca em pagamentos 'paid' ou 'partial'
 * - Preserva o snapshot de valores em pagamentos já pagos
 */
export async function updateFuturePayments(
  rentalId: string,
  newTotalValue: number,
  rental: Rental
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  console.log("🔄 [updateFuturePayments] Atualizando pagamentos futuros...");
  console.log("📅 Data de corte:", todayStr);

  // ✅ CRÍTICO: Buscar APENAS pagamentos futuros (due_date >= hoje) e pending/overdue
  const { data: futurePayments, error } = await supabase
    .from("payments")
    .select("id, reference_month, reference_year, breakdown, status, due_date")
    .eq("rental_id", rentalId)
    .in("status", ["pending", "overdue"])
    .gte("due_date", todayStr);  // ← APENAS pagamentos futuros

  if (error) throw error;
  if (!futurePayments || futurePayments.length === 0) {
    console.log("ℹ️ Nenhum pagamento futuro para atualizar");
    return;
  }

  console.log(`📊 ${futurePayments.length} pagamentos futuros serão atualizados`);

  const baseRent = rental.monthlyRent || rental.value || 0;
  const garage = rental.hasGarage && rental.garageValue ? rental.garageValue : 0;

  const updates = futurePayments.map((payment) => {
    const breakdown = [
      {
        description: "Aluguel",
        amount: parseFloat(baseRent.toFixed(2)),
        type: "addition",
      },
    ];

    if (rental.hasGarage && garage > 0) {
      breakdown.push({
        description: "Garagem",
        amount: parseFloat(garage.toFixed(2)),
        type: "addition",
      });
    }

    return {
      id: payment.id,
      expected_amount: parseFloat(newTotalValue.toFixed(2)),
      breakdown: breakdown,
    };
  });

  await Promise.all(
    updates.map(async (update) => {
      const { error } = await supabase
        .from("payments")
        .update({
          expected_amount: update.expected_amount,
          breakdown: update.breakdown,
        })
        .eq("id", update.id);
      
      if (error) throw error;
    })
  );

  console.log(`✅ ${updates.length} pagamentos futuros atualizados com sucesso`);
}

/**
 * Atualiza dia de vencimento de pagamentos FUTUROS
 * 
 * REGRA CRÍTICA: Atualiza APENAS due_date >= hoje e status = 'pending'
 */
export const updateFuturePaymentsOnPaymentDayChange = async (
  rentalId: string,
  newPaymentDay: number
): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  console.log("🔄 [updateFuturePaymentsOnPaymentDayChange] Atualizando datas...");
  console.log("📅 Data de corte:", todayStr);

  // ✅ CRÍTICO: Buscar APENAS pagamentos futuros e pending
  const { data: futurePayments, error: fetchError } = await supabase
    .from("payments")
    .select("*")
    .eq("rental_id", rentalId)
    .eq("status", "pending")
    .gte("due_date", todayStr);  // ← APENAS pagamentos futuros

  if (fetchError) throw fetchError;
  if (!futurePayments || futurePayments.length === 0) {
    console.log("ℹ️ Nenhum pagamento futuro para atualizar data");
    return;
  }

  console.log(`📊 ${futurePayments.length} datas de vencimento serão atualizadas`);

  const updates = futurePayments.map((payment) => {
    const refYear = typeof payment.reference_year === 'string' ? parseInt(payment.reference_year) : payment.reference_year;
    const refMonth = typeof payment.reference_month === 'string' ? parseInt(payment.reference_month) : payment.reference_month;

    const dueDate = getValidDueDate(newPaymentDay, refYear, refMonth);

    return {
      id: payment.id,
      due_date: dueDate,
    };
  });

  for (const update of updates) {
    const { error } = await supabase
      .from("payments")
      .update({ due_date: update.due_date })
      .eq("id", update.id);

    if (error) throw error;
  }

  console.log(`✅ ${updates.length} datas atualizadas com sucesso`);
};

/**
 * Atualiza pagamentos quando a locação é editada
 * 
 * REGRA CRÍTICA: Atualiza APENAS pagamentos futuros (due_date >= hoje) e pending
 */
export const updatePendingPaymentsOnRentalEdit = async (
  rentalId: string,
  updates: Partial<{
    monthlyRent: number;
    paymentDay: number;
    hasGarage: boolean;
    garageValue: number;
  }>,
  rental: Rental
): Promise<void> => {
  console.log("🔄 [updatePendingPaymentsOnRentalEdit] Iniciando...");
  console.log("📋 Updates:", updates);

  if (updates.monthlyRent !== undefined || updates.garageValue !== undefined || updates.hasGarage !== undefined) {
    const baseRent = updates.monthlyRent ?? rental.monthlyRent ?? rental.value ?? 0;
    const garage = (updates.hasGarage ?? rental.hasGarage) && (updates.garageValue ?? rental.garageValue) 
      ? (updates.garageValue ?? rental.garageValue ?? 0) 
      : 0;
    const totalValue = baseRent + garage;
    
    console.log("💰 Novo total:", totalValue, "(aluguel:", baseRent, "+ garagem:", garage, ")");
    
    await updateFuturePayments(rentalId, totalValue, {
      ...rental,
      monthlyRent: baseRent,
      hasGarage: updates.hasGarage ?? rental.hasGarage,
      garageValue: updates.garageValue ?? rental.garageValue
    });
  }

  if (updates.paymentDay !== undefined) {
    await updateFuturePaymentsOnPaymentDayChange(rentalId, updates.paymentDay);
  }
};

export async function analyzeAllRentalsPayments(): Promise<{
  success: boolean;
  totalRentals: number;
  problems: { rentalId: string; propertyName: string; reason: string }[];
  errors: string[];
}> {
  const problems: { rentalId: string; propertyName: string; reason: string }[] = [];

  try {
    const { data: rentals, error: rentalsError } = await supabase
      .from("rentals")
      .select(`
        id,
        start_date,
        end_date,
        rent_value,
        rent_due_day,
        has_garage,
        garage_value,
        status,
        properties(property_identifier)
      `)
      .in("status", ["active", "ended"]);

    if (rentalsError) throw rentalsError;
    if (!rentals) return { success: true, totalRentals: 0, problems: [], errors: [] };

    for (const rental of rentals) {
      const propertyName = rental.properties?.property_identifier || "Sem identificação";
      
      const expected = generateExpectedPayments({
          rentalId: rental.id,
          startDate: rental.start_date,
          endDate: rental.end_date,
          monthlyRent: rental.rent_value || 0,
          paymentDay: rental.rent_due_day || 5,
          hasGarage: rental.has_garage || false,
          garageValue: rental.garage_value || 0,
      });
      
      const { data: existing } = await supabase.from("payments").select("*").eq("rental_id", rental.id);
      
      if (!existing || existing.length === 0) {
          problems.push({ rentalId: rental.id, propertyName, reason: "Nenhum recebimento encontrado" });
          continue;
      }
      
      if (expected.length !== existing.length) {
          problems.push({ rentalId: rental.id, propertyName, reason: `Quantidade de meses divergente (Esperado: ${expected.length}, Atual: ${existing.length})` });
          continue;
      }
      
      let hasMismatch = false;
      for (const exp of expected) {
          const match = existing.find(ex => String(ex.reference_month) === String(exp.reference_month) && String(ex.reference_year) === String(exp.reference_year));
          if (!match) {
              hasMismatch = true;
              break;
          }
          if (match.installment !== exp.installment) {
              hasMismatch = true;
              break;
          }
          if (match.total_installments !== exp.total_installments) {
              hasMismatch = true;
              break;
          }
      }
      
      if (hasMismatch) {
          problems.push({ rentalId: rental.id, propertyName, reason: "Inconsistência nos meses ou numeração de parcelas incorreta" });
      }
    }

    return { success: true, totalRentals: rentals.length, problems, errors: [] };
  } catch (error: any) {
    console.error("Erro ao analisar pagamentos:", error);
    return { success: false, totalRentals: 0, problems: [], errors: [error.message] };
  }
}

export async function fixSpecificRentalPayments(rentalId: string): Promise<boolean> {
  try {
    const { data: rental, error: rentalError } = await supabase
      .from("rentals")
      .select(`
        id,
        start_date,
        end_date,
        rent_value,
        rent_due_day,
        has_garage,
        garage_value
      `)
      .eq("id", rentalId)
      .single();

    if (rentalError || !rental) throw rentalError;

    const expected = generateExpectedPayments({
      rentalId: rental.id,
      startDate: rental.start_date,
      endDate: rental.end_date,
      monthlyRent: rental.rent_value || 0,
      paymentDay: rental.rent_due_day || 5,
      hasGarage: rental.has_garage || false,
      garageValue: rental.garage_value || 0,
    });
      
    const { data: existing } = await supabase.from("payments").select("*").eq("rental_id", rentalId);
    const currentPayments = existing || [];

    // Updates or Inserts without touching payment status or attachments
    for (const exp of expected) {
      const match = currentPayments.find(ex => String(ex.reference_month) === String(exp.reference_month) && String(ex.reference_year) === String(exp.reference_year));
      
      if (match) {
        await supabase.from("payments").update({
            installment: exp.installment,
            total_installments: exp.total_installments,
            expected_amount: exp.expected_amount,
            breakdown: exp.breakdown,
            due_date: exp.due_date
        }).eq("id", match.id);
      } else {
        await supabase.from("payments").insert([exp]);
      }
    }
    
    // Remove strictly what is completely out of bounds for the contract
    for (const ex of currentPayments) {
      const isExpected = expected.find(exp => String(exp.reference_month) === String(ex.reference_month) && String(exp.reference_year) === String(ex.reference_year));
      if (!isExpected) {
          await supabase.from("payments").delete().eq("id", ex.id);
      }
    }

    return true;
  } catch (error) {
    console.error("Erro ao corrigir recebimentos da locação:", error);
    return false;
  }
}

/**
 * Corrige uma locação específica deletando todos os PENDING e recriando do zero
 * Mantém apenas os recebimentos PAID intactos
 */
export async function fixSpecificRentalByRecalculation(rentalId: string): Promise<{
  success: boolean;
  message: string;
  details: {
    deletedPending: number;
    createdNew: number;
    keptPaid: number;
  };
}> {
  try {
    console.log(`🔧 Iniciando correção total da locação ${rentalId}`);

    // 1. Buscar dados do contrato
    const { data: rental, error: rentalError } = await supabase
      .from("rentals")
      .select(`
        id,
        start_date,
        end_date,
        rent_value,
        rent_due_day,
        has_garage,
        garage_value,
        properties(property_identifier)
      `)
      .eq("id", rentalId)
      .single();

    if (rentalError || !rental) {
      throw new Error(`Erro ao buscar locação: ${rentalError?.message}`);
    }

    console.log(`📋 Locação encontrada:`, {
      property: (rental.properties as any)?.property_identifier,
      period: `${rental.start_date} até ${rental.end_date}`,
      dueDay: rental.rent_due_day
    });

    // 2. Buscar recebimentos existentes
    const { data: existingPayments } = await supabase
      .from("payments")
      .select("*")
      .eq("rental_id", rentalId);

    const paidPayments = (existingPayments || []).filter(p => p.status === 'paid');
    const pendingPayments = (existingPayments || []).filter(p => p.status === 'pending');

    console.log(`📊 Recebimentos existentes:`, {
      total: existingPayments?.length || 0,
      paid: paidPayments.length,
      pending: pendingPayments.length
    });

    // 3. Deletar todos os PENDING
    if (pendingPayments.length > 0) {
      const pendingIds = pendingPayments.map(p => p.id);
      const { error: deleteError } = await supabase
        .from("payments")
        .delete()
        .in("id", pendingIds);

      if (deleteError) throw deleteError;
      console.log(`🗑️ Deletados ${pendingPayments.length} recebimentos PENDING`);
    }

    // 4. Gerar novos recebimentos corretos
    const expectedPayments = generateExpectedPayments({
      rentalId: rental.id,
      startDate: rental.start_date,
      endDate: rental.end_date,
      monthlyRent: rental.rent_value || 0,
      paymentDay: rental.rent_due_day || 5,
      hasGarage: rental.has_garage || false,
      garageValue: rental.garage_value || 0,
    });

    console.log(`📝 Recebimentos esperados: ${expectedPayments.length}`);

    // 5. Filtrar apenas os que NÃO conflitam com PAID existentes
    const paidRefs = new Set(
      paidPayments.map(p => `${p.reference_year}-${p.reference_month}`)
    );

    const paymentsToCreate = expectedPayments.filter(
      exp => !paidRefs.has(`${exp.reference_year}-${exp.reference_month}`)
    );

    console.log(`➕ Recebimentos a criar: ${paymentsToCreate.length}`);

    // 6. Inserir novos recebimentos
    if (paymentsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from("payments")
        .insert(paymentsToCreate);

      if (insertError) throw insertError;
    }

    // 7. Atualizar numeração dos PAID para ficarem na sequência correta
    for (const paid of paidPayments) {
      const expectedForThisMonth = expectedPayments.find(
        exp => exp.reference_month === Number(paid.reference_month) && 
               exp.reference_year === Number(paid.reference_year)
      );

      if (expectedForThisMonth) {
        await supabase
          .from("payments")
          .update({
            installment: expectedForThisMonth.installment,
            total_installments: expectedForThisMonth.total_installments
          })
          .eq("id", paid.id);
      }
    }

    console.log(`✅ Correção concluída com sucesso!`);

    return {
      success: true,
      message: `Locação corrigida com sucesso! ${paymentsToCreate.length} recebimentos criados, ${paidPayments.length} pagos mantidos.`,
      details: {
        deletedPending: pendingPayments.length,
        createdNew: paymentsToCreate.length,
        keptPaid: paidPayments.length
      }
    };

  } catch (error: any) {
    console.error("❌ Erro ao corrigir locação:", error);
    return {
      success: false,
      message: `Erro: ${error.message}`,
      details: {
        deletedPending: 0,
        createdNew: 0,
        keptPaid: 0
      }
    };
  }
}

/**
 * NOVA LÓGICA: Identifica e remove recebimentos duplicados baseado na análise do contrato
 * 
 * Para cada grupo de duplicatas:
 * 1. Busca o contrato para calcular qual deveria ser a parcela correta naquele mês
 * 2. Mantém o recebimento cuja parcela está mais próxima da esperada
 * 3. Se ambos são PAID, gera alerta e não deleta (requer análise manual)
 * 4. Se um é PAID e outro PENDING, mantém o PAID sempre
 */
export async function findAndRemoveDuplicatePayments(): Promise<{
  success: boolean;
  duplicatesFound: number;
  duplicatesRemoved: number;
  details: Array<{
    rentalId: string;
    month: number;
    year: number;
    total: number;
    kept: string;
    keptInstallment: string;
    removed: Array<{id: string; installment: string; status: string}>;
    reason: string;
  }>;
  warnings: Array<{
    rentalId: string;
    month: number;
    year: number;
    message: string;
    payments: Array<{id: string; installment: string; status: string}>;
  }>;
  errors: string[];
}> {
  const details: Array<{
    rentalId: string;
    month: number;
    year: number;
    total: number;
    kept: string;
    keptInstallment: string;
    removed: Array<{id: string; installment: string; status: string}>;
    reason: string;
  }> = [];
  
  const warnings: Array<{
    rentalId: string;
    month: number;
    year: number;
    message: string;
    payments: Array<{id: string; installment: string; status: string}>;
  }> = [];
  
  const errors: string[] = [];
  let duplicatesRemoved = 0;

  try {
    // Buscar todos os recebimentos com dados do contrato
    const { data: allPayments, error: paymentsError } = await supabase
      .from("payments")
      .select(`
        *,
        rental:rentals(
          id,
          start_date,
          end_date,
          rent_due_day,
          rent_value,
          has_garage,
          garage_value,
          properties(property_identifier)
        )
      `)
      .order("created_at", { ascending: true });

    if (paymentsError) throw paymentsError;
    if (!allPayments || allPayments.length === 0) {
      return { 
        success: true, 
        duplicatesFound: 0, 
        duplicatesRemoved: 0, 
        details: [], 
        warnings: [],
        errors: [] 
      };
    }

    // Agrupar por rental_id + reference_month + reference_year
    const grouped = new Map<string, any[]>();
    
    for (const payment of allPayments) {
      const key = `${payment.rental_id}-${payment.reference_month}-${payment.reference_year}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(payment);
    }

    // Processar grupos com duplicatas
    for (const [key, payments] of grouped.entries()) {
      if (payments.length <= 1) continue;

      console.log(`🔍 Duplicata encontrada: ${key} (${payments.length} recebimentos)`);

      const firstPayment = payments[0];
      const rental = firstPayment.rental;
      const propertyName = rental?.properties?.property_identifier || "Imóvel sem nome";

      // Verificar se temos os dados do contrato
      if (!rental || !rental.start_date || !rental.rent_due_day) {
        warnings.push({
          rentalId: firstPayment.rental_id,
          month: Number(firstPayment.reference_month),
          year: Number(firstPayment.reference_year),
          message: "Dados do contrato incompletos - não é possível determinar parcela correta",
          payments: payments.map(p => ({
            id: p.id,
            installment: p.installment ? `${p.installment}/${p.total_installments || '?'}` : 'N/A',
            status: p.status
          }))
        });
        continue;
      }

      // Calcular qual deveria ser a parcela esperada para este mês
      const expectedPayments = generateExpectedPayments({
        rentalId: rental.id,
        startDate: rental.start_date,
        endDate: rental.end_date,
        monthlyRent: rental.rent_value || 0,
        paymentDay: rental.rent_due_day,
        hasGarage: rental.has_garage || false,
        garageValue: rental.garage_value || 0,
      });

      const expectedForThisMonth = expectedPayments.find(
        exp => exp.reference_month === Number(firstPayment.reference_month) && 
               exp.reference_year === Number(firstPayment.reference_year)
      );

      if (!expectedForThisMonth) {
        console.log(`⚠️ Este mês não deveria ter recebimento segundo o contrato`);
        // Todos são inválidos - deletar todos PENDING, alertar se houver PAID
        const paidOnes = payments.filter(p => p.status === 'paid');
        const pendingOnes = payments.filter(p => p.status === 'pending');

        if (paidOnes.length > 0) {
          warnings.push({
            rentalId: firstPayment.rental_id,
            month: Number(firstPayment.reference_month),
            year: Number(firstPayment.reference_year),
            message: `Mês fora do período do contrato, mas tem ${paidOnes.length} recebimento(s) PAGO(S)`,
            payments: payments.map(p => ({
              id: p.id,
              installment: p.installment ? `${p.installment}/${p.total_installments || '?'}` : 'N/A',
              status: p.status
            }))
          });
        }

        // Deletar os pending
        for (const payment of pendingOnes) {
          const { error: deleteError } = await supabase
            .from("payments")
            .delete()
            .eq("id", payment.id);

          if (deleteError) {
            errors.push(`Erro ao deletar ${payment.id}: ${deleteError.message}`);
          } else {
            duplicatesRemoved++;
          }
        }

        if (pendingOnes.length > 0) {
          details.push({
            rentalId: firstPayment.rental_id,
            month: Number(firstPayment.reference_month),
            year: Number(firstPayment.reference_year),
            total: payments.length,
            kept: paidOnes[0]?.id || 'nenhum',
            keptInstallment: paidOnes[0] ? `${paidOnes[0].installment}/${paidOnes[0].total_installments}` : 'N/A',
            removed: pendingOnes.map(p => ({
              id: p.id,
              installment: p.installment ? `${p.installment}/${p.total_installments || '?'}` : 'N/A',
              status: p.status
            })),
            reason: "Mês fora do período do contrato"
          });
        }

        continue;
      }

      const expectedInstallment = expectedForThisMonth.installment;
      console.log(`📊 Parcela esperada para ${firstPayment.reference_month}/${firstPayment.reference_year}: ${expectedInstallment}/${expectedForThisMonth.total_installments}`);

      // Verificar se há múltiplos PAIDs (isso é um problema grave)
      const paidPayments = payments.filter(p => p.status === 'paid');
      
      if (paidPayments.length > 1) {
        warnings.push({
          rentalId: firstPayment.rental_id,
          month: Number(firstPayment.reference_month),
          year: Number(firstPayment.reference_year),
          message: `ATENÇÃO: ${paidPayments.length} recebimentos PAGOS para o mesmo mês - requer análise manual`,
          payments: payments.map(p => ({
            id: p.id,
            installment: p.installment ? `${p.installment}/${p.total_installments || '?'}` : 'N/A',
            status: p.status
          }))
        });
        continue; // Não deletar nada se há múltiplos pagos
      }

      // Se há 1 PAID e N PENDING, manter o PAID
      if (paidPayments.length === 1) {
        const toKeep = paidPayments[0];
        const toRemove = payments.filter(p => p.id !== toKeep.id);

        console.log(`✅ Mantendo recebimento PAGO: ${toKeep.id} - Parcela ${toKeep.installment}/${toKeep.total_installments}`);
        console.log(`❌ Removendo ${toRemove.length} recebimentos PENDING`);

        for (const payment of toRemove) {
          const { error: deleteError } = await supabase
            .from("payments")
            .delete()
            .eq("id", payment.id);

          if (deleteError) {
            errors.push(`Erro ao deletar ${payment.id}: ${deleteError.message}`);
          } else {
            duplicatesRemoved++;
          }
        }

        details.push({
          rentalId: firstPayment.rental_id,
          month: Number(firstPayment.reference_month),
          year: Number(firstPayment.reference_year),
          total: payments.length,
          kept: toKeep.id,
          keptInstallment: `${toKeep.installment}/${toKeep.total_installments}`,
          removed: toRemove.map(p => ({
            id: p.id,
            installment: p.installment ? `${p.installment}/${p.total_installments || '?'}` : 'N/A',
            status: p.status
          })),
          reason: `Mantido recebimento PAGO (${propertyName})`
        });

        continue;
      }

      // Se todos são PENDING, manter o que tem a parcela mais próxima da esperada
      const pendingPayments = payments.filter(p => p.status === 'pending');
      
      // Ordenar por proximidade com parcela esperada
      const sorted = pendingPayments.sort((a, b) => {
        const diffA = Math.abs((a.installment || 0) - expectedInstallment);
        const diffB = Math.abs((b.installment || 0) - expectedInstallment);
        
        if (diffA !== diffB) return diffA - diffB;
        
        // Se empate, usar created_at (mais recente)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const toKeep = sorted[0];
      const toRemove = sorted.slice(1);

      console.log(`✅ Mantendo: ${toKeep.id} - Parcela ${toKeep.installment}/${toKeep.total_installments} (esperada: ${expectedInstallment})`);
      console.log(`❌ Removendo: ${toRemove.map(p => `${p.id} (${p.installment}/${p.total_installments || '?'})`).join(", ")}`);

      for (const payment of toRemove) {
        const { error: deleteError } = await supabase
          .from("payments")
          .delete()
          .eq("id", payment.id);

        if (deleteError) {
          errors.push(`Erro ao deletar ${payment.id}: ${deleteError.message}`);
        } else {
          duplicatesRemoved++;
        }
      }

      details.push({
        rentalId: firstPayment.rental_id,
        month: Number(firstPayment.reference_month),
        year: Number(firstPayment.reference_year),
        total: payments.length,
        kept: toKeep.id,
        keptInstallment: `${toKeep.installment}/${toKeep.total_installments}`,
        removed: toRemove.map(p => ({
          id: p.id,
          installment: p.installment ? `${p.installment}/${p.total_installments || '?'}` : 'N/A',
          status: p.status
        })),
        reason: `Mantido o mais próximo da parcela esperada ${expectedInstallment} (${propertyName})`
      });
    }

    return {
      success: true,
      duplicatesFound: details.length,
      duplicatesRemoved,
      details,
      warnings,
      errors,
    };
  } catch (error: any) {
    console.error("Erro ao buscar duplicatas:", error);
    return {
      success: false,
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      details: [],
      warnings: [],
      errors: [error.message],
    };
  }
}