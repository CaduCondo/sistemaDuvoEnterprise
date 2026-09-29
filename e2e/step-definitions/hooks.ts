import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import DatabaseHelper from '../helpers/database.helper';
import TEST_CONFIG from '../config/test.config';

/**
 * Tempo máximo de CADA passo (não do cenário inteiro).
 *
 * ⚠️ Baixado de 60s para 20s em 07/set/2026 (issue #66) -- o motivo é o
 * custo das FALHAS, não o das passagens. Um passo que passa leva 1-3s; quem
 * consome os 60s é sempre um passo que vai falhar (espera um elemento que
 * nunca aparece). Como a rodada @sistemaCompleto tem hoje dezenas de
 * cenários vermelhos, esses 60s por falha somavam mais de 30 minutos e
 * estouravam o limite do job -- o relatório nunca era gerado e ficávamos
 * sem saber o que estava falhando de verdade.
 *
 * 20s continua folgado: no smoke real, o passo mais lento (compilar +
 * navegar + login) fica bem abaixo disso.
 */
setDefaultTimeout(20 * 1000);

// Garante que os usuários de teste (admin/financeiro/corretor) existem antes
// de qualquer cenário rodar.
//
// Redundante de propósito com e2e/support/seed-test-users.ts (issue #65):
// aquele script já roda isso uma vez, fora do Cucumber, antes de qualquer
// worker subir -- é a garantia de verdade quando se roda via
// `npm run test:smoke`/`test:completo` (scripts/smoke.js). Este BeforeAll
// continua aqui como rede de segurança para quem rodar `npx cucumber-js`
// direto (sem passar pelo smoke.js) -- com `parallel: 2` ele roda uma vez
// por worker, mas como o reset é idempotente isso não causa problema, só
// reforça o mesmo valor.
BeforeAll(async function () {
  await DatabaseHelper.ensureDefaultTestUsers();

  // Varre e apaga sobras de rodadas anteriores (issue #89). A limpeza do
  // fim (AfterAll) só roda se a rodada CHEGAR ao fim -- nas várias vezes em
  // que o job foi cancelado no limite de tempo, tudo ficou para trás. Como
  // resultado, o banco de DEV foi acumulando imóvel e inquilino de teste
  // sem parar. Limpar também na entrada garante que o estrago não se
  // acumule mesmo quando a rodada morre no meio.
  await DatabaseHelper.limparPeloSeloDeTeste();
});

/**
 * Onde ficam as evidências de cada cenário (pedido do Cadu, 29/set/2026):
 *
 * - Cenário que PASSA  -> uma FOTO da tela no fim, anexada ao relatório logo
 *   depois do último passo. É a prova de que o último passo foi validado.
 * - Cenário que FALHA  -> a foto E o VÍDEO da execução inteira, anexados do
 *   mesmo jeito, para dar pra ver o que a tela fez até quebrar.
 *
 * O vídeo é gravado SEMPRE (o Playwright não sabe adivinhar quem vai falhar),
 * mas é apagado assim que o cenário passa -- senão a rodada inteira guardaria
 * 140 vídeos que ninguém vai abrir.
 */
const PASTA_DE_VIDEOS = 'e2e/reports/videos';
const PASTA_DE_FOTOS = 'e2e/reports/screenshots';

