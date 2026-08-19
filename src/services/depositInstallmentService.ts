import { supabase } from "@/integrations/supabase/client";
import { DepositInstallment } from "@/types";

/**
 * Configuração desejada (o que o formulário de locação quer que uma parcela
 * seja) para uma parcela de caução, usada por `planDepositInstallmentsSync`.
 */
export interface DesiredDepositInstallment {
  amount: number;
  due_date: string;
  pix_code: string | null;
}

/**
 * Formato mínimo de uma parcela já existente no banco, usado por
 * `planDepositInstallmentsSync` para decidir o que fazer com ela.
 */
export interface ExistingDepositInstallmentSummary {
  id: string;
  installment_number: number;
  installment_total: number;
  amount: number;
  due_date: string;
  pix_code: string | null;
  status: string;
}

export type DepositInstallmentToCreate = { installment_number: number } & DesiredDepositInstallment;
export type DepositInstallmentToUpdate = { id: string; installment_number: number } & Partial<
  Pick<DesiredDepositInstallment, "amount" | "due_date" | "pix_code">
> & { installment_total?: number };
export type DepositInstallmentRef = { id: string; installment_number: number };

// Nota: propositalmente NÃO é um union type (`{blocked: true} | {blocked:
// false, ...}`). Com a config atual do projeto (strict: false /
// strictNullChecks: false no tsconfig), o TypeScript não estreita esse tipo
// de union corretamente depois de um `if (plan.blocked) throw ...`, e os
// campos ficariam inacessíveis por engano no restante do código. Um objeto
// só, com arrays vazios quando bloqueado, evita esse problema.
export interface DepositInstallmentSyncPlan {
  blocked: boolean;
  reason?: string;
  toCreate: DepositInstallmentToCreate[];
  toUpdate: DepositInstallmentToUpdate[];
  toDelete: DepositInstallmentRef[];
  keptPaid: DepositInstallmentRef[];
}

/**
 * Decide, de forma pura (sem chamar o banco), o que precisa ser criado,
 * atualizado ou removido na tabela `deposit_installments` para que ela
 * passe a refletir `totalInstallments` parcelas configuradas em `desired`,
 * partindo do que já existe em `existing`.
 *
 * Regras (alinhadas com o Cadu):
 * - Nunca sobrescreve valor/vencimento de uma parcela já paga (`status ===
 *   "paid"`) - ela só tem `installment_total` atualizado, se necessário.
 * - Nunca remove uma parcela já paga.
 * - Bloqueia (retorna `blocked: true`) se `totalInstallments` for menor que
 *   a quantidade de parcelas já pagas, com uma mensagem amigável explicando
 *   por quê - não importa qual parcela (1ª, 2ª ou 3ª) está paga, só a
 *   quantidade.
 */
export function planDepositInstallmentsSync(
  totalInstallments: number,
  desired: Record<number, DesiredDepositInstallment>,
  existing: ExistingDepositInstallmentSummary[]
): DepositInstallmentSyncPlan {
  const existingByNumber = new Map<number, ExistingDepositInstallmentSummary>(
    existing.map((installment) => [installment.installment_number, installment])
  );
  const paidCount = existing.filter((installment) => installment.status === "paid").length;

  if (totalInstallments < paidCount) {
    return {
      blocked: true,
      reason:
        `Não é possível configurar o caução em ${totalInstallments} parcela(s): ${paidCount} parcela(s) já ` +
        `foram pagas. Selecione ${paidCount} parcela(s) ou mais, ou exclua o(s) recebimento(s) de caução já ` +
        `pagos em Financeiro > Cauções antes de reduzir a quantidade de parcelas.`,
      toCreate: [],
      toUpdate: [],
      toDelete: [],
      keptPaid: [],
    };
  }

  const toCreate: DepositInstallmentToCreate[] = [];
  const toUpdate: DepositInstallmentToUpdate[] = [];
  const toDelete: DepositInstallmentRef[] = [];
  const keptPaid: DepositInstallmentRef[] = [];

  for (let num = 1; num <= totalInstallments; num++) {
    const desiredInstallment = desired[num];
    if (!desiredInstallment) continue; // sem valor informado para essa parcela

    const existingInstallment = existingByNumber.get(num);

    if (!existingInstallment) {
      toCreate.push({ installment_number: num, ...desiredInstallment });
      continue;
    }

    if (existingInstallment.status === "paid") {
      keptPaid.push({ id: existingInstallment.id, installment_number: num });
      if (existingInstallment.installment_total !== totalInstallments) {
        toUpdate.push({ id: existingInstallment.id, installment_number: num, installment_total: totalInstallments });
      }
      continue;
    }

    const update: DepositInstallmentToUpdate = { id: existingInstallment.id, installment_number: num };
    let hasChange = false;
    if (existingInstallment.installment_total !== totalInstallments) {
      update.installment_total = totalInstallments;
      hasChange = true;
    }
    if (existingInstallment.amount !== desiredInstallment.amount) {
      update.amount = desiredInstallment.amount;
      hasChange = true;
    }
    if (existingInstallment.due_date !== desiredInstallment.due_date) {
      update.due_date = desiredInstallment.due_date;
      hasChange = true;
    }
    if (desiredInstallment.pix_code !== null && existingInstallment.pix_code !== desiredInstallment.pix_code) {
      update.pix_code = desiredInstallment.pix_code;
      hasChange = true;
    }
    if (hasChange) toUpdate.push(update);
  }

  for (const [num, existingInstallment] of existingByNumber) {
    if (num <= totalInstallments) continue;
    if (existingInstallment.status === "paid") {
      keptPaid.push({ id: existingInstallment.id, installment_number: num });
      continue;
    }
    toDelete.push({ id: existingInstallment.id, installment_number: num });
  }

  return { blocked: false, toCreate, toUpdate, toDelete, keptPaid };
}

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

  return data as unknown as DepositInstallment[];
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