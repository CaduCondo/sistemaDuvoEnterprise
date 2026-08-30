import crypto from "crypto";

/**
 * Assinatura da sessão — SÓ RODA NO SERVIDOR.
 *
 * POR QUE ISTO EXISTE
 *
 * O sistema tem login próprio e guarda o usuário no navegador. Até
 * 30/ago/2026 esse era um objeto JSON solto no localStorage: qualquer pessoa
 * podia abrir o console, escrever `role: "admin"` ali e o sistema acreditava.
 * Enquanto o controle era só de tela isso já era ruim; para uma rota de
 * servidor que grava no banco com a chave secreta, seria inaceitável -- a
 * rota não teria como saber em quem confiar.
 *
 * A partir daqui o login devolve, junto com o usuário, um TOKEN assinado com
 * um segredo que só existe no servidor. O navegador guarda e devolve esse
 * token; o servidor confere a assinatura. Sem o segredo não dá para fabricar
 * um token válido, então não dá mais para se declarar admin.
 *
 * Não é criptografia: o conteúdo do token é legível. Ele não guarda nada
 * secreto -- só quem é o usuário, o papel dele e a validade. O que a
 * assinatura garante é que esse conteúdo não foi adulterado.
 */

export interface SessaoAssinada {
  userId: string;
  role: string;
  /** Momento em que o token deixa de valer (milissegundos desde 1970). */
  expiresAt: number;
}

/**
 * O segredo da assinatura.
 *
 * Preferimos AUTH_SESSION_SECRET, uma variável só para isto. Se ela não
 * estiver configurada, caímos na chave secreta do Supabase, que já existe no
 * servidor desde sempre. O motivo dessa reserva é prático: sem ela, publicar
 * o código antes de cadastrar a variável nova derrubaria o login de todo
 * mundo. Configure AUTH_SESSION_SECRET assim que puder -- ver
 * docs/AUTHENTICATION.md.
 */
function segredo(): string {
  const valor = process.env.AUTH_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!valor) {
    throw new Error(
      "Nenhum segredo de sessão configurado no servidor. Defina AUTH_SESSION_SECRET (ou SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return valor;
}

function assinar(corpo: string): string {
  return crypto.createHmac("sha256", segredo()).update(corpo).digest("base64url");
}

export function assinarSessao(dados: SessaoAssinada): string {
  const corpo = Buffer.from(JSON.stringify(dados), "utf8").toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

/**
 * Devolve os dados da sessão se o token for legítimo e ainda estiver no
 * prazo; devolve null em qualquer outro caso. Nunca lança para token
 * malformado -- token inválido e token ausente dão no mesmo.
 */
export function verificarSessao(token?: string | null): SessaoAssinada | null {
  if (!token) return null;

  const partes = token.split(".");
  if (partes.length !== 2) return null;

  const [corpo, assinaturaRecebida] = partes;

  const recebida = Buffer.from(assinaturaRecebida);
  const esperada = Buffer.from(assinar(corpo));

  // Comparação de tempo constante: comparar com === vazaria, pelo tempo de
  // resposta, quantos caracteres do começo estavam certos.
  if (recebida.length !== esperada.length) return null;
  if (!crypto.timingSafeEqual(recebida, esperada)) return null;

  try {
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as SessaoAssinada;

    if (!dados || typeof dados.userId !== "string" || typeof dados.expiresAt !== "number") {
      return null;
    }
    if (Date.now() > dados.expiresAt) return null;

    return dados;
  } catch {
    return null;
  }
}

/** Lê o token do cabeçalho `Authorization: Bearer ...` de uma requisição. */
export function tokenDoCabecalho(cabecalho?: string | string[] | null): string | null {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  if (!valor) return null;

  const [tipo, token] = valor.split(" ");
  if (!token || tipo.toLowerCase() !== "bearer") return null;

  return token;
}
