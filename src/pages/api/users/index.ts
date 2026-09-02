import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { exigirAdmin } from "@/lib/apiAuth";
import { gerarHashDeSenha } from "@/lib/passwordHash";

/**
 * Criar usuário — agora no servidor (31/ago/2026).
 *
 * Antes esta gravação ia direto do navegador para `system_users` com a
 * chave pública (anon). A tabela tem RLS ligado com regras que exigem
 * `auth.uid()`, e este sistema nunca cria sessão no Supabase (login
 * próprio) -- então `auth.uid()` é sempre nulo e a trava barra sempre.
 * Resultado: criar usuário simplesmente não funcionava em produção.
 *
 * Esta rota usa a chave secreta (nunca sai do servidor) para furar o RLS,
 * e por isso só aceita o pedido de quem já provou ser admin -- ver
 * src/lib/apiAuth.ts.
 */

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CHAVE_SECRETA = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Campos que podem sair daqui. `password_hash` NUNCA entra nesta lista. */
const CAMPOS_PUBLICOS =
  "id, email, name, username, role, active, phone, cpf, rg, photo, theme, created_at, requires_password_change, temporary_password";

function servidorSupabase() {
  return createClient(URL_SUPABASE, CHAVE_SECRETA, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  if (!URL_SUPABASE || !CHAVE_SECRETA) {
    console.error("[users/index] Servidor sem NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Servidor mal configurado" });
  }

  const sessao = exigirAdmin(req, res);
  if (!sessao) return;

  const { name, email, username, role, password, temporary_password } = req.body ?? {};

  if (!name || !email || !role || !password) {
    return res.status(400).json({ error: "Preencha nome, e-mail, perfil e senha" });
  }

  const supabase = servidorSupabase();

  try {
    // Confere duplicidade de e-mail e (se veio) de nome de usuário antes de
    // tentar inserir -- a tabela também tem constraint única, mas assim a
    // mensagem de erro fica clara em vez de um "duplicate key" cru.
    const { data: emailExistente } = await supabase
      .from("system_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (emailExistente) {
      return res.status(409).json({ error: "Já existe um usuário com este e-mail." });
    }

    if (username) {
      const { data: usernameExistente } = await supabase
        .from("system_users")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (usernameExistente) {
        return res.status(409).json({ error: "Já existe um usuário com este nome de usuário." });
      }
    }

    const { data, error } = await supabase
      .from("system_users")
      .insert([
        {
          name,
          email,
          ...(username ? { username } : {}),
          role,
          password_hash: gerarHashDeSenha(password),
          temporary_password: temporary_password ?? false,
          requires_password_change: temporary_password ?? false,
        },
      ])
      .select(CAMPOS_PUBLICOS)
      .single();

    if (error) {
      console.error("[users/index] Erro ao criar usuário:", error.message);
      return res.status(500).json({ error: "Não foi possível criar o usuário." });
    }

    return res.status(201).json({ user: data });
  } catch (erro) {
    console.error("[users/index] Erro inesperado:", erro);
    return res.status(500).json({ error: "Erro inesperado ao criar usuário" });
  }
}
