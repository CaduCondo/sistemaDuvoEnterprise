import { supabase } from "@/integrations/supabase/client";

/**
 * Serviço para gerenciar locais isentos de taxa de administração
 * Um local isento = taxa de administração NÃO é cobrada dele
 */

/**
 * Busca todos os locais isentos de taxa de administração
 */
export async function getExemptLocations(): Promise<string[]> {
  const { data, error } = await supabase
    .from("admin_fee_exempt_locations")
    .select("location_id");

  if (error) {
    console.error("Erro ao buscar locais isentos:", error);
    throw error;
  }

  return (data || []).map((row) => row.location_id);
}

/**
 * Adiciona um local à lista de isentos
 */
export async function addExemptLocation(locationId: string): Promise<void> {
  const { error } = await supabase
    .from("admin_fee_exempt_locations")
    .insert({ location_id: locationId });

  if (error) {
    console.error("Erro ao adicionar local isento:", error);
    throw error;
  }
}

/**
 * Remove um local da lista de isentos
 */
export async function removeExemptLocation(locationId: string): Promise<void> {
  const { error } = await supabase
    .from("admin_fee_exempt_locations")
    .delete()
    .eq("location_id", locationId);

  if (error) {
    console.error("Erro ao remover local isento:", error);
    throw error;
  }
}

/**
 * Define a lista completa de locais isentos
 * (remove os que não estão na lista e adiciona os novos)
 */
export async function setExemptLocations(locationIds: string[]): Promise<void> {
  // 1. Buscar locais isentos atuais
  const currentExempt = await getExemptLocations();

  // 2. Remover locais que não estão mais na lista
  const toRemove = currentExempt.filter((id) => !locationIds.includes(id));
  for (const locationId of toRemove) {
    await removeExemptLocation(locationId);
  }

  // 3. Adicionar novos locais
  const toAdd = locationIds.filter((id) => !currentExempt.includes(id));
  for (const locationId of toAdd) {
    await addExemptLocation(locationId);
  }
}

