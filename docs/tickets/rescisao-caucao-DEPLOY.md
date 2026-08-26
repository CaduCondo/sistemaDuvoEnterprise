# Subir a #49 para produção — 3 passos

> A versão anterior deste guia tinha 5 passos com conferências no meio e era
> difícil de seguir na prática. Foi reduzida a isto. As migrations individuais
> continuam no repositório para consulta, mas **você não precisa abrir nenhuma
> delas**: o passo 1 já faz todas na ordem certa.

---

## Passo 1 — Banco de produção

Abra `docs/tickets/PROD-rescisao-49.sql`, copie o arquivo **inteiro**, cole no
SQL Editor de **PRODUÇÃO** e clique em Run. Uma vez só.

Ele faz as cinco migrations da #49 na ordem certa e imprime um relatório no
fim. **As cinco linhas têm que dizer `OK`.**

| etapa | resultado |
|---|---|
| 1. colunas novas | OK |
| 2. indice antigo removido | OK |
| 3. trigger com o desvio da rescisao | OK |
| 4. caucoes com paid_amount zerado | OK |
| 5. card do Kanban | OK |

Se alguma disser `FALTOU`, **pare e mande o relatório** — não siga para o passo
2.

É seguro: roda tudo numa transação só (se qualquer parte falhar, nada é
aplicado) e pode ser rodado de novo sem estragar nada.

---

## Passo 2 — Testes

```bash
npm run test:smoke
```

Tem que passar. Se quebrar, mande o erro antes de seguir.

---

## Passo 3 — Código

```bash
gh pr create --base main --head feat/rescisao-caucao-49 \
  --title "Rescisão separada da devolução do caução (#49)"
```

Ao abrir o PR rodam sozinhos a **trava de ambiente** e o **smoke**. Faça o
merge só com os dois verdes — o merge em `main` dispara o deploy na Vercel.

---

## Depois do deploy

Faça **uma** rescisão de teste em produção e confira:

- nascem **dois** recebimentos;
- a etiqueta "Rescisão" está no recebimento de rescisão (não no de aluguel);
- o VALOR TOTAL da lista é igual ao da tela quando você abre o recebimento;
- Financeiro → aba Locações **não** mostra o Recebimento de Rescisão;
- Financeiro → aba Cauções mostra as quatro colunas preenchidas.

---

## O que esta subida NÃO resolve

**As rescisões antigas de produção continuam contaminadas.** Tudo que foi
rescindido antes desta subida está no formato antigo — um recebimento só, com o
caução misturado — e segue distorcendo a base das taxas de administração e
gerenciamento. Esta entrega conserta as rescisões **novas**.

Consertar as antigas é a História 3 do ticket, que depende da História 2
(relatório para medir o tamanho do problema). Nenhuma das duas foi feita.

**O recibo do Recebimento de Rescisão** ainda é o de aluguel. O card criado
pelo passo 1 está no Kanban.

---

## Detalhes técnicos

Ficaram em `rescisao-caucao.md` (seção "O QUE FOI CONSTRUÍDO"): a lista das
migrations individuais, os defeitos encontrados que não eram da rescisão, e por
que o índice único não volta.

Duas armadilhas que valem ser lembradas se alguém mexer nisso de novo:

- **`validate_payment_status()` tinha três versões diferentes** — a do arquivo
  `20260216223935` (morta, usa uma coluna que nunca existiu), a de DEV e a de
  produção. Para alterar essa função, tire o corpo atual do **banco**
  (`pg_get_functiondef`), nunca do arquivo de migration.
- **A ordem das migrations importa**: o trigger referencia `payment_kind`, então
  só pode ser criado depois da coluna. O passo 1 já resolve isso; rodar os
  arquivos soltos, não.
