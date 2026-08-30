# language: pt
@rescisao49
Funcionalidade: Rescisão de contrato separada da devolução do caução
  Como responsável pela imobiliária
  Quero que a rescisão gere dois recebimentos separados, com a multa vinda de uma cláusula do contrato
  Para que a devolução do caução não contamine as taxas de administração e gerenciamento

  # ============================================================================
  # ONDE ESTÃO AS REGRAS
  #
  #   docs/REGRAS_DE_NEGOCIO.md, seção "🔚 Rescisão de Contrato" — o resumo
  #   do que está em vigor. As decisões originais estão em
  #   docs/tickets/rescisao-caucao.md e as mudanças recentes em
  #   docs/tickets/padronizacao-rodada-2.md e padronizacao-rodada-3.md.
  #
  # O QUE ESTA FEATURE PROTEGE
  #
  #   1. Toda rescisão gera DOIS recebimentos ligados por termination_group_id
  #      e distinguidos por `payment_kind`:
  #         'rent'        -> aluguel proporcional + garagem + multa   (Locações, GERA taxa)
  #         'termination' -> devolução do caução + despesas + desconto (Cauções, NÃO gera taxa)
  #      O caução é dinheiro de terceiro; enquanto vinha grudado no aluguel,
  #      entrava na base das taxas de adm (5%) e gerenciamento (3%).
  #
  #   2. `payment_kind` é a ÚNICA fonte de verdade sobre o tipo do recebimento.
  #      Já houve TRÊS defeitos por decidir isso lendo o texto de Observações.
  #
  #   3. A multa é SEMPRE uma das duas cláusulas do contrato. O campo de multa
  #      livre foi removido em 28/ago/2026 (rodada 2, item D1): desconto,
  #      arredondamento ou perdão da multa se fazem no campo "Valor de Desconto"
  #      do Recebimento de Rescisão, onde ficam registrados como desconto.
  #
  #   4. A devolução incide sobre o caução efetivamente PAGO, nunca sobre o
  #      contratado (rodada 3, item 5).
  #
  # COMO OS CENÁRIOS SÃO ESCRITOS
  #
  #   O setup (Dado) vai direto no banco — montar locação, caução e histórico
  #   pela tela levaria minutos por cenário e testaria cadastro, que não é o
  #   assunto aqui.
  #
  #   A AÇÃO da rescisão é SEMPRE feita pela TELA de verdade. Os defeitos
  #   graves desta funcionalidade só aparecem no caminho real até o banco
  #   (constraints, o trigger validate_payment_status que cravava 'paid').
  #
  #   As verificações de CÁLCULO leem o BANCO. As de EXIBIÇÃO (etiqueta, cor,
  #   coluna, aba, linha na tela) leem a TELA.
  # ============================================================================

  Contexto:
    Dado que estou logado como "admin"
    E existe uma locação de teste com:
      | aluguel         | 1200,00    |
      | garagem         | 300,00     |
      | dia_vencimento  | 10         |
      | data_início     | 01/06/2026 |
      | data_fim        | 31/05/2028 |
      | caução          | 6000,00    |
      | parcelas_caução | 3          |

    # Contrato de 24 meses (01/06/2026 a 31/05/2028). Esse número é o divisor
    # da multa proporcional, então está fixado de propósito.

  # --------------------------------------------------------------------------
  # A separação em dois recebimentos — o coração da #49
  # --------------------------------------------------------------------------

  @smoke
  Cenário: A rescisão gera dois recebimentos separados
    # Protege a regra central: dois registros, um em cada aba, distinguidos
    # por payment_kind. A devolução do caução não pode aparecer em Locações.
    Dado que o inquilino pagou todas as parcelas de caução
    Quando eu registrar a rescisão em "03/09/2026" com a cláusula "Multa Proporcional ao Tempo Restante"
    Então deve existir um recebimento de aluguel na aba "Locações"
    E deve existir um Recebimento de Rescisão na aba "Cauções"
    E a devolução do caução NÃO deve aparecer na aba "Locações"

  @smoke
  Cenário: O recebimento de aluguel soma proporcional do aluguel, proporcional da garagem e multa da cláusula
    # Protege a composição do recebimento de aluguel da rescisão e o fato de a
    # garagem ser proporcionalizada em linha PRÓPRIA (até 24/ago/2026 ela
    # simplesmente sumia da cobrança).
    #
    # Saída 03/09, vencimento dia 10: é ANTES do vencimento, então conta-se só
    # o proporcional desde o último vencimento (10/08/2026).
    #   dias usados: de 10/08 a 03/09 = 25 dias, sobre um mês de 30
    #   aluguel proporcional:  (1.200,00 / 30) x 25 = 1.000,00
    #   garagem proporcional:  (  300,00 / 30) x 25 =   250,00
    #   multa proporcional ao tempo restante:
    #     meses restantes de 03/09/2026 até 31/05/2028 = 20
    #     (3 x 1.200,00 / 24 meses de contrato) x 20   = 3.000,00
    #                                                   ----------
    #   recebimento de aluguel                           4.250,00
    Quando eu registrar a rescisão em "03/09/2026" com a cláusula "Multa Proporcional ao Tempo Restante"
    Então o recebimento de aluguel da rescisão deve ter valor 4250,00
    E o recebimento de aluguel da rescisão deve detalhar "Aluguel Proporcional" com 1000,00
    E o recebimento de aluguel da rescisão deve detalhar "Garagem Proporcional" com 250,00
    E o recebimento de aluguel da rescisão deve detalhar "Multa Rescisória" com 3000,00

  @smoke
  Cenário: A multa é a da cláusula de 12 meses quando é ela a escolhida
    # Protege a decisão D1 da rodada 2: não existe multa digitada; o valor sai
    # da cláusula marcada. Mesma locação e mesma data do cenário anterior, com
    # a OUTRA cláusula, tem que dar OUTRO valor.
    #
    #   mês do contrato na saída (03/09/2026, início 01/06/2026) = 4º
    #   meses até completar 12                                   = 8
    #   (3 x 1.200,00 / 12) x 8                                  = 2.400,00
    #   proporcional do aluguel + da garagem                     = 1.250,00
    #                                                              ----------
    #   recebimento de aluguel                                     3.650,00
    Quando eu registrar a rescisão em "03/09/2026" com a cláusula "Multa Cláusula 12 Meses"
    Então o recebimento de aluguel da rescisão deve detalhar "Multa Rescisória" com 2400,00
    E o recebimento de aluguel da rescisão deve ter valor 3650,00

  @smoke
  Cenário: O diálogo de rescisão não tem campo de multa livre
    # Protege a remoção do campo "Valor da Multa (opcional)" (rodada 2, D1).
    # Ele existiu por um dia, criado para viabilizar um teste, e o Cadu
    # reconsiderou: quem quiser abater a multa usa o "Valor de Desconto" do
    # Recebimento de Rescisão, onde o abatimento fica registrado.
    Quando eu abrir o diálogo de rescisão da locação
    Então devo ver as duas cláusulas de multa
    E não deve existir campo para digitar o valor da multa

  # --------------------------------------------------------------------------
  # As taxas de administração e gerenciamento
  # --------------------------------------------------------------------------

  @smoke
  Cenário: A devolução do caução não entra na base das taxas
    # Protege a razão de existir da #49. Quem decide o que entra na base é
    # payment_kind: financial.tsx descarta 'termination' do cálculo das duas
    # taxas e da aba Locações.
    Dado que o inquilino pagou todas as parcelas de caução
    Quando eu registrar a rescisão em "03/09/2026" com a cláusula "Multa Proporcional ao Tempo Restante"
    Então a base de cálculo das taxas de administração e gerenciamento deve ser 4250,00
    E a devolução do caução não deve influenciar nenhuma das duas taxas

  @smoke
  Cenário: A multa entra na base das taxas
    # Decisão 2 do ticket original: a multa fica no recebimento do ALUGUEL e
    # gera taxa de adm e gerenciamento.
    Quando eu registrar a rescisão em "03/09/2026" com a cláusula "Multa Proporcional ao Tempo Restante"
    Então a multa de 3000,00 deve estar dentro da base das duas taxas

  # --------------------------------------------------------------------------
  # As parcelas que sobram
  # --------------------------------------------------------------------------

  @smoke
  Cenário: As parcelas posteriores à rescisão são apagadas
    # Protege o passo 7 da rescisão: recebimentos com vencimento depois da
    # saída deixam de existir, e a última parcela passa a ser a do mês da saída.
    Dado que o inquilino pagou todas as parcelas de caução
    E existem recebimentos de aluguel pendentes nos meses:
      | mês | ano  |
      | 09  | 2026 |
      | 10  | 2026 |
      | 11  | 2026 |
    Quando eu registrar a rescisão em "03/09/2026" com a cláusula "Multa Proporcional ao Tempo Restante"
    Então não deve sobrar nenhuma parcela de aluguel com vencimento depois de "03/09/2026"
    E a última parcela de aluguel deve ser a do mês da rescisão
    E o Recebimento de Rescisão deve estar no mesmo mês da última parcela de aluguel

  # --------------------------------------------------------------------------
  # A etiqueta "Rescisão" — dois defeitos já vieram daqui
  # --------------------------------------------------------------------------

  @smoke
  Cenário: A etiqueta "Rescisão" pertence ao Recebimento de Rescisão, nunca ao de aluguel
    # Rodada 2 (item F) e rodada 3 (item 1): a etiqueta apareceu no
    # recebimento ERRADO duas vezes, sempre pelo mesmo motivo — a decisão era
    # tomada lendo o texto de Observações. Quem escreve "Rescisão de Contrato"
    # ali é o recebimento de ALUGUEL; o Recebimento de Rescisão escreve
    # "Recebimento de Rescisão". Comparar por texto acerta o registro errado.
    Dado que o inquilino pagou todas as parcelas de caução
    Quando eu registrar a rescisão em "03/09/2026" com a cláusula "Multa Proporcional ao Tempo Restante"
    Então na página de Recebimentos o Recebimento de Rescisão deve ter a etiqueta "Rescisão"
    E o recebimento de aluguel da rescisão NÃO deve ter a etiqueta "Rescisão"
    E a decisão da etiqueta deve vir de payment_kind, não do texto das observações

  # --------------------------------------------------------------------------
  # Caução: devolve-se o que entrou, não o que foi combinado
  # --------------------------------------------------------------------------

  @smoke
  Cenário: A devolução é calculada sobre o caução PAGO, não sobre o contratado
    # Rodada 3, item 5 — o mais grave da rodada, porque é dinheiro. Caso real
    # (Studio-6): caução de 6.000,00 em 3 parcelas, duas pagas.
    #   2.111,11 (paga) + 2.111,11 (paga) = 4.222,22 efetivamente pago
    #   1.777,78 continua pendente
    # A correção da poupança tem que incidir sobre 4.222,22. Sobre os 6.000,00
    # contratados, a imobiliária devolveria dinheiro que nunca recebeu.
    Dado que as parcelas de caução estão assim:
      | parcela | valor   | situação |
      | 1       | 2111,11 | paga     |
      | 2       | 2111,11 | paga     |
      | 3       | 1777,78 | pendente |
    Quando eu registrar a rescisão em "03/09/2026" com a cláusula "Multa Proporcional ao Tempo Restante"
    Então o Valor Corrigido p/ Devolução deve ser calculado sobre 4222,22
    E não deve ser calculado sobre os 6000,00 contratados

  @smoke
  Cenário: Caução nunca pago — nada a devolver
    # Os fallbacks para o valor contratado foram retirados em 28/ago/2026:
    # caíam justamente no caso em que nada foi pago.
    Dado que o inquilino não pagou nenhuma parcela de caução
    Quando eu registrar a rescisão em "03/09/2026" com a cláusula "Multa Proporcional ao Tempo Restante"
    Então não deve haver nada a devolver de caução

  # --------------------------------------------------------------------------
  # O Recebimento de Rescisão nasce PENDENTE
  # --------------------------------------------------------------------------

  @smoke
  Cenário: O Recebimento de Rescisão nasce pendente
    # Quem decide se um recebimento foi quitado é a aplicação, não o banco.
    Dado que o inquilino pagou todas as parcelas de caução
    Quando eu registrar a rescisão em "03/09/2026" com a cláusula "Multa Proporcional ao Tempo Restante"
    Então o Recebimento de Rescisão deve estar com status "pending"

  @smoke
  Cenário: Um Recebimento de Rescisão de valor zero também nasce pendente
    # Defeito de 27/ago/2026: o trigger validate_payment_status olhava
    # "esperado − pago", via zero dos dois lados e cravava 'paid' por cima do
    # 'pending' — e não havia como desmarcar pela tela. O desvio para
    # payment_kind='termination' está no passo 3 do PROD-rescisao-49.sql.
    # A gravação aqui é direta no banco DE PROPÓSITO: o defeito é do banco, e
    # é o INSERT que precisa passar pelo trigger.
    Quando eu gravar um Recebimento de Rescisão de valor 0,00 direto no banco
    Então esse recebimento deve estar com status "pending"

  # --------------------------------------------------------------------------
  # VALOR TOTAL DA RESCISÃO
  # --------------------------------------------------------------------------

  @smoke
  Cenário: As telas mostram o VALOR TOTAL DA RESCISÃO somando os dois recebimentos
    # Rodada 3, item 7 (História 5 do ticket original): quando dois
    # recebimentos da mesma locação vencem no mesmo dia e um deles é o de
    # rescisão, as telas mostram a soma dos dois logo abaixo do VALOR TOTAL.
    # O inquilino paga tudo de uma vez; sem essa linha alguém soma na mão.
    Dado que o inquilino pagou todas as parcelas de caução
    Quando eu registrar a rescisão em "03/09/2026" com a cláusula "Multa Proporcional ao Tempo Restante"
    E eu abrir o Recebimento de Rescisão
    Então devo ver a linha "VALOR TOTAL DA RESCISÃO" com a soma dos recebimentos que vencem em "03/09/2026"

  # --------------------------------------------------------------------------
  # As três composições da "Formação de Valores"
  # (rodada 2, item E; rodada 3, item 3; docs/tickets/padronizacao-telas-recebimento.md)
  #
  # ⚠️ Os tickets escrevem "Vaga Garagem"; o rótulo que o sistema grava e
  # exibe é "Garagem" (é assim em rentalUpdateService, paymentService e
  # terminationService). O que estes cenários protegem é a COMPOSIÇÃO das
  # linhas, não a redação do rótulo.
  # --------------------------------------------------------------------------

  @smoke
  Cenário: Formação de Valores de um recebimento de aluguel comum
    # Aluguel normal, que não veio de rescisão: sem proporcional e sem multa.
    Dado que o recebimento de aluguel de "09/2026" está "pendente" com valor de "1500,00"
    Quando eu abrir o recebimento de aluguel de "09/2026"
    Então a "Formação de Valores" deve mostrar, nesta ordem:
      | linha             |
      | Aluguel           |
      | Garagem           |
      | Valor de Desconto |

  @smoke
  Cenário: Formação de Valores da rescisão quando o mês estava PENDENTE
    # Rescisão em 25/09, DEPOIS do vencimento (dia 10): o mês já tinha vencido
    # e não foi pago, então o recebimento pendente do mês é DELETADO e o mês
    # cheio entra na conta junto com os dias extras.
    #   mês cheio:              1.200,00 + 300,00
    #   dias extras 10/09 a 25/09 = 16 dias
    #   aluguel proporcional:   (1.200,00 / 30) x 16 = 640,00
    #   garagem proporcional:   (  300,00 / 30) x 16 = 160,00
    #   multa proporcional ao tempo restante          = 3.000,00
    #
    # ⚠️ É UMA tela só, com a conta inteira. Hoje o terminationService parte
    # este caso em DOIS recebimentos de aluguel (o mês cheio no dia 10 e o
    # proporcional no dia da saída): o item E da rodada 2 continua aberto.
    # Este cenário é o contrato — uma rescisão, uma "Formação de Valores".
    Dado que o recebimento de aluguel de "09/2026" está "pendente" com valor de "1500,00"
    Quando eu registrar a rescisão em "25/09/2026" com a cláusula "Multa Proporcional ao Tempo Restante"
    E eu abrir o recebimento de aluguel da rescisão
    Então o recebimento pendente do mês deve ter sido deletado
    E a "Formação de Valores" deve mostrar, nesta ordem:
      | linha                |
      | Aluguel              |
      | Aluguel Proporcional |
      | Garagem              |
      | Garagem Proporcional |
      | Multa Rescisória     |
      | Valor de Desconto    |

  @smoke
  Cenário: Formação de Valores da rescisão quando o mês já estava PAGO
    # Mesma data da anterior, mas o recebimento do mês já foi pago: ele é
    # histórico e não se mexe. Nasce um recebimento novo só com o proporcional
    # e a multa — o mês cheio NÃO entra de novo.
    Dado que o recebimento de aluguel de "09/2026" está "pago" com valor de "1500,00"
    Quando eu registrar a rescisão em "25/09/2026" com a cláusula "Multa Proporcional ao Tempo Restante"
    E eu abrir o recebimento de aluguel da rescisão
    Então o recebimento pago do mês deve continuar existindo, intocado
    E a "Formação de Valores" deve mostrar, nesta ordem:
      | linha                |
      | Aluguel Proporcional |
      | Garagem Proporcional |
      | Multa Rescisória     |
      | Valor de Desconto    |

  # --------------------------------------------------------------------------
  # As 4 colunas da aba Cauções
  # --------------------------------------------------------------------------

  @smoke
  Cenário: As 4 colunas aparecem mesmo em locação ativa
    # Decisão 3 do ticket: as colunas existem para TODAS as locações, vazias
    # enquanto não houver rescisão. Ficam no FIM da tabela (rodada 2, G1).
    Quando eu abrir a aba "Cauções" sem ter rescindido a locação
    Então devo ver as colunas:
      | coluna                       |
      | Valor Corrigido p/ Devolução |
      | Despesas Adicionais          |
      | Valor Desconto               |
      | Valor Total                  |
    E as quatro devem estar vazias

  @smoke
  Esquema do Cenário: A coluna Valor Total soma as três anteriores
    # Sinais: devolução é negativa (dinheiro sai da imobiliária), despesas
    # adicionais são positivas (cobrança do inquilino), desconto é negativo
    # (concedido ao inquilino). Total negativo = a imobiliária paga o
    # inquilino. Total positivo = o inquilino paga.
    # Os três casos abaixo foram conferidos com o Cadu em 21/ago/2026.
    Dado um Recebimento de Rescisão com:
      | valor_corrigido     | <corrigido> |
      | despesas_adicionais | <despesas>  |
      | valor_desconto      | <desconto>  |
    Quando eu abrir a aba "Cauções"
    Então a coluna "Valor Total" deve mostrar <total>
    E o valor deve estar em vermelho: <vermelho>

    Exemplos:
      | corrigido | despesas | desconto | total    | vermelho |
      | -3000,00  | 1000,00  | 0,00     | -2000,00 | sim      |
      | -2000,00  | 2200,00  | -200,00  | 0,00     | não      |
      | -1000,00  | 2000,00  | -500,00  | 500,00   | não      |

  @smoke
  Cenário: O campo de desconto não exige digitar o sinal negativo
    # Decisão 1 do ticket: o usuário digita só o número, o sinal "−" fica
    # preso no campo e o sistema grava negativo.
    Dado que estou preenchendo o Recebimento de Rescisão
    Quando eu digitar "200" no campo "Valor de Desconto"
    Então o sistema deve registrar o valor como -200,00
    E eu não devo precisar digitar o sinal de menos
