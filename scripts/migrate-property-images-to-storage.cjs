/**
 * Migra fotos de imoveis que ainda estao em base64 na coluna
 * properties.images para o Supabase Storage (bucket "uploads",
 * pasta "property-images") -- issue #31.
 *
 * Contexto: ate 16/set/2026 (bug corrigido em propriedades.tsx), toda foto
 * de imovel era salva como base64 DIRETO na coluna JSONB `images`. Isso
 * inflou a tabela `properties` (113MB para 139 linhas) e travava o
 * dump/restore do split dev/prod. O upload de fotos NOVAS ja foi corrigido
 * (vai direto pro Storage), mas as fotos ANTIGAS continuam em base64 ate
 * alguem rodar esta migracao uma vez.
 *
 * ⚠️ v2: a v1 buscava `images` de TODAS as propriedades numa unica query
 * (select("id, location_id, complement, images")) -- e com 113MB de base64
 * somados, isso estourava o statement_timeout do Postgres (erro 57014)
 * antes mesmo de comecar a migrar qualquer coisa. Agora o script busca
 * primeiro so os dados leves (id, location_id, complement, image_count --
 * sem a coluna `images`), e so entao busca `images` de UMA propriedade por
 * vez, exatamente na hora de migrar aquela propriedade. Isso mantem cada
 * query pequena o suficiente pra nao estourar o timeout, mesmo que uma
 * propriedade especifica ainda tenha varias fotos grandes.
 *
 * COMO RODAR
 *
 *   1) Dry-run (nao escreve nada, so mostra o que seria feito):
 *        node scripts/migrate-property-images-to-storage.cjs
 *
 *   2) De verdade, usando as credenciais do .env.local (DEV por padrao):
 *        node scripts/migrate-property-images-to-storage.cjs --apply
 *
 *   3) Contra outro ambiente (ex. PROD), apontando pra outro arquivo de
 *      env (nunca commitar esse arquivo!):
 *        node scripts/migrate-property-images-to-storage.cjs --apply --env=.env.prod.local
 *
 * O script e idempotente: roda em qualquer propriedade, mas so sobe pro
 * Storage as imagens que ainda sao base64 (comecam com "data:"); imagens
 * que ja sao URL (comecam com "http") ficam como estao. Se rodar de novo,
 * nao faz nada (ja estara tudo em URL).
 *
 * Nao apaga nada do Storage nem da tabela antes de confirmar que o upload
 * de TODAS as imagens daquela propriedade deu certo -- so entao faz o
 * UPDATE trocando o array `images` pelas novas URLs. Se alguma imagem
 * falhar ao subir, a propriedade inteira e pulada (fica como estava) e o
 * erro aparece no log, pra poder investigar e rodar de novo depois.
 */

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const envArg = args.find((a) => a.startsWith("--env="));
const envFile = envArg ? envArg.split("=")[1] : ".env.local";

require("dotenv").config({ path: envFile });

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(`Faltando NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em ${envFile}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BUCKET = "uploads";
const FOLDER = "property-images";

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");
  return { mime, buffer };
}

function extFromMime(mime) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime] || "jpg";
}

function uniqueName(ext) {
  const random = Math.random().toString(36).slice(2, 9);
  return `${Date.now()}_${random}.${ext}`;
}

async function uploadOne(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error("Formato de data URL inesperado (nao comeca com data:<mime>;base64,)");
  }
  const ext = extFromMime(parsed.mime);
  const fileName = uniqueName(ext);
  const objectPath = `${FOLDER}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, parsed.buffer, { contentType: parsed.mime, upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return publicUrlData.publicUrl;
}

async function main() {
  console.log(`Ambiente: ${SUPABASE_URL}`);
  console.log(APPLY ? "MODO: aplicando de verdade (--apply)" : "MODO: dry-run (nenhuma escrita)");
  console.log("");

  // Passo 1: so os dados leves, SEM a coluna images (evita o timeout).
  const { data: lightList, error: listError } = await supabase
    .from("properties")
    .select("id, location_id, complement, image_count")
    .order("id", { ascending: true });

  if (listError) {
    console.error("Erro ao listar properties:", listError);
    process.exit(1);
  }

  const candidates = lightList.filter((p) => (p.image_count || 0) > 0);

  console.log(`Total de propriedades: ${lightList.length}`);
  console.log(`Propriedades com pelo menos 1 imagem (candidatas a checar): ${candidates.length}`);
  console.log("");

  let okCount = 0;
  let failCount = 0;
  let skippedAlreadyMigrated = 0;
  const failures = [];

  for (const light of candidates) {
    // Passo 2: busca `images` de UMA propriedade por vez.
    const { data: full, error: fetchError } = await supabase
      .from("properties")
      .select("id, images")
      .eq("id", light.id)
      .single();

    if (fetchError) {
      failCount++;
      failures.push({ id: light.id, location_id: light.location_id, complement: light.complement, erro: fetchError.message });
      console.log(`[FALHOU AO BUSCAR] ${light.location_id || "?"} ${light.complement || ""} (${light.id}): ${fetchError.message}`);
      continue;
    }

    const originalImages = Array.isArray(full.images) ? full.images : [];
    const hasBase64 = originalImages.some((img) => typeof img === "string" && img.startsWith("data:"));

    if (!hasBase64) {
      skippedAlreadyMigrated++;
      continue; // ja tudo em URL (ou vazio) -- nada a fazer
    }

    const newImages = [];
    let failed = false;
    let failReason = null;

    for (const img of originalImages) {
      if (typeof img !== "string") {
        newImages.push(img);
        continue;
      }
      if (img.startsWith("http")) {
        newImages.push(img); // ja migrada antes, mantem
        continue;
      }
      if (!img.startsWith("data:")) {
        newImages.push(img); // formato desconhecido, nao mexe
        continue;
      }

      if (!APPLY) {
        newImages.push("<seria subido pro Storage aqui>");
        continue;
      }

      try {
        const url = await uploadOne(img);
        newImages.push(url);
      } catch (e) {
        failed = true;
        failReason = e.message || String(e);
        break;
      }
    }

    if (failed) {
      failCount++;
      failures.push({ id: light.id, location_id: light.location_id, complement: light.complement, erro: failReason });
      console.log(`[FALHOU] ${light.location_id || "?"} ${light.complement || ""} (${light.id}): ${failReason}`);
      continue;
    }

    if (APPLY) {
      const { error: updateError } = await supabase
        .from("properties")
        .update({ images: newImages })
        .eq("id", light.id);

      if (updateError) {
        failCount++;
        failures.push({ id: light.id, location_id: light.location_id, complement: light.complement, erro: updateError.message });
        console.log(`[FALHOU AO SALVAR] ${light.location_id || "?"} ${light.complement || ""} (${light.id}): ${updateError.message}`);
        continue;
      }
    }

    okCount++;
    console.log(`[OK] ${light.location_id || "?"} ${light.complement || ""} (${light.id}) -- ${originalImages.length} imagem(ns)`);
  }

  console.log("");
  console.log(`Concluido. OK: ${okCount} | Ja migradas (puladas): ${skippedAlreadyMigrated} | Falhas: ${failCount}`);
  if (failures.length > 0) {
    console.log("\nDetalhe das falhas:");
    console.log(JSON.stringify(failures, null, 2));
  }
  if (!APPLY) {
    console.log("\nEsse foi um dry-run -- nada foi escrito. Rode de novo com --apply para migrar de verdade.");
  }
}

main();
