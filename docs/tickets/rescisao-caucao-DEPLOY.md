# Subir a #49 para produção — passo a passo

> **A ordem importa e não é a intuitiva.** As migrations rodam **ANTES** do
> deploy do código, não depois. O código novo lê colunas (`payment_kind`,
> `termination_group_id`, as três `termination_*`) que hoje **não existem** no
> banco de produção. Se o deploy sair primeiro, a página de Recebimentos, a de
> Financeiro e a rescisão quebram no ar até a migration rodar.
>
> Todas as migrations do passo 2 são retrocompatíveis: adicionam colunas e
> ajustam um trigger. O código que está em produção hoje continua funcionando
> normalmente com elas aplicadas. Por isso é seguro rodá-las antes.

---

## Passo 1 — Conferir o que falta em produção

No SQL Editor do projeto de **PRODUÇÃO**:

```sql
-- O que já existe? Tudo 'false' = nenhuma migration da #49 rodou ainda.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name='payments' AND column_name='payment_kind')            AS tem_payment_kind,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name='payments' AND column_name='termination_group_id')    AS tem_grupo,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name='payments' AND column_name='termination_corrected_deposit') AS tem_colunas_rescisao,
  EXISTS (SELECT 1 FROM pg_indexes
           WHERE tablename='payments'
             AND indexname='unique_payment_per_rental_period_installment')        AS indice_antigo_ainda_existe;
```

### ⚠️ A função do trigger é diferente em DEV e em PROD — já resolvido

Conferido em 26/ago/2026: `validate_payment_status()` existe em **três versões
diferentes** no projeto.

| Onde | Como funciona |
|---|---|
| arquivo `20260216223935` | chama `calculate_correct_payment_status()` e usa `NEW.discount` — coluna que **nunca existiu**. Este arquivo está morto: nunca poderia ter funcionado como está escrito. |
| DEV (depois da `20260825200000`) | chama `calculate_correct_payment_status()`, que força `'paid'`, `'partial'` **e** `'pending'` |
| **PRODUÇÃO** | lógica inline, sem função auxiliar; força **só** `'paid'` quando o restante é ~zero. Quando não é, **não mexe** no status. |

A diferença não é cosmética: em produção o trigger só intervém para marcar como
pago; em DEV ele reescrevia o status em qualquer situação. Testar em DEV e subir
para PROD com essa divergência é testar outro sistema.

**Decisão:** vale o comportamento de PRODUÇÃO, que atende usuários reais há
meses. A migration `20260826130000` parte do corpo de produção e apenas
acrescenta o desvio do Recebimento de Rescisão — e roda nos **dois** ambientes,
para que passem a ser idênticos.

Por isso a `20260825200000` está marcada como superada e **não deve ser
rodada**.

---

## Passo 1.5 — Alinhar o DEV e rodar os testes ANTES de tocar em produção

Este passo existe por causa da divergência do trigger. Enquanto DEV e PROD se
comportarem diferente, passar nos testes em DEV **não** garante nada sobre
produção.

**1.** No SQL Editor do **DEV**, rodar
`20260826130000_alinha_validate_payment_status_com_producao.sql`.

**2.** Conferir que os dois ambientes ficaram iguais. Rodar em **DEV** e em
**PROD** e comparar o resultado — tem que sair idêntico nos dois (à parte do
desvio da rescisão, que só existirá em DEV até o passo 2):

```sql
SELECT pg_get_functiondef('validate_payment_status()'::regprocedure);
```

**3.** Com o DEV já se comportando como produção, rodar a suíte:

```bash
npm run test:smoke     # 19 cenários (14 da rescisão + 5 que já existiam)
npm run test:bdd       # a suíte completa
```

Os dois precisam passar. Se algum cenário quebrar agora e não quebrava antes,
ele estava passando por causa do trigger de DEV, que reescrevia status onde
produção não reescreve — ou seja, era um teste passando por motivo errado.
Corrigir **antes** de seguir.

---

## Passo 2 — Rodar as migrations em PRODUÇÃO, nesta ordem

