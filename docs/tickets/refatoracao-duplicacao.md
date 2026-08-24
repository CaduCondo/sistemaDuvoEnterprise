# Refatoração: código duplicado, código morto e ruído

Levantamento feito em 24/ago/2026, a pedido do Cadu: *"meu medo é ter até
código repetido ou até sobreposto; queria fazer uma refatoração completa,
tirando código antigo, console.logs desnecessários, até comentários
desnecessários também."*

O medo tem fundamento. Mediram-se números, e um bug real já saiu daí.

## O que foi medido

| O quê | Quanto |
|---|---|
| Arquivos em `src/` | 201 |
| Linhas em `src/` | 52.805 |
| Chamadas a `console.log` em `src/` | **767** |
| Marcadores de história no código (`✅ CORREÇÃO`, `🔥`, etc.) | **164** |
| Definições diferentes de `formatCurrency` | **9** |
| Lugares que recalculam o proporcional (`/ 30 * dias`) na mão | **6** |
| Arquivos que repetem a soma "aluguel + garagem" | **16** |
| Guias de teste em `e2e/` com conteúdo sobreposto | 6 (1.035 linhas) |

Os cinco arquivos com mais `console.log`:

```
124  src/components/PaymentReceipt.tsx
 90  src/services/terminationService.ts
 45  src/services/tenantService.ts
 39  src/services/paymentService.ts
 37  src/services/authService.ts
```

## A duplicação já custou dinheiro — e dá para provar

O cálculo do valor proporcional (`valor / 30 * dias`) está escrito **seis
vezes**, cada uma na mão:

| Onde | Proporcionaliza o aluguel | Proporcionaliza a garagem |
|---|---|---|
| `paymentService.ts:111-112` | ✅ | ✅ |
| `paymentService.ts:762-763` | ✅ | ✅ |
| `RentalFormDialog.tsx:1051-1059` | ✅ | ✅ |
| `rentalUpdateService.ts:27` | ✅ | ❌ |
| `RentalTerminationDialog.tsx:226,233` | ✅ | ❌ |
| `terminationService.ts:92,108` | ✅ | ❌ |

Quatro cópias somam a garagem. Duas — as duas da **rescisão** — não somam.

Resultado prático: **em toda rescisão de imóvel com garagem, a garagem
simplesmente some da cobrança.** O `terminationService.ts` chega a selecionar
`garage_value` do banco (linha 546) e nunca usa o valor.

Isso não foi encontrado por auditoria. Foi encontrado em 24/ago/2026 porque o
Cadu conferiu a conta de um cenário de teste e perguntou onde estava a
garagem. Um cálculo com uma implementação só não teria como divergir assim.

E o mais irônico: **já existe** `src/lib/rentalCalculations.ts`, com uma
função `calculateProportionalRent` pronta. Só dois arquivos a usam.

## Por que NÃO fazer uma refatoração de uma vez só

Refatorar é mudar a forma sem mudar o comportamento. Só que hoje não há como
provar que o comportamento não mudou: a suíte de testes acabou de sair de
semanas quebrada e cobre, por enquanto, 4 cenários. Uma refatoração grande
agora seria mexer em 52 mil linhas de código financeiro sem rede.

O caminho é o inverso: **cada fatia da refatoração vem acompanhada dos
cenários que a protegem**, e nenhuma fatia é maior do que dá para revisar de
uma sentada.

Há ainda uma ordem que importa: o `terminationService.ts` vai ser reescrito
pela issue #49 de qualquer jeito. Refatorá-lo antes seria trabalho jogado
fora.

## Ordem proposta

### Fase 0 — antes de mexer em qualquer código (agora)
- [ ] Religar, com a marca `@smoke`, os cenários de caução e locação que já
      existem em `10-caucoes.feature` e `7-locacoes-regras.feature`. Eles já
      estão escritos; nunca rodaram. É a rede de segurança da refatoração
      inteira, e não custa escrever teste nenhum.

### Fase 1 — o que já está causando bug (junto com a #49)
- [ ] Uma implementação só do proporcional, em `rentalCalculations.ts`,
      recebendo aluguel e garagem, e as 6 cópias passando a chamá-la.
- [ ] A garagem volta para a rescisão (já é a decisão 5 da #49, mas agora se
      sabe que ela não está só no lugar errado: está ausente).

### Fase 2 — ruído de baixo risco
- [ ] Uma definição só de `formatCurrency`. Hoje são 9, sendo **duas** delas
      "oficiais", em `src/lib/masks.ts` e `src/lib/utils.ts`. Escolher uma,
      apagar a outra, apontar as 7 cópias inline para ela.
- [ ] Consolidar os 6 guias de teste de `e2e/` em dois: um "como rodar" e um
      "como escrever". `SMOKE.md` já é o mais atual.

### Fase 3 — os `console.log`
- [ ] Trocar por um logger que só fala em desenvolvimento, começando pelos
      cinco arquivos da lista acima (335 das 767 chamadas).
- [ ] **Não apagar cegamente.** Vários desses logs são o único registro do
      raciocínio de cálculos financeiros — o `terminationService.ts` narra a
      conta inteira passo a passo. O que for explicação vira comentário ou
      teste; o que for depuração esquecida vai embora.

### Fase 4 — código morto e comentários
- [ ] Procurar arquivos e exports que ninguém importa.
- [ ] Os 164 marcadores de história (`✅ CORREÇÃO`, `🔥`) contam o que foi
      corrigido, não o que o código faz. O que for regra de negócio vira
      comentário de regra; o resto sai — o histórico já está no Git.

## O que fica fora por enquanto

Os arquivos gigantes (`financial.tsx` com 2.462 linhas, `paymentService.ts`
com 1.668) pedem divisão, mas quebrar arquivo é a mudança de maior risco de
todas e a que mais precisa de teste. Fica para depois que a cobertura estiver
de pé.

## Como saber que deu certo

Cada fase fecha com os mesmos cenários passando antes e depois. Se um cenário
mudar de resultado, não foi refatoração — foi mudança de comportamento, e aí
ou é bug novo ou é bug antigo aparecendo.
