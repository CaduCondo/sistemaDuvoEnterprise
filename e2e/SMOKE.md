# Suíte de smoke

A suíte rápida, que roda sozinha a cada push. Existe para responder uma
pergunta só: **a subida quebrou alguma coisa essencial?**

Não existe uma "pasta de smoke". O que decide quem roda é a marca `@smoke` no
cenário — mesmos arquivos `.feature`, mesmos step definitions e mesmo
vocabulário da suíte completa.

```bash
npm run test:smoke        # roda a suíte de smoke
npm run test:smoke:ver    # a mesma coisa, com o browser à vista
npm run test:bdd          # a suíte COMPLETA (tudo, com ou sem @smoke)
```

## O que entra no smoke

Um cenário merece a marca quando falhar nele significa que **o sistema está
quebrado para o usuário**, não apenas que um detalhe mudou:

- o caminho crítico do dinheiro (registrar recebimento, rescindir contrato);
- o que já quebrou em produção antes — regressão que voltou uma vez volta duas;
- o que ninguém percebe rápido olhando a tela (sinal de valor, base de cálculo
  de taxa, dado gravado diferente do exibido).

Um cenário NÃO merece a marca quando cobre detalhe de layout, texto de
mensagem, ou uma variação que a suíte completa já cobre com outro exemplo.

O smoke roda `parallel: 2` (a máquina do GitHub Actions tem 2 núcleos). Por
isso **cada cenário precisa criar os próprios dados e validar só o que ele
criou** — nunca depender do que já estava no banco nem do que outro cenário
fez.

## Situação atual: a rescisão está com todos os cenários no smoke

Decisão do Cadu em 26/ago/2026, e é **temporária de propósito**.

A rescisão (issue #49) foi reescrita quase inteira e quebrou muitas vezes
seguidas durante os testes — 409 de constraint, PGRST116, trigger de status
sobrescrevendo, sinal invertido gravado no banco, contagem de dias errada.
Enquanto ela não se firmar, os **14 cenários** de
`features/12-rescisao-caucao.feature` rodam a cada push.

Isso deixa o smoke mais lento do que ele deveria ser, e é um preço aceitável
por enquanto — mas não para sempre.

### Quando reduzir

Quando a rescisão passar algumas subidas seguidas sem quebrar, tirar o `@smoke`
do arquivo e deixar a marca apenas nos **dois** cenários assinalados com o
comentário `GUARDAR NO SMOKE`:

1. **A rescisão gera exatamente dois recebimentos, de tipos diferentes** — é a
   razão de existir da issue: se voltar a gerar um só, a devolução do caução
   volta a contaminar a base das taxas de administração e gerenciamento.
2. **A devolução é calculada sobre o caução efetivamente pago** — a regra de
   dinheiro mais cara de errar da issue. Devolver sobre o valor contratado
   quando o inquilino pagou menos significa pagar a mais, e ninguém percebe
   olhando a tela.

Os outros 12 continuam existindo e rodando na suíte completa (`npm run
test:bdd`). Tirar a marca não é apagar cobertura — é tirar do caminho do push.

Como a marca hoje está na **Funcionalidade** (vale para todos os cenários do
arquivo), reduzir é: remover `@smoke` da linha da Funcionalidade e colocá-la
sobre os dois cenários citados.

## Por que os cenários da rescisão verificam o banco, e não a tela

Nesta issue a tela mostrou valor diferente do gravado mais de uma vez — a lista
de Recebimentos exibia R$ 6.201,25 e o mesmo recebimento, aberto, mostrava
−R$ 5.201,25. Um teste que só olhasse a tela teria passado nas duas vezes.

O setup vai direto no banco (`DatabaseHelper`) por velocidade, mas a **rescisão
em si é sempre feita pela tela**: todos os erros graves apareceram no caminho
real até o banco, e nenhum apareceria chamando `processContractTermination()`
direto.
