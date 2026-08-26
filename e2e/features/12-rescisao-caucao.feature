# language: pt
@smoke @rescisao
Funcionalidade: Rescisão de contrato — dois recebimentos separados
  Como responsável pela imobiliária
  Quero que a rescisão gere o recebimento de aluguel separado do de rescisão
  Para que a devolução do caução não contamine as taxas de administração e gerenciamento

  # ============================================================================
  # Issue #49. Decisões em docs/tickets/rescisao-caucao.md.
  #
  # ⚠️ TODOS os cenários estão com @smoke de propósito, por decisão do Cadu em
  # 26/ago/2026: enquanto a rescisão está sendo estabilizada, ela roda inteira
  # a cada push. Quando parar de quebrar, ficam só os DOIS mais importantes
  # (os marcados com o comentário "GUARDAR NO SMOKE" abaixo) e o resto perde a
  # marca, passando a rodar só na suíte completa.
  #
  # Cada cenário aqui nasceu de um defeito real encontrado em produção de
  # teste, e o comentário de cada um diz qual foi — não são cenários
  # inventados para dar cobertura.
  #
  # O setup vai direto no banco (DatabaseHelper) porque criar locação, caução
  # e pagamentos pela tela levaria minutos por cenário. A rescisão em si é
  # SEMPRE feita pela tela: é lá que os erros apareceram (409, PGRST116,
  # trigger de status), e nenhum deles teria sido pego chamando o serviço
  # direto.
  # ============================================================================

  Contexto:
    Dado que estou logado como "admin"

  # --------------------------------------------------------------------------
  # O coração da #49
  # --------------------------------------------------------------------------

  # GUARDAR NO SMOKE — é o cenário que prova a separação, a razão da issue.
  Cenário: A rescisão gera exatamente dois recebimentos, de tipos diferentes
    # Antes da #49 gerava um só, com o caução misturado no aluguel. Depois
    # passou a gerar TRÊS por um tempo (mês cheio e proporcional em registros
    # separados), corrigido em 1388dfaf.
    Dado uma locação para rescisão com:
      | aluguel         | 3000,00    |
      | garagem         | 200,00     |
      | dia_vencimento  | 5          |
      | data_início     | 01/10/2025 |
      | data_fim        | 31/12/2026 |
      | caução          | 3000,00    |
      | parcelas_caução | 3          |
    Quando eu rescindir o contrato em "27/08/2026"
    Então devem existir 2 recebimentos no mês da rescisão
    E deve existir 1 recebimento do tipo "rent" no mês da rescisão
    E deve existir 1 recebimento do tipo "termination" no mês da rescisão
    E os dois recebimentos devem estar no mesmo grupo de rescisão

  Cenário: O Recebimento de Rescisão é sempre a parcela 1/1
    # Aparecia como "2/2" na lista, como se fosse a segunda parcela do
    # aluguel: ele entrava na renumeração de parcelas do PASSO 8.
    Dado uma locação para rescisão com:
      | aluguel        | 3000,00    |
      | dia_vencimento | 5          |
      | data_início    | 01/10/2025 |
      | data_fim       | 31/12/2026 |
    Quando eu rescindir o contrato em "27/08/2026"
    Então o recebimento "termination" deve ser a parcela 1 de 1

  # --------------------------------------------------------------------------
  # Contagem dos dias extras
  # --------------------------------------------------------------------------

  Esquema do Cenário: Os dias extras são contados sem somar um dia a mais
    # differenceInDays já devolve a diferença correta; havia um "+ 1" que
    # cobrava sempre um dia a mais. Do dia 30 para o 31 é 1 dia, não 2.
    Dado uma locação para rescisão com:
      | aluguel        | 3000,00       |
      | dia_vencimento | <vencimento>  |
      | data_início    | 01/10/2025    |
      | data_fim       | 31/12/2026    |
    Quando eu rescindir o contrato em "<saida>"
    Então o recebimento "rent" deve cobrar <dias> dias extras

    Exemplos:
      | vencimento | saida      | dias |
      | 30         | 31/08/2026 | 1    |
      | 15         | 20/08/2026 | 5    |
      | 5          | 27/08/2026 | 22   |

  # --------------------------------------------------------------------------
  # Mês cheio: depende do que já foi pago
  # --------------------------------------------------------------------------

  Cenário: Recebimento do mês em aberto — o mês cheio entra no recebimento novo
    Dado uma locação para rescisão com:
      | aluguel        | 3000,00    |
      | dia_vencimento | 5          |
      | data_início    | 01/10/2025 |
      | data_fim       | 31/12/2026 |
    E o recebimento do mês da rescisão está "pendente"
    Quando eu rescindir o contrato em "27/08/2026"
    Então o recebimento "rent" deve conter a linha "Aluguel - Mês Cheio"
    E devem existir 2 recebimentos no mês da rescisão

  Cenário: Recebimento do mês já pago — o mês cheio NÃO é cobrado de novo
    # Sem isto o inquilino era cobrado duas vezes pelo mesmo mês. O
    # recebimento quitado tem que ficar intacto, e sobram 3 no período.
    Dado uma locação para rescisão com:
      | aluguel        | 3000,00    |
      | dia_vencimento | 5          |
      | data_início    | 01/10/2025 |
      | data_fim       | 31/12/2026 |
    E o recebimento do mês da rescisão está "pago"
    Quando eu rescindir o contrato em "27/08/2026"
    Então o recebimento "rent" pendente NÃO deve conter a linha "Aluguel - Mês Cheio"
    E o recebimento pago do mês deve continuar intacto
    E devem existir 3 recebimentos no mês da rescisão

  Cenário: Rescisão antes do vencimento cobra só o proporcional
    Dado uma locação para rescisão com:
      | aluguel        | 3000,00    |
      | dia_vencimento | 20         |
      | data_início    | 01/10/2025 |
      | data_fim       | 31/12/2026 |
    Quando eu rescindir o contrato em "10/08/2026"
    Então o recebimento "rent" NÃO deve conter a linha "Aluguel - Mês Cheio"
    E o recebimento "rent" deve conter a linha "Aluguel Proporcional"

  # --------------------------------------------------------------------------
  # Caução: sobre o que foi PAGO, não sobre o contratado
  # --------------------------------------------------------------------------

  # GUARDAR NO SMOKE — é a regra de dinheiro mais cara de errar da issue.
  Cenário: A devolução é calculada sobre o caução efetivamente pago
    # A conta incide sobre paid_amount das parcelas. Duas de três pagas
    # significa devolver sobre 2.000,00, nunca sobre os 3.000,00 contratados.
    Dado uma locação para rescisão com:
      | aluguel         | 3000,00    |
      | dia_vencimento  | 5          |
      | data_início     | 01/10/2025 |
      | data_fim        | 31/12/2026 |
      | caução          | 3000,00    |
      | parcelas_caução | 3          |
    E o inquilino pagou 2 das 3 parcelas de caução
    Quando eu rescindir o contrato em "27/08/2026"
    Então a devolução do caução deve ser calculada sobre "2000,00"
    E a devolução do caução deve estar gravada com sinal negativo

  Cenário: Caução nunca pago — não há o que devolver
    Dado uma locação para rescisão com:
      | aluguel         | 3000,00    |
      | dia_vencimento  | 5          |
      | data_início     | 01/10/2025 |
      | data_fim        | 31/12/2026 |
      | caução          | 3000,00    |
      | parcelas_caução | 3          |
    E o inquilino não pagou nenhuma parcela de caução
    Quando eu rescindir o contrato em "27/08/2026"
    Então a devolução do caução deve ser "0,00"

  # --------------------------------------------------------------------------
  # Estado do Recebimento de Rescisão
  # --------------------------------------------------------------------------

  Cenário: O Recebimento de Rescisão nasce pendente mesmo valendo zero
    # Um trigger no banco lia o total zerado como "quitado" e cravava 'paid'.
    # Cancelar devolvia para pendente e ele voltava sozinho para pago, num
    # laço sem saída pela tela.
    Dado uma locação para rescisão com:
      | aluguel         | 3000,00    |
      | dia_vencimento  | 5          |
      | data_início     | 01/10/2025 |
      | data_fim        | 31/12/2026 |
      | caução          | 3000,00    |
      | parcelas_caução | 3          |
    E o inquilino não pagou nenhuma parcela de caução
    Quando eu rescindir o contrato em "27/08/2026"
    Então o recebimento "termination" deve estar com status "pending"

  # --------------------------------------------------------------------------
  # Limpeza e reprocessamento
  # --------------------------------------------------------------------------

  Cenário: As parcelas posteriores à rescisão são apagadas
    Dado uma locação para rescisão com:
      | aluguel        | 3000,00    |
      | dia_vencimento | 5          |
      | data_início    | 01/10/2025 |
      | data_fim       | 31/12/2026 |
    E existem recebimentos em aberto até "12/2026"
    Quando eu rescindir o contrato em "27/08/2026"
    Então não deve sobrar nenhum recebimento com vencimento depois de "27/08/2026"

  Cenário: Rescindir duas vezes não duplica recebimentos
    # Reprocessar quebrava com PGRST116 ("multiple rows returned") e, antes
    # disso, com 409 na constraint única. Repetir tem que ser inofensivo.
    Dado uma locação para rescisão com:
      | aluguel        | 3000,00    |
      | dia_vencimento | 5          |
      | data_início    | 01/10/2025 |
      | data_fim       | 31/12/2026 |
    Quando eu rescindir o contrato em "27/08/2026"
    E eu rescindir o contrato novamente em "27/08/2026"
    Então devem existir 2 recebimentos no mês da rescisão

  # --------------------------------------------------------------------------
  # Garagem
  # --------------------------------------------------------------------------

  Cenário: A garagem entra no proporcional, em linha própria
    # A garagem simplesmente sumia da cobrança em todo imóvel com vaga:
    # o cálculo usava só o valor do aluguel.
    Dado uma locação para rescisão com:
      | aluguel        | 3000,00    |
      | garagem        | 200,00     |
      | dia_vencimento | 5          |
      | data_início    | 01/10/2025 |
      | data_fim       | 31/12/2026 |
    Quando eu rescindir o contrato em "27/08/2026"
    Então o recebimento "rent" deve conter a linha "Garagem - Proporcional"
    E o recebimento "rent" deve conter a linha "Garagem - Mês Cheio"
