# language: pt
@acordo
Funcionalidade: Acordo de parcelamento do débito do inquilino (#119)
  Como administrador
  Quero juntar o que o inquilino deve e dividir em até 6 parcelas
  Para registrar o acordo combinado sem mexer em recebimento na mão e sem
  contar o mesmo dinheiro duas vezes

  # Regras combinadas com o Cadu (06 e 07/out/2026) -- ver docs/REGRAS_DE_NEGOCIO.md,
  # seção "Acordo de parcelamento":
  #   - total = recebimentos em aberto (aluguel, proporcional + multa
  #     rescisória) + multa e juros por atraso de cada um + Despesas
  #     Adicionais − caução corrigido − desconto (os três últimos SALVOS no
  #     Recebimento de Rescisão);
  #   - nada com vencimento até 31/12/2025 entra (o sistema não existia);
  #   - até 6 parcelas, sem juros, 1 por mês a partir do vencimento escolhido;
  #     centavos que sobram vão para a última;
  #   - os originais ficam "Renegociado", com os valores CONGELADOS, e nada é
  #     apagado; o caução abatido é registrado como devolvido (aba Cauções);
  #   - no Financeiro, o original passa a "esperar" só o que dele já foi pago e
  #     as parcelas aparecem nos meses delas: o mesmo dinheiro nunca conta 2x.
  # Datas "hoje+N" são relativas ao dia em que o teste roda.

  Contexto:
    Dado que fiz login como "admin"

  @sistemaCompleto
  Cenário: Exemplo do Cadu - R$ 6.000,00 em 3x a partir de 20/10/2026
    Dado uma locação com estes recebimentos em aberto:
      | tipo    | vencimento | valor   |
      | aluguel | hoje+15    | 6000.00 |
    Quando abro "Parcelar débito" dessa locação na tela de Locações
    Então o total do acordo na tela deve ser "R$ 6.000,00"
    Quando escolho 3 parcelas com a primeira vencendo em "20/10/2026"
    E confirmo o acordo
    Então o acordo deve ter estas parcelas no banco:
      | parcela | vencimento | valor   |
      | 1/3     | 20/10/2026 | 2000.00 |
      | 2/3     | 20/11/2026 | 2000.00 |
      | 3/3     | 20/12/2026 | 2000.00 |
    E os recebimentos originais devem estar "Renegociado"
    E a aba "Renegociados" de Recebimentos deve mostrar os recebimentos originais

  @sistemaCompleto
  Cenário: Rescisão completa - caução e desconto abatem, despesas somam
    # 1.490,00 + 2.384,00 + 300,00 (pintura) − 1.539,44 (caução) − 44,56 (desconto) = 2.590,00
    Dado uma locação com estes recebimentos em aberto:
      | tipo                 | vencimento | valor   |
      | aluguel              | hoje+10    | 1490.00 |
      | proporcional e multa | hoje+10    | 2384.00 |
    E o Recebimento de Rescisão dessa locação tem caução corrigido "-1539.44", despesas adicionais "300.00" e desconto "-44.56"
    Quando abro "Parcelar débito" dessa locação na tela de Locações
    Então o total do acordo na tela deve ser "R$ 2.590,00"
    Quando escolho 2 parcelas com a primeira vencendo em "hoje+30"
    E confirmo o acordo
    Então o acordo deve ter 2 parcelas que somam o total com multa e juros
    E os recebimentos originais devem estar "Renegociado"
    E o caução devolvido da locação deve ser "1539.44"

  @sistemaCompleto
  Cenário: Centavos que sobram vão para a última parcela
    Dado uma locação com estes recebimentos em aberto:
      | tipo    | vencimento | valor   |
      | aluguel | hoje+15    | 1000.00 |
    Quando abro "Parcelar débito" dessa locação na tela de Locações
    E escolho 3 parcelas com a primeira vencendo em "31/01/2027"
    E confirmo o acordo
    Então o acordo deve ter estas parcelas no banco:
      | parcela | vencimento | valor  |
      | 1/3     | 31/01/2027 | 333.33 |
      | 2/3     | 28/02/2027 | 333.33 |
      | 3/3     | 31/03/2027 | 333.34 |

  @sistemaCompleto
  Cenário: Multa e juros de recebimento atrasado entram e ficam congelados
    Dado uma locação com estes recebimentos em aberto:
      | tipo    | vencimento | valor   |
      | aluguel | hoje-10    | 1000.00 |
    Quando abro "Parcelar débito" dessa locação na tela de Locações
    Então o total do acordo na tela deve ser "1000.00" mais multa e juros de 10 dias sobre "1000.00"
    Quando escolho 1 parcela com a primeira vencendo em "hoje+30"
    E confirmo o acordo
    Então o acordo deve ter 1 parcela que somam o total com multa e juros
    E a multa e os juros do recebimento original devem ficar congelados no banco

  @sistemaCompleto
  Cenário: Recebimentos de 2025 para trás não entram no acordo
    Dado uma locação com estes recebimentos em aberto:
      | tipo    | vencimento | valor   |
      | aluguel | 2025-11-15 | 1450.00 |
      | aluguel | hoje+15    | 1490.00 |
    Quando abro "Parcelar débito" dessa locação na tela de Locações
    Então o acordo não deve listar o recebimento de "15/11/2025"
    E o total do acordo na tela deve ser "R$ 1.490,00"

  @sistemaCompleto
  Cenário: Só a devolução do caução não vira acordo (o saldo é a favor do inquilino)
    Dado uma locação com estes recebimentos em aberto:
      | tipo    | vencimento | valor  |
      | aluguel | hoje+15    | 500.00 |
    E o Recebimento de Rescisão dessa locação tem caução corrigido "-1000.00", despesas adicionais "0" e desconto "0"
    Quando abro "Parcelar débito" dessa locação na tela de Locações
    Então o acordo deve mostrar o aviso "saldo é a favor do inquilino" e não deixar avançar

  @sistemaCompleto
  Cenário: Desfazer o acordo antes de pagar alguma parcela devolve tudo como estava
    Dado uma locação com estes recebimentos em aberto:
      | tipo    | vencimento | valor   |
      | aluguel | hoje-5     | 1000.00 |
    Quando abro "Parcelar débito" dessa locação na tela de Locações
    E escolho 2 parcelas com a primeira vencendo em "hoje+30"
    E confirmo o acordo
    E abro a parcela 1 do acordo na tela de Recebimentos
    E desfaço o acordo
    Então o acordo não deve ter mais parcelas no banco
    E os recebimentos originais devem voltar como estavam

  @sistemaCompleto
  Cenário: Financeiro não conta o mesmo dinheiro duas vezes
    Dado uma locação com estes recebimentos em aberto:
      | tipo    | vencimento | valor   |
      | aluguel | hoje+5     | 1000.00 |
    Quando abro "Parcelar débito" dessa locação na tela de Locações
    E escolho 2 parcelas com a primeira vencendo em "hoje+40"
    E confirmo o acordo
    Então no Financeiro do mês do recebimento original ele aparece "Renegociado" com valor esperado "R$ 0,00"
    E no Financeiro do mês da parcela 1 ela aparece com valor esperado "R$ 500,00"

  @sistemaCompleto
  Cenário: O desconto da rescisão pode ser digitado mesmo com total negativo
    # Até 07/out/2026 o campo sumia quando o total da rescisão ficava negativo
    # (rodada 3, item 6). Revisto na #119: o desconto também abate o acordo.
    Dado um Recebimento de Rescisão com total negativo
    Quando abro esse Recebimento de Rescisão
    Então o campo "Valor de Desconto" e o botão "Salvar" da Formação de Valores devem estar na tela
