import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Serve a página de resumo dos testes do CI (gerada pelo
 * scripts/enviar-relatorio-email.js e guardada no bucket `uploads` do
 * Supabase Storage) por um link fixo e fácil de compartilhar --
 * https://duvoenterprise.com.br/api/ci-reports/{runId} -- em vez do link
 * direto e feio do Supabase, e sem depender de nenhum secret do GitHub
 * Actions (ver issue #75).
 *
 * Existe porque o Supabase Storage, por decisão deles (proteção contra
 * XSS/phishing hospedado no domínio deles), SEMPRE serve arquivo .html
 * como "Content-Type: text/plain" -- o navegador mostra o código fonte em
 * vez de renderizar a página, não importa o Content-Type que a gente
 * mande no upload. Essa rota busca o HTML no Storage e devolve de novo
 * com o Content-Type certo, a partir do nosso próprio domínio.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  const { runId } = req.query;
  const runIdStr = Array.isArray(runId) ? runId[0] : runId;

  // Só aceita o formato de um run id do GitHub Actions (número). Evita
  // que alguém use essa rota pra buscar qualquer outro caminho do bucket.
  if (!runIdStr || !/^\d+$/.test(runIdStr)) {
    return res.status(400).send("Run id inválido.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return res.status(500).send("Configuração do servidor incompleta.");
  }

  const origemUrl = `${supabaseUrl}/storage/v1/object/public/uploads/ci-reports/${runIdStr}/resumo.html`;

  try {
    const resposta = await fetch(origemUrl);
    if (!resposta.ok) {
      return res
        .status(resposta.status === 404 ? 404 : 502)
        .send(
          resposta.status === 404
            ? "Relatório não encontrado (link expirado ou run id errado)."
            : "Não consegui buscar o relatório agora. Tenta de novo em instantes."
        );
    }
    const html = await resposta.text();
    // Cada run id é único pra sempre (não é reaproveitado pelo GitHub), então
    // dá pra guardar em cache por bastante tempo sem risco de mostrar
    // conteúdo desatualizado.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (erro) {
    console.error("[ci-reports] erro ao buscar o relatório:", erro);
    return res.status(502).send("Não consegui buscar o relatório agora. Tenta de novo em instantes.");
  }
}
