# language: pt
Funcionalidade: Rescisão separada da devolução do caução
  Como responsável pela imobiliária
  Quero que a rescisão gere dois recebimentos separados
  Para que a devolução do caução não contamine as taxas de administração e gerenciamento

  # ============================================================================
  # ⚠️ ESTES CENÁRIOS AINDA NÃO PASSAM. É DE PROPÓSITO.
  #
  # Eles são o CONTRATO da issue #49: descrevem como a rescisão tem que
  # funcionar depois da correção, e hoje o sistema não funciona assim.
  #
  # A marca @smoke entra quando a #49 começar a ser construída — aí eles ficam
  # vermelhos no CI de propósito, e a #49 está pronta quando ficarem verdes.
  # Enquanto isso, sem marca, para não confundir o sinal da esteira.
  #
  # O problema que eles cobrem (relatado pelo Cadu em 21/ago/2026): a rescisão
  # monta UM recebimento só, com a conta
  #
  #     aluguel proporcional + multa − caução devolvido
  #
  # e grava na aba Locações. O caução é dinheiro de terceiro, não é receita,
  # mas entra na mesma base sobre a qual as taxas de adm (5%) e gerenciamento
  # (3%) são calculadas. Pior: quando o total fica negativo, um remendo em
  # financial.tsx joga fora o registro INTEIRO da conta das taxas — levando
  # junto o aluguel e a multa, que deveriam gerar taxa. Ou seja, além de
  # distorcer, deixa de cobrar taxa devida.
  #
  # Decisões fechadas com o Cadu estão em docs/tickets/rescisao-caucao.md.
  # ============================================================================

  Contexto:
    Dado que estou logado como "admin"
    E existe uma locação de teste com:
      | aluguel            | 1200,00    |
      | garagem            | 300,00     |
      | dia_vencimento     | 10         |
      | data_início        | 01/01/2026 |
      | data_fim           | 31/12/2026 |
      | caução             | 3000,00    |
      | parcelas_caução    | 3          |

  # --------------------------------------------------------------------------
  # A separação em si — o coração da #49
  # --------------------------------------------------------------------------

  Cenário: A rescisão gera dois recebimentos separados
    Quando eu registrar a rescisão em "04/05/2026" com multa de 500,00
    Então deve existir um recebimento de aluguel na aba "Locações"
    E deve existir um Recebimento de Rescisão na aba "Cauções"
    E a devolução do caução NÃO deve aparecer na aba "Locações"

  Cenário: O recebimento de aluguel soma proporcional do aluguel, proporcional da garagem e multa
    # Rescisão dia 04/05, vencimento dia 10: é ANTES do vencimento, então
    # conta-se só o proporcional desde o último vencimento (10/04/2026).
    # Dias usados: de 10/04 a 04/05 = 25 dias, sobre um mês de 30.
    #
    # O aluguel e a garagem são proporcionalizados SEPARADAMENTE, cada um
    # com a sua linha no detalhamento — é assim que o pagamento mensal
    # normal já funciona (ver rentalUpdateService.ts, que monta o breakdown
    # com "Aluguel" e "Garagem" em linhas distintas).
    #
    #   proporcional do aluguel:  (1.200,00 / 30) x 25 = 1.000,00
    #   proporcional da garagem:  (  300,00 / 30) x 25 =   250,00
    #   multa                                          =   500,00
    #                                                    ----------
    #   recebimento de aluguel                           1.750,00
    #
    # ⚠️ HOJE A GARAGEM SIMPLESMENTE NÃO ENTRA. terminationService.ts calcula
    # `proportionalRent = (monthlyRent / 30) * daysUsed`, e monthlyRent é
    # `rental.value`, que NÃO inclui garage_value. O arquivo até seleciona
    # garage_value do banco (linha 546) e nunca usa. Ou seja: em toda
    # rescisão de imóvel com garagem, a garagem some da cobrança.
    # Encontrado em 24/ago/2026, quando o Cadu conferiu a conta deste
    # cenário e perguntou onde estava a garagem.
    Quando eu registrar a rescisão em "04/05/2026" com multa de 500,00
    Então o recebimento de aluguel deve ter valor 1750,00
    E o recebimento de aluguel deve detalhar o proporcional do aluguel de 1000,00
    E o recebimento de aluguel deve detalhar o proporcional da garagem de 250,00
    E o recebimento de aluguel deve detalhar a multa de 500,00

  Cenário: A devolução do caução não entra na base das taxas
    Quando eu registrar a rescisão em "04/05/2026" com multa de 500,00
    Então a base de cálculo das taxas de administração e gerenciamento deve ser 1750,00
    E a devolução do caução não deve influenciar nenhuma das duas taxas

  Cenário: A multa entra na base das taxas
    Quando eu registrar a rescisão em "04/05/2026" com multa de 500,00
    Então a multa de 500,00 deve estar dentro da base das duas taxas

  # --------------------------------------------------------------------------
  # As parcelas que sobram
  # --------------------------------------------------------------------------

  Cenário: As parcelas posteriores à rescisão são apagadas
    Quando eu registrar a rescisão em "04/05/2026" com multa de 500,00
    Então não deve sobrar nenhuma parcela de aluguel com vencimento depois de "04/05/2026"
    E a última parcela de aluguel deve ser a do mês da rescisão

  Cenário: O Recebimento de Rescisão fica no mesmo período da última parcela
    Quando eu registrar a rescisão em "04/05/2026" com multa de 500,00
    Então o Recebimento de Rescisão deve estar no mesmo mês da última parcela de aluguel

  # --------------------------------------------------------------------------
  # Caução: sobre o que foi PAGO, não sobre o contratado
  # --------------------------------------------------------------------------

  Cenário: Caução pago pela metade — devolução calculada sobre o que entrou
    Dado que o inquilino pagou apenas 2 das 3 parcelas de caução
    Quando eu registrar a rescisão em "04/05/2026" com multa de 500,00
    Então o Valor Corrigido p/ Devolução deve ser calculado sobre 2000,00
    E não deve ser calculado sobre os 3000,00 contratados

  Cenário: Caução nunca pago — nada a devolver
    Dado que o inquilino não pagou nenhuma parcela de caução
    Quando eu registrar a rescisão em "04/05/2026" com multa de 500,00
    Então o Valor Corrigido p/ Devolução deve ser 0,00

  # --------------------------------------------------------------------------
  # As 4 colunas novas da aba Cauções
  # --------------------------------------------------------------------------

  Cenário: As 4 colunas aparecem mesmo em locação ativa
    Quando eu abrir a aba "Cauções" sem ter rescindido a locação
    Então devo ver as colunas:
      | coluna                       |
      | Valor Corrigido p/ Devolução |
      | Despesas Adicionais          |
      | Valor Desconto               |
      | Valor Total                  |
    E as quatro devem estar vazias

  Esquema do Cenário: A coluna Valor Total soma as três anteriores
    # Sinais: devolução é negativa (dinheiro sai da imobiliária), despesas
    # adicionais são positivas (cobrança do inquilino), desconto é negativo
    # (concedido ao inquilino). Total negativo = a imobiliária paga o
    # inquilino. Total positivo = o inquilino paga.
    # Os três casos abaixo foram conferidos com o Cadu em 21/ago/2026.
    Dado um Recebimento de Rescisão com:
      | valor_corrigido      | <corrigido> |
      | despesas_adicionais  | <despesas>  |
      | valor_desconto       | <desconto>  |
    Quando eu abrir a aba "Cauções"
    Então a coluna "Valor Total" deve mostrar <total>
    E o valor deve estar em vermelho: <vermelho>

    Exemplos:
      | corrigido | despesas | desconto | total    | vermelho |
      | -3000,00  | 1000,00  | 0,00     | -2000,00 | sim      |
      | -2000,00  | 2200,00  | -200,00  | 0,00     | não      |
      | -1000,00  | 2000,00  | -500,00  | 500,00   | não      |

  Cenário: O campo de desconto não exige digitar o sinal negativo
    Dado que estou preenchendo o Recebimento de Rescisão
    Quando eu digitar "200" no campo "Valor de Desconto"
    Então o sistema deve registrar o valor como -200,00
    E eu não devo precisar digitar o sinal de menos
