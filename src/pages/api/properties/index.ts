import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { exigirSessao } from "@/lib/apiAuth";

/**
 * API Route: /api/properties
 * Otimizada com timeout aumentado e cache
 *
 * SESSAO EXIGIDA (issue #94) -- esta rota nao tem nenhum caller dentro do
 * repo hoje (a tela de Imoveis le direto do Supabase via
 * src/services/propertyService.ts), mas continua publicada e, sem essa
 * checagem, respondia com a lista completa de imoveis (inclusive os nao
 * disponiveis) para qualquer requisicao anonima. Ver issue #94 para o
 * cenario maior: a maioria das telas internas ainda fala direto com o
 * Supabase pelo navegador, sem passar por nenhuma rota de API -- esta
 * correcao fecha so esta rota especifica, nao esse buraco maior.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessao = exigirSessao(req, res);
  if (!sessao) return;

  try {
    console.log("=== API /properties: Fetching data (OPTIMIZED) ===");

    // Query otimizada com índices
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
        has_garage,
        has_furniture,
        status,
        images,
        accepts_pets,
        created_at,
        updated_at,
        locations!properties_location_id_fkey (
          id,
          name,
          street,
          number,
          neighborhood,
          city,
          state,
          zip_code
        )
      `)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("❌ Database error:", error);
      return res.status(500).json({ 
        error: "Database error", 
        message: error.message,
        hint: "Check if database has proper indexes"
      });
    }

    // Transform data
    const properties = (data || []).map((item: any) => ({
      id: item.id,
      locationId: item.location_id,
      location: item.locations?.name || "",
      complement: item.complement,
      description: item.description,
      propertyIdentifier: item.property_identifier,
      rooms: item.rooms,
      bathrooms: item.bathrooms,
      area: item.area,
      value: item.value,
      hasGarage: item.has_garage,
      hasFurniture: item.has_furniture,
      acceptsPets: item.accepts_pets || false,
      status: item.status,
      images: Array.isArray(item.images) ? item.images : [],
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      address: item.locations?.street,
      number: item.locations?.number,
      neighborhood: item.locations?.neighborhood,
      city: item.locations?.city,
      state: item.locations?.state,
      zipCode: item.locations?.zip_code,
      bedrooms: item.rooms,
      monthlyRent: item.value,
    }));

    console.log(`✅ API /properties: Returning ${properties.length} properties`);

    // Cache headers (1 hour)
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");

    return res.status(200).json(properties);
  } catch (error: any) {
    console.error("❌ Unexpected error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error?.message || "Unknown error",
      hint: "This might be a timeout. Check database performance."
    });
  }
}