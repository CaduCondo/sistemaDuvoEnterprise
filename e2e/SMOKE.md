# As duas rodadas de teste — como funcionam e o esquema de tags

> Reescrito em 31/ago/2026, quando o smoke encolheu de 33 cenários (inflado
> de propósito para vigiar a estabilização da rescisão #49) para 12. A
> história da estabilização e das 28+8+4+2+1 falhas corrigidas continua mais
> abaixo, sem alterar nada.

## A ideia em uma frase

Todo cenário BDD carrega exatamente **uma** marca de rodada — `@smoke` ou
`@sistemaCompleto` — e roda automaticamente a cada push, em duas rodadas
sequenciais. Um cenário sem nenhuma das duas está fora de propósito (ver
"Exceções" abaixo).

## As tags, todas elas

| Tag | O que é | Quem tem |
|---|---|---|
| `@smoke` | **Rodada 1.** Poucos cenários, rápidos, críticos — os que se quebrarem param o sistema ou mexem em dinheiro. Roda a cada push, primeiro. | 12 cenários (lista completa abaixo) |
| `@sistemaCompleto` | **Rodada 2.** Todo o resto: cada regra de negócio, arquivo por arquivo. Roda a cada push, só depois do `@smoke` passar. Por definição, cobre tudo que o `@smoke` não cobre — nenhum cenário é testado duas vezes. | todos os outros cenários "saudáveis" |
| `@quebrado` | Cenário com **defeito conhecido no teste** (não no sistema) — o preparo não cria o dado que o cenário confere, ou o cenário procura algo que a tela nunca teve. Fora das duas rodadas até ser corrigido, para não virar vermelho permanente (ver "Por que foi feito assim"). | 4 cenários, ver lista em `docs/tickets/smoke-30-ago.md` |
| *(sem tag)* | Cenário que é o **contrato de uma funcionalidade que ainda não existe** — não é defeito de teste, é o produto que falta. Fica assim até a funcionalidade ser implementada. | 1 cenário: "Formação de Valores da rescisão quando o mês estava PENDENTE" (item E da rodada 2 de padronização, `12-rescisao-caucao.feature`) |
| tag de página (`@autenticacao`, `@imoveis`, `@inquilinos`, `@locacoes`, `@pagamentos`, `@caucoes`, `@rescisao`, `@anuncioPublico`, `@permissoesAdmin`, `@permissoesFinanceiro`, `@permissoesGestao`, `@regressaoVisual`, `@fundacao`) | Uma por arquivo `.feature`, no topo, acima de `Funcionalidade:`. Todo cenário do arquivo herda ela automaticamente. Serve para rodar só os testes de uma tela, independente da rodada. | todos os cenários (uma tag por arquivo) |
| `@security`, `@performance`, `@stress`, `@permissions`, `@api-tests`, `@regression` | Não são tags do Cucumber/BDD — são **projetos do Playwright** (`playwright.config.ts`), usados pelos testes `.spec.ts` em `e2e/tests/*`. Cobrem outro tipo de teste (SQL injection/XSS, tempo de carregamento, requisições concorrentes...). Rodam só no workflow manual `e2e-tests.yml`, com `--project=<nome>`. | ver `e2e/tests/{security,performance,stress,permissions,api}` |

Para rodar só uma página, em qualquer rodada:

```
npx cucumber-js --config e2e/cucumber.config.cjs --tags "@rescisao"
```

Para rodar uma página só na rodada 2 (por exemplo, todas as regras de
caução que não são smoke):

```
npx cucumber-js --config e2e/cucumber.config.cjs --tags "@caucoes and @sistemaCompleto"
```

## O que está em `@smoke` hoje (12 cenários)

| Arquivo | Cenário | Por quê |
|---|---|---|
| `0-smoke.feature` | os 3 cenários do arquivo | fundação: aplicação no ar, página pública abre, formulário de login abre |
| `1-autenticacao.feature` | Login com sucesso - Usuário Admin | entrar no sistema é pré-requisito de tudo |
| `11-anuncio-publico.feature` | Visitante sem login abre o anúncio pelo link curto | guarda um bug real que já aconteceu (23/ago) na página que a empresa divulga |
| `5-imoveis-crud.feature` | Criar imóvel com sucesso | cadastro básico |
| `6-inquilinos-crud.feature` | Criar inquilino Pessoa Física | cadastro básico |
| `6-inquilinos-crud.feature` | A tela continua respondendo depois de fechar a mensagem de sucesso | guarda o bug do commit `e386d423` (31/ago) — tela inteira travava |
| `7-locacoes-regras.feature` | Criar locação - Garagem opcional | criar locação |
| `10-caucoes.feature` | Marcar parcela de caução como recebida via PIX | receber caução |
| `12-rescisao-caucao.feature` | A rescisão gera dois recebimentos separados | o coração da #49 |
| `12-rescisao-caucao.feature` | A devolução do caução não entra na base das taxas | a razão de existir da #49 |

⚠️ **Lacuna conhecida:** não há hoje um cenário `@smoke` limpo para "receber
aluguel". Os dois candidatos naturais em `8-pagamentos-calculos.feature`
("Calcular pagamento com garagem" e "Registrar pagamento como pago") estão
marcados `@quebrado` — o preparo/asserção deles não bate com a tela real (ver
tabela de `@quebrado` acima). Escrever ou consertar um cenário de "receber
aluguel" para o smoke é tarefa registrada no backlog (ver kanban/GitHub —
card "Escrever cenário de smoke para receber aluguel").

Regra geral de quem entra no `@smoke` (não muda): rápido, confiável, cria o
próprio dado, e **crítico** — quebrar isso para o sistema ou mexe em
dinheiro. Uma variação a mais de cálculo, mais um filtro, mais uma tela de
detalhe: isso é `@sistemaCompleto`.

