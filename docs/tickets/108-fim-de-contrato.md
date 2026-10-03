# #108 — Fim de contrato: proporcional na data fim + recebimento de Fim de Contrato; renovação não mexe na parcela regular

> Texto para colar na issue #108 do GitHub (o Claude desta sessão não tinha
> acesso ao GitHub). Label: `bug` + `regra-de-negocio`. Prioridade: **urgente**
> (dinheiro errado em produção).

## Contexto / erro

1. **Bug de produção (JD. COLOMBO APTO 10, Kácio):** contrato com vencimento
   dia 5 e data fim 29/09/2026. A parcela de 05/09/2026 estava atrasada quando
   o contrato foi renovado (fim → 29/09/2027). Depois da renovação, setembro
   ficou **sem nenhum recebimento** e outubro ficou com **dois** (12/24 e
   13/24). Causa: a renovação passava pela sincronização genérica da edição de
   locação, que decide tudo pelo mês (e o recebimento antigo ainda carregava
   dados da importação, observação "13/13").
2. **Regra de fim de contrato nunca implementada:** o contrato terminava sem
   cobrar os dias entre o último vencimento e a data fim, e sem o recebimento
   de devolução do caução.

## Regra (definida pelo Cadu em 03/out/2026)

- Parcela regular sempre cheia, no dia de vencimento, enquanto o vencimento
  cair até a data fim.
- Proporcional de fim de contrato vencendo **na data fim**: dias depois do
  último vencimento até a data fim, **sem contar** o dia do vencimento
  (05/09 → 29/09 = 24 dias).
- Recebimento de **Fim de Contrato** (devolução do caução corrigido +
  despesas + desconto) vencendo na data fim, criado **junto com a locação**,
  inclusive sem caução (R$ 0,00). O caução corrigido é recalculado **sempre
  que o recebimento aparece na tela**.
- Renovar: parcela regular nunca muda; proporcional e Fim de Contrato da data
  antiga (não pagos) são apagados e recriados na data nova.

## Tarefas

- [x] `src/lib/contractEnd.ts` — contas puras (último vencimento, dias).
- [x] `generateExpectedPayments` — regra nova; coluna `payments.contract_end`.
- [x] `renovarRecebimentos` — rotina própria da renovação.
- [x] `syncPaymentsOnDateChange` — usa a mesma conta da criação.
- [x] Reajuste de aluguel e troca do dia de vencimento não estragam o fim de contrato.
- [x] Rescisão apaga o fim de contrato programado antes de criar o dela.
- [x] Caução corrigido recalculado na lista de Recebimentos, Financeiro, Cauções e ao abrir.
- [x] SQL de produção: coluna nova + Kácio + revisão das locações ativas (`PROD-fim-de-contrato-108.sql`).
- [x] `docs/REGRAS_DE_NEGOCIO.md` — seção "🏁 Fim de Contrato".
- [ ] Rodar o SQL em DEV e PROD (Cadu) **antes** do push.
- [ ] Conferir CI (GitHub Actions) depois do push.
- [ ] Confirmar com o Cadu a contagem de dias da 1ª parcela e da rescisão (hoje incluem o dia inicial).

## Critérios de aceitação (BDD)

```gherkin
Funcionalidade: Fim de contrato

  Cenário: Locação nova termina com parcela cheia, proporcional e Fim de Contrato
    Dado uma locação de R$ 2.800,00 com vencimento dia 5, início 30/09/2025 e fim 29/09/2026
    Quando a locação é criada
    Então deve existir a parcela de 05/09/2026 com R$ 2.800,00
    E deve existir o proporcional de fim de contrato vencendo em 29/09/2026 com 24 dias (R$ 2.240,00)
    E deve existir o recebimento de Fim de Contrato vencendo em 29/09/2026

  Cenário: Data fim antes do dia de vencimento
    Dado uma locação com vencimento dia 20 e fim em 10/09/2026
    Quando a locação é criada
    Então a última parcela regular vence em 20/08/2026
    E o proporcional de fim de contrato vence em 10/09/2026 com 21 dias

  Cenário: Data fim no próprio dia de vencimento
    Dado uma locação com vencimento dia 5 e fim em 05/10/2026
    Quando a locação é criada
    Então não deve existir proporcional de fim de contrato
    E deve existir o recebimento de Fim de Contrato vencendo em 05/10/2026

  Cenário: Renovar mantém a parcela regular atrasada e move só o fim de contrato
    Dado uma locação vencida há poucos dias com a parcela regular do último mês atrasada e o fim de contrato programado
    Quando renovo o contrato
    Então a parcela regular do último mês continua no mesmo vencimento, com o valor cheio
    E não sobra proporcional nem Fim de Contrato na data fim antiga
    E existem o proporcional e o Fim de Contrato na data fim nova

  Cenário: Locação sem caução também tem Fim de Contrato
    Dado uma locação sem caução
    Quando a locação é criada
    Então o recebimento de Fim de Contrato existe com valor R$ 0,00

  Cenário: Caução corrigido sempre atualizado
    Dado uma locação com caução de R$ 3.000,00 com uma parcela de R$ 1.500,00 paga
    Quando abro a lista de Recebimentos no mês da data fim
    Então o Fim de Contrato mostra a devolução de R$ 1.500,00 corrigida pela poupança até a data fim

  Cenário: Rescisão não cobra em dobro
    Dado uma locação com o fim de contrato programado
    Quando registro a rescisão
    Então o proporcional e o Fim de Contrato programados não existem mais
    E existem só os recebimentos criados pela rescisão
```

Automatizado hoje: o cenário de renovação (`7-locacoes-regras.feature`,
"Renovar contrato mantém a parcela regular atrasada e move só o fim de
contrato") e o ajuste do cenário "Renovar contrato cria os recebimentos até a
nova data fim". Os demais ficam como critério para próximos cenários.
