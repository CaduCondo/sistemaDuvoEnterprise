# Rescisão x Caução — 5 histórias

Origem: erro grave relatado pelo Cadu em 21/ago/2026. A rescisão de contrato
mistura o aluguel com a devolução do caução num único recebimento, contaminando
as taxas de administração e gerenciamento.

## Causa raiz (confirmada no código)

`src/services/terminationService.ts` monta UM recebimento só:

    total = aluguel proporcional + multa − caução corrigido

e grava em `payments` (aba Locações). O caução, que é dinheiro de terceiro e não
receita, entra na mesma base sobre a qual `src/pages/financial.tsx` calcula as
taxas de adm (5%) e gerenciamento (3%).

Agravante: `financial.tsx` já tem um remendo que **exclui do cálculo das taxas
todo recebimento com valor pago negativo**. Quando a rescisão fecha negativa, o
registro inteiro sai da conta — e leva junto o aluguel proporcional e a multa,
que deveriam gerar taxa. Ou seja, além de distorcer, deixa de cobrar taxa devida.

## Decisões fechadas com o Cadu (21/ago/2026)

1. Campo "Valor de Desconto": o usuário digita só o número; o sinal "−" fica
   preso no campo. O sistema grava negativo. Ninguém precisa pensar em sinal.
2. A multa rescisória fica no recebimento do ALUGUEL e GERA taxa de adm e
   gerenciamento.
3. A coluna "Valor Devolvido" da aba Cauções é SUBSTITUÍDA por "Valor Corrigido
   p/ Devolução". As 4 colunas novas aparecem para TODAS as locações, inclusive
   ativas, vazias enquanto não houver rescisão.
4. O caução a devolver passa a ser calculado sobre o valor EFETIVAMENTE PAGO
   pelo inquilino, não sobre o valor contratado.
5. A garagem entra no recebimento do aluguel.

   ⚠️ **Descoberto em 24/ago/2026:** hoje a garagem não está no lugar errado
   — ela está AUSENTE. `terminationService.ts` calcula
   `proportionalRent = (monthlyRent / 30) * daysUsed`, e `monthlyRent` é
   `rental.value`, que não inclui `garage_value`. O arquivo seleciona
   `garage_value` do banco (linha 546) e nunca usa. Em toda rescisão de
   imóvel com garagem, a garagem some da cobrança.

   O aluguel e a garagem devem ser proporcionalizados SEPARADAMENTE, cada um
   com a sua linha no detalhamento, como o pagamento mensal normal já faz
   (`rentalUpdateService.ts` monta o breakdown com "Aluguel" e "Garagem" em
   linhas distintas). Exemplo conferido com o Cadu: aluguel 1.200,00 +
   garagem 300,00, rescisão com 25 dias de uso →
   (1.200/30 × 25) + (300/30 × 25) = 1.000,00 + 250,00 = 1.250,00, mais a
   multa de 500,00 = 1.750,00 no recebimento de aluguel.

   Causa de fundo: o cálculo do proporcional está escrito seis vezes na mão
   pelo sistema, e duas dessas cópias (as duas da rescisão) esqueceram a
   garagem. Ver `docs/tickets/refatoracao-duplicacao.md`.
6. Na migração das rescisões antigas, os dois recebimentos gerados ficam com
   status PENDENTE, para que todos sejam revistos manualmente.
7. Os anexos do recebimento antigo são DUPLICADOS para os dois recebimentos
   gerados, e não movidos para um só. Assim cada recebimento fica
   autocontido e ninguém precisa caçar comprovante no outro registro.

## Fórmula da aba Cauções

    Valor Total = Valor Corrigido p/ Devolução + Despesas Adicionais + Valor Desconto

Sinais: devolução é negativa (dinheiro sai), despesas adicionais são positivas
(cobrança do inquilino), desconto é negativo (concedido ao inquilino).
Total negativo = a imobiliária paga o inquilino. Total positivo = o inquilino paga.
Valores negativos devem aparecer em vermelho e inequívocos.

