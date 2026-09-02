import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { gerarHashDeSenha } from "@/lib/passwordHash";

/**
 * "Esqueci minha senha" — agora no servidor (31/ago/2026).
 *
 * O QUE MUDOU E POR QUÊ
 *
 * Isto era feito inteiro no navegador (src/components/public/PublicHeader.tsx),
 * numa tela PÚBLICA sem login nenhum: gerava a senha temporária ali mesmo e
 * gravava direto em `system_users` com a chave pública (anon). Hoje o RLS
 * barra essa gravação -- é por isso que "esqueci minha senha" está quebrado
 * -- mas o desenho em si já era arriscado: se o RLS um dia for destravado
 * sem essa rota existir, qualquer pessoa na internet, sem precisar logar,
 * poderia resetar a senha de qualquer usuário só sabendo o e-mail dele.
 *
 * Esta rota resolve os dois problemas de uma vez: gera a senha e grava com
 * a chave secreta (nunca sai do servidor, furando o RLS do jeito certo), e
 * SEMPRE responde a mesma mensagem de sucesso, exista ou não aquele e-mail
 * no sistema -- para não dar para alguém de fora descobrir, por tentativa e
 * erro, quais e-mails têm conta aqui. Mesmo cuidado que login.ts já toma
 * com "usuário não existe" vs. "senha errada".
 */

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CHAVE_SECRETA = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function gerarSenhaTemporaria(): string {
  const maiusculas = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const minusculas = "abcdefghijklmnopqrstuvwxyz";
  const numeros = "0123456789";
  const especiais = "!@#$%&*";

  let senha = "";
  senha += maiusculas[Math.floor(Math.random() * maiusculas.length)];
  senha += minusculas[Math.floor(Math.random() * minusculas.length)];
  senha += numeros[Math.floor(Math.random() * numeros.length)];
  senha += especiais[Math.floor(Math.random() * especiais.length)];

  const todos = maiusculas + minusculas + numeros + especiais;
  for (let i = 4; i < 10; i++) {
    senha += todos[Math.floor(Math.random() * todos.length)];
  }

  return senha
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/** Resposta idêntica exista ou não o e-mail -- ver comentário no topo do arquivo. */
const RESPOSTA_GENERICA = {
  success: true,
  message: "Se este e-mail estiver cadastrado, enviamos uma senha temporária para ele.",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  if (!URL_SUPABASE || !CHAVE_SECRETA) {
    console.error("[auth/forgot-password] Servidor sem NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Servidor mal configurado" });
  }

  const email = String(req.body?.email ?? "").trim();

  if (!email) {
    return res.status(400).json({ error: "Informe o e-mail" });
  }

  const supabase = createClient(URL_SUPABASE, CHAVE_SECRETA, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });

  try {
    const { data: usuario, error: erroBusca } = await supabase
      .from("system_users")
      .select("id, name, email")
      .eq("email", email)
      .eq("active", true)
      .maybeSingle();

    if (erroBusca) {
      console.error("[auth/forgot-password] Erro ao buscar usuário:", erroBusca.message);
      // Mesmo em erro de busca, não entrega se o e-mail existe ou não.
      return res.status(200).json(RESPOSTA_GENERICA);
    }

    // E-mail não cadastrado (ou inativo): responde igual, não faz nada.
    if (!usuario) {
      return res.status(200).json(RESPOSTA_GENERICA);
    }

    const senhaTemporaria = gerarSenhaTemporaria();

    const { error: erroAtualizar } = await supabase
      .from("system_users")
      .update({
        password_hash: gerarHashDeSenha(senhaTemporaria),
        requires_password_change: true,
        temporary_password: true,
        login_attempts: 0,
        blocked_until: null,
      })
      .eq("id", usuario.id);

    if (erroAtualizar) {
      console.error("[auth/forgot-password] Erro ao resetar senha:", erroAtualizar.message);
      return res.status(200).json(RESPOSTA_GENERICA);
    }

    // Envia o e-mail reaproveitando a rota que já faz isso (mesmo layout
    // usado quando um admin reseta a senha de alguém pela tela).
    const protocolo = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "localhost:3000";
    const baseUrl = host.includes("localhost") || host.includes("127.0.0.1")
      ? `http://${host}`
      : `https://${host}`;

    try {
      await fetch(`${baseUrl}/api/send-password-recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: usuario.email,
          userId: usuario.id,
          name: usuario.name,
          temporaryPassword: senhaTemporaria,
          isReset: true,
          isAdminReset: false,
        }),
      });
    } catch (erroEmail) {
      // A senha já foi trocada no banco; um e-mail que falhou não deve
      // reverter isso nem vazar para quem chamou se o e-mail existe.
      console.error("[auth/forgot-password] Erro ao enviar e-mail:", erroEmail);
    }

    return res.status(200).json(RESPOSTA_GENERICA);
  } catch (erro) {
    console.error("[auth/forgot-password] Erro inesperado:", erro);
    return res.status(200).json(RESPOSTA_GENERICA);
  }
}
