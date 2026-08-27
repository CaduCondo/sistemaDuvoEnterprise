# Padronização das telas de Recebimento

Especificação passada pelo Cadu em **27/ago/2026**, com prints das telas.
Este arquivo é o CONTRATO dessas telas — quando houver dúvida sobre o que
uma tela deve mostrar, a resposta está aqui, não no código.

> Salvo antes de qualquer implementação, de propósito: a especificação é
> longa e não pode viver só numa conversa (ver a regra do commit no
> CLAUDE.md e o que aconteceu em 26/ago).

---

## 1. Regras gerais — valem para TODAS as telas de recebimento

### 1.1 Bloco "Atraso no Pagamento"

- Texto: `Atraso no Pagamento: XX dia(s)`
- `XX` = número de dias **com 2 dígitos** (07, não 7).
- **Singular/plural:** `01 dia` (singular). Qualquer outro número → `dias`.
  Cuidado especial com o 01.
- **Retirar** a linha `VALOR TOTAL` de dentro deste bloco, **junto com a
  linha vermelha acima dela**. O VALOR TOTAL da tela é um só, e fica no
  rodapé do bloco "Formação de Valores".
- Continuam dentro do bloco: as duas linhas com caixa de seleção
  (`Multa (10%)` e `Juros (0.030% ao dia)`), com os valores em vermelho.

### 1.2 Campo "Valor de Desconto"

- Aparece em **todas** as telas que têm VALOR TOTAL.
- **Posição:** sempre **ACIMA** do bloco "Atraso no Pagamento" — nunca
  sozinho abaixo dele.
- **Aparência:** conteúdo em **vermelho**, com o sinal de **negativo (−)**
  preso no campo. O usuário digita só o número.
- Formato do campo: `|_-R$_________|`

### 1.3 Padronização de título

- Nenhuma tela de recebimento tem etiqueta colorida ao lado do título.
  A flag roxa **"CAUÇÃO"** ao lado do título da tela de caução deve ser
  **retirada**.
- Todas têm, abaixo do título, o subtítulo com a parcela: `Parcela XX/XX`.

---

## 2. Tela: **Registrar Recebimento de Aluguel**

Título: `Registrar Recebimento de Aluguel`
Subtítulo: `Parcela XX/XX`

O bloco "Formação de Valores" muda conforme a origem do recebimento.
São três casos.

### 2.1 Aluguel normal (não veio de rescisão)

```
Formação de Valores
-- Aluguel
-- Vaga Garagem                    (aparece só se tiver)
-- Valor de Desconto               |_-R$_________|
-- Bloco Atraso no Pagamento
-- VALOR TOTAL
```

### 2.2 Aluguel criado por rescisão, quando o recebimento do mês estava PENDENTE

Neste caso o recebimento que já existia no mês da rescisão **é deletado**, e
o mês cheio entra na conta junto com o proporcional.

```
Formação de Valores
-- Aluguel
-- Aluguel Proporcional *
-- Vaga Garagem                    (aparece só se tiver)
-- Vaga Garagem Proporcional *     (aparece só se tiver)
-- Multa Rescisória
-- Valor de Desconto               |_-R$_________|
-- Bloco Atraso no Pagamento
-- VALOR TOTAL

* Proporcional de XX dia(s) extras - de XX-XX-XXXX até XX-XX-XXXX
```

### 2.3 Aluguel criado por rescisão, quando o recebimento do mês NÃO estava pendente

Neste caso o recebimento existente no mês da rescisão **NÃO é deletado**
(já foi pago, total ou parcialmente — é histórico e não se mexe). Por isso
o mês cheio **não** entra: só o proporcional.

```
Formação de Valores
-- Aluguel Proporcional *
-- Vaga Garagem Proporcional *     (aparece só se tiver)
-- Multa Rescisória
-- Valor de Desconto               |_-R$_________|
-- Bloco Atraso no Pagamento
-- VALOR TOTAL

* Proporcional de XX dia(s) extras - de XX-XX-XXXX até XX-XX-XXXX
```

### 2.4 O que NUNCA pode aparecer nesta tela

- `Multa por Atraso` e `Juros por Atraso` como linhas soltas na "Formação
  de Valores". Essas informações **já são mostradas** dentro do bloco
  "Atraso no Pagamento" — repetir fora dele é erro.