Exemplos validados com o Cadu:
    (−3.000,00) + 1.000,00 + 0,00        = −2.000,00
    (−2.000,00) + 2.200,00 + (−200,00)   =      0,00
    (−1.000,00) + 2.000,00 + (−500,00)   =    500,00

## Ordem e dependências

    1 ──┬─> 3 ──> 4
        │
    2 ──┘
    1 ──> 5

A #4 SÓ pode ser feita depois da #3. Remover o filtro de negativos enquanto os
dados antigos ainda estão contaminados faria os valores negativos das rescisões
velhas entrarem na conta das taxas, piorando os relatórios em vez de melhorar.

---

# HISTÓRIA 1 — Separar aluguel e caução na rescisão (URGENTÍSSIMO)

## Problema
Ver causa raiz acima. Toda rescisão nova continua contaminando as taxas.

## Tarefas
- [ ] Adicionar ao formulário de rescisão os campos "Despesas Adicionais" e
      "Valor de Desconto" (com o sinal "−" preso no campo, usuário digita só o número).
- [ ] `terminationService.ts`: gerar DOIS registros ligados entre si, em vez de um:
      - Recebimento de aluguel → `payments` (aba Locações): proporcional (ou cheio)
        + garagem + multa. Gera taxa de adm e gerenciamento.
      - Recebimento de Rescisão → aba Cauções: devolução corrigida + despesas
        adicionais + desconto. NÃO gera taxa.
- [ ] Criar o vínculo entre os dois recebimentos (mesma rescisão), necessário para
      a #3, a #2 e a #5.
- [ ] Corrigir o cálculo do valor corrigido: usar o total EFETIVAMENTE PAGO das
      parcelas de caução, não `deposit_amount` contratado.
- [ ] Aba Cauções: substituir a coluna "Valor Devolvido" por "Valor Corrigido p/
      Devolução" e acrescentar "Despesas Adicionais", "Valor Desconto" e "Valor Total".
- [ ] As 4 colunas aparecem para TODAS as locações (inclusive ativas), vazias
      quando não houver rescisão.
- [ ] Negativos em vermelho e visualmente inequívocos.

## Critérios de aceitação (BDD)

Cenário: rescisão gera dois recebimentos separados
  Dado uma locação ativa com caução pago e aluguel mensal definido
  Quando eu registrar a rescisão do contrato
  Então deve ser criado um recebimento de aluguel na aba Locações contendo o
    valor proporcional, a garagem e a multa
  E deve ser criado um Recebimento de Rescisão visível apenas na aba Cauções
  E a devolução do caução NÃO deve aparecer na aba Locações

Cenário: a devolução do caução não afeta as taxas
  Dado uma rescisão com devolução de caução de R$ 3.000,00
  E um aluguel proporcional de R$ 1.000,00 com multa de R$ 500,00
  Quando as taxas de administração e gerenciamento forem calculadas
  Então elas devem incidir sobre R$ 1.500,00
  E não devem sofrer nenhuma influência dos R$ 3.000,00 de caução

Cenário: multa gera taxa
  Dado uma rescisão com multa rescisória de R$ 500,00
  Quando as taxas forem calculadas
  Então a multa deve estar incluída na base de cálculo das duas taxas

Cenário: caução pago parcialmente
  Dado uma locação cujo caução contratado é R$ 3.000,00 em 3 parcelas
  E o inquilino pagou apenas 2 parcelas, totalizando R$ 2.000,00
  Quando a rescisão for registrada
  Então o valor corrigido para devolução deve ser calculado sobre R$ 2.000,00
  E não sobre os R$ 3.000,00 contratados

Cenário: caução não pago
  Dado uma locação cujo caução nunca foi pago
  Quando a rescisão for registrada
  Então o valor corrigido para devolução deve ser R$ 0,00

Cenário: campo de desconto sem sinal
  Dado que estou preenchendo o Recebimento de Rescisão
  Quando eu digitar "200" no campo "Valor de Desconto"
  Então o sistema deve registrar o valor como −R$ 200,00
  E eu não devo precisar digitar o sinal negativo