function nomeDeArquivo(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

Before(async function (this: CustomWorld, { pickle }) {
  // HEADED=true abre o navegador na tela; SLOW_MO atrasa cada acao para dar
  // tempo de acompanhar. Os dois sao ligados por `npm run test:smoke:ver`.
  this.browser = await chromium.launch({
    headless: process.env.HEADED !== 'true',
    slowMo: Number(process.env.SLOW_MO || 0),
  });
  // ✅ CORREÇÃO: sem baseURL, todo page.goto('/') (ou qualquer caminho
  // relativo) quebrava com "Cannot navigate to invalid URL" - os testes BDD
  // (cucumber) não passam por playwright.config.ts (que só vale pra
  // `npm run test:e2e`), então precisam da própria baseURL aqui.
  this.context = await this.browser.newContext({
    viewport: { width: 1280, height: 720 },
    baseURL: TEST_CONFIG.baseUrl,
    // Grava o vídeo de todo cenário; quem passa tem o vídeo descartado no
    // After (ver explicação acima).
    recordVideo: { dir: PASTA_DE_VIDEOS, size: { width: 1280, height: 720 } },
  });
  this.page = await this.context.newPage();

  // Guarda os erros do navegador para a mensagem da falha (ver
  // CustomWorld.errosDoNavegador).
  this.errosDoNavegador = [];
  this.page.on('console', (msg) => {
    if (msg.type() === 'error') this.errosDoNavegador.push(`console: ${msg.text()}`);
  });
  this.page.on('pageerror', (erro) => {
    this.errosDoNavegador.push(`exceção: ${erro.message}`);
  });

  this.loginPage = new LoginPage(this.page);
  this.dashboardPage = new DashboardPage(this.page);
  this.testData = { scenarioName: pickle?.name };
});

/**
 * Rede de segurança contra o defeito que derrubou 128 dos 138 cenários em
 * 07/set/2026 (issues #65/#66).
 *
 * Alguns cenários MEXEM na senha de usuários ("Esqueci minha senha" troca a
 * senha por uma temporária; reset/troca de senha pelo admin também). Se um
 * deles pegar a conta compartilhada (admin@teste.com), todo cenário
 * seguinte falha no login -- e o motivo fica invisível, porque o erro
 * aparece em 100+ cenários que não têm nada a ver com senha.
 *
 * Todo cenário assim deve levar a tag @mexeComSenhaDeUsuario. Este hook
 * ressemeia os usuários padrão logo depois dele, devolvendo as senhas
 * conhecidas -- mesmo que o cenário tenha falhado no meio.
 */
After({ tags: '@mexeComSenhaDeUsuario' }, async function () {
  await DatabaseHelper.ensureDefaultTestUsers();
});

After(async function (this: CustomWorld, { result, pickle }) {
  const fs = await import('fs');
  const falhou = result?.status === 'FAILED';
  const nome = nomeDeArquivo(pickle?.name || this.testData?.scenarioName || 'cenario');

  // ── 1. A FOTO do último passo ────────────────────────────────────────────
  // Tirada ANTES de fechar a página, com a tela exatamente como ficou no fim
  // do cenário. Vai anexada ao relatório: em cenário que passou, é a prova de
  // que o último passo foi validado; em cenário que falhou, mostra a tela no
  // momento da quebra.
  if (this.page && !this.page.isClosed()) {
    try {
      const foto = await this.page.screenshot({ fullPage: true });
      fs.mkdirSync(PASTA_DE_FOTOS, { recursive: true });
      fs.writeFileSync(`${PASTA_DE_FOTOS}/${falhou ? 'FALHOU-' : ''}${nome}.png`, foto);
      this.attach(foto, 'image/png');
      this.attach(
        falhou
          ? `📷 Tela no momento da falha do cenário "${pickle?.name}".`
          : `📷 Prova do último passo do cenário "${pickle?.name}" — validado com sucesso.`,
        'text/plain'
      );
    } catch {
      // Uma foto que não saiu nunca pode derrubar um cenário que passou.
      this.attach('⚠️ Não consegui tirar a foto final desta tela.', 'text/plain');
    }
  }

  // ── 2. O VÍDEO ───────────────────────────────────────────────────────────
  // O arquivo só existe depois que o contexto fecha -- por isso o caminho é
  // pedido antes, mas lido depois.
  const video = this.page?.video();
  const caminhoDoVideo = await video?.path().catch(() => undefined);

  await this.page?.close().catch(() => {});
  await this.context?.close().catch(() => {});
  await this.browser?.close().catch(() => {});

  if (caminhoDoVideo) {
    try {
      if (falhou) {
        const destino = `${PASTA_DE_VIDEOS}/FALHOU-${nome}.webm`;
        fs.renameSync(caminhoDoVideo, destino);
        const bytes = fs.readFileSync(destino);
        this.attach(bytes, 'video/webm');
        this.attach(
          `🎥 Vídeo da execução deste cenário até a falha (também guardado como ${destino}).`,
          'text/plain'
        );
      } else {
        // Passou: o vídeo não serve para nada e só pesaria o relatório.
        fs.unlinkSync(caminhoDoVideo);
      }
    } catch {
      if (falhou) this.attach('⚠️ O vídeo deste cenário não pôde ser recuperado.', 'text/plain');
    }
  }
});

// Remove dados de teste (locações, imóveis, inquilinos, localizações) criados
// durante a execução. Usuários fixos de teste são mantidos.
// 60 segundos (o padrão) não bastavam: a limpeza apaga locações, imóveis,
// inquilinos e localizações de todos os cenários da rodada, uma tabela de cada
// vez. Quando ela estoura o tempo, os dados de teste ficam para trás no banco.
AfterAll({ timeout: 300000 }, async function () {
  await DatabaseHelper.cleanupAllTestData();
});
