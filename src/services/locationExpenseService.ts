import { supabase } from "@/integrations/supabase/client";
import { LocationExpense } from "@/types";

// Helper to bypass strict type checking for new tables not yet in types
const db = supabase as any;

export const locationExpenseService = {
  async getAll(): Promise<LocationExpense[]> {
    const { data, error } = await db
      .from("location_expenses")
      .select("*")
      .order("reference_year", { ascending: false })
      .order("reference_month", { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      locationId: item.location_id,
      expenseType: item.expense_type,
      isCapex: !!item.is_capex,
      description: item.description,
      amount: item.amount,
      referenceMonth: item.reference_month,
      referenceYear: item.reference_year,
      dueDate: item.due_date,
      paymentDate: item.payment_date,
      status: item.status,
      notes: item.notes,
      attachments: item.attachments || [],
      // updatedAt: item.updated_at, // Remove updatedAt
    }));
  },

  async getByLocation(locationId: string): Promise<LocationExpense[]> {
    const { data, error } = await db
      .from("location_expenses")
      .select("*")
      .eq("location_id", locationId)
      .order("reference_year", { ascending: false })
      .order("reference_month", { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      locationId: item.location_id,
      expenseType: item.expense_type,
      isCapex: !!item.is_capex,
      description: item.description,
      amount: item.amount,
      referenceMonth: item.reference_month,
      referenceYear: item.reference_year,
      dueDate: item.due_date,
      paymentDate: item.payment_date,
      status: item.status,
      notes: item.notes,
      attachments: item.attachments || [],
      // updatedAt: item.updated_at, // Remove updatedAt
    }));
  },

  async getByPeriod(month: number, year: number): Promise<LocationExpense[]> {
    const { data, error } = await db
      .from("location_expenses")
      .select("*")
      .eq("reference_month", month)
      .eq("reference_year", year);

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      locationId: item.location_id,
      expenseType: item.expense_type,
      isCapex: !!item.is_capex,
      description: item.description,
      amount: item.amount,
      referenceMonth: item.reference_month,
      referenceYear: item.reference_year,
      dueDate: item.due_date,
      paymentDate: item.payment_date,
      status: item.status,
      notes: item.notes,
      attachments: item.attachments || [],
      // updatedAt: item.updated_at, // Remove updatedAt
    }));
  },

  async create(expense: Partial<LocationExpense>): Promise<LocationExpense> {
    const { data, error } = await db
      .from("location_expenses")
      .insert({
        location_id: expense.locationId,
        expense_type: expense.expenseType,
        description: expense.description,
        amount: expense.amount,
        reference_month: expense.referenceMonth,
        reference_year: expense.referenceYear,
        due_date: expense.dueDate,
        payment_date: expense.paymentDate,
        status: expense.status || "pending",
        notes: expense.notes,
        attachments: expense.attachments || [],
        // Só quando marcada (bancos sem a coluna is_capex continuam aceitando).
        ...(expense.isCapex ? { is_capex: true } : {}),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      locationId: data.location_id,
      description: data.description,
      amount: Number(data.amount),
      dueDate: data.due_date,
      status: data.status,
      category: data.expense_type, // Map expense_type to category as fallback
      recurrent: false, // Default
      locationName: data.locations?.name,
      referenceMonth: data.reference_month,
      referenceYear: data.reference_year,
      expenseType: data.expense_type,
      isCapex: !!data.is_capex,
      attachments: data.attachments || [],
    };
  },

  async update(id: string, expense: Partial<LocationExpense>): Promise<void> {
    const updateData: any = {};
    if (expense.expenseType) updateData.expense_type = expense.expenseType;
    if (expense.description !== undefined) updateData.description = expense.description;
    if (expense.amount !== undefined) updateData.amount = expense.amount;
    if (expense.referenceMonth) updateData.reference_month = expense.referenceMonth;
    if (expense.referenceYear) updateData.reference_year = expense.referenceYear;
    if (expense.dueDate !== undefined) updateData.due_date = expense.dueDate;
    if (expense.paymentDate !== undefined) updateData.payment_date = expense.paymentDate;
    if (expense.status) updateData.status = expense.status;
    if (expense.notes !== undefined) updateData.notes = expense.notes;
    if (expense.attachments) updateData.attachments = expense.attachments;
    if (expense.isCapex !== undefined) updateData.is_capex = expense.isCapex;
    updateData.updated_at = new Date().toISOString();

    const { error } = await db
      .from("location_expenses")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    console.log("🔵 [SERVICE] delete chamado, ID:", id);
    
    const { error } = await db
      .from("location_expenses")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("🔵 [SERVICE] Erro no delete:", error);
      throw error;
    }
    
    console.log("🔵 [SERVICE] Delete bem-sucedido!");
  },
};

export const getAll = locationExpenseService.getAll;
export const getByLocation = locationExpenseService.getByLocation;
export const getByPeriod = locationExpenseService.getByPeriod;
export const create = locationExpenseService.create;
export const update = locationExpenseService.update;
export const remove = locationExpenseService.delete;