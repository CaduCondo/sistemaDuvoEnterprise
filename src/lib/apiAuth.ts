import type { NextApiRequest, NextApiResponse } from "next";
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

/** Exige uma sessão válida (qualquer perfil). Responde 401 e devolve null se não houver. */
export function exigirSessao(
  req: NextApiRequest,
  res: NextApiResponse
): SessaoAssinada | null {
  const sessao = sessaoDaRequisicao(req);
  if (!sessao) {
    res.status(401).json({ error: "Sessão inválida ou expirada. Faça login novamente." });
    return null;
  }
  return sessao;
}

/** Como exigirSessao, mas também exige perfil admin. Responde 403 se não for. */
export function exigirAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): SessaoAssinada | null {
  const sessao = exigirSessao(req, res);
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
export function exigirDonoOuAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
): SessaoAssinada | null {
  const sessao = exigirSessao(req, res);
  if (!sessao) return null;

  if (sessao.userId !== userId && sessao.role !== "admin") {
    res.status(403).json({ error: "Você só pode fazer isso para a sua própria conta." });
    return null;
  }

  return sessao;
}
