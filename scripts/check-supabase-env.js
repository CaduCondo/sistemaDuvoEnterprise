#!/usr/bin/env node
/**
 * Trava de seguranca do build.
 *
 * Roda automaticamente antes de cada `npm run build` (script "prebuild").
 * Se um deploy de PRODUCAO estiver apontando para o banco errado, o build
 * FALHA e nada e publicado.
 *
 * Existe por causa do incidente de 21/ago/2026: o site de producao ficou
 * apontando para o banco de DEV e o deploy passou normalmente, sem nenhum
 * aviso. Usuarios reais gravaram dados no banco de teste.
 *
 * A referencia de qual banco pertence a cada ambiente esta em
 * `supabase-environments.json`, na raiz do projeto.
 */

const projectRefs = require("../supabase-environments.json");

const PROD_REF = String(projectRefs.production).toLowerCase();
const DEV_REF = String(projectRefs.development).toLowerCase();

// VERCEL_ENV vale "production", "preview" ou "development" quando o build roda
// na Vercel. No computador do Cadu ele nao existe.
const vercelEnv = process.env.VERCEL_ENV || null;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

function extractRef(url) {
  const match = String(url).trim().match(/^https?:\/\/([a-z0-9-]+)\.supabase\./i);
  return match ? match[1].toLowerCase() : null;
}

function describe(ref) {
  if (ref === PROD_REF) return "PRODUCAO";
  if (ref === DEV_REF) return "DESENVOLVIMENTO (DEV)";
  return "DESCONHECIDO";
}

function fail(titulo, linhas) {
  console.error("");
  console.error("==================================================================");
  console.error("  BUILD BLOQUEADO - " + titulo);
  console.error("==================================================================");
  linhas.forEach((l) => console.error("  " + l));
  console.error("==================================================================");
  console.error("");
  process.exit(1);
}

const COMO_CORRIGIR = [
  "Como corrigir na Vercel:",
  "  1. Abra o projeto > Settings > Environment Variables.",
  "  2. Confira NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  "  3. Cada ambiente precisa da SUA PROPRIA entrada:",
  "       Production -> banco de PRODUCAO (" + PROD_REF + ")",
  "       Preview    -> banco de DEV       (" + DEV_REF + ")",
  "     Nunca deixe uma unica entrada marcada como 'Production and Preview'.",
  "  4. Salve e rode um novo deploy (mudar a variavel sozinha nao basta:",
  "     o valor e gravado dentro do site na hora do build).",
];

const ref = extractRef(supabaseUrl);

// 1) Variavel ausente ou irreconhecivel
if (!ref) {
  if (vercelEnv === "production" || vercelEnv === "preview") {
    fail("NEXT_PUBLIC_SUPABASE_URL ausente ou invalida", [
      "Ambiente do deploy: " + vercelEnv,
      "Valor recebido: " + (supabaseUrl ? supabaseUrl : "(vazio)"),
      "",
      ...COMO_CORRIGIR,
    ]);
  }
  console.warn(
    "[check-supabase-env] Aviso: NEXT_PUBLIC_SUPABASE_URL ausente ou invalida. " +
      "Build local segue normalmente."
  );
  process.exit(0);
}

// 2) Deploy de PRODUCAO com banco que nao e o de producao -> este foi o incidente
if (vercelEnv === "production" && ref !== PROD_REF) {
  fail("producao apontando para o banco errado", [
    "Este deploy vai para o site que os usuarios reais usam,",
    "mas esta configurado para o banco " + describe(ref) + ".",
    "",
    "  Esperado: " + PROD_REF + "  (PRODUCAO)",
    "  Recebido: " + ref,
    "",
    "Publicar assim faria os usuarios gravarem dados no banco errado,",
    "exatamente como aconteceu em 21/ago/2026.",
    "",
    ...COMO_CORRIGIR,
  ]);
}

// 3) Deploy de teste (Preview) apontando para o banco de producao
if (vercelEnv === "preview" && ref === PROD_REF) {
  fail("ambiente de teste apontando para o banco de PRODUCAO", [
    "Este e um deploy de Preview (teste), mas esta ligado ao banco real.",
    "Qualquer teste feito nele alteraria os dados de verdade dos clientes.",
    "",
    "  Esperado: " + DEV_REF + "  (DESENVOLVIMENTO)",
    "  Recebido: " + ref + "  (PRODUCAO)",
    "",
    ...COMO_CORRIGIR,
  ]);
}

console.log(
  "[check-supabase-env] OK - ambiente '" +
    (vercelEnv || "local") +
    "' conectado ao banco de " +
    describe(ref) +
    " (" +
    ref +
    ")."
);
