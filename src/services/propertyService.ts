import { supabase } from "@/integrations/supabase/client";
import type { Property } from "@/types";
import { logAudit } from "./auditService";

// Cache em memória otimizado com chaves diferentes para listagem vs detalhes
let propertiesListCache: { data: Property[] | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};

const propertyDetailsCache: Map<string, { data: Property; timestamp: number }> = new Map();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const DETAILS_CACHE_DURATION = 15 * 60 * 1000; // 15 minutos (detalhes mudam menos)

/**
 * Helper para processar imagens do JSONB do Supabase
 */
const processImages = (images: any): string[] => {
  if (!images) {
    return [];
  }
  
  // Se já é um array
  if (Array.isArray(images)) {
    // Filtrar e validar imagens de forma otimizada
    const validImages: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (img && typeof img === 'string' && img.length > 0) {
        validImages.push(img);
      }
    }
    return validImages;
  }
  
  return [];
};

/**
 * Helper otimizado para mapear dados do banco (LISTAGEM - SEM IMAGES)
 */
const mapDatabasePropertyLight = (item: any): Property => {
  return {
    id: item.id,
    locationId: item.location_id,
    location: item.location_name || "",
    propertyIdentifier: item.property_identifier || "",
    complement: item.complement || "",
    description: item.description || "",
    rooms: item.rooms || 0,
    bathrooms: item.bathrooms || 0,
    area: item.area || 0,
    value: item.value || 0,
    hasGarage: item.has_garage || false,
    hasFurniture: item.has_furniture || false,
    acceptsPets: item.accepts_pets || false,
    status: item.status as "available" | "occupied" | "unavailable",
    images: [], // VAZIO para listagem! Carrega só no detalhe
    createdAt: item.created_at,
    address: "",
    features: [],
  };
};

/**
 * Helper para mapear dados completos (DETALHES - COM IMAGES)
 */
const mapDatabasePropertyFull = (item: any): Property => {
  return {
    id: item.id,
    locationId: item.location_id,
    location: item.location_name || "",
    propertyIdentifier: item.property_identifier || "",
    complement: item.complement || "",
    description: item.description || "",
    rooms: item.rooms || 0,
    bathrooms: item.bathrooms || 0,
    area: item.area || 0,
    value: item.value || 0,
    hasGarage: item.has_garage || false,
    hasFurniture: item.has_furniture || false,
    acceptsPets: item.accepts_pets || false,
    status: item.status as "available" | "occupied" | "unavailable",
    images: processImages(item.images),
    createdAt: item.created_at,
    address: "",
    features: [],
  };
};

/**
 * Invalidar cache quando houver mudanças
 */
const invalidateCache = () => {
  propertiesListCache = { data: null, timestamp: 0 };
  propertyDetailsCache.clear();
  console.log("🗑️ [propertyService] Cache invalidado");
};

/**
 * Buscar todos os imóveis - COM IMAGE_COUNT (ultra-rápido, sem timeout)
 */
