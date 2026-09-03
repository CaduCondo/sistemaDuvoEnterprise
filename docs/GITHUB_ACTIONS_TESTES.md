# 🧪 Testes automatizados no GitHub Actions

> Reescrito em 31/ago/2026. A versão anterior descrevia a suíte completa como
> "manual" — hoje ela roda sozinha, automaticamente, logo depois do smoke
> passar (job `sistema_completo` dentro do próprio workflow `smoke.yml`). Se
> algo aqui divergir do que está em `.github/workflows/`, os arquivos mandam.

## Os 4 workflows

| Workflow | Arquivo | O que faz | Quando roda | Duração |
|---|---|---|---|---|
| **Smoke Test** | `smoke.yml` | **Job 1 (`smoke`)**: roda os cenários BDD marcados com `@smoke`. É o portão rápido — se ficar vermelho, alguma coisa importante quebrou de verdade. **Job 2 (`sistema_completo`)**: só começa depois que o job 1 passar; roda TODOS os cenários marcados `@sistemaCompleto` (todas as regras de negócio que o smoke não cobre). | Todo push e PR em `main`/`develop`, ou manual | smoke: ~2-5 min · sistema completo: ~15-25 min |
| **Trava de ambiente** | `trava-ambiente.yml` | Confere que a trava que impede produção de subir apontando para o banco de DEV continua funcionando. Não usa banco, nem navegador, nem segredo. | Todo push e PR | ~12 s |
| **E2E Tests (suíte completa - manual)** | `e2e-tests.yml` | A suíte Playwright completa (permissões, segurança, performance, stress — fora do BDD). Fica manual porque cobre um tipo de teste diferente do BDD e ainda não foi toda revisada. | **Só manual** (Actions → Run workflow) | 10-60 min |
| **Sync from Vercel (Auto)** | `sync-from-vercel.yml` | Herança de quando se usava o Softgen; hoje provavelmente não acha nada para sincronizar. Ver [SETUP_GITHUB_AUTO_SYNC.md](./SETUP_GITHUB_AUTO_SYNC.md). | 1x/dia às 20h ou manual | ~15 s |

Os quatro são independentes e podem rodar ao mesmo tempo, exceto os dois jobs
de `smoke.yml`: o `sistema_completo` só começa quando o `smoke` termina e
passa (`needs: smoke`).

## As duas rodadas do BDD, e por que existem duas

**Rodada 1 — `@smoke`.** Um punhado de cenários (hoje 12): login, abrir o
anúncio público, criar imóvel, criar inquilino, criar locação, receber
caução, e os dois cenários essenciais da rescisão (gerar dois recebimentos,
não contaminar as taxas). Termina em minutos. É o "pode seguir" ou "parou de
pé" — o sinal que se olha primeiro depois de um push.

**Rodada 2 — `@sistemaCompleto`.** Todo o resto: cada regra de negócio
detalhada, arquivo por arquivo. Mais lenta, mas não atrasa o sinal rápido da
rodada 1 porque só começa depois dela. Cobre por definição tudo que o smoke
não cobre — todo cenário do repositório tem uma marca ou outra, nunca as
duas (ver [e2e/SMOKE.md](../e2e/SMOKE.md) para a explicação completa, e as
exceções: cenários `@quebrado` — defeito conhecido do teste — e cenários sem
marca nenhuma, que esperam uma funcionalidade que ainda não existe).

Por que não voltar a rodar tudo junto, como era antes: a suíte antiga (hoje
`e2e-tests.yml`) rodava tudo de uma vez a cada push, levava ~60 minutos e
falhava sempre — um teste que falha sempre não avisa nada, vira ruído, e todo
mundo aprende a ignorar o vermelho. Dividir em duas rodadas sequenciais dá o
melhor dos dois mundos: resposta rápida e confiável logo no primeiro sinal, e
cobertura completa das regras de negócio na sequência, sem re-testar o que a
rodada 1 já validou.

## Como mover um cenário entre as rodadas

O que decide em qual rodada um cenário roda é a marca escrita acima dele, no
arquivo `.feature`: `@smoke` ou `@sistemaCompleto`. Não existe pasta
separada.

- Um cenário da rodada 2 que precisa de resposta mais rápida (por exemplo,
  proteger um bug crítico recém-corrigido): troque `@sistemaCompleto` por
  `@smoke`.
