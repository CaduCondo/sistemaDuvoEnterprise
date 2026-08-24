# 🧪 Testes automatizados no GitHub Actions

> Reescrito em 23/ago/2026. A versão anterior descrevia uma esteira que não
> existe mais: falava em 2 workflows (hoje são 4), em Node 18 (hoje 22) e
> dizia que a suíte completa rodava a cada push (hoje ela é manual). Se algo
> aqui divergir do que está em `.github/workflows/`, os arquivos mandam.

## Os 4 workflows

| Workflow | Arquivo | O que faz | Quando roda | Duração |
|---|---|---|---|---|
| **Smoke Test** | `smoke.yml` | Roda os cenários BDD marcados com `@smoke`. **É o portão**: se ficar vermelho, alguma coisa quebrou de verdade. | Todo push e PR em `main`/`develop`, ou manual | ~2 min |
| **Trava de ambiente** | `trava-ambiente.yml` | Confere que a trava que impede produção de subir apontando para o banco de DEV continua funcionando. Não usa banco, nem navegador, nem segredo. | Todo push e PR | ~12 s |
| **E2E Tests (suíte completa - manual)** | `e2e-tests.yml` | A suíte antiga inteira (Playwright + Cucumber). | **Só manual** (Actions → Run workflow) | 10-60 min |
| **Sync from Vercel (Auto)** | `sync-from-vercel.yml` | Herança de quando se usava o Softgen; hoje provavelmente não acha nada para sincronizar. Ver [SETUP_GITHUB_AUTO_SYNC.md](./SETUP_GITHUB_AUTO_SYNC.md). | 1x/dia às 20h ou manual | ~15 s |

Os quatro são independentes e podem rodar ao mesmo tempo.

## Por que a suíte completa virou manual

Ela falhava em **todos** os pushes há semanas, levando cerca de 60 minutos por
execução. Um teste que falha sempre não avisa nada: vira ruído, e todo mundo
aprende a ignorar o vermelho — e ainda trava qualquer mudança nova sem apontar
problema real.

Foram encontrados três defeitos na esteira, todos medidos antes de serem
corrigidos, mais um quarto à parte. A história completa, com os números, está
em **[e2e/SMOKE.md](../e2e/SMOKE.md)** — o resumo é: os testes rodavam em
fila, cada falha custava 3 minutos por causa das repetições automáticas, e a
aplicação subia em modo de desenvolvimento (onde cada tela leva segundos para
ser montada na primeira abertura, tempo que conta dentro do limite do clique).

A suíte continua no repositório. A volta é por partes: ver a seção seguinte.

## Como religar um pedaço da suíte antiga

O que decide se um cenário roda a cada push é a **marca `@smoke`** escrita
acima dele, no arquivo `.feature`. Não existe pasta separada.

1. Escolha um cenário em `e2e/features/*.feature`.
2. Rode ele sozinho e conserte até passar de forma confiável:
   ```
   npx cucumber-js --config e2e/cucumber.config.cjs --name "parte do nome do cenário"
   ```
3. Escreva `@smoke` na linha acima do `Cenário:`.
4. Pronto — ele passa a rodar a cada push.

## Rodando na sua máquina

```bash
npm run test:smoke      # sobe a aplicação compilada e roda os cenários @smoke
npm run test:bdd:smoke  # só os cenários @smoke, com a aplicação já rodando
npm run test:bdd        # a suíte BDD completa
npm run test:e2e        # a suíte Playwright completa
```

`npm run test:smoke` faz tudo sozinho: compila (se precisar), sobe a
aplicação, espera ela responder, roda os cenários em paralelo e derruba a
aplicação no fim. Ver `scripts/smoke.js`.

## Node 22, não 20

O Cucumber 13 só funciona em Node 22, 24 ou 26+. Com Node 20 ele nem começa:

```
Cucumber can only run on Node.js versions 22 || 24 || >=26.
```

Os workflows usam Node 22. Se você criar um workflow novo que rode testes,
use 22 também.

## Configuração: os 3 secrets do Supabase

Os testes usam o banco de **DEV**. Em **Settings → Secrets and variables →
Actions**, precisam existir:

| Secret | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |

⚠️ A `service_role` dá acesso total ao banco: nunca vai para o código, só
para os secrets. E os três devem apontar para **DEV**, nunca para produção —
os testes criam e apagam dados. Qual banco pertence a qual ambiente está em
`supabase-environments.json`.

## Lendo o resultado

Actions → clique na execução. Cada passo pode ser aberto e mostra o log.

Quando o Smoke Test falha, ele guarda um artefato chamado `smoke-report` com
o relatório em HTML, o JSON e os screenshots das falhas. Baixe, extraia e
abra o `.html`.

Uma observação que vale mais que qualquer relatório: **a mensagem quase sempre
está no log do passo que ficou vermelho**, em texto claro. A primeira execução
do Smoke Test, por exemplo, falhou em 1m49s com a frase exata do problema na
tela (a versão do Node). O valor de uma esteira rápida é justamente esse.

## Problemas comuns

**"Cucumber can only run on Node.js versions..."**
O workflow está com `node-version: '20'`. Troque para `'22'`.

**Um cenário só passa às vezes.**
Não repita até passar. A suíte de smoke não tem repetição automática de
propósito: cenário instável é cenário com defeito. As causas mais comuns são
depender de um dado que já estava no banco, ou depender do que outro cenário
criou — os cenários rodam **ao mesmo tempo**, cada um tem que criar e validar
o próprio dado.

**"Missing required secrets" / variáveis vazias.**
Faltam os 3 secrets acima.

**"Build failed".**
Rode `npm run build` na sua máquina; o erro é o mesmo.

**A suíte completa demora demais.**
É esperado. Ela é manual justamente por isso. Se precisar rodar, Actions →
"E2E Tests (suíte completa - manual)" → Run workflow. Há uma opção para
incluir também os projetos por tag, que demora bem mais — deixe desligada a
menos que precise.

## Escrevendo testes novos

Os testes deste projeto são **BDD**: cenários escritos em português
(Dado/Quando/Então) nos arquivos `e2e/features/*.feature`, com os passos
implementados em `e2e/step-definitions/`.

Antes de inventar um passo novo, **procure em `e2e/step-definitions/common.steps.ts`**
— quase tudo o que se precisa (clicar, preencher, ver botão, fazer login, ver
o dashboard) já existe. Repetir um passo com outro nome cria dialeto e, se o
texto colidir, o Cucumber acusa "ambiguous step".

Regras para um cenário entrar no `@smoke`:

1. **Rápido** — a suíte inteira tem que terminar em poucos minutos.
2. **Confiável** — se só passa às vezes, está com defeito.
3. **Cria o próprio dado** — nunca depender do banco nem de outro cenário.

## Documentação relacionada

- [e2e/SMOKE.md](../e2e/SMOKE.md) — como a suíte de smoke funciona e a história dos defeitos encontrados
- [e2e/README.md](../e2e/README.md) — guia geral dos testes
- [e2e/COMANDOS.md](../e2e/COMANDOS.md) — comandos
- [DEPLOYMENT.md](./DEPLOYMENT.md) — deploy e a trava de ambiente
