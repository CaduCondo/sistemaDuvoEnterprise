#!/usr/bin/env node
/**
 * Envia um e-mail com o resumo dos testes do CI, depois que a rodada
 * completa (Smoke + Sistema completo) termina -- ver issue #69.
 *
 * Roda dentro do job "notificar_por_email" de .github/workflows/smoke.yml,
 * depois que os artefatos smoke-report/sistema-completo-report (gerados
 * sempre, ver issue #68) foram baixados para relatorios/smoke e
 * relatorios/completo.
 *
 * Lê as seguintes variáveis de ambiente:
 *   RESEND_API_KEY      chave da API do Resend (secret do GitHub). Se não
 *                        estiver configurada, o script AVISA e sai com
 *                        sucesso (não quebra o workflow por causa do
 *                        e-mail -- isso não é um teste, é uma notificação).
 *   RESULTADO_SMOKE      resultado do job "smoke": success/failure/
 *                        cancelled/skipped (${{ needs.smoke.result }})
 *   RESULTADO_COMPLETO   idem para o job "sistema_completo"
 *   RUN_URL              link do run no GitHub Actions
 *   PARA                 e-mail de destino (padrão: stefcadu@gmail.com)
 */
const fs = require("fs");
const path = require("path");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESULTADO_SMOKE = process.env.RESULTADO_SMOKE || "desconhecido";
const RESULTADO_COMPLETO = process.env.RESULTADO_COMPLETO || "desconhecido";
const RUN_URL = process.env.RUN_URL || "";
const PARA = process.env.PARA || "stefcadu@gmail.com";
const DE = "D'Uvo Enterprise CI <noreply@duvoenterprise.com.br>";

/**
 * Lê um relatório JSON do Cucumber e conta cenários totais/falhos.
 * Formato do Cucumber JSON: array de features, cada uma com `elements`
 * (cenários/backgrounds); um elemento type "scenario" tem `steps`, cada
 * step com `result.status`. Um cenário falhou se algum step falhou.
 */
function contarCenarios(caminhoJson) {
  if (!fs.existsSync(caminhoJson)) return null;
  let features;
  try {
    features = JSON.parse(fs.readFileSync(caminhoJson, "utf8"));
  } catch (erro) {
    console.warn(`[email] não consegui ler ${caminhoJson}: ${erro.message}`);
    return null;
  }
  let total = 0;
  let falharam = 0;
  for (const feature of features) {
    for (const el of feature.elements || []) {
      if (el.type !== "scenario") continue;
      total++;
      const falhou = (el.steps || []).some(
        (s) => s.result && s.result.status === "failed"
      );
      if (falhou) falharam++;
    }
  }
  return { total, falharam };
}

function emojiDoResultado(resultado) {
  if (resultado === "success") return "✅";
  if (resultado === "failure") return "❌";
  if (resultado === "cancelled") return "⚠️";
  if (resultado === "skipped") return "⏭️";
  return "❔";
}

function linhaDaSuite(nome, resultadoJob, contagem) {
  const emoji = emojiDoResultado(resultadoJob);
  let detalhe = resultadoJob;
  if (contagem) {
    detalhe += ` -- ${contagem.total - contagem.falharam}/${contagem.total} cenários passaram`;
    if (contagem.falharam > 0) detalhe += ` (${contagem.falharam} falharam)`;
  }
  return `<li>${emoji} <strong>${nome}:</strong> ${detalhe}</li>`;
}

async function principal() {
  const contagemSmoke = contarCenarios(
    path.join("relatorios", "smoke", "smoke-report.json")
  );
  const contagemCompleto = contarCenarios(
    path.join("relatorios", "completo", "sistema-completo-report.json")
  );

  const tudoPassou =
    RESULTADO_SMOKE === "success" &&
    (RESULTADO_COMPLETO === "success" || RESULTADO_COMPLETO === "skipped");
  const assunto = tudoPassou
    ? "✅ CI passou -- relatório de testes"
    : "❌ CI com problema -- relatório de testes";

  const corpoHtml = `
    <h2>${assunto}</h2>
    <ul>
      ${linhaDaSuite("Smoke", RESULTADO_SMOKE, contagemSmoke)}
      ${linhaDaSuite("Sistema completo (2ª rodada)", RESULTADO_COMPLETO, contagemCompleto)}
    </ul>
    <p><a href="${RUN_URL}">Ver o run completo no GitHub Actions</a> (o relatório em HTML de cada rodada está em Artifacts, na mesma página).</p>
  `;

  console.log(`[email] resumo: smoke=${RESULTADO_SMOKE} completo=${RESULTADO_COMPLETO}`);
  if (contagemSmoke) console.log(`[email] smoke: ${JSON.stringify(contagemSmoke)}`);
  if (contagemCompleto) console.log(`[email] completo: ${JSON.stringify(contagemCompleto)}`);

  if (!RESEND_API_KEY) {
    console.warn(
      "[email] RESEND_API_KEY não configurada -- pulei o envio do e-mail. " +
      "Para ativar, adicione o secret RESEND_API_KEY em Settings > Secrets and variables > Actions."
    );
    return;
  }

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: DE,
      to: [PARA],
      subject: assunto,
      html: corpoHtml,
    }),
  });

  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => "");
    console.error(`[email] Resend recusou o envio (status ${resposta.status}): ${texto}`);
    // Não derruba o job por causa disso -- e-mail é uma notificação, não um teste.
    return;
  }

  console.log("[email] e-mail enviado com sucesso.");
}

principal().catch((erro) => {
  console.error(`[email] erro inesperado: ${erro.message}`);
  // Mesmo um erro inesperado no envio do e-mail não deve derrubar o CI.
});
