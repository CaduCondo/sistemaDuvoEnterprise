import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { exigirAdmin, exigirDonoOuAdmin } from "@/lib/apiAuth";

/**
 * Editar/excluir usuário — agora no servidor (31/ago/2026).
 * Mesmo motivo de src/pages/api/users/index.ts: RLS em `system_users`
 * exige `auth.uid()`, que este sistema nunca tem, e barrava toda gravação.
 *
 * PATCH: o próprio usuário pode editar o próprio perfil (nome, e-mail,
 * telefone, cpf, rg, foto); só um admin pode mudar `role` ou `status`
 * (ativar/desativar) -- inclusive o próprio, para não abrir brecha de
 * alguém se auto-promover.
 * DELETE: só admin.
 */

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CHAVE_SECRETA = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const CAMPOS_PUBLICOS =
  "id, email, name, username, role, active, phone, cpf, rg, photo, theme, created_at, requires_password_change, temporary_password";

function servidorSupabase() {
  return createClient(URL_SUPABASE, CHAVE_SECRETA, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!URL_SUPABASE || !CHAVE_SECRETA) {
    console.error("[users/[id]] Servidor sem NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Servidor mal configurado" });
  }

  const id = String(req.query.id ?? "");
  if (!id) {
    return res.status(400).json({ error: "Id do usuário não informado" });
  }

  const supabase = servidorSupabase();

  if (req.method === "PATCH") {
    const { name, email, phone, cpf, rg, photo, role, status } = req.body ?? {};

    const mudaRoleOuStatus = role !== undefined || status !== undefined;

    // Editar o próprio perfil: liberado. Mudar role/status: só admin, mesmo
    // que seja o próprio usuário mudando o próprio -- ver comentário acima.
    const sessao = mudaRoleOuStatus
      ? exigirAdmin(req, res)
      : exigirDonoOuAdmin(req, res, id);
    if (!sessao) return;

    if (email) {
      const { data: emailDeOutro } = await supabase
        .from("system_users")
        .select("id")
        .eq("email", email)
        .neq("id", id)
        .maybeSingle();

      if (emailDeOutro) {
        return res.status(409).json({ error: "Já existe outro usuário com este e-mail." });
      }
    }

    const atualizacoes: Record<string, any> = {};
    if (name !== undefined) atualizacoes.name = name;
    if (email !== undefined) atualizacoes.email = email;
    if (phone !== undefined) atualizacoes.phone = phone;
    if (cpf !== undefined) atualizacoes.cpf = cpf;
    if (rg !== undefined) atualizacoes.rg = rg;
    if (photo !== undefined) atualizacoes.photo = photo;
    if (role !== undefined) atualizacoes.role = role;
    if (status !== undefined) atualizacoes.active = status === "active" || status === "ativo";

    if (Object.keys(atualizacoes).length === 0) {
      return res.status(400).json({ error: "Nada para atualizar" });
    }

    const { data, error } = await supabase
      .from("system_users")
      .update(atualizacoes)
      .eq("id", id)
      .select(CAMPOS_PUBLICOS)
      .single();

    if (error) {
      console.error("[users/[id]] Erro ao atualizar usuário:", error.message);
      return res.status(500).json({ error: "Não foi possível atualizar o usuário." });
    }

    return res.status(200).json({ user: data });
  }

  if (req.method === "DELETE") {
    const sessao = exigirAdmin(req, res);
    if (!sessao) return;

    const { error } = await supabase.from("system_users").delete().eq("id", id);

    if (error) {
      console.error("[users/[id]] Erro ao excluir usuário:", error.message);
      return res.status(500).json({ error: "Não foi possível excluir o usuário." });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Método não permitido" });
}
