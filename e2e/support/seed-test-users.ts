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
 */
import DatabaseHelper from '../helpers/database.helper';

DatabaseHelper.ensureDefaultTestUsers()
  .then(() => {
    console.log('[seed] Usuários de teste padrão (admin/financeiro/gestão) prontos e confirmados.');
    process.exit(0);
  })
  .catch((erro) => {
    console.error('[seed] Falha ao preparar os usuários de teste:', erro.message);
    process.exit(1);
  });
