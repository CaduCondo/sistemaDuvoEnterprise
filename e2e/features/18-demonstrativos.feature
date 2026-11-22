# language: pt
@demonstrativos
Funcionalidade: Demonstrativos (DRE, Balanço e Fluxo de Caixa)
  Como administrador
  Quero ver a DRE, o Balanço e o Fluxo de Caixa de cada prédio e da carteira
  Para acompanhar o resultado real e a projeção dos próximos 5 anos

  # Issue #128 (22/nov/2026). Regra de ouro: os Demonstrativos usam a MESMA
  # conta do Financeiro (src/lib/financeiro/calculos.ts). Se um dia as duas
  # telas mostrarem números diferentes para o mesmo filtro, o primeiro
  # cenário fica vermelho.
  #
  # O preparo cria um Local próprio (com selo [E2E]) com UM recebimento: o
  # Local some no fim da rodada e leva junto contas, cauções e patrimônio.

  @sistemaCompleto
  Cenário: Os Demonstrativos mostram os mesmos números do Financeiro
    Dado que fiz login como "admin"
    E que existe um local com um recebimento PAGO de "1000.00" em "Março/2026"
    E esse local tem uma conta de "200.00" em "Março/2026"
    Quando abro os Demonstrativos e o Financeiro com o mesmo filtro em "Março/2026"
    Então a Receita Bruta (recebido), as taxas e as Contas do Mês são iguais nas duas telas

  @sistemaCompleto
  Cenário: O Balanço fecha em todos os meses
    Dado que fiz login como "admin"
    E que existe um local com um recebimento PAGO de "1000.00" em "Março/2026"
    Quando abro os Demonstrativos em "Março/2026" filtrado por esse local
    Então o Resumo dos Demonstrativos mostra "Balanço fechado ✓"
    E a conferência do Balanço é zero em todos os meses

  @sistemaCompleto
  Cenário: Caução recebida não é receita, vai para o passivo
    Dado que fiz login como "admin"
    E que existe um local com um recebimento PAGO de "1000.00" em "Março/2026"
    E esse local tem uma caução recebida de "3000.00" em "Março/2026"
    Quando abro os Demonstrativos em "Março/2026" filtrado por esse local
    Então a DRE de "Março/2026" mostra receita bruta de "1000"
    E o Balanço de "Março/2026" mostra cauções de inquilinos de "3000"

  @sistemaCompleto
  Cenário: Filtro por proprietário (Holding ou Pessoa física)
    Dado que fiz login como "admin"
    E que existe um local com um recebimento PAGO de "1000.00" em "Março/2026"
    E esse local é de uma Holding
    Quando abro os Demonstrativos em "Março/2026" filtrado por esse local
    E filtro os Demonstrativos pelo proprietário "Holding"
    Então a aba Por Prédio mostra esse local
    Quando filtro os Demonstrativos pelo proprietário "Pessoa física"
    Então a aba Por Prédio não mostra esse local

  @sistemaCompleto
  Cenário: Exportar para Excel
    Dado que fiz login como "admin"
    E que existe um local com um recebimento PAGO de "1000.00" em "Março/2026"
    Quando abro os Demonstrativos em "Março/2026" filtrado por esse local
    E exporto os Demonstrativos para Excel
    Então o Excel tem as abas Resumo, Premissas, Dados do sistema, Cálculos, DRE, Balanço, Fluxo de Caixa e Por Prédio
    E nenhuma fórmula do Excel tem #REF!, #DIV/0! ou #VALUE!

  @sistemaCompleto
  Cenário: Perfil Financeiro não vê os Demonstrativos (só Admin por padrão)
    Dado que fiz login como "financial"
    Então o menu "Demonstrativos" não aparece
    Quando acesso a página "/demonstrativos"
    Então devo ser redirecionado para "/dashboard"
