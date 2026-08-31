#!/usr/bin/env node
/**
 * Roda a suíte de smoke de ponta a ponta com um comando só:
 *
 *     npm run test:smoke
 *
 * O que ele faz, em ordem:
 *   1. Olha se JÁ existe uma aplicação no ar na porta (por exemplo o
 *      `npm run dev` que você deixou aberto). Se existe, usa ela.
 *   2. Se não existe, garante que existe uma versão compilada (compila se
 *      não existir) e sobe a aplicação compilada (`npm run start`).
 *   3. Espera a aplicação responder no endereço de saúde.
 *   4. Abre uma vez cada tela principal, para elas já estarem prontas
 *      quando o teste clicar.
 *   5. Roda os cenários marcados com @smoke.
 *   6. Derruba a aplicação — mas SÓ se foi este script que a subiu — e
 *      devolve o resultado dos testes.
 *
 * POR QUE ISSO EXISTE
 *
 * Antes, quem subia a aplicação para os testes era o Playwright (opção
 * `webServer`). Só que os testes BDD (Cucumber) não passam por aquele
 * arquivo de configuração — então o passo de BDD do GitHub Actions rodava
 * SEM aplicação no ar, e todos os cenários falhavam por nada.
 *
 * E a aplicação sobe compilada, não em modo de desenvolvimento. Em modo de
 * desenvolvimento cada tela é montada na hora em que é aberta pela primeira
 * vez, e esse tempo conta dentro do limite do clique do teste. Medido numa
 * máquina de 2 núcleos, do mesmo tamanho da do GitHub:
 *
 *     tela          modo desenvolvimento (1a abertura)   já compilada
 *     /                       9.298 ms                       35 ms
 *     /dashboard              7.988 ms                       14 ms
 *     /rentals                3.978 ms                       12 ms
 *
 * POR QUE ELE REAPROVEITA UMA APLICAÇÃO JÁ NO AR
 *
 * Na sua máquina é normal deixar o `npm run dev` aberto o dia inteiro. Se
 * este script ignorasse isso, aconteciam DOIS estragos ao mesmo tempo:
 *
 *   - ele tentava subir um segundo servidor na mesma porta 3000 e morria
 *     com "EADDRINUSE: address already in use";
 *   - antes disso, o `next build` reescrevia a pasta `.next` bem embaixo do
 *     `npm run dev`, que passava a reclamar de arquivos que sumiram
 *     ("ENOENT: no such file or directory ... _buildManifest.js").
 *
 * Por isso a PRIMEIRA coisa que ele faz é perguntar na porta se já tem
 * alguém lá. Tendo, ele não compila e não sobe nada — só usa. O passo 4
 * (abrir cada tela uma vez) existe justamente para o caso de essa aplicação
 * ser o modo de desenvolvimento: paga-se a montagem das telas ANTES dos
 * testes, fora do relógio de cada clique.
 */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");
const http = require("http");

const RAIZ = path.resolve(__dirname, "..");

/**
 * Opcoes de linha de comando.
 *
 *   --headed    abre o navegador na tela, para assistir a automacao
 *   --slow[=N]  atrasa cada acao em N ms (padrao 250) para dar pra acompanhar
 *   --porta=N   usa outra porta (padrao 3000), quando a 3000 esta ocupada
 *               por outro programa
 *   --suite=X   qual suite rodar: "smoke" (padrao, rápida) ou
 *               "sistemaCompleto" (todo o resto, roda depois do smoke)
 *
 * Sao lidas aqui, e nao por variavel de ambiente, porque no PowerShell do
 * Windows definir variavel na mesma linha do comando nao funciona como no
 * Linux (`HEADED=true npm run ...` nao existe la).
 */
const argumentosCli = process.argv.slice(2);
const querVer = argumentosCli.includes("--headed");
const argSlow = argumentosCli.find((a) => a.startsWith("--slow"));
const argPorta = argumentosCli.find((a) => a.startsWith("--porta"));
const argSuite = argumentosCli.find((a) => a.startsWith("--suite"));

