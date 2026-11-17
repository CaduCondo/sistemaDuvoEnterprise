import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { criarClienteSupabaseAdmin } from "./supabaseServidor";
import { verificarSessao, tokenDoCabecalho, type SessaoAssinada } from "./sessionToken";

/**
 * Ajuda as rotas de servidor a saber quem está chamando.
 *
 * POR QUE ISTO EXISTE
 *
 * As rotas que gravam em `system_users` (criar/editar/excluir usuário,
 * desbloquear, trocar senha) usam a chave secreta do Supabase para furar o
 * RLS -- ver o cabeçalho de src/pages/api/auth/login.ts. Uma rota assim só é
 * segura se ela mesma souber dizer quem está pedindo a gravação; sem isso,
 * qualquer pessoa que descobrisse a URL poderia criar um admin para si.
 *
 * `sessaoDaRequisicao` lê e confere o token assinado (ver sessionToken.ts).
 * `exigirSessao`/`exigirAdmin` fazem o mesmo e já respondem 401/403 se não
 * houver sessão válida -- assim cada rota só precisa checar `if (!sessao)
 * return;` e seguir.
 */

export function sessaoDaRequisicao(req: NextApiRequest): SessaoAssinada | null {
  const token = tokenDoCabecalho(req.headers.authorization);
  return verificarSessao(token);
}

/**
 * Exige uma sessão válida (qualquer perfil). Responde 401 e devolve null se não houver.
 *
 * Além de conferir o token, olha o cadastro da pessoa NA HORA: se ela foi
 * desativada, ou se o perfil dela mudou (ex.: deixou de ser administrador),
 * isso vale já na próxima chamada -- sem esperar as 24h do token vencerem.
 */
export async function exigirSessao(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<SessaoAssinada | null> {
  const sessao = sessaoDaRequisicao(req);
  if (!sessao) {
    res.status(401).json({ error: "Sessão inválida ou expirada. Faça login novamente." });
    return null;
  }

  const { data, error } = await criarClienteSupabaseAdmin()
    .from("system_users")
    .select("active, role")
    .eq("id", sessao.userId)
    .maybeSingle();

  if (error) {
    console.error("[apiAuth] Erro ao conferir o usuário da sessão:", error.message);
    res.status(503).json({ error: "Não foi possível confirmar o seu acesso agora. Tente de novo." });
    return null;
  }
  if (!data || data.active === false) {
    res.status(401).json({ error: "Sessão inválida ou expirada. Faça login novamente." });
    return null;
  }

  // O perfil que vale é o do cadastro de hoje, não o que estava no token.
  return { ...sessao, role: data.role };
}

/** Como exigirSessao, mas também exige perfil admin. Responde 403 se não for. */
export async function exigirAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<SessaoAssinada | null> {
  const sessao = await exigirSessao(req, res);
  if (!sessao) return null;

  if (sessao.role !== "admin") {
    res.status(403).json({ error: "Só administradores podem fazer isso." });
    return null;
  }

  return sessao;
}

/**
 * Exige uma sessão válida que seja OU o próprio usuário (mesmo id), OU um
 * admin. Usado nas rotas de "editar meu perfil"/"trocar minha senha", que um
 * usuário comum pode fazer para si mesmo, e um admin pode fazer para
 * qualquer um.
 */
export async function exigirDonoOuAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
): Promise<SessaoAssinada | null> {
  const sessao = await exigirSessao(req, res);
  if (!sessao) return null;

  if (sessao.userId !== userId && sessao.role !== "admin") {
    res.status(403).json({ error: "Você só pode fazer isso para a sua própria conta." });
    return null;
  }

  return sessao;
}

/**
 * Chamada de uma rota do servidor para outra (ex.: "esqueci minha senha"
 * pedindo o envio do e-mail). Quem chama manda o cabeçalho `x-chamada-interna`,
 * que só o servidor sabe calcular (usa a chave secreta). De fora, não dá.
 */
export function assinaturaInterna(): string {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return crypto.createHmac("sha256", chave).update("chamada-interna-email").digest("hex");
}

export function chamadaInternaValida(req: NextApiRequest): boolean {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const recebida = Buffer.from(String(req.headers["x-chamada-interna"] ?? ""));
  const esperada = Buffer.from(assinaturaInterna());
  return recebida.length === esperada.length && crypto.timingSafeEqual(recebida, esperada);
}
