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
     * 2 cenários ao mesmo tempo. A máquina do GitHub Actions tem 2 núcleos;
     * acima disso os cenários só disputam processador entre si e começam a
     * falhar por lentidão, e não por defeito de verdade.
     *
     * Para isso funcionar, cada cenário precisa criar os próprios dados e
     * validar só o que ele criou — nunca depender de algo que já estava no
     * banco nem do que outro cenário fez.
     */
    parallel: 2,

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
