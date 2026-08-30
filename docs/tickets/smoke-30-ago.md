# Smoke de 30/ago/2026 — as 28 falhas, uma por uma

A primeira rodada de verdade do smoke terminou em **8 passaram, 28 falharam**.
Este documento registra a causa de cada uma e o que foi feito.

A conclusão curta: **nenhuma das 28 era defeito do sistema de aluguel**. Eram
testes procurando na tela coisas que a tela nunca teve, mais um defeito de tela
de verdade (o filtro de mês dos Recebimentos) que só aparecia em condição de
corrida.

## 1. Os botões da tela de Locações não tinham identificação na visão de tabela

**15 das 28 falhas.** Todas as de rescisão, com a mesma mensagem:

    waiting for locator('#rentals-terminate-<id da locação>')

A tela de Locações tem duas visões: cartões e tabela. Ela **abre em tabela**.
Os quatro botões de ação (histórico, renovar, rescindir, excluir) tinham
identificação só na visão de cartões. Na tabela eram botões anônimos — o teste
esperava 30 segundos por algo que não existia naquela visão.

**Correção:** as mesmas identificações foram colocadas nos botões da tabela
(`src/pages/rentals.tsx`). Nada mudou visualmente.

## 2. "Valor Total" batia em duas colunas

**4 falhas.** Na aba Cauções existem "Valor Total Caução" e "Valor Total". O
teste procurava por pedaço de texto, então "Valor Total" achava as duas: numa
hora o Playwright recusava por ambiguidade, noutra pegava a coluna errada (por
isso um cenário comparou 500,00 com R$ 6.000,00).

**Correção (no teste):** o nome exato ganha; só se não houver exato é que vale
o pedaço. E a busca por coluna agora espera a tabela aparecer antes de ler os
cabeçalhos — duas falhas eram "Cabeçalhos vistos: []", ou seja, pressa.

## 3. Trocar o mês nos Recebimentos logo depois de abrir a tela não fazia nada

**2 falhas** — e este é **defeito de tela de verdade, que atinge o usuário.**

A tela de Recebimentos abre filtrada no mês de hoje e vai buscar os dados. Se
um segundo pedido chegasse enquanto o primeiro estava em andamento, ele era
**jogado fora em silêncio**: o rótulo do filtro mudava para "Todos os meses" e
a lista continuava a do mês de hoje, sem erro nenhum na tela.

**Correção (na tela):** em `src/hooks/usePayments.ts`, o pedido que chega
durante uma busca não é mais descartado — fica guardado e roda assim que a
busca em andamento termina. O teste também passou a esperar a primeira carga
antes de mexer no filtro.

## 4. Seletores que nunca existiram

| O que o teste procurava | O que a tela tem |
|---|---|
| `tr[data-installment="1"]` | nada; o verde fica nas células, e a linha se acha pelo código PIX |
| `#deposit-payment-date` | `#rental-deposit-date` |
| texto "Possui garagem" | rótulo "Vaga Garagem?" (`#rental-has-garage`) |
| campo "Valor da garagem" por texto | o campo não tem rótulo visível, só `#rental-garage-value` |
| `[data-testid="payment-card"]` (18 lugares) | nada; a tela abre em lista, cada recebimento é uma linha |
| botão "Pago" | não existe; marca-se abrindo a linha e confirmando no diálogo |
| `[id*="payment-date"]` | `#payment_date`, com traço baixo |
| botão "Salvar" nos cadastros | o botão diz "Criar" (novo) ou "Atualizar" (edição) |
| opção "São Paulo - Centro" no campo Local | a lista vem do banco, e o cenário não criava a localização |

Todos corrigidos **no teste**, porque a tela já tinha um jeito estável de achar
cada elemento. Nenhuma tela foi alterada por causa disso.

⚠️ Consequência importante: `[data-testid="payment-card"]` aparecia em 18
lugares e não achava nada — o que fazia várias verificações **passarem sem
verificar coisa alguma** (contar 0 de 0, percorrer uma lista vazia). Agora elas
verificam de verdade, então é possível que uma rodada futura mostre alguma
falha nova. Isso é o teste começando a funcionar, não uma piora.

## 5. Três cenários que não têm como passar — tirados do smoke

Não é seletor: o preparo deles não cria os dados que eles conferem.

