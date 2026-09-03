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
 * Desde 03/set/2026 (issue #70): além do e-mail, monta uma página de
 * resumo própria (bonita, com números em destaque e um gráfico simples,
 * sem depender de nenhum JavaScript pesado) e sobe pro bucket `uploads` do
 * Supabase Storage -- o mesmo bucket já usado pelos anexos de
 * locação/recebimento/caução. Isso resolve dois problemas de uma vez:
 *   1. Não precisa mais baixar .zip do GitHub Actions e extrair pra ver o
 *      relatório -- o e-mail já traz um link que abre direto no navegador.
 *   2. O HTML cru gerado pelo Cucumber (que o Cadu tentou abrir em
 *      03/set/2026 e a página ficou em branco) continua existindo como
 *      artifact pra quem quiser o detalhe de cada passo, mas deixa de ser
 *      o link principal -- a página de resumo é só HTML+CSS simples,
 *      sem o bundle JavaScript do Cucumber, então abre igual em qualquer
 *      navegador, sem precisar de servidor local.
 *
 * Ajustado em 03/set/2026 (issue #75, no mesmo dia que o #70 foi ao ar):
 * o Supabase Storage sempre serve arquivo .html como "text/plain" (decisão
 * deles, proteção contra phishing hospedado no domínio do Storage) -- o
 * navegador mostrava o código-fonte em vez de abrir a página. E o link
 * direto do Supabase, por vir de um secret do GitHub, aparecia mascarado
 * como "***" no resumo do Actions. Correção: o e-mail e o resumo do
 * Actions agora linkam pra /api/ci-reports/{runId} no próprio site (ver
 * src/pages/api/ci-reports/[runId].ts), que busca o HTML no Storage e
 * devolve com o Content-Type certo -- e o corpo do e-mail já traz o
 * resumo completo (números, barra, cenários que falharam), não só um link.
 *
 * Lê as seguintes variáveis de ambiente:
 *   RESEND_API_KEY              chave da API do Resend (secret do GitHub).
 *                                Se não estiver configurada, o script AVISA
 *                                e sai com sucesso (não quebra o workflow
 *                                por causa do e-mail).
 *   RESULTADO_SMOKE              resultado do job "smoke": success/failure/
 *                                cancelled/skipped (${{ needs.smoke.result }})
 *   RESULTADO_COMPLETO           idem para o job "sistema_completo"
 *   RUN_URL                      link do run no GitHub Actions
 *   PARA                         e-mail de destino (padrão: stefcadu@gmail.com)
 *   NEXT_PUBLIC_SUPABASE_URL     URL do projeto Supabase (pra subir o resumo)
 *   SUPABASE_SERVICE_ROLE_KEY    chave de serviço (bypassa RLS/políticas do
 *                                bucket -- se faltar, o script só pula essa
 *                                parte e o e-mail sai sem o link direto)
 *   GITHUB_RUN_ID                id do run (já vem pronto do GitHub Actions)
 *   GITHUB_STEP_SUMMARY          arquivo de resumo do step (já vem pronto)
 */
const fs = require("fs");
const path = require("path");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESULTADO_SMOKE = process.env.RESULTADO_SMOKE || "desconhecido";
const RESULTADO_COMPLETO = process.env.RESULTADO_COMPLETO || "desconhecido";
const RUN_URL = process.env.RUN_URL || "";
const PARA = process.env.PARA || "stefcadu@gmail.com";
const DE = "D'Uvo Enterprise CI <noreply@duvoenterprise.com.br>";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUN_ID = process.env.GITHUB_RUN_ID || String(Date.now());
const BUCKET = "uploads";
// Domínio público do site -- não é segredo nenhum, pode aparecer em log
// e em resumo do GitHub Actions sem problema (ao contrário da URL do
// Supabase, que o GitHub mascara como "***" por vir de um secret --
// ver issue #75).
const SITE_URL = process.env.SITE_URL || "https://duvoenterprise.com.br";

/**
 * Lê um relatório JSON do Cucumber e devolve total/falharam/duração e a
 * lista de cenários que falharam (nome da feature + nome do cenário).
 * Formato do Cucumber JSON: array de features, cada uma com `elements`
 * (cenários/backgrounds); um elemento type "scenario" tem `steps`, cada
 * step com `result.status` e `result.duration` (nanosegundos).
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
  let duracaoNs = 0;
  const cenariosFalhos = [];
  for (const feature of features) {
    for (const el of feature.elements || []) {
      if (el.type !== "scenario") continue;
      total++;
      let falhou = false;
      for (const s of el.steps || []) {
        if (s.result && typeof s.result.duration === "number") {
          duracaoNs += s.result.duration;
        }
        if (s.result && s.result.status === "failed") falhou = true;
      }
      if (falhou) {
        falharam++;
        cenariosFalhos.push({ feature: feature.name, cenario: el.name });
      }
    }
  }
  return { total, falharam, duracaoSegundos: duracaoNs / 1e9, cenariosFalhos };
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

function formatarDuracao(segundos) {
  if (!segundos && segundos !== 0) return "?";
  if (segundos < 60) return `${segundos.toFixed(0)}s`;
  const min = Math.floor(segundos / 60);
  const seg = Math.round(segundos % 60);
  return `${min}min ${seg}s`;
}

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Uma barrinha horizontal simples (passou em verde, falhou em vermelho) --
 * SVG puro, sem lib nenhuma, então não tem risco de ficar em branco em
 * nenhum navegador.
 */
function barraSvg(passaram, falharam) {
  const total = passaram + falharam || 1;
  const larguraTotal = 400;
  const larguraPassou = (passaram / total) * larguraTotal;
  const larguraFalhou = larguraTotal - larguraPassou;
  return `
    <svg width="${larguraTotal}" height="24" viewBox="0 0 ${larguraTotal} 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${larguraPassou}" height="24" fill="#22c55e" />
      <rect x="${larguraPassou}" y="0" width="${larguraFalhou}" height="24" fill="#ef4444" />
    </svg>`;
}

function cardDaSuite(nome, resultadoJob, contagem) {
  const emoji = emojiDoResultado(resultadoJob);
  if (!contagem) {
    return `
      <div class="card">
        <h3>${emoji} ${escaparHtml(nome)}</h3>
        <p class="muted">Sem relatório JSON disponível (resultado: ${escaparHtml(resultadoJob)}).</p>
      </div>`;
  }
  const passaram = contagem.total - contagem.falharam;
  const listaFalhas = contagem.cenariosFalhos
    .map(
      (c) =>
        `<li><strong>${escaparHtml(c.feature)}</strong> -- ${escaparHtml(c.cenario)}</li>`
    )
    .join("");
  return `
    <div class="card">
      <h3>${emoji} ${escaparHtml(nome)}</h3>
      <div class="metricas">
        <div class="metrica"><span class="numero">${passaram}/${contagem.total}</span><span class="rotulo">passaram</span></div>
        <div class="metrica"><span class="numero">${contagem.falharam}</span><span class="rotulo">falharam</span></div>
        <div class="metrica"><span class="numero">${formatarDuracao(contagem.duracaoSegundos)}</span><span class="rotulo">duração</span></div>
      </div>
      ${barraSvg(passaram, contagem.falharam)}
      ${
        listaFalhas
          ? `<p class="muted" style="margin-top:16px">Cenários que falharam:</p><ul class="falhas">${listaFalhas}</ul>`
          : ""
      }
    </div>`;
}

/**
 * Monta a página de resumo -- HTML+CSS puro, sem nenhum JavaScript, sem
 * nenhuma dependência externa (fonte, CDN, etc). Abre em qualquer
 * navegador, direto do disco ou por URL, sem precisar de servidor local.
 */
function montarResumoHtml({ tudoPassou, contagemSmoke, contagemCompleto }) {
  const dataHora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resumo dos testes -- D'Uvo Enterprise</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px 16px; }
  .container { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .subtitulo { color: #64748b; font-size: 14px; margin-bottom: 24px; }
  .banner { padding: 16px 20px; border-radius: 10px; font-weight: 600; margin-bottom: 24px; }
  .banner.ok { background: #dcfce7; color: #166534; }
  .banner.erro { background: #fee2e2; color: #991b1b; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .card h3 { margin: 0 0 12px 0; font-size: 16px; }
  .metricas { display: flex; gap: 24px; margin-bottom: 12px; }
  .metrica { display: flex; flex-direction: column; }
  .metrica .numero { font-size: 22px; font-weight: 700; }
  .metrica .rotulo { font-size: 12px; color: #64748b; }
  .muted { color: #64748b; font-size: 13px; }
  ul.falhas { margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; }
  ul.falhas li { margin-bottom: 4px; }
  .rodape { margin-top: 24px; font-size: 12px; color: #94a3b8; }
  .rodape a { color: #2563eb; }
</style>
</head>
<body>
  <div class="container">
    <h1>Resumo dos testes automáticos</h1>
    <p class="subtitulo">D'Uvo Enterprise -- gerado em ${escaparHtml(dataHora)}</p>
    <div class="banner ${tudoPassou ? "ok" : "erro"}">
      ${tudoPassou ? "✅ Tudo passou -- nenhum problema encontrado." : "❌ Algum teste falhou -- ver detalhe abaixo."}
    </div>
    ${cardDaSuite("Smoke", RESULTADO_SMOKE, contagemSmoke)}
    ${cardDaSuite("Sistema completo (2ª rodada)", RESULTADO_COMPLETO, contagemCompleto)}
    <p class="rodape">
      Detalhe passo a passo (com screenshot de cada falha, quando houver):
      <a href="${RUN_URL}">ver o run no GitHub Actions</a> → aba Artifacts.
    </p>
  </div>
</body>
</html>`;
}

/**
 * Mesma barrinha verde/vermelho de barraSvg(), mas em tabela HTML (não
 * SVG) -- forma clássica de fazer uma barra colorida que sobrevive a
 * cliente de e-mail (Gmail, Outlook etc.), que costuma cortar <svg> e
 * <style>. Usada só no corpo do e-mail; a página hospedada continua
 * usando o SVG normal.
 */
function barraEmail(passaram, falharam) {
  const total = passaram + falharam || 1;
  const pctPassou = Math.round((passaram / total) * 100);
  const pctFalhou = 100 - pctPassou;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0;">
      <tr>
        ${pctPassou > 0 ? `<td width="${pctPassou}%" bgcolor="#22c55e" style="height:14px;line-height:14px;font-size:1px;">&nbsp;</td>` : ""}
        ${pctFalhou > 0 ? `<td width="${pctFalhou}%" bgcolor="#ef4444" style="height:14px;line-height:14px;font-size:1px;">&nbsp;</td>` : ""}
      </tr>
    </table>`;
}

/**
 * Card de uma suíte (Smoke / Sistema completo) pronto pra ir dentro do
 * corpo do e-mail -- tudo com estilo inline (sem <style> nem classe),
 * porque cliente de e-mail não respeita CSS externo nem <head>.
 */
function cardEmailSuite(nome, resultadoJob, contagem) {
  const emoji = emojiDoResultado(resultadoJob);
  const caixa = (conteudo) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:12px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 10px 0;font-size:15px;font-weight:600;color:#0f172a;">${emoji} ${escaparHtml(nome)}</p>
        ${conteudo}
      </td></tr>
    </table>`;

  if (!contagem) {
    return caixa(
      `<p style="margin:0;font-size:13px;color:#64748b;">Sem relatório JSON disponível (resultado: ${escaparHtml(resultadoJob)}).</p>`
    );
  }
  const passaram = contagem.total - contagem.falharam;
  const listaFalhas = contagem.cenariosFalhos
    .slice(0, 10)
    .map(
      (c) =>
        `<li style="margin-bottom:4px;"><strong>${escaparHtml(c.feature)}</strong> -- ${escaparHtml(c.cenario)}</li>`
    )
    .join("");
  const maisFalhas =
    contagem.cenariosFalhos.length > 10
      ? `<p style="margin:6px 0 0 0;font-size:12px;color:#94a3b8;">+ ${contagem.cenariosFalhos.length - 10} outro(s) -- ver relatório completo.</p>`
      : "";
  return caixa(`
    <p style="margin:0 0 4px 0;font-size:13px;color:#334155;">
      <strong>${passaram}/${contagem.total}</strong> passaram · <strong>${contagem.falharam}</strong> falharam · ${formatarDuracao(contagem.duracaoSegundos)}
    </p>
    ${barraEmail(passaram, contagem.falharam)}
    ${
      listaFalhas
        ? `<p style="margin:12px 0 4px 0;font-size:12px;color:#64748b;">Cenários que falharam:</p><ul style="margin:0;padding-left:18px;font-size:12px;color:#334155;">${listaFalhas}</ul>${maisFalhas}`
        : ""
    }
  `);
}

/**
 * Sobe um arquivo pro bucket `uploads` do Supabase Storage via REST API
 * (sem precisar instalar @supabase/supabase-js neste job) e devolve a URL
 * pública. Devolve null (e só avisa no log) se faltar configuração ou a
 * chamada falhar -- subir o resumo é um "bônus" do e-mail, não pode
 * quebrar o CI.
 */
async function subirParaStorage(caminhoNoBucket, conteudo, contentType) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.warn(
      "[email] NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados -- pulei o upload do resumo."
    );
    return null;
  }
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${caminhoNoBucket}`;
  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: conteudo,
    });
    if (!resposta.ok) {
      const texto = await resposta.text().catch(() => "");
      console.warn(
        `[email] upload do resumo falhou (status ${resposta.status}): ${texto}`
      );
      return null;
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${caminhoNoBucket}`;
  } catch (erro) {
    console.warn(`[email] erro ao subir o resumo pro Storage: ${erro.message}`);
    return null;
  }
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

  console.log(`[email] resumo: smoke=${RESULTADO_SMOKE} completo=${RESULTADO_COMPLETO}`);
  if (contagemSmoke) console.log(`[email] smoke: ${JSON.stringify(contagemSmoke)}`);
  if (contagemCompleto) console.log(`[email] completo: ${JSON.stringify(contagemCompleto)}`);

  const resumoHtml = montarResumoHtml({ tudoPassou, contagemSmoke, contagemCompleto });
  const urlResumo = await subirParaStorage(
    `ci-reports/${RUN_ID}/resumo.html`,
    resumoHtml,
    "text/html; charset=utf-8"
  );
  // Link fácil de compartilhar, no nosso próprio domínio -- não é a URL
  // direta do Supabase (que o navegador mostra como texto puro em vez de
  // abrir, e que o GitHub mascara como "***" nos resumos por vir de um
  // secret). Ver src/pages/api/ci-reports/[runId].ts e issue #75.
  const urlAmigavel = urlResumo ? `${SITE_URL}/api/ci-reports/${RUN_ID}` : null;
  if (urlResumo) {
    console.log(`[email] resumo publicado em: ${urlResumo}`);
    console.log(`[email] link fácil: ${urlAmigavel}`);
  }

  // Escreve no resumo do próprio step do GitHub Actions (aba "Summary" do
  // run) -- assim quem abre o run também vê o link direto, sem precisar
  // caçar em Artifacts. Ver issue #70. Usa o link amigável (não a URL do
  // Supabase) pra não ser mascarado pelo GitHub -- ver issue #75.
  if (process.env.GITHUB_STEP_SUMMARY) {
    const linhas = [
      `## Resumo dos testes`,
      "",
      linhaDaSuite("Smoke", RESULTADO_SMOKE, contagemSmoke).replace(/<\/?(li|strong)>/g, ""),
      linhaDaSuite("Sistema completo (2ª rodada)", RESULTADO_COMPLETO, contagemCompleto).replace(/<\/?(li|strong)>/g, ""),
      "",
      urlAmigavel
        ? `📊 [Abrir o relatório bonito, direto no navegador](${urlAmigavel})`
        : "_(relatório resumido não pôde ser publicado -- ver log do step)_",
      "",
    ].join("\n");
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, linhas + "\n");
  }

  // O resumo completo (números, barra, cenários que falharam) já vai no
  // corpo do e-mail -- não só um link -- pra dar pra ver tudo sem precisar
  // clicar em nada. Ver issue #75.
  const corpoHtml = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
      <h2 style="margin:0 0 4px 0;font-size:19px;">${assunto}</h2>
      <p style="margin:0 0 18px 0;font-size:13px;color:#64748b;">D'Uvo Enterprise -- relatório automático</p>
      ${cardEmailSuite("Smoke", RESULTADO_SMOKE, contagemSmoke)}
      ${cardEmailSuite("Sistema completo (2ª rodada)", RESULTADO_COMPLETO, contagemCompleto)}
      ${
        urlAmigavel
          ? `<p style="margin:18px 0 6px 0;"><a href="${urlAmigavel}" style="color:#2563eb;font-weight:600;text-decoration:none;">📊 Abrir o relatório completo no navegador</a></p>`
          : ""
      }
      <p style="margin:6px 0 0 0;font-size:12px;color:#94a3b8;">Detalhe passo a passo de cada cenário (com screenshot de cada falha, quando houver): <a href="${RUN_URL}" style="color:#2563eb;">ver o run no GitHub Actions</a> → aba Artifacts.</p>
    </div>
  `;

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
