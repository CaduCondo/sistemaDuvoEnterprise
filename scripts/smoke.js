#!/usr/bin/env node
/**
 * Roda a suíte de smoke de ponta a ponta com um comando só:
 *
 *     npm run test:smoke
 *
 * O que ele faz, em ordem:
 *   1. Garante que existe uma versão compilada da aplicação (compila se
 *      não existir).
 *   2. Sobe a aplicação compilada (`npm run start`).
 *   3. Espera ela responder no endereço de saúde.
 *   4. Roda os cenários marcados com @smoke.
 *   5. Derruba a aplicação e devolve o resultado dos testes.
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
 */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

const RAIZ = path.resolve(__dirname, "..");
const PORTA = process.env.PORT || 3000;
const SAUDE = `http://localhost:${PORTA}/api/health`;
const ESPERA_MAXIMA_MS = 120000;
const noWindows = process.platform === "win32";

function log(mensagem) {
  console.log(`[smoke] ${mensagem}`);
}

function rodarAteOFim(comando, argumentos) {
  return spawnSync(comando, argumentos, {
    cwd: RAIZ,
    stdio: "inherit",
    shell: noWindows,
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
  const servidor = spawn("npm", ["run", "start"], {
    cwd: RAIZ,
    stdio: ["ignore", "inherit", "inherit"],
    shell: noWindows,
    detached: !noWindows,
    env: { ...process.env, PORT: String(PORTA) },
  });

  let codigoFinal = 1;
  try {
    await esperarAplicacaoSubir(servidor);
    log("Aplicação no ar. Rodando os cenários marcados com @smoke...");

    const testes = rodarAteOFim("npx", [
      "cucumber-js",
      "--config",
      "e2e/cucumber.smoke.config.cjs",
    ]);
    codigoFinal = testes.status === null ? 1 : testes.status;
  } catch (erro) {
    log(`Erro: ${erro.message}`);
    codigoFinal = 1;
  } finally {
    log("Derrubando a aplicação...");
    derrubar(servidor);
  }

  process.exit(codigoFinal);
}

principal();
