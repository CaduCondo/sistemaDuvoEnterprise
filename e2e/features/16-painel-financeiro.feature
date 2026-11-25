# language: pt
Funcionalidade: Painel de Gestão - totais batem com o Financeiro (#120)
  Como administrador
  Quero que a Receita Bruta Recebida do Painel seja igual à do Financeiro no
  mesmo mês
  Para confiar no número que vejo ao abrir o sistema

  # Achado pelo Cadu (07/out/2026): o Painel e os gráficos somavam o
  # Recebimento de Rescisão (devolução de caução) na Receita, no Esperado e
  # nas Taxas -- a mesma contaminação que o Financeiro já tinha e corrigiu
  # na #49. Ver issue #120 e o levantamento de cobertura #121 ("nenhum
  # cenário compara os totais do Painel com os do Financeiro no mesmo mês").
  #
  # Período isolado (fevereiro/2030): diferente de dezembro/2030 já usado pelo
  # cenário "Taxa de administração" (8-pagamentos-calculos.feature) -- não
  # há limpeza entre cenários dentro da mesma execução (só ao final, pelo
  # selo [E2E]), então cada cenário isolado precisa do seu próprio mês.

  Contexto:
    Dado que fiz login como "admin"

  @sistemaCompleto
  Cenário: Recebimento de Rescisão não entra na Receita Bruta do Painel nem do Financeiro
    Dado um aluguel "Pago" de "1000.00" e um Recebimento de Rescisão "Pago" de "500.00", isolados no mesmo período de teste
    Quando estou na página "/dashboard"
    E seleciono o período de teste no filtro de mês e ano
    Então o card "Receita Bruta Recebida" do Painel deve mostrar "1000.00"
    Quando estou na página "/financial"
    E seleciono o período de teste no filtro de mês e ano
    Então o card "Receita Bruta" do Financeiro deve mostrar "1000.00"

  # Issue #137 (pedido do Cadu, 25/nov/2026): o filtro de mês do Financeiro
  # aceita VÁRIOS meses (checkbox por mês + "Marcar todos"). Janeiro e março
  # de 2030 são meses sem nenhum outro dado; o local do cenário isola o resto.
  @sistemaCompleto
  Cenário: Financeiro soma os meses marcados (#137)
    Dado que existe um local com recebimentos PAGOS de "1000.00" em "Janeiro/2030" e de "2000.00" em "Março/2030"
    Quando abro o Financeiro de "2030" com os meses "Janeiro, Março" filtrado por esse local
    Então o card "Receita Bruta" do Financeiro deve mostrar "3000.00"

  @sistemaCompleto
  Cenário: Um mês só dá o mesmo resultado de antes (#137)
    Dado que existe um local com recebimentos PAGOS de "1000.00" em "Janeiro/2030" e de "2000.00" em "Março/2030"
    Quando abro o Financeiro de "2030" com os meses "Março" filtrado por esse local
    Então o card "Receita Bruta" do Financeiro deve mostrar "2000.00"

  @sistemaCompleto
  Cenário: Marcar todos mostra o ano completo e vira Desmarcar todos (#137)
    Dado que existe um local com recebimentos PAGOS de "1000.00" em "Janeiro/2030" e de "2000.00" em "Março/2030"
    Quando abro o Financeiro de "2030" com os meses "Janeiro" filtrado por esse local
    Então o filtro de meses deve oferecer "Marcar todos"
    Quando clico em "Marcar todos" no filtro de meses
    Então os 12 meses devem estar marcados no filtro
    E o filtro de meses deve oferecer "Desmarcar todos"
    E o card "Receita Bruta" do Financeiro deve mostrar "3000.00"
    Quando clico em "Desmarcar todos" no filtro de meses
    Então os 0 meses devem estar marcados no filtro
    E o filtro de meses deve oferecer "Marcar todos"
    E o card "Receita Bruta" do Financeiro deve mostrar "0.00"
