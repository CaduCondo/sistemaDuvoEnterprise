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
  if (urlResumo) {
    console.log(`[email] resumo publicado em: ${urlResumo}`);
  }

  // Escreve no resumo do próprio step do GitHub Actions (aba "Summary" do
  // run) -- assim quem abre o run também vê o link direto, sem precisar
  // caçar em Artifacts. Ver issue #70.
  if (process.env.GITHUB_STEP_SUMMARY) {
    const linhas = [
      `## Resumo dos testes`,
      "",
      linhaDaSuite("Smoke", RESULTADO_SMOKE, contagemSmoke).replace(/<\/?(li|strong)>/g, ""),
      linhaDaSuite("Sistema completo (2ª rodada)", RESULTADO_COMPLETO, contagemCompleto).replace(/<\/?(li|strong)>/g, ""),
      "",
      urlResumo
        ? `📊 [Abrir o relatório bonito, direto no navegador](${urlResumo})`
        : "_(relatório resumido não pôde ser publicado -- ver log do step)_",
      "",
    ].join("\n");
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, linhas + "\n");
  }

  const corpoHtml = `
    <h2>${assunto}</h2>
    <ul>
      ${linhaDaSuite("Smoke", RESULTADO_SMOKE, contagemSmoke)}
      ${linhaDaSuite("Sistema completo (2ª rodada)", RESULTADO_COMPLETO, contagemCompleto)}
    </ul>
    ${
      urlResumo
        ? `<p><a href="${urlResumo}"><strong>📊 Abrir o relatório de testes</strong></a> -- abre direto no navegador, sem precisar baixar nada.</p>`
        : ""
    }
    <p><a href="${RUN_URL}">Ver o run completo no GitHub Actions</a> (detalhe passo a passo de cada cenário, com screenshot de cada falha, está em Artifacts, na mesma página).</p>
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
