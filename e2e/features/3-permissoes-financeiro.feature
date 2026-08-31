# language: pt
@permissoesFinanceiro
Funcionalidade: Permissões do Perfil Financeiro
  Como um usuário com perfil Financeiro
  Quero ter acesso apenas às funcionalidades financeiras
  Para gerenciar pagamentos e relatórios

  Contexto:
    Dado que fiz login como "financial"

  @sistemaCompleto
  Cenário: Financeiro deve ver apenas menus permitidos
    Quando acesso o dashboard
    Então devo ver os seguintes menus:
      | menu       |
      | Dashboard  |
      | Financeiro |
    E NÃO devo ver os seguintes menus:
      | menu         |
      | Imóveis      |
      | Inquilinos   |
      | Locações     |
      | Pagamentos   |
      | Configurações|

  @sistemaCompleto
  Cenário: Financeiro NÃO pode acessar Imóveis
    Quando tento acessar "/properties"
    Então devo ser bloqueado
    E devo permanecer no dashboard ou ver página de erro 403

  @sistemaCompleto
  Cenário: Financeiro NÃO pode acessar Inquilinos
    Quando tento acessar "/tenants"
    Então devo ser bloqueado
    E devo permanecer no dashboard ou ver página de erro 403

  @sistemaCompleto
  Cenário: Financeiro NÃO pode acessar Locações
    Quando tento acessar "/rentals"
    Então devo ser bloqueado
    E devo permanecer no dashboard ou ver página de erro 403

  @sistemaCompleto
  Cenário: Financeiro NÃO pode acessar Pagamentos
    Quando tento acessar "/payments"
    Então devo ser bloqueado
    E devo permanecer no dashboard ou ver página de erro 403

  @sistemaCompleto
  Cenário: Financeiro NÃO pode acessar Configurações
    Quando tento acessar "/settings"
    Então devo ser bloqueado
    E devo permanecer no dashboard ou ver página de erro 403

  @sistemaCompleto
  Cenário: Financeiro PODE acessar Dashboard
    Quando clico no menu "Dashboard"
    Então devo ser redirecionado para "/dashboard"
    E devo ver os cards de métricas
    E devo ver os gráficos financeiros

  @sistemaCompleto
  Cenário: Financeiro PODE acessar página Financeiro
    Quando clico no menu "Financeiro"
    Então devo ser redirecionado para "/financial"
    E devo ver as abas de "Parcelas de Caução" e "Despesas de Locação"
    E devo poder visualizar relatórios

  @sistemaCompleto
  Esquema do Cenário: Financeiro bloqueado em múltiplas páginas
    Quando tento acessar "<pagina>"
    Então devo ser bloqueado
    E devo permanecer no dashboard ou ver página de erro 403

    Exemplos:
      | pagina       |
      | /properties  |
      | /tenants     |
      | /rentals     |
      | /payments    |
      | /settings    |