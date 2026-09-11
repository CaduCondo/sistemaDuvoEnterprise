# language: pt
@permissoesGestao
Funcionalidade: Permissões do Perfil Corretor
  Como um usuário com perfil Corretor
  Quero ter acesso a quase todas as funcionalidades operacionais
  Para gerenciar imóveis, inquilinos, locações, pagamentos e financeiro

  # Regra de negócio confirmada pelo Cadu em 11/set/2026 (issue #99): o
  # perfil "Gestão" nunca existiu de verdade no sistema -- só existem
  # admin, corretor e financeiro (system_users.role). O corretor tem
  # acesso a quase todas as páginas, com uma única exceção:
  # Configurações. Este arquivo testava um perfil "Gestão" que não
  # existe (logava como corretor por engano) -- foi reescrito para
  # testar a regra real do corretor.

  Contexto:
    Dado que fiz login como "corretor"

  @sistemaCompleto
  Cenário: Corretor deve ver os menus operacionais e o Financeiro
    Quando acesso o dashboard
    Então devo ver os seguintes menus:
      | menu       |
      | Dashboard  |
      | Imóveis    |
      | Inquilinos |
      | Locações   |
      | Pagamentos |
      | Financeiro |
    E NÃO devo ver os seguintes menus:
      | menu          |
      | Configurações |

  @sistemaCompleto
  Cenário: Corretor PODE acessar Imóveis
    Quando clico no menu "Imóveis"
    Então devo ser redirecionado para "/properties"
    E devo ver o botão "Novo Imóvel"
    E devo poder criar, editar e visualizar imóveis

  @sistemaCompleto
  Cenário: Corretor PODE acessar Inquilinos
    Quando clico no menu "Inquilinos"
    Então devo ser redirecionado para "/tenants"
    E devo ver o botão "Novo Inquilino"
    E devo poder criar, editar e visualizar inquilinos

  @sistemaCompleto
  Cenário: Corretor PODE acessar Locações
    Quando clico no menu "Locações"
    Então devo ser redirecionado para "/rentals"
    E devo ver o botão "Nova Locação"
    E devo poder criar, editar e visualizar locações

  @sistemaCompleto
  Cenário: Corretor PODE acessar Pagamentos
    Quando clico no menu "Pagamentos"
    Então devo ser redirecionado para "/payments"
    E devo poder visualizar e gerenciar pagamentos

  @sistemaCompleto
  Cenário: Corretor PODE acessar Financeiro
    Quando clico no menu "Financeiro"
    Então devo ser redirecionado para "/financial"
    E devo ver as abas de "Locações" e "Cauções"

  @sistemaCompleto
  Cenário: Corretor NÃO pode acessar Configurações
    Quando tento acessar "/settings"
    Então devo ser bloqueado
    E devo permanecer no dashboard ou ver página de erro 403