export const getAll = async (): Promise<Property[]> => {
  const now = Date.now();

  // Verificar cache em memória primeiro
  if (propertiesListCache.data && (now - propertiesListCache.timestamp) < CACHE_DURATION) {
    console.log("✅ [propertyService.getAll] Usando cache em memória");
    return propertiesListCache.data;
  }

  try {
    console.log("🔄 [propertyService.getAll] Buscando do banco COM IMAGE_COUNT (ultra-rápido)...");

    // 🔥 QUERY COM IMAGE_COUNT - apenas um número INTEGER, não JSONB!
    const { data, error } = await supabase
      .from("properties")
      .select(`
        id,
        location_id,
        property_identifier,
        complement,
        description,
        rooms,
        bathrooms,
        area,
        value,
        status,
        has_garage,
        has_furniture,
        accepts_pets,
        image_count,
        created_at
      `) as any; // Type assertion temporária até regenerar tipos

    if (error) throw error;

    // Buscar nomes das locations em paralelo (query separada mais rápida)
    const locationIds = [...new Set((data || []).map((p: any) => p.location_id).filter(Boolean))] as string[];
    
    const { data: locationsData } = await supabase
      .from("locations")
      .select("id, name")
      .in("id", locationIds);

    const locationsMap = new Map((locationsData || []).map(loc => [loc.id, loc.name]));

    const properties = (data || []).map((item: any) => {
      // 🔥 Criar array vazio com length correto baseado em image_count
      const imageCount = item.image_count || 0;
      const images: string[] = imageCount > 0 ? new Array(imageCount).fill('') : [];
      
      return {
        id: item.id,
        locationId: item.location_id,
        location: locationsMap.get(item.location_id) || "",
        propertyIdentifier: item.property_identifier || "",
        complement: item.complement || "",
        description: item.description || "",
        rooms: item.rooms || 0,
        bathrooms: item.bathrooms || 0,
        area: item.area || 0,
        value: item.value || 0,
        hasGarage: item.has_garage || false,
        hasFurniture: item.has_furniture || false,
        acceptsPets: item.accepts_pets || false,
        status: item.status as "available" | "occupied" | "unavailable",
        images: images, // 🔥 Array vazio com length correto (ícone funciona!)
        createdAt: item.created_at,
        address: "",
        features: [],
      };
    });

    console.log(`✅ [propertyService.getAll] ${properties.length} imóveis retornados (COM contadores de imagens)`);

    // Atualizar cache em memória
    propertiesListCache = { data: properties, timestamp: now };

    return properties;
  } catch (error) {
    console.error("❌ Error fetching properties:", error);
    
    // Tentar usar cache expirado como fallback
    if (propertiesListCache.data) {
      console.log("⚠️ Usando cache expirado como fallback");
      return propertiesListCache.data;
    }

    throw error;
  }
};

/**
 * Buscar imóvel por ID - QUERY COMPLETA COM IMAGES (só quando abrir detalhes)
 */