- Um cenário `@quebrado` (defeito conhecido do teste, não do sistema) que foi
  consertado: troque `@quebrado` por `@sistemaCompleto`.

Cada arquivo `.feature` também carrega uma tag de página (`@imoveis`,
`@locacoes`, `@rescisao` etc. — ver [e2e/SMOKE.md](../e2e/SMOKE.md)), útil
para rodar só os cenários de uma tela:

```
npx cucumber-js --config e2e/cucumber.config.cjs --tags "@rescisao"
```

## Rodando na sua máquina

```bash
npm run test:smoke                    # sobe a aplicação e roda os cenários @smoke
npm run test:completo                 # sobe a aplicação e roda os cenários @sistemaCompleto
npm run test:bdd:smoke                # só os cenários @smoke, com a aplicação já rodando
npm run test:bdd:sistemaCompleto      # só os cenários @sistemaCompleto, com a aplicação já rodando
npm run test:bdd                      # a suíte BDD inteira (as duas rodadas juntas)
npm run test:e2e                      # a suíte Playwright completa
```

`npm run test:smoke` e `npm run test:completo` fazem tudo sozinhos: compilam
(se precisar), sobem a aplicação, esperam ela responder, rodam os cenários em
paralelo e derrubam a aplicação no fim. Ver `scripts/smoke.js`.

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

