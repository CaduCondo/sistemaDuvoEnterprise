# language: pt
@financeiro
Funcionalidade: Isenção de taxa por Local na tela Financeiro
  Como administrador
  Quero que isentar um Local realmente derrube a taxa cobrada dele
  Para confiar nos valores de Taxa Adm e Taxa Ger antes de repassar dinheiro

  # ⚠️ NOVO (25/set/2026) — nasceu de um caso real relatado pelo Cadu em
  # produção (issue #110). Ele isentou um Local da Taxa de Gerenciamento e os
  # cards do Financeiro não mudaram. Investigando, a conta estava certa: o
  # Local isentado não tinha NENHUM recebimento pago no mês, e a base da taxa
  # é só o valor recebido — então ele já contribuía com zero.
  #
  # O problema de verdade era outro: NÃO EXISTIA NENHUM TESTE sobre isso. Os
  # cards do Financeiro (aba Locações) não tinham nem `id` nem `data-testid`,
  # então nenhum teste automatizado conseguia sequer ler esses valores. Se a
  # isenção quebrasse de verdade, ninguém seria avisado.
  #
  # Estes cenários cobrem os dois lados da regra: a isenção FAZ efeito quando
  # há dinheiro recebido, e NÃO faz efeito quando não há. O segundo é tão
  # importante quanto o primeiro, porque é exatamente a situação que gerou a
  # dúvida — e um teste que só cobrisse o primeiro caso deixaria a porta
  # aberta para alguém "consertar" a conta mudando a base para o esperado.

  Contexto:
    Dado que fiz login como "admin"

  # Os números redondos vêm daí: o preparo fixa as taxas em 5% (Adm) e 3%
  # (Ger) antes de rodar, então R$ 1.000,00 recebidos dão R$ 50,00 e R$ 30,00.
  # Sem fixar, o cenário dependeria do percentual que estivesse gravado nas
  # Configurações do banco de DEV -- e passaria ou falharia por motivo que não
  # tem nada a ver com a isenção.
  @sistemaCompleto
  Cenário: Isentar um Local com recebimento pago derruba a Taxa de Gerenciamento
    Dado que existe um local com um recebimento PAGO de "1000.00" em "Março/2026"
    Quando abro o Financeiro em "Março/2026" filtrado por esse local
    Então o card "Taxa Ger" deve mostrar "30.00"
    E o card "Taxa Adm" deve mostrar "50.00"
    Quando marco esse local como isento de Taxa de Gerenciamento
    E abro o Financeiro em "Março/2026" filtrado por esse local
    Então o card "Taxa Ger" deve mostrar "0.00"
    E o card "Taxa Adm" deve mostrar "50.00"

  @sistemaCompleto
  Cenário: Isentar um Local sem recebimento pago não muda a Taxa de Gerenciamento
    Dado que existe um local com um recebimento PENDENTE de "1000.00" em "Março/2026"
    Quando abro o Financeiro em "Março/2026" filtrado por esse local
    Então o card "Taxa Ger" deve mostrar "0.00"
    E o card "Receita Bruta" deve mostrar "0.00"
    Quando marco esse local como isento de Taxa de Gerenciamento
    E abro o Financeiro em "Março/2026" filtrado por esse local
    Então o card "Taxa Ger" deve mostrar "0.00"

  # Issue #138 (Cadu, produção, out/2026): num recebimento pago em 2 partes (1 locação, 2 linhas
  # de pagamento) o campo do Código PIX abria nas duas linhas ao mesmo tempo, perdia o foco e
  # salvava vazio com "sucesso" -- impossível digitar.
  @sistemaCompleto
  Cenário: Digitar o Código PIX numa linha de um recebimento com 2 pagamentos (#138)
    Dado que existe um local com um recebimento pago em 2 partes de "1500.00" e "300.00" em "Janeiro/2030"
    Quando abro o Financeiro em "Janeiro/2030" filtrado por esse local
    E clico no Código PIX da 2ª linha desse recebimento
    Então só 1 campo de texto de Código PIX deve estar aberto na tabela
    Quando digito "PIX-ABC-123" no Código PIX sem confirmar
    Então o campo de Código PIX deve continuar aberto com o texto digitado
    E nenhuma mensagem de sucesso deve ter aparecido
    Quando aperto Enter no Código PIX
    Então devo ver o aviso "Código PIX atualizado" e fecho no OK
    E o Código PIX "PIX-ABC-123" deve estar gravado nesse recebimento

  @sistemaCompleto
  Cenário: Clicar no Código PIX e sair sem digitar não salva nada nem avisa sucesso (#138)
    Dado que existe um local com um recebimento pago em 2 partes de "1500.00" e "300.00" em "Janeiro/2030"
    Quando abro o Financeiro em "Janeiro/2030" filtrado por esse local
    E clico no Código PIX da 1ª linha desse recebimento
    E clico fora do campo de Código PIX
    Então nenhuma mensagem de sucesso deve ter aparecido
    E nenhum Código PIX deve estar gravado nesse recebimento
