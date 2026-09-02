import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { exigirAdmin } from "@/lib/apiAuth";
import { gerarHashDeSenha } from "@/lib/passwordHash";

/**
 * Admin reseta a senha de um usuário para o padrão -- agora no servidor,
 * mesmo motivo das outras rotas em src/pages/api/users/. Só admin.
 *
 * Diferente da rota pública src/pages/api/auth/forgot-password.ts (o
 * "esqueci minha senha" que o próprio usuário pede, sem estar logado):
 * esta é o admin resetando a senha de alguém pela tela de usuários.
 *
 * Melhoria em relação ao comportamento antigo: agora marca
 * `requires_password_change`, então quem receber essa senha padrão é
 * obrigado a trocar por uma própria no primeiro login -- antes não era.
 */

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CHAVE_SECRETA = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SENHA_PADRAO = "mudar123";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  if (!URL_SUPABASE || !CHAVE_SECRETA) {
    console.error("[users/[id]/reset-password] Servidor sem NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
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
    .update({
      password_hash: gerarHashDeSenha(SENHA_PADRAO),
      temporary_password: true,
      requires_password_change: true,
      login_attempts: 0,
      blocked_until: null,
    })
    .eq("id", id);

  if (error) {
    console.error("[users/[id]/reset-password] Erro ao resetar senha:", error.message);
    return res.status(500).json({ error: "Não foi possível resetar a senha." });
  }

  return res.status(200).json({ success: true, temporaryPassword: SENHA_PADRAO });
}