const SUITES = {
  smoke: {
    config: "e2e/cucumber.smoke.config.cjs",
    label: "cenários marcados com @smoke",
  },
  sistemaCompleto: {
    config: "e2e/cucumber.sistemaCompleto.config.cjs",
    label: "cenários marcados com @sistemaCompleto (tudo que não é @smoke)",
  },
};
const NOME_SUITE = (argSuite && argSuite.split("=")[1]) || "smoke";
const SUITE = SUITES[NOME_SUITE];
if (!SUITE) {
  console.error(
    `[smoke] --suite="${NOME_SUITE}" não existe. Use "smoke" ou "sistemaCompleto".`
  );
  process.exit(1);
}

if (querVer) {
  process.env.HEADED = "true";
}
if (argSlow) {
  const [, valor] = argSlow.split("=");
  process.env.SLOW_MO = valor || "250";
}

const PORTA = Number(
  (argPorta && argPorta.split("=")[1]) || process.env.PORT || 3000
);
const ENDERECO = `http://localhost:${PORTA}`;
const SAUDE = `${ENDERECO}/api/health`;
const ESPERA_MAXIMA_MS = 120000;
const noWindows = process.platform === "win32";

/** Telas que os cenarios de smoke abrem. Aquecidas antes dos testes. */
const TELAS_PARA_AQUECER = [
  "/",
  "/dashboard",
  "/rentals",
  "/payments",
  "/tenants",
  "/properties",
  "/financial",
];

function log(mensagem) {
  console.log(`[smoke] ${mensagem}`);
}

function rodarAteOFim(comando, argumentos, variaveis) {
  return spawnSync(comando, argumentos, {
    cwd: RAIZ,
    stdio: "inherit",
    shell: noWindows,
    env: { ...process.env, ...(variaveis || {}) },
  });
}

function aplicacaoJaCompilada() {
  return fs.existsSync(path.join(RAIZ, ".next", "BUILD_ID"));
}