export const getById = async (id: string): Promise<Property | null> => {
  const now = Date.now();

  // Verificar cache em memória primeiro
  const cached = propertyDetailsCache.get(id);
  if (cached && (now - cached.timestamp) < DETAILS_CACHE_DURATION) {
    console.log(`✅ [propertyService.getById] Usando cache para ${id}`);
    return cached.data;
  }

  try {
    console.log(`🔄 [propertyService.getById] Buscando ${id} COM IMAGENS...`);

    // 🔥 Query simples SEM JOIN para evitar timeout
    const { data, error } = await supabase
      .from("properties")
      .select(`
        id,
        location_id,
        property_identifier,
        complement,
        description,
        rooms,
        bathrooms,
        area,
        has_garage,
        value,
        status,
        images,
        has_furniture,
        accepts_pets,
        created_at,
        updated_at
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) return null;

    // Buscar location separadamente
    const { data: locationData } = await supabase
      .from("locations")
      .select("name")
      .eq("id", data.location_id)
      .single();

    const property = mapDatabasePropertyFull({
      ...data,
      location_name: locationData?.name,
    });

    // Atualizar cache em memória
    propertyDetailsCache.set(id, { data: property, timestamp: now });

    console.log(`✅ [propertyService.getById] Imóvel ${id} retornado (com ${property.images.length} imagens)`);

    return property;
  } catch (error) {
    console.error("Error fetching property:", error);
    
    // Tentar usar cache expirado
    const cached = propertyDetailsCache.get(id);
    if (cached) {
      console.log("⚠️ Usando cache expirado como fallback");
      return cached.data;
    }

    return null;
  }
};

/**
 * Criar novo imóvel
 */
export const create = async (property: Omit<Property, "id" | "createdAt" | "updatedAt">): Promise<Property> => {
  const { data, error } = await supabase
    .from("properties")
    .insert({
      location_id: property.locationId,
      property_identifier: property.propertyIdentifier || null,
      complement: property.complement || null,
      value: property.value || 0,
      status: property.status || "available",
      rooms: property.rooms || 0,
      bathrooms: property.bathrooms || 0,
      area: property.area || 0,
      has_garage: property.hasGarage || false,
      description: property.description || null,
      images: property.images || [],
      has_furniture: property.hasFurniture || false,
      accepts_pets: property.acceptsPets || false,
    })
    .select(`
      id,
      location_id,
      property_identifier,
      complement,
      description,
      rooms,
      bathrooms,
      area,
      has_garage,
      value,
      status,
      images,
      has_furniture,
      accepts_pets,
      created_at,
      updated_at,
      locations!properties_location_id_fkey(name)
    `)
    .single();

  if (error) throw error;

  // ✅ Registrar log de auditoria
  console.log("🔍 [propertyService.create] Registrando log de auditoria...");
  console.log("📋 Imóvel criado:", data);

  await logAudit({
    action_type: "create",
    entity_type: "property",
    entity_id: data.id,
    new_values: {
      location: data.locations?.name,
      complement: data.complement,
      value: data.value,
      status: data.status,
    },
  });

  console.log("✅ [propertyService.create] Log de auditoria registrado com sucesso");

  // Invalidate cache
  invalidateCache();

  return mapDatabasePropertyFull({
    ...data,
    location_name: data.locations?.name,
  });
};

/**
 * Atualizar imóvel existente
 */
export const update = async (id: string, property: Partial<Property>): Promise<Property> => {
  // ✅ CORREÇÃO: Buscar TODOS os campos antigos ANTES de atualizar
  const { data: oldData, error: oldError } = await supabase
    .from("properties")
    .select(`
      *,
      locations!properties_location_id_fkey(name)
    `)
    .eq("id", id)
    .single();

  if (oldError) {
    console.error("❌ [propertyService.update] Erro ao buscar valores antigos:", oldError);
  }

  const propertyData: any = {};

  if (property.locationId !== undefined) propertyData.location_id = property.locationId;
  if (property.propertyIdentifier !== undefined) propertyData.property_identifier = property.propertyIdentifier;
  if (property.complement !== undefined) propertyData.complement = property.complement;
  if (property.description !== undefined) propertyData.description = property.description;
  if (property.rooms !== undefined) propertyData.rooms = property.rooms;
  if (property.bathrooms !== undefined) propertyData.bathrooms = property.bathrooms;
  if (property.area !== undefined) propertyData.area = property.area;
  if (property.hasGarage !== undefined) propertyData.has_garage = property.hasGarage;
  if (property.value !== undefined) propertyData.value = property.value;
  if (property.status !== undefined) propertyData.status = property.status;
  if (property.images !== undefined) propertyData.images = property.images;
  if (property.hasFurniture !== undefined) propertyData.has_furniture = property.hasFurniture;
  if (property.acceptsPets !== undefined) propertyData.accepts_pets = property.acceptsPets;

  const { data, error } = await supabase
    .from("properties")
    .update(propertyData)
    .eq("id", id)
    .select(`
      id,
      location_id,
      property_identifier,
      complement,
      description,
      rooms,
      bathrooms,
      area,
      has_garage,
      value,
      status,
      images,
      has_furniture,
      accepts_pets,
      created_at,
      updated_at,
      locations!properties_location_id_fkey(name)
    `)
    .single();

  if (error) throw error;

  // ✅ CORREÇÃO: Registrar TODOS os campos que foram alterados
  if (oldData) {
    const oldValues: any = {};
    const newValues: any = {};

    // Helper para formatar valores
    const formatValue = (value: any, field: string): string => {
      if (value === null || value === undefined) return "-";
      
      if (field === "value") {
        // Formatar valor monetário
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);
      }
      
      if (typeof value === "boolean") {
        return value ? "Sim" : "Não";
      }
      
      if (typeof value === "number") {
        return value.toString();
      }
      
      return value.toString();
    };

    // Comparar e registrar apenas campos que mudaram
    const fieldsToCheck = [
      { old: oldData.locations?.name, new: data.locations?.name, key: "location", label: "Localização" },
      { old: oldData.complement, new: data.complement, key: "complement", label: "Complemento" },
      { old: oldData.description, new: data.description, key: "description", label: "Descrição" },
      { old: oldData.rooms, new: data.rooms, key: "rooms", label: "Quartos" },
      { old: oldData.bathrooms, new: data.bathrooms, key: "bathrooms", label: "Banheiros" },
      { old: oldData.area, new: data.area, key: "area", label: "Área" },
      { old: oldData.value, new: data.value, key: "value", label: "Valor" },
      { old: oldData.has_garage, new: data.has_garage, key: "has_garage", label: "Garagem" },
      { old: oldData.has_furniture, new: data.has_furniture, key: "has_furniture", label: "Mobiliado" },
      { old: oldData.accepts_pets, new: data.accepts_pets, key: "accepts_pets", label: "Aceita Pets" },
      { old: oldData.status, new: data.status, key: "status", label: "Status" },
    ];

    for (const field of fieldsToCheck) {
      // Comparar valores (considerar null == undefined como iguais)
      const oldVal = field.old ?? null;
      const newVal = field.new ?? null;
      
      if (oldVal !== newVal) {
        oldValues[field.key] = formatValue(field.old, field.key);
        newValues[field.key] = formatValue(field.new, field.key);
      }
    }

    console.log("🔍 [propertyService.update] Registrando log de auditoria...");
    console.log("📋 Valores antigos formatados:", oldValues);
    console.log("📋 Valores novos formatados:", newValues);

    // Apenas registrar se houve mudanças
    if (Object.keys(oldValues).length > 0) {
      await logAudit({
        action_type: "update",
        entity_type: "property",
        entity_id: id,
        old_values: oldValues,
        new_values: newValues,
      });

      console.log("✅ [propertyService.update] Log de auditoria registrado com sucesso");
    } else {
      console.log("ℹ️ [propertyService.update] Nenhuma mudança detectada, log não registrado");
    }
  }

  // Invalidate cache
  invalidateCache();

  return mapDatabasePropertyFull({
    ...data,
    location_name: data.locations?.name,
  });
};

/**
 * Deletar imóvel
 */
export const remove = async (id: string): Promise<void> => {
  // ✅ Buscar dados ANTES de deletar para log de auditoria
  const property = await getById(id);
  
  // 🔒 GATILHO DE SEGURANÇA: Verificar status antes de deletar
  if (property && property.status === "occupied") {
    throw new Error(
      "Não é possível deletar este imóvel porque ele possui uma locação ativa. " +
      "Encerre ou rescinda o contrato de locação antes de deletar o imóvel."
    );
  }

  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw error;

  // ✅ Registrar log de auditoria
  if (property) {
    await logAudit({
      action_type: "delete",
      entity_type: "property",
      entity_id: id,
      old_values: {
        location: property.location,
        complement: property.complement,
        value: property.value,
      },
    });
  }

  // Invalidate cache
  invalidateCache();
};

/**
 * Buscar imóveis disponíveis - QUERY OTIMIZADA (SEM IMAGES)
 */
export async function getAvailable(): Promise<Property[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(`
      id,
      location_id,
      property_identifier,
      complement,
      value,
      status,
      locations!properties_location_id_fkey(id, name)
    `)
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((property: any) => ({
    id: property.id,
    locationId: property.location_id,
    location: property.locations?.name || "",
    propertyIdentifier: property.property_identifier || "",
    complement: property.complement || "",
    value: property.value || 0,
    status: property.status,
    images: [], // SEM IMAGES para listagem rápida
  })) as Property[];
}

/**
 * PÁGINA PÚBLICA - QUERY COM IMAGE_COUNT (ultra-rápido, sem timeout)
 */
export const getPublicProperties = async (): Promise<Property[]> => {
  try {
    console.log("🔄 [getPublicProperties] Iniciando busca de imóveis disponíveis...");
    console.log("🔍 [getPublicProperties] Query: status = 'available' COM IMAGE_COUNT (sem JSONB)");

    // 🔥 Query COM IMAGE_COUNT - apenas um número, SEM JSONB de images!
    const { data, error } = await supabase
      .from("properties")
      .select(`
        id,
        location_id,
        property_identifier,
        complement,
        description,
        rooms,
        bathrooms,
        area,
        value,
        status,
        has_garage,
        has_furniture,
        accepts_pets,
        image_count,
        created_at
      `)
      .eq("status", "available")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ [getPublicProperties] Erro na query principal:", error);
      console.error("❌ Código do erro:", error.code);
      console.error("❌ Mensagem:", error.message);
      console.error("❌ Detalhes:", error.details);
      throw error;
    }

    console.log(`📊 [getPublicProperties] Query retornou ${data?.length || 0} imóveis`);

    if (!data || data.length === 0) {
      console.log("⚠️ [getPublicProperties] Nenhum imóvel com status 'available' encontrado no banco");
      console.log("💡 Verifique se os imóveis estão realmente com status = 'available' no banco de dados");
      return [];
    }

    console.log("✅ [getPublicProperties] Imóveis encontrados:");
    data.forEach((prop: any, idx) => {
      const imageCount = prop.image_count || 0;
      console.log(`  ${idx + 1}. ID: ${prop.id} | Location: ${prop.location_id} | Status: ${prop.status} | Images: ${imageCount}`);
    });

    // Buscar locations em query separada
    const locationIds = [...new Set(data.map((p: any) => p.location_id).filter(Boolean))];
    
    console.log(`🔍 [getPublicProperties] Buscando ${locationIds.length} localizações...`);

    if (locationIds.length === 0) {
      console.log("⚠️ [getPublicProperties] Nenhuma localização vinculada aos imóveis");
      return data.map((item: any) => {
        // 🔥 Criar array vazio com length correto baseado em image_count
        const imageCount = item.image_count || 0;
        const images: string[] = imageCount > 0 ? new Array(imageCount).fill('') : [];
        
        return {
          id: item.id,
          locationId: item.location_id,
          location: "",
          city: "",
          neighborhood: "",
          state: "",
          address: "",
          propertyIdentifier: item.property_identifier || "",
          complement: item.complement || "",
          description: item.description || "",
          rooms: item.rooms || 0,
          bathrooms: item.bathrooms || 0,
          area: item.area || 0,
          value: item.value || 0,
          hasGarage: item.has_garage || false,
          hasFurniture: item.has_furniture || false,
          acceptsPets: item.accepts_pets || false,
          status: item.status as "available" | "occupied" | "unavailable",
          images: images, // Array vazio com length correto
          createdAt: item.created_at,
          features: [],
        };
      });
    }

    // Query de locations
    const { data: locationsData, error: locationsError } = await supabase
      .from("locations")
      .select("id, name, city, neighborhood, state, street, number")
      .in("id", locationIds);

    if (locationsError) {
      console.error("❌ [getPublicProperties] Erro ao buscar locations:", locationsError);
      console.error("❌ Código do erro:", locationsError.code);
      console.error("❌ Mensagem:", locationsError.message);
      throw locationsError;
    }

    console.log(`✅ [getPublicProperties] ${locationsData?.length || 0} localizações carregadas`);

    const locationsMap = new Map(
      (locationsData || []).map(loc => [loc.id, loc])
    );

    const properties = data.map((item: any) => {
      const location = locationsMap.get(item.location_id) as any;
      
      // Montar endereço
      const addressParts = [];
      if (location?.street) addressParts.push(location.street);
      if (location?.number) addressParts.push(location.number);
      const address = addressParts.join(", ");

      // 🔥 Criar array vazio com length correto baseado em image_count
      const imageCount = item.image_count || 0;
      const images: string[] = imageCount > 0 ? new Array(imageCount).fill('') : [];

      return {
        id: item.id,
        locationId: item.location_id,
        location: location?.name || "",
        city: location?.city || "",
        neighborhood: location?.neighborhood || "",
        state: location?.state || "",
        address: address,
        propertyIdentifier: item.property_identifier || "",
        complement: item.complement || "",
        description: item.description || "",
        rooms: item.rooms || 0,
        bathrooms: item.bathrooms || 0,
        area: item.area || 0,
        value: item.value || 0,
        hasGarage: item.has_garage || false,
        hasFurniture: item.has_furniture || false,
        acceptsPets: item.accepts_pets || false,
        status: item.status as "available" | "occupied" | "unavailable",
        images: images, // Array vazio com length correto (ícone funciona!)
        createdAt: item.created_at,
        features: [],
      } as Property;
    });

    console.log(`✅ [getPublicProperties] SUCESSO! ${properties.length} imóveis processados e prontos para exibição`);

    return properties;

  } catch (error: any) {
    console.error("❌ [getPublicProperties] ERRO CRÍTICO:", error);
    console.error("❌ Stack trace:", error.stack);
    
    // 🔥 IMPORTANTE: NÃO retornar array vazio - lançar o erro para o hook tratar
    throw new Error(`Erro ao carregar imóveis: ${error.message || 'Erro desconhecido'}`);
  }
};