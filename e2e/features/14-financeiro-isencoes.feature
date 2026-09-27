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
