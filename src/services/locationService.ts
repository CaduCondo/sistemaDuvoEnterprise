import { Location } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./auditService";

const TABLE = "locations";

/**
 * Get all locations from the database
 * IMPORTANT: No filtering - returns all records since we use hard delete
 */
export async function getAllLocations(): Promise<Location[]> {
  console.log("[locationService] Fetching all locations from database...");
  
  // Add timestamp to bust cache
  const timestamp = new Date().getTime();
  
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("name")
    // Force fresh data by adding a dummy filter that always passes
    .gte("created_at", "2000-01-01");

  if (error) {
    console.error("[locationService] Error fetching locations:", error);
    throw error;
  }

  console.log(`[locationService] Loaded ${data?.length || 0} locations from database (timestamp: ${timestamp})`);

  return (data || []).map(dbLocation => ({
    id: dbLocation.id,
    name: dbLocation.name,
    street: dbLocation.street || "",
    number: dbLocation.number || "",
    complement: dbLocation.complement || "",
    neighborhood: dbLocation.neighborhood || "",
    city: dbLocation.city,
    state: dbLocation.state,
    zip_code: dbLocation.zip_code || "",
    is_active: dbLocation.is_active !== false,
    active: dbLocation.is_active !== false,
    address: `${dbLocation.street || ''}, ${dbLocation.number || ''} - ${dbLocation.neighborhood || ''}, ${dbLocation.city || ''} - ${dbLocation.state || ''}`,
    manager_id: null,
    created_at: dbLocation.created_at,
    updated_at: dbLocation.updated_at,
  }));
}

export const getAll = getAllLocations;
export const getLocations = getAllLocations;

/**
 * Get a single location by ID
 */
export async function getById(id: string): Promise<Location | null> {
  console.log(`[locationService] Fetching location by ID: ${id}`);
  
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error(`[locationService] Error fetching location ${id}:`, error);
    throw error;
  }

  if (!data) {
    console.log(`[locationService] Location ${id} not found`);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    street: data.street || "",
    number: data.number || "",
    complement: data.complement || "",
    neighborhood: data.neighborhood || "",
    city: data.city,
    state: data.state,
    zip_code: data.zip_code || "",
    is_active: data.is_active !== false,
    active: data.is_active !== false,
    address: `${data.street || ''}, ${data.number || ''} - ${data.neighborhood || ''}, ${data.city || ''} - ${data.state || ''}`,
    manager_id: null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function getLocationById(id: string): Promise<Location> {
  const location = await getById(id);
  if (!location) throw new Error("Local não encontrado");
  return location;
}

/**
 * Create a new location
 */
export async function createLocation(location: Partial<Location>): Promise<Location> {
  const { data, error } = await supabase
    .from("locations")
    .insert([
      {
        name: location.name,
        street: location.street,
        number: location.number,
        complement: location.complement,
        neighborhood: location.neighborhood,
        city: location.city,
        state: location.state,
        zip_code: location.zip_code,
        is_active: location.is_active !== false,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  // ✅ Log de auditoria
  await logAudit({
    action_type: "create",
    entity_type: "location",
    entity_id: data.id,
    changes_summary: `Aba: Locais\nNovo local cadastrado: ${data.name}`,
    new_values: {
      name: data.name,
      street: data.street,
      city: data.city,
    },
  });

  return {
    id: data.id,
    name: data.name,
    street: data.street || "",
    number: data.number || "",
    complement: data.complement || "",
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    zip_code: data.zip_code || "",
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Update an existing location
 */
export async function updateLocation(id: string, updates: Partial<Location>): Promise<Location> {
  // Buscar valores antigos
  const { data: oldData } = await supabase
    .from("locations")
    .select("*")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("locations")
    .update({
      name: updates.name,
      street: updates.street,
      number: updates.number,
      complement: updates.complement,
      neighborhood: updates.neighborhood,
      city: updates.city,
      state: updates.state,
      zip_code: updates.zip_code,
      is_active: updates.is_active,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // ✅ Log de auditoria com mudanças
  if (oldData) {
    const changes: string[] = [];
    
    if (oldData.name !== data.name) changes.push(`name: de=${oldData.name} -> para=${data.name}`);
    if (oldData.street !== data.street) changes.push(`street: de=${oldData.street || '-'} -> para=${data.street || '-'}`);
    if (oldData.number !== data.number) changes.push(`number: de=${oldData.number || '-'} -> para=${data.number || '-'}`);
    if (oldData.neighborhood !== data.neighborhood) changes.push(`neighborhood: de=${oldData.neighborhood || '-'} -> para=${data.neighborhood || '-'}`);
    if (oldData.city !== data.city) changes.push(`city: de=${oldData.city || '-'} -> para=${data.city || '-'}`);
    if (oldData.state !== data.state) changes.push(`state: de=${oldData.state || '-'} -> para=${data.state || '-'}`);
    if (oldData.zip_code !== data.zip_code) changes.push(`zip_code: de=${oldData.zip_code || '-'} -> para=${data.zip_code || '-'}`);

    const changesSummary = changes.length > 0
      ? `Aba: Locais\nLocal editado: ${data.name}\n${changes.join('\n')}`
      : `Aba: Locais\nLocal editado: ${data.name}`;

    await logAudit({
      action_type: "update",
      entity_type: "location",
      entity_id: id,
      changes_summary: changesSummary,
      old_values: { name: oldData.name, street: oldData.street, city: oldData.city },
      new_values: { name: data.name, street: data.street, city: data.city },
    });
  }

  return {
    id: data.id,
    name: data.name,
    street: data.street || "",
    number: data.number || "",
    complement: data.complement || "",
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    zip_code: data.zip_code || "",
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * HARD DELETE - Permanently remove a location from the database
 * This will CASCADE delete related records (expenses, permissions, etc.)
 */
export async function deleteLocation(id: string): Promise<void> {
  // Buscar dados antes de deletar
  const { data: locationData } = await supabase
    .from("locations")
    .select("name, street, city")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("locations").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "Este local não pode ser excluído pois possui propriedades, despesas ou permissões vinculadas."
      );
    }
    throw error;
  }

  // ✅ Log de auditoria
  if (locationData) {
    await logAudit({
      action_type: "delete",
      entity_type: "location",
      entity_id: id,
      changes_summary: `Aba: Locais\nLocal excluído: ${locationData.name}`,
      old_values: {
        name: locationData.name,
        street: locationData.street,
        city: locationData.city,
      },
    });
  }
}