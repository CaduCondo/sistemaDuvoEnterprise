# language: pt
Funcionalidade: Cálculos e Regras de Pagamentos
  Como um usuário autorizado
  Quero que os cálculos de pagamentos sejam precisos
  Para garantir a corretitude financeira

  Contexto:
    Dado que fiz login como "admin"
    E estou na página "/payments"

  # ✅ NOVO: Teste do bug corrigido - reference_month
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
  Cenário: Filtro de mês deve corresponder à data de vencimento
    Dado que existem múltiplas locações com diferentes datas de início
    Quando filtro por "Setembro/2026" na página de Recebimentos
    Então todos os recebimentos exibidos devem ter:
      | campo                | valor           |
      | Período (referência) | Setembro/2026   |
      | Mês de vencimento    | 09 (Setembro)   |
    E nenhum recebimento deve ter vencimento em outro mês

  Cenário: Calcular pagamento com taxa de administração 10%
    Dado que existe uma locação com aluguel de "2500.00"
    E a taxa de administração é "10%"
    Quando visualizo o detalhamento do pagamento
    Então devo ver:
      | campo                  | valor    |
      | Aluguel                | 2500.00  |
      | Taxa Administração     | 250.00   |
      | Valor Líquido (Repasse)| 2250.00  |

  # FORA DO SMOKE (30/ago/2026): o passo "Dado que existe uma locação com:" não
  # cria nada -- só guarda a tabela. O cenário acaba abrindo um recebimento
  # qualquer da base e conferindo valores que não são os dele. Além disso pede
  # "Taxa Administração", que não existe na tela de Recebimentos.
  # Ver docs/tickets/smoke-30-ago.md.
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

  Cenário: Calcular pagamento com corretor parceiro 5%
    Dado que existe uma locação com:
      | campo           | valor   |
      | Aluguel         | 2500.00 |
      | Corretor (5%)   | sim     |
    E a taxa de administração é "10%"
    Quando visualizo o detalhamento do pagamento
    Então devo ver:
      | campo                  | valor    |
      | Aluguel                | 2500.00  |
      | Taxa Administração     | 250.00   |
      | Taxa Corretor (5%)     | 125.00   |
      | Valor Líquido          | 2125.00  |

  # FORA DO SMOKE (30/ago/2026): o último passo espera um botão "Gerar Recibo"
  # que não existe na tela (o recibo sai pela coluna Recibo da aba Pagos).
  # Ver docs/tickets/smoke-30-ago.md.
  Cenário: Registrar pagamento como pago
    Dado que existe um pagamento pendente
    Quando marco o pagamento como "Pago"
    E preencho a data de pagamento
    E anexo o comprovante
    E clico em "Salvar"
    Então o status deve mudar para "Pago"
    E devo poder gerar o recibo

  Cenário: Gerar recibo de pagamento
    Dado que existe um pagamento "Pago"
    Quando clico em "Gerar Recibo"
    Então devo ver o PDF do recibo
    E o recibo deve conter:
      | informação          |
      | Nome do inquilino   |
      | Endereço do imóvel  |
      | Valor pago          |
      | Data de pagamento   |
      | Detalhamento        |

  Cenário: Cancelar pagamento - Confirmar
    Dado que existe um pagamento "Pendente"
    Quando clico em "Cancelar Pagamento"
    E confirmo o cancelamento
    Então o status deve mudar para "Cancelado"
    E não deve ser possível gerar recibo

  Cenário: Filtrar pagamentos por mês
    Quando seleciono o mês "Janeiro"
    Então devo ver apenas pagamentos de Janeiro

  Cenário: Filtrar pagamentos por ano
    Quando seleciono o ano "2026"
    Então devo ver apenas pagamentos de 2026

  Cenário: Filtrar pagamentos por status
    Quando seleciono o status "Pendente"
    Então devo ver apenas pagamentos pendentes
    Quando seleciono o status "Pago"
    Então devo ver apenas pagamentos pagos