function consultarSaude() {
  return new Promise((resolve) => {
    const req = http.get(SAUDE, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Tem ALGUEM escutando nessa porta? Diferente de `consultarSaude`: aqui nao
 * importa se responde direito, so se a porta esta tomada. Serve para
 * distinguir "a porta esta livre" de "tem outro programa ai que nao e a
 * nossa aplicacao" — e assim trocar o erro cru de EADDRINUSE por um recado
 * que diz o que fazer.
 */
function portaOcupada() {
  return new Promise((resolve) => {
    const soquete = new net.Socket();
    const responder = (resposta) => {
      soquete.destroy();
      resolve(resposta);
    };
    soquete.setTimeout(1500);
    soquete.once("connect", () => responder(true));
    soquete.once("timeout", () => responder(false));
    soquete.once("error", () => responder(false));
    soquete.connect(PORTA, "127.0.0.1");
  });
}

async function esperarAplicacaoSubir(processo) {
  const limite = Date.now() + ESPERA_MAXIMA_MS;
  while (Date.now() < limite) {
    if (processo.exitCode !== null) {
      throw new Error(
        `A aplicação encerrou sozinha (código ${processo.exitCode}) antes de responder.`
      );
    }
    if (await consultarSaude()) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `A aplicação não respondeu em ${SAUDE} dentro de ${ESPERA_MAXIMA_MS / 1000} segundos.`
  );
}

/** Abre uma tela uma vez e espera ela terminar de carregar. */
function abrirTela(caminho) {
  return new Promise((resolve) => {
    const comeco = Date.now();
    const req = http.get(`${ENDERECO}${caminho}`, (res) => {
      res.resume();
      res.on("end", () => resolve(Date.now() - comeco));
    });
    req.on("error", () => resolve(null));
    req.setTimeout(60000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Abre cada tela uma vez antes dos testes. Em modo de desenvolvimento a
 * primeira abertura de cada tela leva segundos (ela e montada na hora); se
 * isso acontecer durante o teste, conta dentro do limite do clique e o
 * cenario falha por lentidao, nao por defeito.
 */
async function aquecerTelas() {
  log("Abrindo cada tela uma vez, para elas já estarem prontas nos testes...");
  for (const tela of TELAS_PARA_AQUECER) {
    const ms = await abrirTela(tela);
    log(`   ${tela.padEnd(14)} ${ms === null ? "não respondeu" : `${ms} ms`}`);
  }
}

/**
 * Derruba a aplicação. No Windows não basta matar o processo do npm: ele
 * abre o Next como processo filho, que continuaria segurando a porta 3000 e
 * quebraria a próxima execução com "porta em uso".
 */
function derrubar(processo) {
  if (!processo || processo.exitCode !== null) return;
  if (noWindows) {
    spawnSync("taskkill", ["/pid", String(processo.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    try {
      process.kill(-processo.pid, "SIGTERM");
    } catch {
      processo.kill("SIGTERM");
    }
  }
}

async function principal() {
  let servidor = null;

  if (await consultarSaude()) {
    // Alguem ja subiu a aplicacao (normalmente o `npm run dev` aberto ao
    // lado). Nao compilamos e nao subimos nada: compilar agora reescreveria
    // a pasta .next embaixo dele, e subir daria EADDRINUSE.
    log(`Já tem uma aplicação respondendo em ${ENDERECO} — vou usar essa.`);
    log(
      "Não vou compilar nem subir outra (era isso que dava o erro 'address already in use')."
    );
    log(
      "Se for o `npm run dev`, tudo bem: os testes rodam igual, só a primeira abertura de cada tela é mais lenta."
    );
  } else if (await portaOcupada()) {
    log(`A porta ${PORTA} está ocupada, mas quem está lá não respondeu como esta aplicação.`);
    log("Pode ser outro programa, ou a aplicação ainda terminando de subir.");
    log("O que fazer, escolha um:");
    log(`   1. Abra ${ENDERECO} no navegador. Se abrir, espere terminar de carregar e rode de novo.`);
    log("   2. Feche o programa que está usando a porta e rode de novo.");
    log(`   3. Rode em outra porta:  npm run test:smoke -- --porta=3001`);
    process.exit(1);
  } else {
    if (!aplicacaoJaCompilada()) {
      log("Não encontrei a aplicação compilada. Compilando agora (demora ~1-2 min)...");
      const build = rodarAteOFim("npm", ["run", "build"]);
      if (build.status !== 0) {
        log("A compilação falhou. Os testes não chegaram a rodar.");
        process.exit(build.status || 1);
      }
    } else {
      log("Usando a aplicação já compilada em .next (rode `npm run build` se quiser atualizar).");
    }

    log("Subindo a aplicação...");
    servidor = spawn("npm", ["run", "start"], {
      cwd: RAIZ,
      stdio: ["ignore", "inherit", "inherit"],
      shell: noWindows,
      detached: !noWindows,
      env: { ...process.env, PORT: String(PORTA) },
    });
  }

  // Se voce apertar Ctrl+C no meio, o servidor que NOS subimos tem que cair
  // junto — senao ele fica segurando a porta e a proxima execucao quebra.
  const aoInterromper = () => {
    derrubar(servidor);
    process.exit(130);
  };
  process.on("SIGINT", aoInterromper);
  process.on("SIGTERM", aoInterromper);

  let codigoFinal = 1;
  try {
    if (servidor) await esperarAplicacaoSubir(servidor);
    await aquecerTelas();
    log(
      querVer
        ? "Aplicação no ar. Abrindo o navegador para você assistir..."
        : `Aplicação no ar. Rodando os ${SUITE.label}...`
    );

    // No modo visivel roda UM cenario por vez: dois navegadores abrindo ao
    // mesmo tempo e impossivel de acompanhar.
    const argsCucumber = ["cucumber-js", "--config", SUITE.config];
    if (querVer) {
      argsCucumber.push("--parallel", "0");
    }

    // Os testes leem o endereco da aplicacao dessa variavel; se rodarmos em
    // outra porta, eles precisam saber.
    const testes = rodarAteOFim("npx", argsCucumber, {
      SMOKE_BASE_URL: ENDERECO,
      NEXT_PUBLIC_SITE_URL: ENDERECO,
    });
    codigoFinal = testes.status === null ? 1 : testes.status;
  } catch (erro) {
    log(`Erro: ${erro.message}`);
    codigoFinal = 1;
  } finally {
    if (servidor) {
      log("Derrubando a aplicação...");
      derrubar(servidor);
    } else {
      log("A aplicação já estava no ar antes dos testes — deixei ela rodando.");
    }
  }

  process.exit(codigoFinal);
}

principal();