- **`7-locacoes-regras.feature` — "Gerar pagamentos automaticamente".** O
  preparo cria a locação direto no banco, e quem gera os 12 recebimentos é a
  tela. Não existe recebimento nenhum para contar.
- **`8-pagamentos-calculos.feature` — "Calcular pagamento com garagem".** O
  passo "Dado que existe uma locação com:" não cria nada, só guarda a tabela do
  cenário. O teste acaba abrindo um recebimento qualquer da base. E confere
  "Taxa Administração", que não aparece na tela de Recebimentos.
- **`8-pagamentos-calculos.feature` — "Registrar pagamento como pago".** O
  último passo espera um botão "Gerar Recibo" que não existe (o recibo sai pela
  coluna Recibo da aba Pagos).

Os três continuam no repositório, com a explicação escrita acima do cenário.
Para voltarem ao smoke, o preparo precisa ser reescrito — não basta trocar
seletor.

## Como fica o smoke

De 36 para **33 cenários**. Os 19 de rescisão continuam todos dentro: são eles
que guardam as regras novas.

## Pendências conhecidas

- O item E da rodada 2 (composição do mês PENDENTE) continua vermelho de
  propósito, até ser implementado.
- `e2e/step-definitions/rentals.steps.ts` tem um passo de preencher campos que
  usa seis identificações que não existem no formulário de locação
  (`deposit-installment-1-amount`, `depositInstallment2` e companhia). Ele não
  quebra porque só preenche "se estiver visível" — ou seja, não preenche nada e
  segue em frente. Vale arrumar quando alguém mexer nesses cenários.
- `src/components/rentals/DepositPaymentDialog.tsx` tem um rótulo apontando
  para `deposit-payment-time`, que não existe (os campos são `-hour`, `-minute`
  e `-second`). Não quebra nada, mas está errado.

---

# Segunda rodada — 25 passaram, 8 falharam

Restaram oito, de quatro causas.

## 6. A lista de Recebimentos vinha cortada em 1.000 linhas

**6 das 8.** Esta foi a mais enganosa: a mensagem dizia "não achei na tela o
recebimento", o que parece defeito de tela. O print da falha mostrou a tela com
o filtro em "Todos os meses", a busca preenchida e **só as parcelas de caução
da locação de teste** — nenhum recebimento de aluguel.

Com "Todos os meses" a busca vai ao banco **sem filtro de data**, e o Supabase
devolve no máximo **1.000 linhas**, das mais recentes para as mais antigas. Numa
base com contratos até 2028, os recebimentos de 09/2026 ficam fora desse corte.
As parcelas de caução apareciam porque vêm de outra consulta, curta.

**Correção (no teste):** em vez de "Todos os meses", o teste agora seleciona o
**mês do recebimento que ele procura**. A conta passa a ser feita no banco e
voltam poucas linhas. Também ficou mais rápido.

## 7. A limpeza do banco no fim da rodada estourava o tempo

**2 das 8** (o gancho `AfterAll`, contado duas vezes por causa dos 2 cenários em
paralelo). O limite era 60 segundos e a limpeza apaga locações, imóveis,
inquilinos e localizações de todos os cenários da rodada, uma tabela por vez.

**Efeito colateral já visível:** o banco de DEV tem dezenas de locações
"Rescisao E2E ..." e inquilinos "João Silva" que ficaram para trás das rodadas
anteriores. Não atrapalham (têm nome próprio), mas convém limpar um dia.

**Correção:** limite do `AfterAll` subiu para 5 minutos.

## 8. O e-mail do cenário de inquilino era sempre o mesmo

O cadastro de inquilino recusa e-mail repetido. Com "joao@email.com" fixo, o
cenário passava na primeira rodada e falhava em todas as seguintes, sem
mensagem de sucesso e sem erro claro.

**Correção (no teste):** o e-mail ganha um número único a cada rodada
(`joao+<número>@email.com`).

## 9. Mais um cenário impossível — fora do smoke

`7-locacoes-regras.feature` — **"Criar locação - Caução integral"**. Ele abre
"Nova Locação" e preenche só os campos do caução: nunca escolhe imóvel,
inquilino nem as datas, que são obrigatórios. O formulário não tem como ser
gravado. Print da falha confirma o diálogo aberto com tudo em branco.

## Como fica o smoke

**32 cenários.** Os 19 de rescisão continuam todos dentro.