| # | Arquivo | Por que agora |
|---|---|---|
| 1 | `20260824120000_add_termination_split_columns.sql` | cria as colunas que o código novo lê. **Sem esta, tudo quebra.** |
| 2 | `20260825180000_fix_unique_payment_constraint_for_termination.sql` | remove o índice único que barra o 2º recebimento (erro 409) |
| 3 | `20260826130000_alinha_validate_payment_status_com_producao.sql` | trigger para de cravar 'paid' no recebimento zerado, **preservando o comportamento de produção** — depende da #1 |
| 4 | `20260826100000_fix_paid_amount_parcelas_caucao.sql` | conserta as parcelas de caução pagas por R$ 0,00 |
| 5 | `20260826110000_kanban_recibo_recebimento_rescisao.sql` | cria o card do recibo no Kanban |

**Não rodar:**

- `20260825190000_recreate_unique_payment_index.sql` — cancelada de propósito,
  não tem DDL; é o registro de por que o índice não volta.
- `20260825200000_termination_payment_status_nao_automatico.sql` — **superada**
  pela `20260826130000`. Rodá-la em produção mudaria o comportamento de todo
  recebimento de aluguel.

**Ainda não precisa:** `20260826120000_corrige_recebimentos_rescisao_gravados.sql`
conserta Recebimentos de Rescisão já gravados errado. Em produção **não existe
nenhum** (a #49 nunca rodou lá), então ela não tem o que fazer hoje. Rodar não
causa dano; só não é necessária agora.

### Conferências obrigatórias

- **Migration #3:** o `SELECT` do fim imprime o corpo novo da função. Confira
  que ele tem o desvio `IF NEW.payment_kind = 'termination'` **e** a lógica
  inline (`total_expected := COALESCE(...)`) — e que **não** aparece nenhuma
  chamada a `calculate_correct_payment_status`.
- **Migration #4:** o `SELECT` do fim tem que voltar **vazio**. Se voltar
  linhas, alguma parcela de caução ficou para trás — não siga adiante antes de
  entender por quê.

---

## Passo 3 — Levar o código para produção

```bash
gh pr create --base main --head feat/rescisao-caucao-49 \
  --title "Rescisão separada da devolução do caução (#49)"
```

O que roda sozinho ao abrir o PR:

- **Trava de ambiente** — impede que um deploy suba apontando para o banco
  errado (a proteção criada depois do incidente de 21/ago/2026).
- **Smoke** — os 19 cenários (`.github/workflows/smoke.yml`).

⚠️ O smoke do CI roda contra o banco configurado nos *secrets* do GitHub. Por
isso o passo 1.5 vem antes: se o DEV ainda estiver com o trigger antigo, o
smoke valida um comportamento que produção não tem.

Só faça o merge com os dois **verdes**. O merge em `main` dispara o deploy de
produção na Vercel.

---

## Passo 4 — Conferir em produção depois do deploy

1. Abrir Recebimentos e confirmar que a página carrega normalmente.
2. Fazer **uma** rescisão de teste e conferir que nascem **dois** recebimentos,
   com a etiqueta "Rescisão" no de rescisão (e não no de aluguel).
3. Abrir o de rescisão e conferir que o VALOR TOTAL bate com o da lista.
4. Financeiro → aba Locações: o Recebimento de Rescisão **não** deve aparecer.
5. Financeiro → aba Cauções: as quatro colunas do Detalhamento devem estar
   preenchidas.

---

## O que continua pendente depois desta subida

**As rescisões antigas continuam contaminadas.** Tudo que foi rescindido em
produção antes desta subida está no formato antigo — um recebimento só, com o
caução misturado — e segue distorcendo a base das taxas de administração e
gerenciamento. Esta entrega conserta as rescisões **novas**.

O conserto das antigas é a História 3 do ticket (migração dos dados), que
depende da História 2 (relatório para medir o tamanho do problema). Nenhuma das
duas foi feita.

**O recibo do Recebimento de Rescisão** ainda é o recibo de aluguel: fala em
aluguel, parcela X/Y e assume total positivo. Card criado no Kanban pelo passo
2 acima.
