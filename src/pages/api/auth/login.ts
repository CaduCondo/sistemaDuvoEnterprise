import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { assinarSessao } from "@/lib/sessionToken";
import { senhaConfere } from "@/lib/passwordHash";

/**
 * LOGIN — agora acontece AQUI, no servidor.
 *
 * O QUE MUDOU E POR QUÊ (30/ago/2026)
 *
 * Até aqui o login rodava no navegador: a tela baixava a linha inteira do
 * usuário -- senha inclusive -- e comparava ali. Isso tinha três problemas
 * sérios, todos reais em produção:
 *
 *   1. A senha viajava até o navegador de quem tentava entrar, e chegava a
 *      ser impressa no console.
 *   2. A contagem de tentativas erradas era gravada pelo navegador. Como a
 *      trava do banco (RLS) barrava essa gravação e o erro era engolido em
 *      silêncio, o BLOQUEIO POR 3 SENHAS ERRADAS ESTAVA MORTO: dava para
 *      tentar senha infinitas vezes. Aqui a gravação usa a chave secreta do
 *      servidor e volta a funcionar.
 *   3. A sessão era um objeto solto no navegador, sem nada que provasse quem
 *      era o usuário. Agora esta rota devolve um token assinado (ver
 *      src/lib/sessionToken.ts), que é o que as rotas de gravação vão exigir.
 *
 * ETAPA 3 (02/set/2026): a senha agora é conferida com hash bcrypt (ver
 * src/lib/passwordHash.ts), não mais com `===` direto. Contas que ainda não
 * passaram pela migration de hash continuam funcionando -- o helper aceita
 * os dois formatos enquanto a migration não roda nos dois bancos.
 */

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CHAVE_SECRETA = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DURACAO_DA_SESSAO_MS = 24 * 60 * 60 * 1000; // 24 horas, como era antes
const TENTATIVAS_ATE_BLOQUEAR = 3;
const MINUTOS_DE_BLOQUEIO = 30;

/** Campos que podem sair daqui. `password_hash` NUNCA entra nesta lista. */
const CAMPOS_PUBLICOS =
  "id, email, name, username, role, photo, phone, cpf, rg, theme";

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
    console.error("[login] Servidor sem NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Servidor mal configurado" });
  }

  const identificador = String(req.body?.identificador ?? "").trim();
  const senha = String(req.body?.senha ?? "");

  if (!identificador || !senha) {
    return res.status(400).json({ error: "Informe usuário e senha" });
  }

  const supabase = servidorSupabase();

  try {
    // 1. Acha o usuário por nome de usuário ou por e-mail, entre os ativos.
    let { data: encontrados, error: erroBusca } = await supabase
      .from("system_users")
      .select("*")
      .eq("username", identificador)
      .eq("active", true);

    if (!erroBusca && (!encontrados || encontrados.length === 0)) {
      const porEmail = await supabase
        .from("system_users")
        .select("*")
        .eq("email", identificador)
        .eq("active", true);

      encontrados = porEmail.data;
      erroBusca = porEmail.error;
    }

    if (erroBusca) {
      console.error("[login] Erro ao buscar usuário:", erroBusca.message);
      return res.status(500).json({ error: "Erro ao buscar usuário" });
    }

    const usuario: any = encontrados?.[0];

    // Mensagem igual à de senha errada, de propósito: dizer "usuário não
    // existe" entrega quais logins são válidos para quem estiver tentando.
    if (!usuario) {
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }

    // 2. Está bloqueado?
    if (usuario.blocked_until && new Date(usuario.blocked_until) > new Date()) {
      const faltam = Math.ceil(
        (new Date(usuario.blocked_until).getTime() - Date.now()) / 60000
      );
      return res.status(423).json({
        error: `Conta bloqueada temporariamente por muitas tentativas falhas. Tente novamente em ${faltam} minutos.`,
      });
    }

    // 3. Confere a senha (hash bcrypt hoje; texto puro só se a conta ainda
    // não passou pela migration -- ver src/lib/passwordHash.ts).
    const senhaEstaCorreta = senhaConfere(senha, usuario.password_hash);

    if (!senhaEstaCorreta) {
      const tentativas = (usuario.login_attempts || 0) + 1;
      const alteracoes: Record<string, any> = { login_attempts: tentativas };

      // ⚠️ A MENSAGEM NÃO PODE CONTAR TENTATIVAS.
      //
      // A primeira versão desta rota dizia "você tem mais 2 tentativa(s)
      // antes do bloqueio" -- simpático, e um vazamento: só um usuário que
      // EXISTE tem contagem. Quem estivesse adivinhando logins separava os
      // válidos dos inválidos só pela diferença de texto. O cenário
      // "Senha errada não diz se o usuário existe" pegou isso antes de ir
      // para produção.
      //
      // Então: senha errada e usuário inexistente respondem exatamente igual.
      let mensagem = "Usuário ou senha inválidos";

      if (tentativas >= TENTATIVAS_ATE_BLOQUEAR) {
        alteracoes.blocked_until = new Date(
          Date.now() + MINUTOS_DE_BLOQUEIO * 60000
        ).toISOString();

        // Esta, sim, é específica -- e de propósito. Ela só aparece para quem
        // já errou três vezes, e o dono da conta precisa entender por que
        // parou de conseguir entrar. É a troca consciente entre discrição e
        // uma pessoa de verdade travada do lado de fora sem explicação.
        mensagem = `Muitas tentativas falhas. Conta bloqueada por ${MINUTOS_DE_BLOQUEIO} minutos.`;
      }

      // Esta gravação é a que estava morta antes: o navegador não tinha
      // permissão e o erro era engolido. Aqui ela vale.
      const { error: erroAoContar } = await supabase
        .from("system_users")
        .update(alteracoes)
        .eq("id", usuario.id);

      if (erroAoContar) {
        console.error("[login] Falha ao contar tentativa:", erroAoContar.message);
      }

      return res.status(401).json({ error: mensagem });
    }

    // 4. Acertou: zera a contagem, se houver o que zerar.
    if ((usuario.login_attempts || 0) > 0 || usuario.blocked_until) {
      await supabase
        .from("system_users")
        .update({ login_attempts: 0, blocked_until: null })
        .eq("id", usuario.id);
    }

    // 5. Devolve o usuário SEM a senha, mais o token assinado.
    const { data: publico } = await supabase
      .from("system_users")
      .select(CAMPOS_PUBLICOS)
      .eq("id", usuario.id)
      .single();

    const expiresAt = Date.now() + DURACAO_DA_SESSAO_MS;

    return res.status(200).json({
      user: publico,
      token: assinarSessao({ userId: usuario.id, role: usuario.role, expiresAt }),
      expiresAt,
      requiresPasswordChange: Boolean(usuario.requires_password_change),
    });
  } catch (erro) {
    console.error("[login] Erro inesperado:", erro);
    return res.status(500).json({ error: "Erro inesperado ao entrar" });
  }
}
