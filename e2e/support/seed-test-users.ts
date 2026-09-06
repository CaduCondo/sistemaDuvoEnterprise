/**
 * Prepara os usuários de teste padrão (admin/financeiro/gestão) ANTES do
 * Cucumber subir -- ver issue #65.
 *
 * POR QUE ISTO EXISTE SEPARADO DO `BeforeAll` EM hooks.ts
 *
 * As suítes @sistemaCompleto e @smoke rodam com `parallel: 2` (ver
 * e2e/cucumber.*.config.cjs): o Cucumber sobe 2 processos "worker"
 * separados, e cada um deles roda o PRÓPRIO `BeforeAll` de forma
 * independente -- ou seja, `ensureDefaultTestUsers()` roda 2 vezes em
 * paralelo, uma por worker, bem no começo da suíte. O reset em si é
 * idempotente (as duas chamadas escrevem o mesmo valor), mas isso não
 * garante que um cenário do worker A só comece a rodar DEPOIS que o reset do
 * worker B (ou do próprio A) já tenha sido confirmado no banco -- com
 * replicação/latência, uma leitura logo em seguida pode pegar um valor
 * intermediário.
 *
 * Rodando este script uma vez só, aqui, ANTES de `cucumber-js` sequer
 * começar (chamado por scripts/smoke.js), garante que quando os workers
 * sobem, o valor já está gravado e confirmado -- os `BeforeAll` de cada
 * worker continuam existindo como reforço (não fazem mal, é a mesma escrita
 * idempotente), mas deixam de ser a ÚNICA garantia.
 *
 * ⚠️ CAUSA RAIZ DO BUG #75 (06/set/2026): este arquivo mora em
 * `e2e/support/`, e TODOS os configs do Cucumber (`cucumber.smoke.config.cjs`
 * e `cucumber.sistemaCompleto.config.cjs`) têm um `require` que pega TODOS os
 * arquivos .ts dentro de `e2e/support` (em qualquer subpasta) como "arquivo
 * de apoio" -- ou seja, o PRÓPRIO cucumber-js importa este arquivo de novo,
 * antes de rodar qualquer cenário. Sem a proteção abaixo
 * (`require.main === module`), o código logo depois deste comentário rodava
 * TODA VEZ que o arquivo era importado -- inclusive essa segunda vez, dentro
 * do próprio cucumber-js -- e terminava chamando `process.exit(0)` assim que
 * os 3 usuários de teste terminassem de ser gravados (poucos segundos).
 * Isso matava o processo do cucumber-js inteiro por baixo dos panos, ANTES
 * de qualquer cenário @smoke/@sistemaCompleto rodar -- só que com
 * status=0 (saída "limpa"), o que fazia o job do GitHub Actions parecer
 * bem-sucedido. É por isso que os relatórios (JSON/HTML) sempre saíam vazios:
 * o cucumber-js nunca chegava a terminar um cenário sequer para ter o que
 * relatar. Confirmado com o diagnóstico via formatter `message` (evento
 * NDJSON): a última coisa gravada era sempre "testRunHookStarted" -- o
 * `BeforeAll` de hooks.ts mal tinha começado quando o processo morria.
 */
import DatabaseHelper from '../helpers/database.helper';

// Só roda a seed (e só chama process.exit) quando este arquivo é executado
// DIRETAMENTE como script (`ts-node e2e/support/seed-test-users.ts`, via
// scripts/smoke.js) -- nunca quando é apenas importado como módulo, que é
// exatamente o que o `require` do Cucumber faz. Ver o comentário acima.
if (require.main === module) {
  DatabaseHelper.ensureDefaultTestUsers()
    .then(() => {
      console.log('[seed] Usuários de teste padrão (admin/financeiro/gestão) prontos e confirmados.');
      process.exit(0);
    })
    .catch((erro) => {
      console.error('[seed] Falha ao preparar os usuários de teste:', erro.message);
      process.exit(1);
    });
}
