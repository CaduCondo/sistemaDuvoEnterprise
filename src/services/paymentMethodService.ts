import { supabase } from "@/integrations/supabase/client";

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Buscar todos os métodos de pagamento
 */
export async function getAllPaymentMethods(): Promise<PaymentMethod[]> {
  console.log("🔍 [paymentMethodService] Buscando formas de pagamento...");
  
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("❌ [paymentMethodService] Erro ao buscar payment_methods:", error);
    throw error;
  }

  console.log("✅ [paymentMethodService] Formas de pagamento carregadas:", data?.length || 0);
  console.log("📋 [paymentMethodService] Dados:", data);
  
  return (data || []) as PaymentMethod[];
}

/**
 * Criar novo método de pagamento
 */
export async function createPaymentMethod(data: {
  code: string;
  name: string;
  active?: boolean;
  display_order?: number;
}): Promise<PaymentMethod> {
  const insertData = {
    code: data.code,
    name: data.name,
    active: data.active ?? true,
    display_order: data.display_order ?? 99,
  };

  const { data: result, error } = await supabase
    .from("payment_methods")
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar método de pagamento:", error);
    throw error;
  }

  return result;
}

/**
 * Atualizar método de pagamento
 */
export async function updatePaymentMethod(
  id: string,
  data: Partial<PaymentMethod>
): Promise<PaymentMethod> {
  const { data: result, error } = await supabase
    .from("payment_methods")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar método de pagamento:", error);
    throw error;
  }

  return result;
}

/**
 * Deletar método de pagamento
 */
export async function deletePaymentMethod(id: string): Promise<void> {
  const { error } = await supabase
    .from("payment_methods")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao deletar método de pagamento:", error);
    throw error;
  }
}