# A suíte de smoke — como funciona e como religar os testes

## A ideia em uma frase

Um cenário BDD só roda automaticamente a cada push se estiver **marcado com
`@smoke`**. Religar cobertura é marcar mais cenários.

## Por que foi feito assim

A suíte completa vinha falhando em **todos** os pushes há semanas, levando
cerca de 60 minutos por execução. Um teste que falha sempre não avisa nada:
vira ruído, e todo mundo aprende a ignorar o vermelho. Pior, ela travava
qualquer mudança nova sem apontar nenhum problema real.

Em vez de apagar a suíte (ela guarda muito conhecimento do negócio), ela foi
**tirada do caminho**: continua aqui, continua podendo ser rodada, mas não
bloqueia mais nada. No lugar dela entrou uma suíte pequena que roda em
poucos minutos e em que dá para confiar.

## O que foi encontrado na esteira antiga

Três defeitos, todos medidos antes de serem corrigidos:

1. **Os testes rodavam em fila.** A configuração dizia "rode em paralelo" e,
   duas linhas abaixo, "use 1 trabalhador no GitHub". Com 1 trabalhador, os
   64 testes rodavam um atrás do outro.

2. **Cada falha custava 3 minutos.** Todo teste que falhava era repetido 2
   vezes. Como o limite de cada teste é 60 segundos, um teste quebrado
   consumia 3 minutos sozinho. Com cerca de 20 quebrados, isso passa dos 60
   minutos que o próprio serviço aceita — por isso o resultado era sempre
   "falhou em 59m14s": o serviço cortava por tempo, não pelos testes. Os
   testes BDD, que rodam depois, nunca chegavam a rodar.

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

   Esse tempo conta **dentro** do limite do clique do teste.

E um quarto, à parte: **os testes BDD rodavam sem aplicação no ar.** Quem
subia o servidor era o Playwright, que o derruba ao terminar. O passo de BDD
vinha depois e não tinha nada escutando na porta.

## Como rodar

```
npm run test:smoke
```

Um comando só, e pode rodar com o `npm run dev` aberto do lado.

Ele começa perguntando na porta 3000 se já tem uma aplicação no ar:

- **Tem** (seu `npm run dev`, por exemplo) — ele usa essa. Não compila e
  não sobe nada, e no fim deixa ela rodando do jeito que estava.
- **Não tem** — ele compila (se precisar), sobe a aplicação compilada,
  espera responder, roda os testes e derruba no fim.

Nos dois casos ele abre cada tela principal uma vez antes de começar, para
a montagem da tela não contar dentro do limite de tempo do clique do teste.

Ver `scripts/smoke.js`.

> **Por que ele pergunta antes.** Ele não fazia isso, e com o `npm run dev`
> aberto dava dois estragos de uma vez: o `next build` reescrevia a pasta
> `.next` embaixo do dev (que passava a reclamar de `ENOENT ...
> _buildManifest.js`) e logo depois o servidor novo morria com
> `EADDRINUSE: address already in use :::3000`.

Se a porta 3000 estiver ocupada por outro programa qualquer, rode em outra:

```
npm run test:smoke -- --porta=3001
```

E se quiser rodar só os cenários, sem que o script mexa em servidor nenhum:

```
npm run test:bdd:smoke
```

E a suíte completa, quando você quiser: aba **Actions** do GitHub →
**E2E Tests (suíte completa - manual)** → **Run workflow**. Ou, na sua
máquina, `npm run test:bdd` e `npm run test:e2e`.

## Como religar um pedaço da suíte

1. Escolha um cenário em `e2e/features/*.feature`.
2. Rode ele sozinho e conserte até passar de forma confiável:
   ```
   npx cucumber-js --config e2e/cucumber.config.cjs --name "parte do nome do cenário"
   ```
3. Escreva `@smoke` na linha acima do `Cenário:`.
4. Pronto — ele passa a rodar a cada push.

## As regras de quem entra no smoke

1. **Rápido.** A suíte inteira tem que terminar em poucos minutos.
2. **Confiável.** Um cenário que só passa às vezes está com defeito e
   precisa ser corrigido — não repetido até passar. É por isso que a suíte
   de smoke não tem repetição automática.
3. **Cada cenário cuida do próprio dado.** Quem precisa de uma locação cria
   a locação dele e valida só ela. Nunca depende de um dado que já estava no
   banco, nem do que outro cenário criou — porque eles rodam ao mesmo tempo.

---

## ⚠️ Smoke ampliado — decisão temporária de 29/ago/2026

O smoke saiu de 7 para **36 cenários**. Isso é **de propósito e temporário**,
e contraria a ideia normal de um smoke (poucos cenários, rápido).

### Por quê

A rescisão (#49) está sendo estabilizada e vai subir para produção. Enquanto
isso, o Cadu quer que **todos** os cenários de rescisão rodem a cada envio,
mais os processos principais do sistema — para não subir às cegas.

### O que entrou

| Arquivo | Cenários | O que garante |
|---|---|---|
| `12-rescisao-caucao` | **19** (todos) | a rescisão inteira |
| `6-inquilinos-crud` | 1 | criar inquilino |
| `5-imoveis-crud` | 1 | criar imóvel |
| `7-locacoes-regras` | 3 | criar locação (caução integral, garagem, geração de recebimentos) |
| `10-caucoes` | 3 | caução à vista, em 3x, e recebimento de parcela |
| `8-pagamentos-calculos` | 2 | cálculo com garagem e registro de pagamento |

Caução **não pago** já é coberto por um cenário da própria rescisão.

### Quando encolher

**Depois que a #49 estiver em produção e estável.** Aí o smoke volta a ser o
que deve ser: os poucos caminhos que, se quebrarem, param o sistema. Da
rescisão ficam os dois marcados como essenciais (a separação em dois
recebimentos e a devolução sobre o caução pago); o resto perde a marca e
continua rodando na suíte completa.

Um smoke de 36 cenários que demora demais deixa de ser usado — e um smoke
que ninguém roda não protege nada. Esta ampliação tem prazo.
