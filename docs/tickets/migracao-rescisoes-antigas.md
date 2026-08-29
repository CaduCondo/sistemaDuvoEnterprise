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

- [ ] Passo 0: confirmar PITR ativo no Supabase
- [ ] Passo 1: relatório das rescisões antigas (só leitura)
- [ ] SQL da migração + **SQL do desfazer**, escritos juntos
- [ ] Passo 2: migrar UMA em DEV e conferir na tela
- [ ] Passo 3: migrar o resto em DEV e comparar relatórios
- [ ] Passo 4: cenários BDD da migração (inclusive o de rodar duas vezes)
- [ ] Passo 5: rodar em produção (só depois da #49 estável)
- [ ] Passo 6: revisão manual dos recebimentos gerados
- [ ] História 4: remover o remendo do cálculo das taxas

---

# Roteiro de execução — o caminho de menor risco

Definido com o Cadu em 28/ago/2026. A ordem importa: cada passo só começa
depois que o anterior deu certo.

## Princípio que vale para todos os passos

**Nada é apagado, e o desfazer existe antes do fazer.** Um SQL de
migração de dado financeiro só pode ser executado se o comando que
reverte a operação já estiver escrito e testado.

---

## Passo 0 — Backup (não pule)

O projeto está no plano **PRO** do Supabase, que tem *Point-in-Time
Recovery*. Antes de rodar qualquer coisa em produção:

1. Confirmar no painel do Supabase que o PITR está ativo.
2. Anotar a data e hora exatas de antes da migração.

Se tudo der errado, é isso que traz o banco de volta.

## Passo 1 — Relatório (só leitura, risco zero)

Um SELECT que lista as rescisões antigas: locação, inquilino, valor
total, quanto é aluguel, quanto é caução, quanto foi pago, quantos
anexos. **Não altera nada.**

Serve para três coisas:

- medir o tamanho do trabalho (são 3 rescisões ou 30?);
- ser a **linha de base**: depois da migração, os números têm de bater;
- achar casos estranhos antes de mexer (rescisão sem linha de caução,
  valor pago maior que o total, breakdown vazio).

## Passo 2 — Migrar UMA em DEV

Não todas. **Uma.**

Escolher a rescisão mais simples do relatório, migrar só ela, e conferir
na tela: os dois recebimentos aparecem? a soma bate com o original? os
anexos estão nos dois? os dois estão Pendente? a aba Cauções mostra os
valores?

Se algo estiver errado, o estrago é de um registro num banco de teste.

## Passo 3 — Migrar o resto em DEV

Só depois que a primeira passou. Rodar o relatório de novo e comparar
com o do passo 1: **a soma dos valores tem de ser idêntica**. Se mudou
um centavo, alguma coisa está errada.

## Passo 4 — Testes automatizados

Cenário BDD específico, pedido pelo Cadu:

    Cenário: rescisão antiga separada em dois recebimentos
      Dado uma rescisão no formato antigo, com um recebimento só,
        contendo aluguel, multa e devolução de caução, com status Pago
        e 2 anexos
      Quando a migração for executada
      Então devem existir DOIS recebimentos ligados pelo mesmo grupo
      E a soma dos dois deve ser igual ao valor do recebimento original
      E os DOIS devem estar com status Pendente
      E os DOIS devem ter os 2 anexos
      E o recebimento original deve continuar no banco, marcado como migrado

    Cenário: migração rodada duas vezes não duplica
      Dado uma rescisão antiga já migrada
      Quando a migração for executada de novo
      Então deve continuar existindo apenas um par de recebimentos

## Passo 5 — Produção

Só depois de a #49 estar no ar e rodando bem por alguns dias.

- Fora do horário de uso.
- Passo 0 (backup) refeito.
- Relatório rodado **antes**, guardado.
- Migrar **uma** primeiro, conferir na tela, e só então o resto.
- Relatório rodado **depois**, comparado com o de antes.

## Passo 6 — Revisão manual

Os recebimentos nascem Pendente. Percorrer um a um, com o relatório do
passo 5 na mão, e registrar o valor pago de cada.

Enquanto esta revisão não termina, **não** mexer na História 4 (remover o
remendo do cálculo das taxas): o remendo ainda está segurando os dados
não revisados.

---

## Se algo der errado

Em ordem, do mais brando ao mais drástico:

1. **Rodar o desfazer**: apaga os recebimentos criados pela migração e
   devolve os originais às telas. Nenhum dado se perde, porque o original
   nunca foi apagado.
2. **Point-in-Time Recovery** para o horário anotado no passo 0.

O caso 2 só deve ser necessário se o desfazer também falhar — e é por
isso que ele é escrito e testado em DEV antes.