⚠️ Resolvido em 02/set/2026 (issue #68): o Smoke Test (job `smoke`) sempre
guarda um artefato chamado `smoke-report`, e o Sistema Completo (job
`sistema_completo`) sempre guarda `sistema-completo-report` — passando ou
falhando, não só quando quebra como era antes. Os dois trazem o relatório em
HTML, o JSON e os screenshots das falhas (quando houver).

⚠️ O `.html` cru gerado pelo Cucumber (o que vem dentro desse artefato) usa
um bundle de JavaScript pesado — em alguns navegadores/computadores, abrir
esse arquivo direto (duplo-clique, sem servidor) pode ficar em branco (foi o
que aconteceu com o Cadu em 03/set/2026 tentando abrir um desses). Esse
`.html` continua existindo pra quem quer o detalhe de cada passo, mas **não
é mais o jeito recomendado de olhar o resultado** — use o link do e-mail ou
o resumo do run (próxima seção), que são HTML+CSS simples e abrem em
qualquer navegador.

Uma observação que vale mais que qualquer relatório: **a mensagem quase
sempre está no log do passo que ficou vermelho**, em texto claro.

## E-mail com o resumo (issues #69, #70 e #75)

Depois que a rodada completa termina (Smoke + Sistema completo, passando ou
falhando), o job `notificar_por_email` manda um e-mail para
`stefcadu@gmail.com` com o resumo completo de cada rodada — quantos cenários
passaram/falharam, quanto tempo levou e, se algum cenário falhou, uma
barrinha verde/vermelha e o nome de cada cenário que quebrou, tudo já **no
corpo do e-mail**, sem precisar clicar em nada. Usa o
[Resend](https://resend.com) (mesmo serviço já usado para recuperação de
senha, ver `src/pages/api/send-password-recovery.ts`), lendo a chave do
secret `RESEND_API_KEY` do GitHub — sem esse secret configurado, o job só
avisa no log e não quebra o CI por causa disso (e-mail é notificação, não
teste). Script: `scripts/enviar-relatorio-email.js`.

Desde 03/set/2026 (issue #70), o mesmo script também monta uma **página de
resumo própria** (o mesmo conteúdo do e-mail, só que como página — HTML e
CSS puro, sem o bundle do Cucumber, então abre sempre) e sobe ela pro bucket
`uploads` do Supabase Storage (o mesmo já usado pelos anexos do sistema), em
`ci-reports/<run_id>/resumo.html`.

⚠️ Corrigido em 03/set/2026, ainda no mesmo dia (issue #75): o Supabase
Storage **sempre** serve arquivo `.html` como `Content-Type: text/plain`
(decisão deles, proteção contra phishing hospedado no domínio do Storage) —
o navegador mostrava o código-fonte em vez de abrir a página, não importa o
Content-Type mandado no upload. E o link direto do Supabase, por vir de um
secret do GitHub, aparecia mascarado como `***` no resumo do Actions.
Correção: o e-mail e o resumo do Actions (`$GITHUB_STEP_SUMMARY`) agora
linkam pra `https://duvoenterprise.com.br/api/ci-reports/<run_id>` — uma
rota do próprio site (`src/pages/api/ci-reports/[runId].ts`) que busca o
HTML no Storage e devolve de novo com o `Content-Type` certo. Link fixo,
fácil de repassar, e não depende de nenhum secret aparecer em texto.

Pra esse upload funcionar, o step precisa dos mesmos secrets
`NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` da tabela acima
(apontando pro projeto de DEV, igual aos outros dois jobs). Se faltar algum
dos dois, o script só avisa no log e o e-mail sai sem o link — não quebra o
envio (mas o resumo completo continua no corpo do e-mail de qualquer jeito).

Essas páginas de resumo não são apagadas automaticamente (diferente do
artefato do GitHub Actions, que expira em 14 dias) — combinado com o Cadu
que isso não é problema por enquanto; se o bucket crescer demais no futuro,
dá pra revisitar.

## Problemas comuns

**"Cucumber can only run on Node.js versions..."**
O workflow está com `node-version: '20'`. Troque para `'22'`.

**Um cenário só passa às vezes.**
Não repita até passar. Nenhuma das duas rodadas tem repetição automática de
propósito: cenário instável é cenário com defeito. As causas mais comuns são
depender de um dado que já estava no banco, ou depender do que outro cenário
criou — os cenários rodam **ao mesmo tempo** (2 em paralelo), cada um tem que
criar e validar o próprio dado.

**"Missing required secrets" / variáveis vazias.**
Faltam os 3 secrets acima.

**Dezenas de cenários falham todos com "Usuário ou senha inválidos" no login.**
Sinal de que o reset da senha dos usuários de teste (admin/financeiro/gestão)
não foi confirmado antes dos cenários começarem — ver
`e2e/support/seed-test-users.ts` (issue #65). Desde 02/set/2026 esse reset
roda uma vez, fora do Cucumber, antes dos cenários (`scripts/smoke.js` chama
o script antes de `cucumber-js`); se mesmo assim aparecer esse padrão de
falha em massa, o log do passo "Rodar o..." mostra `[seed] Falha ao preparar
os usuários de teste: ...` com o motivo exato.

**"Build failed".**
Rode `npm run build` na sua máquina; o erro é o mesmo.

**O job `sistema_completo` nem começou.**
Ele só roda se o job `smoke` passar (`needs: smoke`). Veja o log do `smoke`
primeiro.

## Escrevendo testes novos

Os testes deste projeto são **BDD**: cenários escritos em português
(Dado/Quando/Então) nos arquivos `e2e/features/*.feature`, com os passos
implementados em `e2e/step-definitions/`.

Antes de inventar um passo novo, **procure em `e2e/step-definitions/common.steps.ts`**
— quase tudo o que se precisa (clicar, preencher, ver botão, fazer login, ver
o dashboard) já existe. Repetir um passo com outro nome cria dialeto e, se o
texto colidir, o Cucumber acusa "ambiguous step".

Todo cenário novo precisa de exatamente uma marca de rodada — `@smoke` ou
`@sistemaCompleto` — mais a tag de página do arquivo (herdada
automaticamente, não precisa repetir). Regras para um cenário entrar no
`@smoke` em vez do `@sistemaCompleto`:

1. **Rápido** — a rodada inteira tem que terminar em poucos minutos.
2. **Confiável** — se só passa às vezes, está com defeito.
3. **Cria o próprio dado** — nunca depender do banco nem de outro cenário.
4. **Crítico** — se quebrar, para o sistema ou perde dinheiro. Detalhe de
   regra de negócio (mais uma variação de cálculo, mais um filtro) é
   `@sistemaCompleto`, não `@smoke`.

## Documentação relacionada

- [e2e/SMOKE.md](../e2e/SMOKE.md) — como as duas rodadas funcionam, o esquema de tags completo e a história dos defeitos encontrados
- [e2e/README.md](../e2e/README.md) — guia geral dos testes
- [e2e/COMANDOS.md](../e2e/COMANDOS.md) — comandos
- [DEPLOYMENT.md](./DEPLOYMENT.md) — deploy e a trava de ambiente