Cenário: total da aba Cauções com resultado negativo
  Dado um Valor Corrigido p/ Devolução de −R$ 3.000,00
  E Despesas Adicionais de R$ 1.000,00
  E Valor Desconto de R$ 0,00
  Quando eu abrir a aba Cauções
  Então a coluna Valor Total deve mostrar −R$ 2.000,00
  E o valor deve estar em vermelho

Cenário: total zerado
  Dado um Valor Corrigido p/ Devolução de −R$ 2.000,00
  E Despesas Adicionais de R$ 2.200,00
  E Valor Desconto de −R$ 200,00
  Então a coluna Valor Total deve mostrar R$ 0,00

Cenário: total positivo
  Dado um Valor Corrigido p/ Devolução de −R$ 1.000,00
  E Despesas Adicionais de R$ 2.000,00
  E Valor Desconto de −R$ 500,00
  Então a coluna Valor Total deve mostrar R$ 500,00
  E o valor não deve estar em vermelho

Cenário: colunas visíveis em locação ativa
  Dado uma locação ativa que ainda não foi rescindida
  Quando eu abrir a aba Cauções
  Então as 4 colunas devem estar visíveis e vazias

---

# HISTÓRIA 2 — Relatório das rescisões antigas contaminadas (URGENTE)

## Problema
Antes de mexer em dado financeiro histórico, o Cadu precisa ver o tamanho do
estrago: quais rescisões estão contaminadas e quanto de taxa foi distorcida.
Só leitura, risco zero.

## Tarefas
- [ ] Identificar todas as rescisões já registradas que têm devolução de caução
      embutida no recebimento de aluguel.
- [ ] Para cada uma: locação, inquilino, imóvel, data da rescisão, valor do
      recebimento hoje, quanto é aluguel/garagem/multa e quanto é caução.
- [ ] Calcular a taxa de adm e gerenciamento que foi cobrada e a que deveria ter
      sido, e a diferença.
- [ ] Separar os casos em que o recebimento ficou negativo (excluídos por
      completo do cálculo das taxas pelo remendo) dos que ficaram positivos.
- [ ] Totalizar a diferença por período e por local.
- [ ] Entregar em formato que o Cadu consiga conferir linha por linha.

## Critérios de aceitação (BDD)

Cenário: relatório lista todas as rescisões contaminadas
  Dado que existem rescisões antigas com caução embutido no aluguel
  Quando eu gerar o relatório
  Então cada rescisão contaminada deve aparecer com o valor de aluguel e o
    valor de caução separados
  E deve mostrar a taxa cobrada, a taxa correta e a diferença

Cenário: relatório destaca rescisões que ficaram negativas
  Dado uma rescisão antiga cujo recebimento ficou com valor negativo
  Quando eu gerar o relatório
  Então ela deve estar marcada como "excluída do cálculo das taxas"
  E deve mostrar quanto de taxa deixou de ser cobrada

Cenário: relatório não altera nada
  Quando eu gerar o relatório
  Então nenhum recebimento deve ser criado, alterado ou excluído

---

# HISTÓRIA 3 — Migrar as rescisões antigas (URGENTE, depende de 1 e 2)

## Problema
As rescisões já registradas continuam com o caução misturado ao aluguel,
distorcendo todos os relatórios financeiros do passado.

## Decisão do Cadu
Cada recebimento de rescisão antigo vira DOIS, ambos com status PENDENTE, para
que sejam revistos um a um.

## Cuidados obrigatórios
- Rodar primeiro em DEV, com relatório antes/depois aprovado pelo Cadu.
- Backup antes de rodar em produção.
- Preservar os dados originais (valor pago, data de pagamento, anexos) — ao virar
  pendente, essas informações não podem sumir, senão a revisão é feita no escuro.
- Duplicar os anexos existentes para os DOIS recebimentos gerados (decisão do
  Cadu, 22/08/2026): cada um fica autocontido.
- Nunca rodar em produção sem validação prévia em DEV.

## Efeito esperado (o Cadu já foi avisado)
Rescisões hoje marcadas como pagas voltam a aparecer como não recebidas. O total
recebido do período vai cair até a revisão manual ser concluída.

## Critérios de aceitação (BDD)

