# Padronização das telas — rodada 3

Pedido do Cadu em **28/ago/2026**, com 6 prints.

---

## 1. Flag "Rescisão" no recebimento errado (continua)

Página Recebimentos, locação Studio-6:

| parcela | conteúdo | flag hoje | deveria |
|---|---|---|---|
| 15/17 | aluguel do mês | — | — |
| 16/17 | aluguel proporcional + garagem + multa | **Rescisão** | — |
| 17/17 | devolução do caução (−R$ 4.452,80) | — | **Rescisão** |

A flag pertence ao Recebimento de Rescisão (o da devolução do caução).
Nunca ao de aluguel, mesmo quando ele nasceu de uma rescisão.

## 2. Valor negativo em vermelho na lista de Recebimentos

Coluna "Valor Esperado" da página Recebimentos: `-R$ 4.452,80` está na cor
padrão. Valor negativo deve ser vermelho, como no resto do sistema.

## 3. Descrição do proporcional é longa demais

Hoje a linha inteira carrega o período:

    Aluguel Proporcional - Dias Extras (21 dias - 2026-09-10 a 2026-09-30)
    Garagem Proporcional - Dias Extras (21 dias - 2026-09-10 a 2026-09-30)

Deve virar:

    Aluguel Proporcional *
    Garagem Proporcional *

e o período vai para a legenda no rodapé do bloco, uma vez só:

    * Proporcional de XX dia(s) extras - de XX-XX-XXXX até XX-XX-XXXX

## 4. Tela de Caução ainda fora do padrão

O bloco chama-se "Valores da Caução" e deve chamar-se **"Formação de
Valores"**, como as outras três telas, com o mesmo visual (fundo azul).

    Formação de Valores
    -- Valor da Parcela
    -- Saldo Restante
    -- Data de Vencimento
    -- Bloco Atraso no Pagamento   (só se houver atraso)

Sem VALOR TOTAL, sem Valor de Desconto.

## 5. ⚠️ A correção da poupança usa o caução CONTRATADO, não o PAGO

**Este é o mais grave — é dinheiro, não layout.**

Caso real (Studio-6): caução de R$ 6.000,00 em 3 parcelas.

| parcela | status | valor |
|---|---|---|
| 1/3 | Pago | R$ 2.111,11 |
| 2/3 | Pago | R$ 2.111,11 |
| 3/3 | **Pendente** | R$ 1.777,78 |

Efetivamente pago: **R$ 4.222,22**. Mas o tooltip mostra
`Valor Original: R$ 6.000,00` e corrige sobre esse valor — a imobiliária
devolveria dinheiro que nunca recebeu.

O "Valor Original" da correção tem de ser a soma das parcelas com status
**PAGO**. É a decisão 4 do ticket original (`rescisao-caucao.md`), que já
foi aplicada no `terminationService.ts` mas **não nas telas**, que
recalculam por conta própria a partir do valor contratado.

> Onde procurar: `calculateCorrectedDeposit(...)` chamado em
> `ManagePaymentForm.tsx` e em `RentalTerminationDialog.tsx` — os dois
> passam o caução contratado.

## 6. "Valor de Desconto" some quando o total é negativo

Tela "Registrar Recebimento de Rescisão de Contrato": quando o
`VALOR TOTAL` for **negativo** (a imobiliária paga o inquilino), o campo
"Valor de Desconto" não faz sentido e deve sumir da tela.

Só quando negativo — `-R$ 0,01`, `-R$ 4.739,64`, qualquer valor com o
sinal. Total positivo ou zero: o campo continua.

## 7. Novo campo "VALOR TOTAL DA RESCISÃO"

Quando uma locação foi rescindida e **dois recebimentos compartilham a
mesma data de vencimento** (a data escolhida na rescisão) — sendo um deles
o Recebimento de Rescisão — as duas telas ganham, logo abaixo do
`VALOR TOTAL`, a linha:

    VALOR TOTAL DA RESCISÃO:   <soma do VALOR TOTAL dos dois>

O inquilino normalmente paga os dois de uma vez; sem essa soma, alguém
faz a conta na mão. É a História 5 do ticket original.

Vale tanto para o caso de 3 recebimentos (o do mês + os 2 da rescisão)
quanto para o de 2 (só os da rescisão). O que define é a data de
vencimento igual.

---

## Estado

- [x] 1 flag Rescisão no recebimento certo
- [x] 2 valor negativo em vermelho na lista de Recebimentos
- [x] 3 "Aluguel Proporcional *" + legenda no rodapé
- [x] 4 tela de Caução com o bloco "Formação de Valores" padronizado
- [x] 5 correção da poupança sobre o caução PAGO (não o contratado)
- [x] 6 esconder "Valor de Desconto" quando o total for negativo
- [ ] 7 campo "VALOR TOTAL DA RESCISÃO"