## Como mover um cenário de rodada

1. Escolha o cenário em `e2e/features/*.feature`.
2. Rode ele sozinho: `npx cucumber-js --config e2e/cucumber.config.cjs --name "parte do nome"`.
3. Troque a tag: `@sistemaCompleto` → `@smoke` (sobe de rodada) ou o
   contrário (desce). Nunca as duas ao mesmo tempo.
4. Pronto — a próxima execução do workflow já respeita a troca.

## Como rodar

```
npm run test:smoke      # so a rodada 1 (@smoke)
npm run test:completo   # so a rodada 2 (@sistemaCompleto)
```

Cada comando começa perguntando na porta 3000 se já tem uma aplicação no ar
(o `npm run dev` que você deixou aberto, por exemplo) — se tem, usa essa; se
não, compila e sobe uma. Ver `scripts/smoke.js`.

Com a aplicação já rodando do lado, sem esse script mexer em servidor:

```
npm run test:bdd:smoke
npm run test:bdd:sistemaCompleto
```

No GitHub Actions (`.github/workflows/smoke.yml`): o job `smoke` roda
primeiro a cada push; o job `sistema_completo` só começa depois que o
`smoke` passar (`needs: smoke`) e roda a rodada 2 inteira. Ver
`docs/GITHUB_ACTIONS_TESTES.md`.

## Por que foi feito assim (histórico)

A suíte completa vinha falhando em **todos** os pushes há semanas, levando
cerca de 60 minutos por execução. Um teste que falha sempre não avisa nada:
vira ruído, e todo mundo aprende a ignorar o vermelho. Pior, ela travava
qualquer mudança nova sem apontar nenhum problema real.

Em vez de apagar a suíte (ela guarda muito conhecimento do negócio), ela foi
dividida em duas rodadas automáticas e sequenciais: a rápida primeiro (poucos
minutos, confiável), a completa depois (mais lenta, mas não atrasa o sinal
rápido nem repete o que a primeira já validou). Isso substitui o esquema
anterior, em que a suíte completa era manual — hoje ela roda sozinha, todo
push, só que numa rodada separada.

## O que foi encontrado na esteira antiga (defeitos corrigidos)

1. **Os testes rodavam em fila.** A configuração dizia "rode em paralelo" e,
   duas linhas abaixo, "use 1 trabalhador no GitHub". Com 1 trabalhador, os
   64 testes rodavam um atrás do outro.

2. **Cada falha custava 3 minutos.** Todo teste que falhava era repetido 2
   vezes. Como o limite de cada teste é 60 segundos, um teste quebrado
   consumia 3 minutos sozinho. Com cerca de 20 quebrados, isso passa dos 60
   minutos que o próprio serviço aceita — por isso o resultado era sempre
   "falhou em 59m14s": o serviço cortava por tempo, não pelos testes.

3. **A aplicação subia em modo de desenvolvimento.** O GitHub gastava tempo
   compilando a aplicação e depois jogava esse trabalho fora, subindo a
   versão não compilada — onde cada tela é montada na hora em que é aberta
   pela primeira vez. Medido numa máquina do mesmo tamanho da do GitHub
   (2 núcleos):

   | Tela          | Modo desenvolvimento (1ª abertura) | Já compilada |
   |---------------|-----------------------------------:|-------------:|
   | Página inicial |                          9.298 ms |        35 ms |
   | Dashboard      |                          7.988 ms |        14 ms |
   | Locações       |                          3.978 ms |        12 ms |
   | Financeiro     |                          2.825 ms |        13 ms |

E um quarto, à parte: **os testes BDD rodavam sem aplicação no ar**, porque
quem subia o servidor era o Playwright, que o derrubava ao terminar.
`scripts/smoke.js` resolve isso subindo a aplicação ele mesmo.

## As regras de quem entra no `@smoke` (não mudam)

1. **Rápido.** A rodada 1 inteira tem que terminar em poucos minutos.
2. **Confiável.** Um cenário que só passa às vezes está com defeito e
   precisa ser corrigido — não repetido até passar. Nenhuma das duas rodadas
   tem repetição automática de propósito.
3. **Cada cenário cuida do próprio dado.** Quem precisa de uma locação cria
   a locação dele e valida só ela. Nunca depende de um dado que já estava no
   banco, nem do que outro cenário fez — porque eles rodam ao mesmo tempo.
4. **Crítico.** Se quebrar, para o sistema ou mexe em dinheiro. O resto é
   `@sistemaCompleto`.

---

# Histórico da estabilização da rescisão (29-30/ago/2026)

## Smoke ampliado — decisão temporária de 29/ago/2026 (já revertida)

O smoke saiu de 7 para 36 cenários entre 29 e 30/ago, de propósito e
temporariamente: a rescisão (#49) estava sendo estabilizada e ia subir para
produção, e o Cadu queria que todos os cenários de rescisão rodassem a cada
envio enquanto isso não acontecesse. **A #49 está em produção e estável desde
30/ago** — por isso, em 31/ago, o smoke encolheu para os 12 cenários da
tabela acima, como planejado desde o início desta ampliação.

## As rodadas de estabilização — 28 falhas até 1 falha

A primeira rodada de verdade do smoke ampliado terminou em **8 passaram, 28
falharam**. Depois de cinco rodadas de correção, terminou em **30 passaram, 1
falhou** (o único cenário que fica vermelho de propósito — item E da rodada
2, ainda não implementado). O relato completo, causa por causa, está em
[`docs/tickets/smoke-30-ago.md`](../docs/tickets/smoke-30-ago.md).
