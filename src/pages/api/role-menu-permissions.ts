import { NextApiRequest, NextApiResponse } from "next";
import { criarClienteSupabaseAnon } from "@/lib/supabaseServidor";
import { exigirSessao } from "@/lib/apiAuth";

// SESSAO EXIGIDA (issue #94) -- esta rota tambem nao tem caller dentro do
// repo hoje (a tela le as permissoes direto do Supabase via
// src/services/roleMenuPermissionService.ts), mas continua publicada e
// devolvia o mapa completo de permissoes por perfil para qualquer um, sem
// login. Ver issue #94 para o buraco maior que esta correcao nao fecha.

// Cliente Supabase server-side (com timeout de rede embutido -- ver #66)
const supabase = criarClienteSupabaseAnon({
  headers: { "Content-Type": "application/json" },
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessao = exigirSessao(req, res);
  if (!sessao) return;

  const startTime = Date.now();

  try {
    console.log("🔍 [API] Fetching role menu permissions...");

    // Query otimizada com timeout
    const { data: permissions, error } = await supabase
      .from("role_menu_permissions")
      .select("*")
      .order("role", { ascending: true })
      .order("menu_item", { ascending: true });

    if (error) {
      console.error("❌ [API] Supabase error:", error);
      
      // Retornar erro específico para debug
      return res.status(500).json({
        error: "Database query failed",
        message: error.message,
        details: error.details || null,
        hint: error.hint || null,
      });
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [API] Found ${permissions?.length || 0} permissions in ${duration}ms`);

    return res.status(200).json({
      permissions: permissions || [],
      count: permissions?.length || 0,
      duration_ms: duration,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error("❌ [API] Error fetching role menu permissions:", error);
    
    return res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Unknown error occurred",
      duration_ms: duration,
    });
  }
}