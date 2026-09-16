#!/usr/bin/env node
/**
 * Migra fotos de imóveis salvas como texto base64 na coluna `images` da
 * tabela `properties` para arquivos de verdade no Supabase Storage (bucket
 * `uploads`, pasta `property-images/`) -- issue do bug "canceling statement
 * due to statement timeout" ao salvar edição de imóvel, relatado pelo Cadu
 * em 16/set/2026.
 *
 * POR QUE ISTO É NECESSÁRIO
 *
 * Antes de 16/set/2026, a tela de Imóveis nunca subia foto nenhuma pro
 * Storage -- lia cada arquivo com `FileReader.readAsDataURL` no navegador e
 * gravava o texto base64 (o arquivo inteiro, ~33% maior codificado em
 * texto) DIRETO na coluna `images`. Um imóvel com várias fotos de celular
 * passa fácil de dezenas de MB nessa única coluna. Toda vez que alguém
 * salvava QUALQUER edição desse imóvel (mesmo só a descrição), o Postgres
 * tentava regravar a coluna inteira de novo -- e, passado um certo
 * tamanho, estourava o tempo limite da instrução ("statement timeout"),
 * travando o salvamento com erro 500.
 *
 * O código já foi corrigido para novos uploads (ver src/pages/properties.tsx
 * -- `handleImageUpload` agora usa `uploadAttachment`, que sobe pro Storage
 * e guarda só a URL). Mas imóveis que JÁ TÊM fotos em base64 continuam
 * quebrados até alguém migrar o que já está gravado -- é isso que este
 * script faz.
 *
 * O QUE O SCRIPT FAZ
 *
 *   1. Lista todos os imóveis cuja coluna `images` tem pelo menos uma foto
 *      em base64 (string começando com "data:image").
 *   2. Para cada foto em base64: decodifica, sobe pro Storage (bucket
 *      `uploads`, pasta `property-images/`) e troca pela URL pública no
 *      array. Fotos que já são URL (não começam com "data:") ficam como
 *      estão.
 *   3. Grava o array de imagens atualizado de volta no imóvel -- um UPDATE
 *      pequeno agora, só com URLs, não mais o arquivo inteiro.
 *
 * Por padrão roda em modo SÓ LEITURA (lista o que encontrou, não muda nada
 * no banco). Só grava de verdade com a flag --confirmar.
 *
 * USO
 *
 *   node scripts/migrar-fotos-imoveis-para-storage.js
 *       Modo teste: mostra quais imóveis seriam alterados e o tamanho da
 *       coluna `images` antes/depois, sem gravar nada.
 *
 *   node scripts/migrar-fotos-imoveis-para-storage.js --confirmar
 *       Faz a migração de verdade.
 *
 * VARIÁVEIS DE AMBIENTE (obrigatórias)
 *
 *   NEXT_PUBLIC_SUPABASE_URL     URL do projeto Supabase a migrar.
 *   SUPABASE_SERVICE_ROLE_KEY    chave de serviço (bypassa RLS) desse mesmo
 *                                 projeto.
 *
 * ⚠️ Rode isto apontando para o Supabase de PRODUÇÃO (o mesmo bug não
 * existe no DEV a não ser que alguém tenha subido fotos grandes por lá
 * também) -- o script imprime, antes de mexer em qualquer coisa, qual
 * ambiente detectou (comparando com supabase-environments.json) para
 * evitar o erro de 21/ago/2026 (apontar para o banco errado sem perceber).
 */

const { createClient } = require("@supabase/supabase-js");
const projectRefs = require("../supabase-environments.json");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONFIRMAR = process.argv.includes("--confirmar");
const BUCKET = "uploads";
const PASTA = "property-images";

function extrairRef(url) {
  if (!url) return null;
  const m = String(url).trim().match(/^https?:\/\/([a-z0-9-]+)\.supabase\./i);
  return m ? m[1].toLowerCase() : null;
}

function descreverAmbiente(ref) {
  if (ref === String(projectRefs.production).toLowerCase()) return "PRODUÇÃO";
  if (ref === String(projectRefs.development).toLowerCase()) return "DESENVOLVIMENTO (DEV)";
  return "DESCONHECIDO -- não bate com nenhum dos dois projetos em supabase-environments.json";
}

function tamanhoEmKB(str) {
  return (Buffer.byteLength(str, "utf8") / 1024).toFixed(1);
}

function nomeUnico(extensao) {
  const aleatorio = Math.random().toString(36).slice(2, 9);
  return `${Date.now()}_${aleatorio}.${extensao}`;
}