- `Devolução de Caução (corrigido pela Taxa da Poupança)`. Devolução de
  caução é de outra tela (a de Rescisão). Não pertence ao recebimento de
  aluguel — foi exatamente essa mistura que a issue #49 veio separar.

### 2.5 Campo "Parcela" sai

- O campo `Parcela` (desabilitado, tipo `10/12`) deve ser **retirado** do
  bloco "Informações do Pagamento".
- Em seu lugar entra o box **"Forma de Pagamento"**.

---

## 3. Tela: **Registrar Recebimento de Rescisão de Contrato**

Título: `Registrar Recebimento de Rescisão de Contrato`
(era `Registrar Recebimento - Rescisão de Contrato` — trocar o traço)
Subtítulo: `Parcela 1/1`

```
Formação de Valores
-- Devolução de Caução
   Corrigido pela Taxa da Poupança      (linha secundária, abaixo)
-- Despesas Adicionais             |__R$_________|
   Reforma/Limpeza/Pinturas/Reparos necessários
-- Valor de Desconto               |_-R$_________|
-- Bloco Atraso no Pagamento
-- VALOR TOTAL
```

### Ajustes específicos desta tela

- **"Despesas Adicionais" perde o asterisco** — não é campo obrigatório.
- O texto explicativo que hoje fica no **rodapé do bloco**
  (`* Despesas Adicionais de Reforma/Limpeza/Pinturas ou reparos
  necessários após a saída do inquilino`) **sai do rodapé** e passa a ficar
  **na linha logo abaixo do próprio campo**, com o texto encurtado para:
  `Reforma/Limpeza/Pinturas/Reparos necessários`
- **Retirar as linhas tracejadas** que hoje ficam acima e abaixo do campo
  "Despesas Adicionais".
- `Valor de Desconto` sobe para acima do bloco "Atraso no Pagamento"
  (regra 1.2), logo abaixo de "Despesas Adicionais".

---

## 4. Tela: **Registrar Recebimento de Caução**

Título: `Registrar Recebimento de Caução`
Subtítulo: `Parcela XX/XX`

```
Formação de Valores
-- Valor da Parcela
-- Saldo Restante
-- Data de Vencimento
-- Bloco Atraso no Pagamento
```

- **Não tem VALOR TOTAL.** É a única das quatro telas sem essa linha.
- **Não tem Valor de Desconto.**
- **Retirar a flag roxa "CAUÇÃO"** ao lado do título (regra 1.3).

---

## Resumo do que muda, por arquivo provável

| O que | Onde provavelmente |
|---|---|
| Título "de Rescisão de Contrato" | `ManagePaymentForm.tsx` |
| Campo Parcela → Forma de Pagamento | `PaymentFormFields.tsx` + `ManagePaymentForm.tsx` |
| Ordem/aparência do Valor de Desconto | `PaymentBreakdownCard.tsx` |
| Bloco Atraso (VALOR TOTAL, singular/plural) | `PaymentBreakdownCard.tsx` |
| Linhas do breakdown por caso (2.1/2.2/2.3) | `terminationService.ts` + `PaymentBreakdownCard.tsx` |
| Flag roxa CAUÇÃO | tela de recebimento de caução |

---

## Estado

- [ ] 1.1 Bloco Atraso: tirar VALOR TOTAL + linha vermelha
- [ ] 1.1 Bloco Atraso: XX com 2 dígitos, singular/plural do "dia"
- [ ] 1.2 Valor de Desconto: posição acima do bloco Atraso (todas as telas)
- [ ] 1.2 Valor de Desconto: vermelho com sinal negativo (todas as telas)
- [ ] 1.3 Tirar flag roxa "CAUÇÃO"
- [ ] 2.1 / 2.2 / 2.3 Linhas corretas da Formação de Valores por caso
- [ ] 2.4 Nunca mostrar Multa/Juros por Atraso soltos
- [ ] 2.4 Nunca mostrar Devolução de Caução na tela de aluguel
- [ ] 2.5 Campo Parcela → Forma de Pagamento
- [ ] 3. Título "Registrar Recebimento de Rescisão de Contrato"
- [ ] 3. Despesas Adicionais sem asterisco + texto abaixo do campo
- [ ] 3. Tirar linhas tracejadas do Despesas Adicionais
- [ ] 4. Tela de caução sem VALOR TOTAL
