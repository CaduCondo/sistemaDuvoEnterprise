# Migração das rescisões antigas

História 3 do `rescisao-caucao.md`. Plano fechado com o Cadu em
**28/ago/2026**.

## O problema

Toda rescisão feita **antes** de 24/ago/2026 20h24 gerou **um** recebimento
só, com o caução misturado ao aluguel:

    total = aluguel proporcional + garagem + multa − caução corrigido

Como o caução é dinheiro de terceiro e não receita, esses registros
continuam distorcendo a base das taxas de administração (5%) e
gerenciamento (3%). A #49 conserta as rescisões **novas**; estas não.

## A boa notícia: dá para separar sem adivinhar

O `breakdown` (jsonb) dos recebimentos antigos guarda as linhas
**separadas e identificáveis**. Conferido no código anterior à #49
(`git show 582b9754^:src/services/terminationService.ts`):

| Linha no breakdown antigo | Vai para |
|---|---|
| `Aluguel Mês X/YYYY` | recebimento de **aluguel** |
| `Aluguel Proporcional - Dias Extras (...)` | recebimento de **aluguel** |
| `Garagem Proporcional - Dias Extras (...)` | recebimento de **aluguel** |
| `Multa Rescisória` | recebimento de **aluguel** |
| `Devolução de Caução (corrigido pela Taxa da Poupança)` | **Recebimento de Rescisão** |
| `Despesas Adicionais*` | **Recebimento de Rescisão** |

O `discount_amount` do registro antigo vira `termination_discount`.

Não há estimativa envolvida: cada centavo tem endereço.

## ⚠️ O que o banco NÃO sabe: como o pagamento se dividiu

Este é o ponto delicado, e é por isso que a migração não pode ser
totalmente automática.

Exemplo real do formato antigo:

    aluguel proporcional + multa    R$ 3.000,00
    devolução do caução            −R$ 2.000,00
    ───────────────────────────────────────────
    total do recebimento            R$ 1.000,00
    paid_amount gravado             R$ 1.000,00

Ao separar em dois (aluguel R$ 3.000,00 e rescisão −R$ 2.000,00),
**quanto foi pago de cada um?** O banco só guardou o líquido. Qualquer
divisão automática seria invenção.

Foi exatamente por isso que a decisão 6 do ticket original definiu:

> Os dois recebimentos gerados ficam com status PENDENTE, para que todos
> sejam revistos manualmente.

**Confirmado pelo Cadu em 28/ago/2026.** Marcar como PAGO seria mais
rápido, mas faria os relatórios mostrarem receita de aluguel que não
entrou e devolução que não saiu — a mesma classe de distorção que a #49
veio consertar.

## O plano

1. **Relatório primeiro (só leitura).** Listar as rescisões antigas: qual
   locação, qual valor total, quanto de aluguel, quanto de caução, quanto
   foi pago. Serve para medir o tamanho do problema antes de mexer.
2. **Migração em DEV**, conferindo o resultado contra o relatório.
3. **Migração em produção**, só depois da #49 estar no ar e estável por
   alguns dias (decisão do Cadu, 28/ago). Se algo der errado, o sistema
   novo já está provado e a causa fica isolada.
4. **Revisão manual** dos recebimentos gerados, um a um, ajustando o valor
   pago de cada.

### Regras da migração

- Os dois recebimentos nascem com `termination_group_id` em comum.
- O de aluguel: `payment_kind = 'rent'`, mantém `installment` e
  `due_date` do original.
- O de rescisão: `payment_kind = 'termination'`, parcela **1/1**, mesma
  `due_date`.
- **Os dois nascem `pending`**, com `paid_amount = 0` (ver acima).
- **Anexos duplicados** para os dois, nunca movidos para um só — assim
  cada recebimento fica autocontido e ninguém precisa caçar comprovante
  no outro registro (decisão 7 do ticket original, confirmada).
- O registro antigo **não é apagado**: recebe uma marca de que foi
  migrado e sai das telas. Migração de dado financeiro sem volta é o tipo
  de coisa que não se faz — se algo estiver errado, o original ainda está
  lá para comparar.
- Idempotente: rodar duas vezes não duplica nada.

### Depois da migração

Concluída e revisada, cai a História 4: remover de `financial.tsx` o
remendo que exclui do cálculo das taxas todo recebimento com valor pago
negativo. Ele existe para mascarar exatamente estes registros e, depois
da migração, passa a esconder erros legítimos.

## Estado

- [ ] Relatório das rescisões antigas (só leitura)
- [ ] SQL da migração
- [ ] Rodar em DEV e conferir
- [ ] Rodar em produção (só depois da #49 estável)
- [ ] Revisão manual dos recebimentos gerados
- [ ] História 4: remover o remendo do cálculo das taxas
