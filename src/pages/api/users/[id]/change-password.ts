import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { exigirDonoOuAdmin } from "@/lib/apiAuth";
import { gerarHashDeSenha } from "@/lib/passwordHash";

/**
 * Trocar a própria senha (ou, se admin, a de outro usuário) — agora no
 * servidor, mesmo motivo das outras rotas em src/pages/api/users/.
 *
 * Usada pela tela de "por segurança, crie uma nova senha" que aparece no
 * primeiro login com senha temporária (PasswordChangeDialog.tsx). Quem
 * chama já tem uma sessão válida nesse ponto -- o login aconteceu antes,
 * só a troca de senha é que ficava travada pelo RLS.
 */

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CHAVE_SECRETA = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  if (!URL_SUPABASE || !CHAVE_SECRETA) {
    console.error("[users/[id]/change-password] Servidor sem NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Servidor mal configurado" });
  }

  const id = String(req.query.id ?? "");
  if (!id) {
    return res.status(400).json({ error: "Id do usuário não informado" });
  }

  const sessao = exigirDonoOuAdmin(req, res, id);
  if (!sessao) return;

  const { newPassword } = req.body ?? {};

  if (!newPassword || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Informe a nova senha" });
  }

  // Mesmos requisitos já cobrados na tela (PasswordChangeDialog.tsx) --
  // conferidos de novo aqui porque quem chama a rota não precisa ser
  // necessariamente o navegador com aquela tela.
  if (newPassword.length < 8 || newPassword.length > 12) {
    return res.status(400).json({ error: "A senha deve ter entre 8 e 12 caracteres" });
  }
  if (!/[A-Z]/.test(newPassword)) {
    return res.status(400).json({ error: "A senha deve conter pelo menos uma letra maiúscula" });
  }
  if (!/[a-z]/.test(newPassword)) {
    return res.status(400).json({ error: "A senha deve conter pelo menos uma letra minúscula" });
  }
  if (!/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: "A senha deve conter pelo menos um número" });
  }

  const supabase = createClient(URL_SUPABASE, CHAVE_SECRETA, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });

  const { error } = await supabase
    .from("system_users")
    .update({
      password_hash: gerarHashDeSenha(newPassword),
      requires_password_change: false,
      temporary_password: false,
    })
    .eq("id", id);

  if (error) {
    console.error("[users/[id]/change-password] Erro ao trocar senha:", error.message);
    return res.status(500).json({ error: "Não foi possível trocar a senha." });
  }

  return res.status(200).json({ success: true });
}
