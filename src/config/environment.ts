import projectRefs from "../../supabase-environments.json";

/**
 * Identificacao de qual banco de dados Supabase o sistema esta usando.
 *
 * Existe por causa do incidente de 21/ago/2026: as variaveis de ambiente da
 * Vercel estavam com um unico valor compartilhado entre Production e Preview,
 * e esse valor apontava para o banco de DEV. O site de producao passou a ler e
 * gravar no banco de teste, e nada no sistema avisou. Usuarios reais editaram
 * dados que foram parar no lugar errado.
 *
 * Os codigos ficam em `supabase-environments.json`, na raiz do projeto.
 */

export const SUPABASE_PROJECT_REFS = {
  production: projectRefs.production,
  development: projectRefs.development,
};

export type SupabaseEnvironment = "production" | "development" | "unknown";

/** Extrai o codigo do projeto (subdominio) de uma URL do Supabase. */
export function extractProjectRef(url?: string | null): string | null {
  if (!url) return null;
  const match = String(url).trim().match(/^https?:\/\/([a-z0-9-]+)\.supabase\./i);
  return match ? match[1].toLowerCase() : null;
}

/** Diz a qual ambiente pertence a URL do Supabase recebida. */
export function identifySupabaseEnvironment(url?: string | null): SupabaseEnvironment {
  const ref = extractProjectRef(url);
  if (!ref) return "unknown";
  if (ref === String(SUPABASE_PROJECT_REFS.production).toLowerCase()) return "production";
  if (ref === String(SUPABASE_PROJECT_REFS.development).toLowerCase()) return "development";
  return "unknown";
}

/** Enderecos em que usuarios reais acessam o sistema. */
export const PRODUCTION_HOSTNAMES = [
  "duvoenterprise.com.br",
  "www.duvoenterprise.com.br",
];

export function isProductionHostname(hostname?: string | null): boolean {
  if (!hostname) return false;
  return PRODUCTION_HOSTNAMES.includes(String(hostname).toLowerCase());
}
