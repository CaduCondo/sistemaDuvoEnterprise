#!/usr/bin/env node
/**
 * Trava de seguranca do build.
 *
 * Roda automaticamente antes de cada `npm run build` (script "prebuild").
 * Se um deploy estiver apontando para o banco de dados errado, o build FALHA
 * e nada e publicado.
 *
 * Existe por causa do incidente de 21/ago/2026: o site de producao ficou
 * apontando para o banco de DEV, o deploy passou normalmente sem nenhum aviso,
 * e usuarios reais gravaram dados no banco de teste.
 *
 * A referencia de qual banco pertence a cada ambiente esta em
 * `supabase-environments.json`, na raiz do projeto.
 *
 * Uso:
 *   node scripts/check-supabase-env.js              confere o ambiente atual
 *   node scripts/check-supabase-env.js --self-test  testa a propria logica
 */

const projectRefs = require("../supabase-environments.json");

const PROD_REF = String(projectRefs.production).toLowerCase();
const DEV_REF = String(projectRefs.development).toLowerCase();

function extractRef(url) {
  if (!url) return null;
  const match = String(url).trim().match(/^https?:\/\/([a-z0-9-]+)\.supabase\./i);
  return match ? match[1].toLowerCase() : null;
}

function describe(ref) {
  if (ref === PROD_REF) return "PRODUCAO";
  if (ref === DEV_REF) return "DESENVOLVIMENTO (DEV)";
  return "DESCONHECIDO";
}

/**
 * Decide se este build pode continuar.
 *
 * `vercelEnv` vale "production", "preview" ou "development" quando o build roda
 * na Vercel; no computador do Cadu ele nao existe (null).
 *
 * Retorna { ok, codigo, ref } — `codigo` identifica o motivo, e e o que os
 * testes automaticos verificam.
 */
function avaliar(vercelEnv, supabaseUrl) {
  const ref = extractRef(supabaseUrl);
  const naVercel = vercelEnv === "production" || vercelEnv === "preview";

  if (!ref) {
    return naVercel
      ? { ok: false, codigo: "url-ausente", ref: null }
      : { ok: true, codigo: "local-sem-url", ref: null };
  }
  if (vercelEnv === "production" && ref !== PROD_REF) {
    return { ok: false, codigo: "producao-com-banco-errado", ref };
  }
  if (vercelEnv === "preview" && ref === PROD_REF) {
    return { ok: false, codigo: "preview-com-banco-de-producao", ref };
  }
  return { ok: true, codigo: "ok", ref };
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

function explicar(resultado, vercelEnv, supabaseUrl) {
  switch (resultado.codigo) {
    case "url-ausente":
      return {
        titulo: "NEXT_PUBLIC_SUPABASE_URL ausente ou invalida",
        linhas: [
          "Ambiente do deploy: " + vercelEnv,
          "Valor recebido: " + (supabaseUrl || "(vazio)"),
          "",
          ...COMO_CORRIGIR,
        ],
      };
    case "producao-com-banco-errado":
      return {
        titulo: "producao apontando para o banco errado",
        linhas: [
          "Este deploy vai para o site que os usuarios reais usam,",
          "mas esta configurado para o banco " + describe(resultado.ref) + ".",
          "",
          "  Esperado: " + PROD_REF + "  (PRODUCAO)",
          "  Recebido: " + resultado.ref,
          "",
          "Publicar assim faria os usuarios gravarem dados no banco errado,",
          "exatamente como aconteceu em 21/ago/2026.",
          "",
          ...COMO_CORRIGIR,
        ],
      };
    case "preview-com-banco-de-producao":
      return {
        titulo: "ambiente de teste apontando para o banco de PRODUCAO",
        linhas: [
          "Este e um deploy de Preview (teste), mas esta ligado ao banco real.",
          "Qualquer teste feito nele alteraria os dados de verdade dos clientes.",
          "",
          "  Esperado: " + DEV_REF + "  (DESENVOLVIMENTO)",
          "  Recebido: " + resultado.ref + "  (PRODUCAO)",
          "",
          ...COMO_CORRIGIR,
        ],
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Auto-teste: garante que a propria trava continua funcionando.
// Roda no GitHub Actions a cada push (workflow "Trava de ambiente").
// ---------------------------------------------------------------------------
function selfTest() {
  const URL_PROD = "https://" + PROD_REF + ".supabase.co";
  const URL_DEV = "https://" + DEV_REF + ".supabase.co";

  const casos = [
    ["producao com banco de DEV bloqueia (o incidente de 21/ago/2026)", "production", URL_DEV, false, "producao-com-banco-errado"],
    ["producao com banco de producao passa", "production", URL_PROD, true, "ok"],
    ["producao com banco desconhecido bloqueia", "production", "https://outroprojeto.supabase.co", false, "producao-com-banco-errado"],
    ["producao sem a variavel bloqueia", "production", "", false, "url-ausente"],
    ["preview com banco de producao bloqueia", "preview", URL_PROD, false, "preview-com-banco-de-producao"],
    ["preview com banco de DEV passa", "preview", URL_DEV, true, "ok"],
    ["preview sem a variavel bloqueia", "preview", "", false, "url-ausente"],
    ["build local sem VERCEL_ENV nunca bloqueia", null, URL_DEV, true, "ok"],
    ["build local sem a variavel nunca bloqueia", null, "", true, "local-sem-url"],
    ["URL com espacos em volta ainda e reconhecida", "production", "  " + URL_PROD + "  ", true, "ok"],
    ["URL em maiuscula ainda e reconhecida", "production", URL_PROD.toUpperCase(), true, "ok"],
  ];

  let falhas = 0;
  console.log("Auto-teste da trava de ambiente\n");
  for (const [descricao, env, url, okEsperado, codigoEsperado] of casos) {
    const r = avaliar(env, url);
    const passou = r.ok === okEsperado && r.codigo === codigoEsperado;
    if (!passou) falhas++;
    console.log(
      (passou ? "  OK   " : "  FALHOU ") +
        descricao +
        (passou ? "" : "  (esperado ok=" + okEsperado + "/" + codigoEsperado +
          ", obtido ok=" + r.ok + "/" + r.codigo + ")")
    );
  }
  console.log("");
  if (falhas > 0) {
    console.error(falhas + " de " + casos.length + " casos falharam.");
    process.exit(1);
  }
  console.log("Todos os " + casos.length + " casos passaram.");
  process.exit(0);
}

if (process.argv.includes("--self-test")) selfTest();

// ---------------------------------------------------------------------------
// Execucao normal (antes do build)
// ---------------------------------------------------------------------------
const vercelEnv = process.env.VERCEL_ENV || null;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const resultado = avaliar(vercelEnv, supabaseUrl);

if (!resultado.ok) {
  const { titulo, linhas } = explicar(resultado, vercelEnv, supabaseUrl);
  console.error("");
  console.error("==================================================================");
  console.error("  BUILD BLOQUEADO - " + titulo);
  console.error("==================================================================");
  linhas.forEach((l) => console.error("  " + l));
  console.error("==================================================================");
  console.error("");
  process.exit(1);
}

if (resultado.codigo === "local-sem-url") {
  console.warn(
    "[check-supabase-env] Aviso: NEXT_PUBLIC_SUPABASE_URL ausente ou invalida. " +
      "Build local segue normalmente."
  );
  process.exit(0);
}

console.log(
  "[check-supabase-env] OK - ambiente '" +
    (vercelEnv || "local") +
    "' conectado ao banco de " +
    describe(resultado.ref) +
    " (" +
    resultado.ref +
    ")."
);
