# Padronização das telas — rodada 2

Pedido do Cadu em **28/ago/2026**, com 12 prints. Objetivo declarado:
fechar isto e **implantar em produção**.

Salvo antes de qualquer implementação (regra do CLAUDE.md).

---

## A. Ajustes visuais

### A1. Tela "Registrar Recebimento de Caução" — mesmo layout das outras
Continua com layout próprio. Deve seguir o MESMO padrão visual das outras
três telas de recebimento: mesma estrutura de blocos, mesmos títulos,
mesmo espaçamento. Já foi pedido na rodada 1 e não foi feito.

### A2. "Valor de Desconto" — o sinal vem ANTES do R$
Hoje está vermelho, mas sem o negativo. Deve ficar **`-R$`** (menos colado
à esquerda do R$). Vale para as telas de Aluguel, Caução e Rescisão.

### A3. Fundo azul no bloco "Formação de Valores"
O bloco "Formação de Valores - Rescisão" tem fundo azul claro. Aplicar a
MESMA cor no bloco "Formação de Valores" das outras telas de recebimento.

### A4. Subtítulo com a parcela na tela de Aluguel
A tela "Registrar Recebimento de Aluguel" não mostra `Parcela XX/XX`
abaixo do título. Deve mostrar, como as outras.

---

## B. Tooltips da Taxa da Poupança

### B1. Tela "Rescisão de Contrato" (diálogo de rescisão)
O link "Valor corrigido pela Taxa da Poupança" abre o tooltip, mas ele
aparece **em branco**. Deve mostrar as informações da correção (valor
original, data base, taxas mensais aplicadas, taxa acumulada, valor
corrigido).

### B2. Tela "Registrar Recebimento de Rescisão de Contrato"
A linha hoje é `Valor Corrigido p/ Devolução (Taxa da Poupança)`, sem
link. Deve virar duas linhas:

    Caução Corrigido p/ Devolução
    Valor Corrigido pela Taxa da Poupança   <- ESTA linha é o link do tooltip

---

## C. Mensagens do sistema

### C1. Diálogo do navegador ao cancelar recebimento de caução
Ao excluir os recebimentos de uma parcela de caução aparece um
`confirm()` cru do navegador ("localhost:3000 diz..."). Fora do padrão
visual do sistema. Trocar pelo diálogo de confirmação próprio.

### C2. Varrer o sistema inteiro
Procurar QUALQUER outro `alert()`, `confirm()` ou `prompt()` nativo do
navegador e trocar pelo padrão do sistema. O Cadu não mapeou todos.

---

## D. Campo a remover

### D1. "Valor da Multa (opcional)" no diálogo de rescisão
Campo criado pelo Claude em 27/ago para viabilizar um teste. O Cadu
reconsiderou: a multa deve ser **uma das duas opções** de cláusula. Se o
corretor quiser dar desconto, arredondar ou zerar a multa, ele usa o campo
"Valor de Desconto" na tela "Registrar Recebimento de Rescisão de
Contrato". **Remover o campo.**

> Consequência para os testes: o cenário BDD que digitava multa de 500,00
> pela tela precisa ser reescrito usando uma das duas cláusulas.

---

## E. Composição da "Formação de Valores" — caso do mês já pago

Recebimento de aluguel criado por rescisão quando o recebimento do mês
estava com status **diferente de pendente** (pago ou parcial). O antigo
não é deletado; nasce um novo só com os valores proporcionais:

    Formação de Valores
    -- Aluguel Proporcional *
    -- Vaga Garagem Proporcional *   (aparece se tiver)
    -- Multa Rescisória
    -- Valor de Desconto              |_-R$_________|
    -- Bloco Atraso no Pagamento
    -- VALOR TOTAL

    * Proporcional de XX dia(s) extras - de XX-XX-XXXX até XX-XX-XXXX

---

## F. Flag "Rescisão" e numeração das parcelas

Estado errado observado na página Recebimentos (imagem 9):

| parcela | conteúdo | flag hoje | deveria |
|---|---|---|---|
| 9/11  | aluguel do mês (mês cheio) | — | — |
| 10/11 | devolução do caução (rescisão) | — | **1/1 + flag Rescisão** |
| 11/11 | aluguel proporcional + multa | **Rescisão** | **10/10, sem flag** |

Regras:

- A flag "Rescisão" pertence **só** ao Recebimento de Rescisão (o da
  devolução do caução). Nunca ao recebimento de aluguel, mesmo quando ele
  nasceu por causa de uma rescisão.
- O Recebimento de Rescisão é sempre **1/1** — é o único recebimento das
  cobranças da rescisão.
- O recebimento de aluguel proporcional é o **último da sequência** de
  aluguel (ex.: 10/10), e o total de parcelas da locação encolhe para
  refletir o encerramento.
- Recebimentos de aluguel continuam aparecendo em Financeiro → Locações.
- O Recebimento de Rescisão aparece em Financeiro → Cauções.

---

## G. Página Financeiro → aba Cauções

### G1. Posição das 4 colunas
"Valor Corrigido p/ Devolução", "Despesas Adicionais", "Valor Desconto" e
"Valor Total" foram criadas no meio da tabela. Devem ir para o **final**,
depois da coluna "Código PIX".

### G2. Linha de TOTAL no rodapé da tabela
Somando todos os valores de cada coluna. Colunas que precisam de total:

- Valor Total Caução
- Valor Parceiro
- Valor Corretor
- Valor Recebido (ver G3)
- as 4 colunas da rescisão

### G3. Renomear coluna
"Valor Pago" passa a ser **"Valor Recebido"**.

---

## H. Testes

### H1. Cobrir todas as regras da rescisão
Atualizar os cenários BDD para cobrir as regras acima, incluindo as três
composições diferentes da "Formação de Valores" e a flag/numeração.

### H2. Smoke temporário e amplo
Enquanto a rescisão está sendo estabilizada, o smoke roda **todos** os
cenários de rescisão, mais cenários que garantam os processos principais
do sistema:

- criar inquilino
- criar imóvel
- fazer locação (mais de uma configuração)
- caução em diferentes números de parcelas
- caução não pago
- pagamento de aluguel do mês

### H3. Depois da produção, encolher o smoke
Quando estiver em produção e estável, o smoke volta a ter só os processos
mais importantes — que é para o que um smoke serve. **Isto é uma decisão
consciente e temporária, não o estado final.**

---

## Estado

- [ ] A1 tela de caução com o layout das outras
- [x] A2 "-R$" no Valor de Desconto (3 telas)
- [x] A3 fundo azul no bloco Formação de Valores
- [x] A4 subtítulo "Parcela XX/XX" na tela de aluguel
- [x] B1 tooltip da poupança no diálogo de rescisão (está em branco)
- [x] B2 duas linhas + link do tooltip na tela de rescisão
- [x] C1 confirm() do cancelamento de caução
- [x] C2 varredura de alert/confirm/prompt no sistema
- [x] D1 remover o campo "Valor da Multa (opcional)"
- [ ] E composição do caso "mês já pago" + rodapé do proporcional
- [ ] F flag Rescisão no recebimento certo + numeração 1/1 e 10/10
- [ ] G1 4 colunas para o fim da tabela
- [ ] G2 linha de TOTAL
- [ ] G3 "Valor Pago" -> "Valor Recebido"
- [ ] H1 testes BDD cobrindo tudo
- [ ] H2 smoke amplo temporário
