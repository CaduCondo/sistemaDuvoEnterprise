import { supabase } from "@/integrations/supabase/client";
import { DepositInstallment } from "@/types";

/**
 * Criar parcelas de caução para uma locação
 */
export async function createDepositInstallments(
  rentalId: string,
  installments: Array<{
    installment_number: number;
    total_installments: number;
    amount: number;
    due_date: string;
    payment_date?: string | null;
    pix_code?: string | null;
    status?: "pending" | "paid" | "partial";
    paid_amount?: number;
    payment_method?: string | null;
  }>
): Promise<DepositInstallment[]> {
  try {
    // ✅ CORREÇÃO CRÍTICA: Verificar se já existem parcelas antes de criar
    const { data: existing, error: checkError } = await supabase
      .from("deposit_installments")
      .select("id, installment_number")
      .eq("rental_id", rentalId);

    if (checkError) throw checkError;

    // Se já existem parcelas, não criar duplicatas
    if (existing && existing.length > 0) {
      console.warn(`⚠️ Parcelas de caução já existem para rental_id ${rentalId}. Não criando duplicatas.`);
      return existing.map(item => ({
        id: item.id,
        rental_id: rentalId,
        installment_number: item.installment_number,
        total_installments: installments.length,
        amount: 0,
        due_date: "",
        payment_date: null,
        paid_amount: 0,
        payment_method: null,
        pix_code: null,
        status: "pending",
        notes: null,
        attachments: [],
        created_at: "",
        updated_at: "",
      })) as DepositInstallment[];
    }

    const installmentsData = installments.map(inst => ({
      rental_id: rentalId,
      installment_number: inst.installment_number,
      installment_total: inst.total_installments,
      amount: inst.amount,
      due_date: inst.due_date,
      payment_date: inst.payment_date || null,
      pix_code: inst.pix_code || null,
      status: inst.status || "pending",
      paid_amount: inst.paid_amount || 0,
      payment_method: inst.payment_method || null,
    }));

    const { data, error } = await supabase
      .from("deposit_installments")
      .insert(installmentsData)
      .select();

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      rental_id: item.rental_id,
      installment_number: item.installment_number,
      total_installments: item.installment_total,
      amount: item.amount,
      due_date: item.due_date,
      payment_date: item.payment_date,
      paid_amount: item.paid_amount || 0,
      payment_method: item.payment_method,
      pix_code: item.pix_code,
      status: item.status,
      notes: item.notes,
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
      created_at: item.created_at,
      updated_at: item.updated_at,
    })) as DepositInstallment[];
  } catch (error) {
    console.error("Erro ao criar parcelas de caução:", error);
    throw error;
  }
}

/**
 * Buscar parcelas de caução de uma locação
 */
export async function getDepositInstallmentsByRental(
  rentalId: string
): Promise<DepositInstallment[]> {
  const { data, error } = await supabase
    .from("deposit_installments")
    .select("*")
    .eq("rental_id", rentalId)
    .order("installment_number", { ascending: true });

  if (error) {
    console.error("Erro ao buscar parcelas de caução:", error);
    throw error;
  }

  return data as DepositInstallment[];
}

/**
 * Buscar todas as parcelas de caução (com filtros opcionais)
 */
export async function getAllDepositInstallments(): Promise<DepositInstallment[]> {
  try {
    const { data, error } = await supabase
      .from("deposit_installments")
      .select("*")
      .order("due_date", { ascending: true });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      rental_id: item.rental_id,
      installment_number: item.installment_number,
      total_installments: item.installment_total,
      amount: item.amount,
      due_date: item.due_date,
      payment_date: item.payment_date,
      paid_amount: item.paid_amount || 0,
      payment_method: item.payment_method,
      status: item.status,
      notes: item.notes,
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
      created_at: item.created_at,
      updated_at: item.updated_at,
    })) as DepositInstallment[];
  } catch (error) {
    console.error("Erro ao buscar parcelas de caução:", error);
    throw error;
  }
}

/**
 * Atualizar parcela de caução
 */
export const updateDepositInstallment = async (
  id: string,
  data: {
    payment_date?: string;
    paid_value?: number;
    status?: "pending" | "paid" | "overdue";
    attachments?: any[]; // ✅ JSONB aceita qualquer array de objetos
    pix_code?: string;
  }
) => {
  const { data: result, error } = await supabase
    .from("deposit_installments")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return result;
};

/**
 * Registrar pagamento de parcela de caução
 */
export async function registerDepositInstallmentPayment(
  id: string,
  payment: {
    payment_date: string;
    paid_amount: number;
    payment_method?: string;
    notes?: string;
  }
): Promise<DepositInstallment> {
  // Buscar a parcela atual
  const { data: installment, error: fetchError } = await supabase
    .from("deposit_installments")
    .select("amount")
    .eq("id", id)
    .single();

  if (fetchError) {
    console.error("Erro ao buscar parcela:", fetchError);
    throw fetchError;
  }

  // Determinar status
  let status: "pending" | "paid" | "partial" = "pending";
  if (payment.paid_amount >= installment.amount) {
    status = "paid";
  } else if (payment.paid_amount > 0) {
    status = "partial";
  }

  const { data, error } = await supabase
    .from("deposit_installments")
    .update({
      payment_date: payment.payment_date,
      paid_amount: payment.paid_amount,
      payment_method: payment.payment_method,
      notes: payment.notes,
      status,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erro ao registrar pagamento:", error);
    throw error;
  }

  return {
    id: data.id,
    rental_id: data.rental_id,
    installment_number: data.installment_number,
    total_installments: data.installment_total,
    amount: data.amount,
    due_date: data.due_date,
    payment_date: data.payment_date,
    paid_amount: data.paid_amount || 0,
    payment_method: data.payment_method,
    status: data.status,
    notes: data.notes,
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    created_at: data.created_at,
    updated_at: data.updated_at,
  } as DepositInstallment;
}

/**
 * Atualizar status de parcelas vencidas
 */
export async function updateOverdueDepositInstallments(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const { error } = await supabase
    .from("deposit_installments")
    .update({ status: "overdue" })
    .lt("due_date", today)
    .in("status", ["pending", "partial"]);

  if (error) {
    console.error("Erro ao atualizar parcelas vencidas:", error);
    throw error;
  }
}

/**
 * Deletar parcelas de caução de uma locação
 */
export async function deleteDepositInstallmentsByRental(
  rentalId: string
): Promise<void> {
  const { error } = await supabase
    .from("deposit_installments")
    .delete()
    .eq("rental_id", rentalId);

  if (error) {
    console.error("Erro ao deletar parcelas de caução:", error);
    throw error;
  }
}

export async function markDepositInstallmentAsPaid(
  id: string,
  paymentDate: string,
  paymentMethod: string,
  notes?: string,
  attachments?: string[]
): Promise<DepositInstallment> {
  try {
    const updates: any = {
      status: "paid",
      payment_date: paymentDate,
      payment_method: paymentMethod,
    };

    if (notes) updates.notes = notes;
    if (attachments) updates.attachments = attachments;

    const { data, error } = await supabase
      .from("deposit_installments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      rental_id: data.rental_id,
      installment_number: data.installment_number,
      total_installments: data.installment_total,
      amount: data.amount,
      due_date: data.due_date,
      payment_date: data.payment_date,
      paid_amount: data.paid_amount || 0,
      payment_method: data.payment_method,
      status: data.status,
      notes: data.notes,
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      created_at: data.created_at,
      updated_at: data.updated_at,
    } as DepositInstallment;
  } catch (error) {
    console.error("Erro ao marcar parcela como paga:", error);
    throw error;
  }
}