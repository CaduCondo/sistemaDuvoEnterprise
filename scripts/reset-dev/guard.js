#!/usr/bin/env node
/*
 * Trava do reset de DEV (issue #36).
 *
 * O reset APAGA tudo do banco de destino e coloca uma copia do banco de
 * origem no lugar. Se alguem trocar os dois secrets sem querer
 * (PROD_DB_URL <-> DEV_DB_URL), o reset apagaria PRODUCAO. Esta trava
 * impede isso: confere, contra o supabase-environments.json (fonte de
 * verdade versionada no Git), que
 *   - a ORIGEM e o banco de producao, e
 *   - o DESTINO e o banco de desenvolvimento.
 * Qualquer outra combinacao (trocado, igual, vazio, desconhecido) para o
 * processo antes de qualquer comando tocar em qualquer banco.
 *
 * Uso:
 *   node scripts/reset-dev/guard.js              (le PROD_DB_URL e DEV_DB_URL)
 *   node scripts/reset-dev/guard.js --self-test  (sem banco, sem secrets)
 */
const fs = require("fs");
const path = require("path");

const ENV_FILE = path.join(__dirname, "..", "..", "supabase-environments.json");

// Extrai o codigo do projeto Supabase de uma connection string.
// Formatos aceitos:
//   postgresql://postgres.<ref>:senha@aws-0-xx.pooler.supabase.com:5432/postgres  (pooler)
//   postgresql://postgres:senha@db.<ref>.supabase.co:5432/postgres                 (direta)
function extrairRef(url) {
  if (!url || typeof url !== "string") return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const user = decodeURIComponent(u.username || "");
  const mUser = user.match(/^postgres\.([a-z0-9]{20})$/);
  if (mUser) return mUser[1];
  const mHost = (u.hostname || "").match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (mHost) return mHost[1];
  return null;
}

function conferir(prodUrl, devUrl, envs) {
  const prodRef = extrairRef(prodUrl);
  const devRef = extrairRef(devUrl);
  if (!prodRef) return { ok: false, motivo: "PROD_DB_URL vazia ou em formato desconhecido" };
  if (!devRef) return { ok: false, motivo: "DEV_DB_URL vazia ou em formato desconhecido" };
  if (prodRef === devRef) return { ok: false, motivo: "origem e destino sao o MESMO banco" };
  if (devRef === envs.production)
    return { ok: false, motivo: "o DESTINO e o banco de PRODUCAO (secrets trocados?) -- reset bloqueado" };
  if (prodRef !== envs.production)
    return { ok: false, motivo: `a ORIGEM (${prodRef}) nao e o banco de producao (${envs.production})` };
  if (devRef !== envs.development)
    return { ok: false, motivo: `o DESTINO (${devRef}) nao e o banco de desenvolvimento (${envs.development})` };
  return { ok: true, motivo: `origem=${prodRef} (producao) -> destino=${devRef} (desenvolvimento)` };
}

function selfTest(envs) {
  const P = envs.production;
  const D = envs.development;
  const pool = (ref) => `postgresql://postgres.${ref}:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`;
  const direta = (ref) => `postgresql://postgres:x@db.${ref}.supabase.co:5432/postgres`;
  const casos = [
    ["certo (pooler)", pool(P), pool(D), true],
    ["certo (conexao direta)", direta(P), direta(D), true],
    ["secrets trocados", pool(D), pool(P), false],
    ["destino = producao", pool(P), pool(P), false],
    ["origem = dev", pool(D), pool(D), false],
    ["DEV_DB_URL vazia", pool(P), "", false],
    ["PROD_DB_URL vazia", "", pool(D), false],
    ["banco desconhecido", pool(P), pool("abcdefghijklmnopqrst"), false],
    ["texto invalido", "nao-e-url", pool(D), false],
  ];
  let falhas = 0;
  for (const [nome, prod, dev, esperado] of casos) {
    const r = conferir(prod, dev, envs);
    const passou = r.ok === esperado;
    if (!passou) falhas++;
    console.log(`${passou ? "OK  " : "FALHOU"} ${nome}: ${r.ok ? "liberado" : "bloqueado"} (${r.motivo})`);
  }
  if (falhas) {
    console.error(`\n${falhas} caso(s) do auto-teste falharam.`);
    process.exit(1);
  }
  console.log("\nAuto-teste da trava do reset de DEV: tudo certo.");
}

function main() {
  const envs = JSON.parse(fs.readFileSync(ENV_FILE, "utf8"));
  if (!envs.production || !envs.development) {
    console.error("supabase-environments.json sem 'production'/'development'.");
    process.exit(1);
  }
  if (process.argv.includes("--self-test")) return selfTest(envs);
  const r = conferir(process.env.PROD_DB_URL, process.env.DEV_DB_URL, envs);
  if (!r.ok) {
    console.error(`TRAVA DO RESET DE DEV: ${r.motivo}. Nenhum banco foi tocado.`);
    process.exit(1);
  }
  console.log(`Trava do reset de DEV liberada: ${r.motivo}`);
}

if (require.main === module) main();
module.exports = { extrairRef, conferir };
