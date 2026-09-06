/**
 * Configuração do Cucumber para a suíte de SMOKE — a rápida, que roda
 * sozinha a cada push.
 *
 * A diferença para `cucumber.config.cjs` (a suíte completa) é só isto:
 *
 *   - `tags: '@smoke'`  -> roda apenas os cenários marcados com @smoke.
 *   - `parallel: 2`     -> roda 2 cenários ao mesmo tempo.
 *
 * É o mesmo vocabulário, os mesmos step definitions e os mesmos arquivos
 * .feature. Não existe uma "pasta de smoke": o que decide quem roda a cada
 * push é a marca @smoke no cenário. Para trazer mais cobertura de volta,
 * marque mais cenários — ver e2e/SMOKE.md.
 */
const path = require('path');

process.env.TS_NODE_PROJECT = path.join(__dirname, 'tsconfig.json');
process.env.TS_NODE_TRANSPILE_ONLY = 'true';

module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['e2e/support/**/*.ts', 'e2e/step-definitions/**/*.ts'],
    paths: ['e2e/features/**/*.feature'],

    // Só os cenários marcados com @smoke.
    tags: '@smoke',

    /*
     * SEM --parallel (06/set/2026, issue #75) — antes era `parallel: 2`.
     *
     * Causa raiz confirmada do "relatório JSON sempre vazio (0 bytes)":
     * o cucumber-js 13.x reescreveu o motor de execução paralela pra usar
     * "worker_threads" (changelog da 13.0.0). Essa reescrita é recente
     * (poucos meses) e já teve mais de um bug de ciclo de vida corrigido
     * em versões seguintes (13.1.0, 13.2.1 -- ver
     * github.com/cucumber/cucumber-js/issues/2907 e /2912). O formatter
     * "json" grava tudo de uma vez só, no finalzinho do run; o formatter
     * "html" grava aos poucos, durante o run inteiro. Com --parallel, o
     * processo principal aparentemente encerra (de forma limpa, sem
     * crash -- confirmado com diagnóstico real, ver issue #75) ANTES de
     * garantir que a escrita final do JSON tenha terminado -- por isso o
     * JSON sai vazio (perde 100% do conteúdo, que só existia numa escrita
     * só) enquanto o HTML sobrevive com a maior parte do conteúdo, mas
     * cortado no final (por isso abre em branco no navegador).
     *
     * Não existe versão mais nova do @cucumber/cucumber corrigindo isso
     * hoje (13.2.1 já é a mais recente). Tirar o --parallel evita o bug:
     * sem paralelismo o motor não usa mais worker_threads, só processa os
     * cenários um de cada vez no processo principal. Deixa a suíte mais
     * lenta, mas troca "rápido e talvez mentindo" por "mais devagar e
     * confiável" -- ver a instrução permanente do Cadu sobre falso
     * positivo em teste automatizado.
     */

    format: [
      'progress-bar',
      'html:e2e/reports/smoke-report.html',
      'json:e2e/reports/smoke-report.json',
    ],
    formatOptions: {
      snippetInterface: 'async-await',
    },
    publishQuiet: true,
  },
};
