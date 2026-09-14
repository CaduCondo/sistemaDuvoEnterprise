# language: pt
@pagamentos
Funcionalidade: Cálculos e Regras de Pagamentos
  Como um usuário autorizado
  Quero que os cálculos de pagamentos sejam precisos
  Para garantir a corretitude financeira

  Contexto:
    Dado que fiz login como "admin"
    E estou na página "/payments"

  # ✅ NOVO: Teste do bug corrigido - reference_month
  @sistemaCompleto
  Cenário: Pagamento proporcional - Início após vencimento (Bug corrigido)
    Dado que crio uma locação com:
      | campo          | valor      |
      | Data início    | 18/07/2026 |
      | Data fim       | 31/12/2026 |
      | Dia vencimento | 10         |
      | Aluguel        | 3000.00    |
    Quando vou para a página de Recebimentos
    E filtro pelo mês "Agosto/2026"
    Então devo ver 1 recebimento
    E o recebimento deve ter:
      | campo                | valor      |
      | Período (referência) | Agosto/2026|
      | Data Vencimento      | 10/08/2026 |
      | Status               | Pendente   |
    E o valor deve ser proporcional a 26 dias
    E quando filtro por "Julho/2026"
    Então NÃO devo ver recebimentos dessa locação

  # ✅ NOVO: Teste de pagamento proporcional - Início antes do vencimento
  @sistemaCompleto
  Cenário: Pagamento proporcional - Início antes do vencimento
    Dado que crio uma locação com:
      | campo          | valor      |
      | Data início    | 02/07/2026 |
      | Data fim       | 31/12/2026 |
      | Dia vencimento | 10         |
      | Aluguel        | 3000.00    |
    Quando vou para a página de Recebimentos
    E filtro pelo mês "Julho/2026"
    Então devo ver 1 recebimento
    E o recebimento deve ter:
      | campo                | valor      |
      | Período (referência) | Julho/2026 |
      | Data Vencimento      | 10/07/2026 |
      | Status               | Pendente   |
    E o valor deve ser proporcional a 8 dias

  # ✅ NOVO: Validar sincronia entre filtro e vencimento
  @sistemaCompleto
  Cenário: Filtro de mês deve corresponder à data de vencimento
    Dado que existem múltiplas locações com diferentes datas de início
    Quando filtro por "Setembro/2026" na página de Recebimentos
    Então todos os recebimentos exibidos devem ter:
      | campo                | valor           |
      | Período (referência) | Setembro/2026   |
      | Mês de vencimento    | 09 (Setembro)   |
    E nenhum recebimento deve ter vencimento em outro mês

  # ✅ Reescrito em 14/set/2026 (issue #99, decisão #1 do Cadu: "ajuste os
  # testes para conferir o total do dashboard"). Motivo original: não existe
  # (e não vai ser criada) uma tela de detalhamento por recebimento com
  # "Taxa Administração" -- conferido em PaymentBreakdownCard.tsx, o
  # detalhamento real nunca mostra isso por pagamento individual. A taxa só
  # existe AGREGADA no card "Taxa Adm" do Dashboard Financeiro
  # (financial.tsx, kpiCalculations) -- é isso que o cenário passa a
  # validar: cria um recebimento pago isolado (mês sem nenhum outro dado,
  # pra não poluir o total do card) e confere que o card mostra valor pago
  # × percentual REAL configurado no sistema (hoje 5%, não os "10%" fixos
  # que o cenário antigo assumia -- é configurável em Configurações).
  @sistemaCompleto
  Cenário: Taxa de administração aparece corretamente no Dashboard Financeiro
    Dado que existe um pagamento "Pago" de "2500.00" isolado no período de teste
    Quando estou na página "/financial"
    E seleciono o período de teste no filtro de mês e ano
    Então o card "Taxa Adm" deve mostrar a taxa administrativa sobre "2500.00"

  # FORA DO SMOKE (30/ago/2026): o passo "Dado que existe uma locação com:" não
  # cria nada -- só guarda a tabela. O cenário acaba abrindo um recebimento
  # qualquer da base e conferindo valores que não são os dele. Além disso pede
  # "Taxa Administração", que não existe na tela de Recebimentos.
  # Ver docs/tickets/smoke-30-ago.md.
  @quebrado
  Cenário: Calcular pagamento com garagem
    Dado que existe uma locação com:
      | campo          | valor   |
      | Aluguel        | 2500.00 |
      | Garagem        | 300.00  |
    E a taxa de administração é "10%"
    Quando visualizo o detalhamento do pagamento
    Então devo ver:
      | campo                  | valor    |
      | Aluguel                | 2500.00  |
      | Garagem                | 300.00   |
      | Total Bruto            | 2800.00  |
      | Taxa Administração     | 280.00   |
      | Valor Líquido          | 2520.00  |

  # ❌ REMOVIDO em 14/set/2026 (issue #99). Este cenário testava uma
  # comissão de "corretor parceiro" incidindo sobre um recebimento de
  # ALUGUEL, com "Taxa Corretor (5%)" e "Valor Líquido" por pagamento --
  # confirmado com o Cadu que isso nunca existiu e não é pra existir: o
  # corretor parceiro é só sobre CAUÇÃO, e o valor é preenchido direto na
  # tabela da aba Cauções (página Financeiro), coluna "Valor Parceiro" --
  # célula que só abre pra edição quando o checkbox "Corretor Parceiro?" é
  # marcado na locação. Essa regra real já está coberta em
  # 10-caucoes.feature ("Editar comissão de corretor parceiro inline").
  # Não existe (e não vai existir) equivalente por pagamento de aluguel --
  # por isso o cenário foi removido em vez de deixado sem tag.

  # FORA DO SMOKE (30/ago/2026): o último passo espera um botão "Gerar Recibo"
  # que não existe na tela (o recibo sai pela coluna Recibo da aba Pagos).
  # Ver docs/tickets/smoke-30-ago.md.
  @quebrado
  Cenário: Registrar pagamento como pago
    Dado que existe um pagamento pendente
    Quando marco o pagamento como "Pago"
    E preencho a data de pagamento
    E anexo o comprovante
    E clico em "Salvar"
    Então o status deve mudar para "Pago"
    E devo poder gerar o recibo

  # ⚠️ Corrigido em 14/set/2026 (issue #99): "Dado que existe um pagamento
  # {string}" era um stub que não criava nada -- agora cria de verdade
  # (inquilino + locação + pagamento). Também nunca existiu um botão
  # "Gerar Recibo": a coluna "Recibo" (aba Pagos) mostra botões numerados
  # (payments.tsx). E o recibo em si (PaymentReceipt.tsx) é uma carta
  # corrida, não um formulário com campos rotulados -- "o recibo deve
  # conter" passou a checar o texto real (nome do inquilino, "situado em
  # ...", "Total Pago", "vencimento em ...", "Valores:").
  @sistemaCompleto
  Cenário: Gerar recibo de pagamento
    Dado que existe um pagamento "Pago"
    Quando clico no botão de recibo
    Então devo ver o PDF do recibo
    E o recibo deve conter:
      | informação          |
      | Nome do inquilino   |
      | Endereço do imóvel  |
      | Valor pago          |
      | Data de pagamento   |
      | Detalhamento        |

  # ⚠️ Corrigido em 14/set/2026 (issue #99): o botão "Cancelar Pagamento"
  # só existe no diálogo de um recebimento JÁ PAGO (ManagePaymentForm.tsx,
  # só aparece se status for "paid"/"partial") -- e cancelar reverte o
  # status pra "Pendente" (o sistema não tem status "Cancelado", ver
  # payments.tsx/confirmCancelPayment). O cenário testava cancelar um
  # pagamento que ainda nem tinha sido pago, fluxo que não existe.
  @sistemaCompleto
  Cenário: Cancelar pagamento - Confirmar
    Dado que existe um pagamento "Pago"
    Quando abro o recebimento de teste
    E clico em "Cancelar Pagamento"
    E confirmo o cancelamento
    Então o status deve mudar para "Pendente"
    E não deve ser possível gerar recibo

  @sistemaCompleto
  Cenário: Filtrar pagamentos por mês
    Quando seleciono o mês "Janeiro"
    Então devo ver apenas pagamentos de Janeiro

  @sistemaCompleto
  Cenário: Filtrar pagamentos por ano
    Quando seleciono o ano "2026"
    Então devo ver apenas pagamentos de 2026

  @sistemaCompleto
  Cenário: Filtrar pagamentos por status
    Quando seleciono o status "Pendente"
    Então devo ver apenas pagamentos pendentes
    Quando seleciono o status "Pago"
    Então devo ver apenas pagamentos pagos

  # ✅ NOVO (bug real, 06/set/2026): um recebimento "pending" que sobrou de
  # uma locação já excluída (status='deleted' -- ver rentalService.remove())
  # continuava aparecendo aqui como se fosse cobrança válida, duplicando a
  # linha da locação nova que tomou o lugar dela na tela. Caso real: ACÁCIAS
  # APTO 36, Agosto/2026 -- a locação antiga foi excluída e recriada (correção
  # manual de contrato), e o recebimento pendente da antiga não sumiu.
  # Corrigido filtrando por rental.status em src/hooks/usePayments.ts.
  @sistemaCompleto
  Cenário: Recebimento residual de locação excluída não aparece nos Recebimentos
    Dado que existe uma locação com status "deleted" e um recebimento pendente residual em "Agosto/2026"
    Quando vou para a página de Recebimentos
    E filtro pelo mês "Agosto/2026"
    Então não devo ver o recebimento residual da locação excluída