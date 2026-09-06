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
     * ⚠️ ATUALIZAÇÃO (06/set/2026, mesmo dia): tirar o --parallel NÃO
     * resolveu -- rodou de novo no CI real (commit ef4d57fa) e o JSON
     * continuou 0 bytes. Ou seja, a hipótese do worker_threads (comentário
     * abaixo, já ultrapassada) estava errada. Mantendo o comentário como
     * histórico da investigação, mas a causa raiz real ainda está sendo
     * procurada -- ver diagnóstico novo logo abaixo (formatter "message").
     *
     * Dado novo mais importante: o tempo entre "Rodando os cenários" e o
     * cucumber-js sair foi de ~3,6 segundos no run sem --parallel -- tempo
     * de menos pra 12 cenários reais de navegador (login, criar imóvel,
     * etc.), igual ao padrão ~1,4s visto ANTES de tirar o --parallel.
     * Ou seja, os cenários provavelmente não estão sendo executados de
     * verdade em nenhum dos dois casos -- não é (só) sobre os formatters
     * perderem a escrita final, é sobre o cucumber-js aparentemente não
     * estar encontrando/rodando os cenários de jeito nenhum neste
     * ambiente. Hipótese em teste: 0 cenários batendo com a tag "@smoke"
     * em CI (por algum motivo de path/cwd diferente do ambiente local) --
     * o cucumber-js 13.2.1 tem um fix recente justamente para não mais
     * "travar" quando 0 cenários rodam (ver changelog/issue #2907), o que
     * bateria com a saída rápida e "limpa" (status 0) que vemos.
     *
     * Motivo histórico de ter tirado o --parallel (comentário original,
     * mantido para não perder o raciocínio, mas a causa real é outra):
     * o cucumber-js 13.x reescreveu o motor de execução paralela pra usar
     * "worker_threads" (changelog da 13.0.0), reescrita recente com mais
     * de um bug de ciclo de vida corrigido depois (13.1.0, 13.2.1 -- ver
     * github.com/cucumber/cucumber-js/issues/2907 e /2912).
     */

    format: [
      'progress-bar',
      'html:e2e/reports/smoke-report.html',
      'json:e2e/reports/smoke-report.json',
      // Diagnóstico novo (06/set/2026, issue #75): grava CADA evento (NDJSON,
      // uma linha por mensagem) conforme acontece, ao contrário do "json"
      // acima que só grava tudo de uma vez no final. Mesmo se o processo
      // morrer/sair cedo demais, o que já tiver acontecido até ali fica
      // gravado -- isso vai dizer exatamente quantos cenários chegaram a
      // começar/terminar antes do cucumber-js sair, e se o problema é "0
      // cenários encontrados" ou "encontrou os 12 mas não rodou/travou no
      // meio". Documentação: github.com/cucumber/cucumber-js/blob/main/docs/formatters.md#message
      'message:e2e/reports/smoke-messages.ndjson',
    ],
    formatOptions: {
      snippetInterface: 'async-await',
    },
    publishQuiet: true,
  },
};
