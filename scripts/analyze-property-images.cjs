/**
 * Diagnostico (somente leitura) de quantas fotos de imoveis ainda estao em
 * base64 na coluna properties.images vs. ja migradas para o Supabase
 * Storage -- companheiro de scripts/migrate-property-images-to-storage.cjs
 * (issue #31).
 *
 * Nao corrige nada, so relata. Util para conferir o estado de um banco
 * (DEV ou PROD) antes/depois de rodar a migracao, ou futuramente se alguma
 * tela voltar a salvar foto como base64 por engano.
 *
 * ⚠️ Mesmo cuidado da v2 da migracao: nunca buscar a coluna `images` de
 * todas as propriedades numa unica query -- com a base cheia de base64 isso
 * ja estourou o statement_timeout do Postgres (erro 57014) antes mesmo de
 * come​car a ler. Por isso busca primeiro so os dados leves (sem `images`),
 * e so entao busca `images` de uma propriedade por vez.
 *
 * Uso:
 *   node scripts/analyze-property-images.cjs [--env=<arquivo>]
 *
 * --env   arquivo de variaveis de ambiente (default: .env.local)
 */

const path = require("path");

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith("--env="));
const envFile = envArg ? envArg.split("=")[1] : ".env.local";

require("dotenv").config({ path: path.resolve(process.cwd(), envFile) });

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    `Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em ${envFile}.`
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log(`Analisando ${SUPABASE_URL} (env: ${envFile})...\n`);

  // Passo 1: so os dados leves, sem a coluna `images` -- barato mesmo numa
  // base grande.
  const { data: lightList, error: listError } = await supabase
    .from("properties")
    .select("id, location_id, complement, image_count")
    .order("id", { ascending: true });

  if (listError) {
    console.error("ERRO ao listar propriedades:", listError);
    process.exit(1);
  }

  const candidatas = (lightList || []).filter((p) => (p.image_count || 0) > 0);

  let totalProps = lightList.length;
  let propsWithImages = 0;
  let propsWithBase64 = 0;
  let propsAllUrls = 0;
  let propsMixed = 0;
  let totalImages = 0;
  let base64Images = 0;
  let urlImages = 0;
  let base64Bytes = 0;

  const base64Details = [];

  // Passo 2: busca `images` de UMA propriedade por vez, so das que tem
  // foto (image_count > 0).
  for (const light of candidatas) {
    const { data: full, error: fetchError } = await supabase
      .from("properties")
      .select("id, images")
      .eq("id", light.id)
      .single();

    if (fetchError || !full) {
      console.error(`  [FALHOU AO BUSCAR] id=${light.id}:`, fetchError?.message);
      continue;
    }

    const imgs = Array.isArray(full.images) ? full.images : [];
    if (imgs.length === 0) continue;

    propsWithImages++;
    let hasBase64 = false;
    let hasUrl = false;

    for (const img of imgs) {
      if (typeof img !== "string") continue;
      totalImages++;
      if (img.startsWith("data:")) {
        base64Images++;
        hasBase64 = true;
        base64Bytes += img.length;
      } else if (img.startsWith("http")) {
        urlImages++;
        hasUrl = true;
      }
    }

    if (hasBase64 && hasUrl) propsMixed++;
    else if (hasBase64) propsWithBase64++;
    else if (hasUrl) propsAllUrls++;

    if (hasBase64) {
      base64Details.push({
        id: light.id,
        location_id: light.location_id,
        complement: light.complement,
        count: imgs.filter((i) => typeof i === "string" && i.startsWith("data:")).length,
      });
    }
  }

  console.log("Total de propriedades:", totalProps);
  console.log("Propriedades com imagens:", propsWithImages);
  console.log("  - so base64 (precisam migrar):", propsWithBase64);
  console.log("  - mistura de base64+url:", propsMixed);
  console.log("  - ja so urls:", propsAllUrls);
  console.log("Total de imagens:", totalImages, "| base64:", base64Images, "| urls:", urlImages);
  console.log(
    "Tamanho aprox. do texto base64:",
    base64Bytes,
    "chars (~",
    Math.round(base64Bytes / 1024 / 1024),
    "MB)"
  );

  if (base64Details.length > 0) {
    console.log("\nPropriedades que ainda precisam de migracao:");
    console.log(JSON.stringify(base64Details, null, 2));
  } else {
    console.log("\nNenhuma propriedade com foto em base64 -- nada a migrar.");
  }
}

main();