/** "data:image/jpeg;base64,/9j/4AAQ..." -> { mime: "image/jpeg", extensao: "jpg", buffer } */
function decodificarDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const extensaoPorMime = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const extensao = extensaoPorMime[mime] || "jpg";
  return { mime, extensao, buffer };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
      "[migrar-fotos] Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente."
    );
    process.exit(1);
  }

  const ref = extrairRef(SUPABASE_URL);
  console.log(`[migrar-fotos] Ambiente detectado: ${descreverAmbiente(ref)} (${SUPABASE_URL})`);
  console.log(`[migrar-fotos] Modo: ${CONFIRMAR ? "GRAVANDO DE VERDADE (--confirmar)" : "SÓ LEITURA (dry-run)"}`);
  console.log("");

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, property_identifier, complement, images");

  if (error) {
    console.error("[migrar-fotos] Erro ao buscar imóveis:", error.message);
    process.exit(1);
  }

  const comBase64 = (properties || []).filter(
    (p) => Array.isArray(p.images) && p.images.some((img) => typeof img === "string" && img.startsWith("data:image"))
  );

  console.log(`[migrar-fotos] ${properties.length} imóveis no total, ${comBase64.length} com foto(s) em base64.\n`);

  if (comBase64.length === 0) {
    console.log("[migrar-fotos] Nada para migrar. ✅");
    return;
  }

  let totalAntesKB = 0;
  let totalDepoisKB = 0;
  let falhas = 0;

  for (const property of comBase64) {
    const identificador = `${property.property_identifier || property.id} (${property.complement || "sem complemento"})`;
    const tamanhoAntes = tamanhoEmKB(JSON.stringify(property.images));
    totalAntesKB += Number(tamanhoAntes);

    console.log(`→ ${identificador}: ${property.images.length} foto(s), coluna images com ${tamanhoAntes}KB`);

    const novasImagens = [];
    for (const [index, img] of property.images.entries()) {
      if (typeof img !== "string" || !img.startsWith("data:image")) {
        novasImagens.push(img);
        continue;
      }

      const decodificado = decodificarDataUrl(img);
      if (!decodificado) {
        console.warn(`   ⚠️ foto #${index + 1}: não consegui decodificar o base64, mantendo como estava.`);
        novasImagens.push(img);
        falhas++;
        continue;
      }

      const caminho = `${PASTA}/${nomeUnico(decodificado.extensao)}`;
      console.log(
        `   foto #${index + 1}: ${(decodificado.buffer.length / 1024).toFixed(1)}KB decodificado -> ${caminho}`
      );

      if (CONFIRMAR) {
        const { error: erroUpload } = await supabase.storage
          .from(BUCKET)
          .upload(caminho, decodificado.buffer, { contentType: decodificado.mime, upsert: false });

        if (erroUpload) {
          console.error(`   ❌ falha ao subir a foto #${index + 1} de ${identificador}: ${erroUpload.message}`);
          novasImagens.push(img); // mantém o base64 antigo em caso de falha, não perde a foto
          falhas++;
          continue;
        }

        const { data: urlPublica } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
        novasImagens.push(urlPublica.publicUrl);
      } else {
        novasImagens.push(`[seria] .../storage/v1/object/public/${BUCKET}/${caminho}`);
      }
    }

    const tamanhoDepois = tamanhoEmKB(JSON.stringify(novasImagens));
    totalDepoisKB += Number(tamanhoDepois);
    console.log(`   coluna images depois: ${tamanhoDepois}KB\n`);

    if (CONFIRMAR) {
      const { error: erroUpdate } = await supabase
        .from("properties")
        .update({ images: novasImagens })
        .eq("id", property.id);

      if (erroUpdate) {
        console.error(`   ❌ falha ao gravar o imóvel ${identificador}: ${erroUpdate.message}`);
        falhas++;
      }
    }
  }

  console.log("─".repeat(60));
  console.log(
    `[migrar-fotos] Total: ${totalAntesKB.toFixed(1)}KB -> ${totalDepoisKB.toFixed(1)}KB nas colunas images` +
      (CONFIRMAR ? "" : " (estimado -- nada foi gravado, rode com --confirmar)")
  );
  if (falhas > 0) {
    console.warn(`[migrar-fotos] ${falhas} falha(s) durante a migração -- ver mensagens acima.`);
    process.exitCode = 1;
  } else {
    console.log("[migrar-fotos] Concluído sem falhas. ✅");
  }
}

main().catch((erro) => {
  console.error("[migrar-fotos] Erro inesperado:", erro);
  process.exit(1);
});