Cenário: rescisão antiga é destrinchada em dois recebimentos
  Dado um recebimento de rescisão antigo contendo aluguel, multa e devolução de caução
  Quando a migração for executada
  Então devem existir dois recebimentos ligados à mesma rescisão
  E o primeiro deve conter apenas aluguel, garagem e multa, na aba Locações
  E o segundo deve conter apenas a devolução do caução, na aba Cauções
  E ambos devem estar com status pendente

Cenário: nenhum valor é perdido na migração
  Dado um recebimento de rescisão antigo de valor conhecido
  Quando a migração for executada
  Então a soma dos dois recebimentos gerados deve ser igual ao valor original
  E o valor pago, a data de pagamento e os anexos originais devem continuar
    consultáveis

Cenário: anexos são duplicados para os dois recebimentos
  Dado um recebimento de rescisão antigo com 2 anexos
  Quando a migração for executada
  Então o recebimento de aluguel deve ter os 2 anexos
  E o Recebimento de Rescisão deve ter os mesmos 2 anexos
  E nenhum anexo deve ser perdido ou movido

Cenário: migração é validada em DEV antes de produção
  Dado que a migração ainda não foi aprovada pelo Cadu
  Então ela não deve ser executada no banco de produção

Cenário: taxas passam a refletir apenas o aluguel
  Dado que a migração foi concluída
  Quando as taxas de adm e gerenciamento forem recalculadas para o período
  Então elas devem incidir apenas sobre aluguel, garagem e multa
  E nenhuma devolução de caução deve influenciar o resultado

---

# HISTÓRIA 4 — Remover o remendo do cálculo das taxas (ALTA, depende de 3)

## Problema
`financial.tsx` exclui do cálculo das taxas todo recebimento com valor pago
negativo, e aplica `Math.abs()` em pontos do mapeamento de pagamentos parciais.
Isso foi um remendo para o sintoma do caução misturado. Depois da #3 ele deixa de
ser necessário e passa a esconder erros legítimos.

## ATENÇÃO À ORDEM
Esta história SÓ pode ser feita depois da #3 concluída. Remover o filtro enquanto
os dados antigos ainda estiverem contaminados faz os valores negativos das
rescisões velhas entrarem na conta das taxas, piorando os relatórios.

## Tarefas
- [ ] Remover o filtro `paidAmount > 0` do cálculo de adminFee e managementFee.
- [ ] Revisar cada `Math.abs()` no mapeamento de pagamentos e remover os que
      mascaram sinal legítimo.
- [ ] Conferir que os totais do período não mudam após a remoção (a #3 já limpou
      a causa).

## Critérios de aceitação (BDD)

Cenário: remoção do filtro não altera os totais
  Dado que a migração da história 3 foi concluída
  Quando o filtro de valores negativos for removido do cálculo das taxas
  Então os totais de taxa de adm e gerenciamento do período devem permanecer iguais

Cenário: recebimento negativo legítimo volta a ser considerado
  Dado um recebimento de aluguel legitimamente negativo
  Quando as taxas forem calculadas
  Então esse recebimento não deve ser silenciosamente ignorado

---

# HISTÓRIA 5 — Total somado da rescisão (MÉDIA, depende de 1)

## Problema
Depois da separação, o inquilino normalmente paga os dois valores de uma vez. Sem
um total somado visível, alguém precisa fazer a conta na mão.

## Tarefas
- [ ] Usando o vínculo criado na #1, exibir "Total da Rescisão" com os dois
      valores destrinchados abaixo.
- [ ] Mostrar em ambos os recebimentos e na tela da rescisão.
- [ ] Deixar claro quando o total é a receber e quando é a pagar ao inquilino.

## Critérios de aceitação (BDD)

Cenário: total somado da rescisão
  Dado um recebimento de aluguel de R$ 1.500,00
  E um Recebimento de Rescisão de −R$ 2.000,00 da mesma rescisão
  Quando eu abrir qualquer um dos dois
  Então devo ver "Total da Rescisão: −R$ 500,00"
  E devo ver os dois valores que compõem esse total
  E deve estar claro que o valor é a pagar ao inquilino
