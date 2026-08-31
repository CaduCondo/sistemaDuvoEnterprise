import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { exigirAdmin } from "@/lib/apiAuth";

/**
 * Desbloquear usuário (limpar o bloqueio de 30min por 3 senhas erradas) —
 * agora no servidor, mesmo motivo das outras rotas em src/pages/api/users/.
 * Só admin.
 */

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CHAVE_SECRETA = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  if (!URL_SUPABASE || !CHAVE_SECRETA) {
    console.error("[users/[id]/unblock] Servidor sem NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Servidor mal configurado" });
  }

  const sessao = exigirAdmin(req, res);
  if (!sessao) return;

  const id = String(req.query.id ?? "");
  if (!id) {
    return res.status(400).json({ error: "Id do usuário não informado" });
  }

  const supabase = createClient(URL_SUPABASE, CHAVE_SECRETA, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });

  const { error } = await supabase
    .from("system_users")
    .update({ blocked_until: null, login_attempts: 0 })
    .eq("id", id);

  if (error) {
    console.error("[users/[id]/unblock] Erro ao desbloquear:", error.message);
    return res.status(500).json({ error: "Não foi possível desbloquear o usuário." });
  }

  return res.status(200).json({ success: true });
}
