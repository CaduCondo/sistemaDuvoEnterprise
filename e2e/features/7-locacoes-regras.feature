# language: pt
Funcionalidade: Regras de Negócio de Locações
  Como um usuário autorizado
  Quero gerenciar locações
  Para garantir que as regras de negócio sejam aplicadas corretamente

  Contexto:
    Dado que fiz login como "admin"
    E estou na página "/rentals"

  Cenário: Criar locação - Validar imóvel disponível
    Quando clico no botão "Nova Locação"
    E seleciono um imóvel que está "Ocupado"
    Então devo ver uma mensagem de erro
    E não devo poder continuar

  Cenário: Criar locação - Caução obrigatória
    Quando clico no botão "Nova Locação"
    E preencho todos os campos obrigatórios
    E NÃO preencho o valor da caução
    E tento salvar
    Então devo ver a mensagem "Caução é obrigatória"

  # ✅ ATUALIZADO: Reflete nova estrutura de parcelas de caução
  Cenário: Criar locação - Parcelamento de caução (3 parcelas)
    Quando clico no botão "Nova Locação"
    E preencho todos os campos obrigatórios
    E preencho o valor da caução com "6000.00"
    E marco a opção "Parcelar caução"
    E seleciono "3 parcelas"
    E preencho:
      | campo                           | valor      |
      | 1ª parcela - Valor              | 2000.00    |
      | 1ª parcela - Data Pagamento     | 01/08/2026 |
      | 2ª parcela - Valor              | 2000.00    |
      | 2ª parcela - Data Vencimento    | 01/09/2026 |
      | 3ª parcela - Valor              | 2000.00    |
      | 3ª parcela - Data Vencimento    | 01/10/2026 |
    E salvo a locação
    Então na aba "Cauções" da página Financeiro devo ver:
      | Parcela | Valor   | Data Vencimento | Data Pagamento | Status   |
      | 1/3     | 2000.00 | 01/08/2026      | 01/08/2026     | Pendente |
      | 2/3     | 2000.00 | 01/09/2026      | (vazio)        | Pendente |
      | 3/3     | 2000.00 | 01/10/2026      | (vazio)        | Pendente |

  # ✅ NOVO: Testa que 1ª parcela salva em due_date E payment_date
  Cenário: Criar locação - 1ª parcela de caução preenche ambas as datas
    Quando clico no botão "Nova Locação"
    E preencho todos os campos obrigatórios
    E marco a opção "Parcelar caução"
    E seleciono "2 parcelas"
    E preencho a "Data Pagamento" da 1ª parcela com "15/08/2026"
    E salvo a locação
    Então no banco de dados a parcela 1 deve ter:
      | campo        | valor      |
      | due_date     | 15/08/2026 |
      | payment_date | 15/08/2026 |
    E a parcela 2 deve ter:
      | campo        | valor      |
      | due_date     | (preenchido)|
      | payment_date | NULL       |

  # ✅ NOVO: Testa carregamento de parcelas ao visualizar locação
  Cenário: Visualizar locação - Carregar dados de caução da tabela
    Dado que existe uma locação com caução parcelado em 3x:
      | Parcela | Valor   | Data Vencimento | Código PIX |
      | 1/3     | 2000.00 | 01/08/2026      | PIX123     |
      | 2/3     | 2000.00 | 01/09/2026      | PIX456     |
      | 3/3     | 2000.00 | 01/10/2026      |            |
    Quando abro a locação em modo "Visualizar"
    Então no bloco "Informações do Caução" devo ver:
      | campo                        | valor      |
      | 1ª parcela - Valor           | 2000.00    |
      | 1ª parcela - Data Pagamento  | 01/08/2026 |
      | 1ª parcela - Código PIX      | PIX123     |
      | 2ª parcela - Valor           | 2000.00    |
      | 2ª parcela - Data Vencimento | 01/09/2026 |
      | 2ª parcela - Código PIX      | PIX456     |
      | 3ª parcela - Valor           | 2000.00    |
      | 3ª parcela - Data Vencimento | 01/10/2026 |
      | 3ª parcela - Código PIX      | (vazio)    |

  Cenário: Criar locação - Caução integral
    Quando clico no botão "Nova Locação"
    E preencho o valor da caução com "5000.00"
    E NÃO marco a opção "Parcelar caução"
    E preencho a "Data Pagamento" com "01/08/2026"
    E salvo a locação
    Então na aba "Cauções" devo ver:
      | Parcela | Valor   | Data Vencimento | Data Pagamento |
      | 1/1     | 5000.00 | 01/08/2026      | 01/08/2026     |

  Cenário: Criar locação - Garagem opcional
    Quando clico no botão "Nova Locação"
    E marco a opção "Possui garagem"
    Então devo ver o campo "Valor da garagem"
    E devo poder preencher o valor

  Cenário: Criar locação - Corretor parceiro
    Quando clico no botão "Nova Locação"
    E marco a opção "Corretor parceiro"
    Então devo ver os campos:
      | campo           |
      | Nome do corretor|
      | Taxa (%)        |

  Cenário: Criar locação - Gerar pagamentos automaticamente
    Dado que existe um imóvel disponível "IMO-001" com aluguel de "2500.00"
    E existe um inquilino "João Silva"
    Quando crio uma locação com:
      | campo          | valor      |
      | Imóvel         | IMO-001    |
      | Inquilino      | João Silva |
      | Dia vencimento | 10         |
      | Data início    | 01/01/2026 |
      | Data fim       | 31/12/2026 |
    Então devem ser criados 12 pagamentos
    E cada pagamento deve ter valor de "2500.00"
    E todos os pagamentos devem vencer no dia 10

  Cenário: Editar locação - Atualizar valor do aluguel
    Dado que existe uma locação ativa
    Quando edito a locação
    E altero o valor do aluguel de "2500.00" para "2800.00"
    E salvo as alterações
    Então os pagamentos futuros devem ser atualizados para "2800.00"
    E os pagamentos já pagos devem manter o valor original

  Cenário: Editar locação - Preservar snapshot em pagamentos pagos
    Dado que existe uma locação ativa com aluguel de "2500.00"
    E o pagamento de Janeiro/2026 está "Pago" com valor de "2500.00"
    Quando edito a locação
    E altero o valor do aluguel para "2800.00"
    E altero a garagem para "400.00"
    E salvo as alterações
    E visualizo o recibo do pagamento de Janeiro/2026
    Então no bloco "Informações do Contrato" devo ver:
      | campo             | valor   |
      | Valor do Aluguel  | 2500.00 |
      | Valor da Garagem  | 0.00    |
      | Valor Total       | 2500.00 |
    E no bloco "Formação de Valores" devo ver:
      | descrição | valor   |
      | Aluguel   | 2500.00 |
    Quando visualizo um pagamento futuro
    Então no bloco "Informações do Contrato" devo ver:
      | campo             | valor   |
      | Valor do Aluguel  | 2800.00 |
      | Valor da Garagem  | 400.00  |
      | Valor Total       | 3200.00 |
    E no bloco "Formação de Valores" devo ver:
      | descrição | valor   |
      | Aluguel   | 2800.00 |
      | Garagem   | 400.00  |

  Cenário: Editar locação - Não atualizar pagamentos passados pendentes
    Dado que existe uma locação ativa com aluguel de "2500.00"
    E o pagamento de Novembro/2025 está "Pendente" com valor de "2500.00"
    E o pagamento de Dezembro/2025 está "Pendente" com valor de "2500.00"
    E o pagamento de Março/2026 está "Pendente" com valor de "2500.00"
    Quando edito a locação em "15/02/2026"
    E altero o valor do aluguel para "2800.00"
    E salvo as alterações
    Então o pagamento de Novembro/2025 deve manter "2500.00"
    E o pagamento de Dezembro/2025 deve manter "2500.00"
    E o pagamento de Março/2026 deve ser atualizado para "2800.00"
    E pagamentos futuros devem ter "2800.00"

  # ✅ NOVO (bug corrigido 21/ago/2026): quando a data de início é
  # corrigida DEPOIS que a parcela do mês já tinha sido criada, o valor
  # dessa parcela precisa ser recalculado — antes ficava "preso" no valor
  # de mês cheio, mesmo quando a nova data tornava a parcela proporcional.
  Cenário: Editar locação - Corrigir data de início recalcula parcela já criada
    Dado que existe uma locação ativa com aluguel de "2500.00"
    E o dia de vencimento é "20"
    E o pagamento de referência Junho/2026 está "Pendente" com valor de "2500.00"
    Quando edito a locação
    E altero a data de início para "18/06/2026"
    E salvo as alterações
    Então o pagamento de referência Junho/2026 deve ser atualizado para "166.67"

  Cenário: Comprovante de Contrato - Somar aluguel e garagem
    Dado que existe uma locação com:
      | campo          | valor   |
      | Aluguel        | 1500.00 |
      | Garagem        | 400.00  |
    Quando visualizo o "Comprovante de Contrato de Locação"
    Então no campo "Valor Total" devo ver "1900.00"
    E não apenas o valor do aluguel

  Cenário: Encerrar locação antecipadamente
    Dado que existe uma locação ativa com término em "31/12/2026"
    Quando clico em "Encerrar Locação"
    E preencho a data de encerramento com "30/06/2026"
    E confirmo o encerramento
    Então a data de término deve ser atualizada para "30/06/2026"
    E os pagamentos após "30/06/2026" devem ser cancelados
    E o imóvel deve ficar "Disponível"