import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para rotas de API (servidor) -- SEMPRE com timeout de rede.
 *
 * POR QUE ISTO EXISTE (issue #66, 07/set/2026)
 *
 * Toda rota em src/pages/api que precisava do Supabase criava seu próprio
 * `createClient(...)` avulso, sem nenhum timeout. O `fetch` que o Supabase
 * usa por baixo dos panos não tem limite de tempo por padrão -- então
 * qualquer instabilidade de rede do lado do Supabase (mesmo rara) travava
 * a chamada para sempre, sem erro nenhum, em vez de falhar rápido.
 *
 * Isso já tinha sido corrigido nos clientes Supabase usados só pelos
 * TESTES automatizados (e2e/helpers/database.helper.ts e api.helper.ts),
 * mas o job "Sistema completo" do CI voltou a travar por 30 minutos depois
 * disso -- porque quem realmente hangou dessa vez foi um cliente Supabase
 * de dentro do PRÓPRIO APLICATIVO (a rota /api/auth/forgot-password, sendo
 * chamada de verdade pelo navegador durante o teste), não um cliente só de
 * teste. Ou seja: o risco nunca foi só do CI -- é o mesmo risco que um
 * usuário de verdade corre tentando fazer login ou recuperar a senha em
 * produção, ficando com a tela travada pra sempre se o Supabase tiver um
 * problema passageiro de rede.
 *
 * Este arquivo centraliza a criação do cliente Supabase do lado do
 * servidor com um timeout de 15s já embutido, para que nenhuma rota nova
 * (nem as que já existem) volte a cometer esse mesmo erro.
 */

const TIMEOUT_SUPABASE_SERVIDOR_MS = 15_000;

function fetchComTimeout(url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_SUPABASE_SERVIDOR_MS);

  return fetch(url, { ...options, signal: controller.signal })
    .catch((erro) => {
      if (erro?.name === "AbortError") {
        throw new Error(
          `Supabase não respondeu em ${TIMEOUT_SUPABASE_SERVIDOR_MS / 1000}s -- ` +
          "possível instabilidade do serviço (não é bug da rota). Ver issue #66."
        );
      }
      throw erro;
    })
    .finally(() => clearTimeout(timeoutId));
}

type OpcoesClienteServidor = {
  /** Cabeçalhos extras a enviar em toda chamada (raro precisar). */
  headers?: Record<string, string>;
};

/**
 * Cliente com a chave secreta (service role) -- ignora RLS por completo.
 * Só usar em código que roda no servidor (rotas de API), nunca no navegador.
 */
export function criarClienteSupabaseAdmin(opcoes?: OpcoesClienteServidor): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const chaveSecreta = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, chaveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
    global: {
      fetch: fetchComTimeout,
      ...(opcoes?.headers ? { headers: opcoes.headers } : {}),
    },
  });
}

/**
 * Cliente com a chave anônima (pública) -- respeita RLS normalmente.
 * Usar quando a rota não precisa (ou não deve) furar o RLS.
 */
export function criarClienteSupabaseAnon(opcoes?: OpcoesClienteServidor): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const chaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, chaveAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
    global: {
      fetch: fetchComTimeout,
      ...(opcoes?.headers ? { headers: opcoes.headers } : {}),
    },
  });
}
