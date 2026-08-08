/**
 * Configuração do Cucumber (BDD) para os testes E2E.
 *
 * Formato CommonJS puro: o carregador de configuração do @cucumber/cucumber
 * importa arquivos ".ts"/".mjs" como ESM nativo, o que quebra com o restante
 * do projeto (tsconfig raiz usa "module": "esnext" + paths customizados).
 * Usar ".cjs" evita esse problema e carrega de forma síncrona via require().
 */
const path = require('path');

// Faz o ts-node transpilar os step-definitions em CommonJS (o tsconfig raiz
// usa "esnext", que não funciona com o require() usado pelo Cucumber).
process.env.TS_NODE_PROJECT = path.join(__dirname, 'tsconfig.json');
process.env.TS_NODE_TRANSPILE_ONLY = 'true';

module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['e2e/support/**/*.ts', 'e2e/step-definitions/**/*.ts'],
    paths: ['e2e/features/**/*.feature'],
    format: [
      'progress-bar',
      'html:e2e/reports/cucumber-report.html',
      'json:e2e/reports/cucumber-report.json',
    ],
    formatOptions: {
      snippetInterface: 'async-await',
    },
    publishQuiet: true,
  },
};
