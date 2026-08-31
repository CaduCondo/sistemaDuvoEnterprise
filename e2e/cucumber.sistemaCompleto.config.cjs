/**
 * Configuração do Cucumber para a suíte "sistema completo" — a segunda
 * rodada, que roda depois do @smoke e cobre TODAS as regras que o smoke não
 * cobriu, sem repetir nenhum cenário.
 *
 * Como isso é garantido: todo cenário do repositório carrega exatamente uma
 * marca de execução — `@smoke` OU `@sistemaCompleto` — nunca as duas. Quem
 * decide qual é o número de cada arquivo em `e2e/features/`. Um cenário sem
 * nenhuma das duas está de propósito fora das duas rodadas (ver comentário
 * acima dele: ou é `@quebrado` — defeito conhecido do teste, não do sistema
 * — ou está esperando uma funcionalidade que ainda não existe).
 *
 * É o mesmo vocabulário, os mesmos step definitions e os mesmos arquivos
 * .feature do `cucumber.config.cjs` — só muda a marca filtrada.
 */
const path = require('path');

process.env.TS_NODE_PROJECT = path.join(__dirname, 'tsconfig.json');
process.env.TS_NODE_TRANSPILE_ONLY = 'true';

module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['e2e/support/**/*.ts', 'e2e/step-definitions/**/*.ts'],
    paths: ['e2e/features/**/*.feature'],

    // Todos os cenários marcados com @sistemaCompleto — por construção,
    // "tudo que o @smoke não cobriu" (ver e2e/SMOKE.md).
    tags: '@sistemaCompleto',

    // Mesma lógica do smoke: 2 núcleos disponíveis no GitHub Actions.
    parallel: 2,

    format: [
      'progress-bar',
      'html:e2e/reports/sistema-completo-report.html',
      'json:e2e/reports/sistema-completo-report.json',
    ],
    formatOptions: {
      snippetInterface: 'async-await',
    },
    publishQuiet: true,
  },
};
