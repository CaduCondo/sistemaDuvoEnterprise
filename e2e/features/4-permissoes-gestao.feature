# language: pt
@permissoesGestao
Funcionalidade: Permissões do Perfil Gestão
  Como um usuário com perfil Gestão
  Quero ter acesso a funcionalidades operacionais
  Para gerenciar imóveis, inquilinos e locações

  Contexto:
    Dado que fiz login como "management"

  @sistemaCompleto
  Cenário: Gestão deve ver menus operacionais
    Quando acesso o dashboard
    Então devo ver os seguintes menus:
      | menu       |
      | Dashboard  |
      | Imóveis    |
      | Inquilinos |
      | Locações   |
      | Pagamentos |
    E NÃO devo ver os seguintes menus:
      | menu         |
      | Financeiro   |
      | Configurações|

  @sistemaCompleto
  Cenário: Gestão PODE acessar Imóveis
    Quando clico no menu "Imóveis"
    Então devo ser redirecionado para "/properties"
    E devo ver o botão "Novo Imóvel"
    E devo poder criar, editar e visualizar imóveis

  @sistemaCompleto
  Cenário: Gestão PODE acessar Inquilinos
    Quando clico no menu "Inquilinos"
    Então devo ser redirecionado para "/tenants"
    E devo ver o botão "Novo Inquilino"
    E devo poder criar, editar e visualizar inquilinos

  @sistemaCompleto
  Cenário: Gestão PODE acessar Locações
    Quando clico no menu "Locações"
    Então devo ser redirecionado para "/rentals"
    E devo ver o botão "Nova Locação"
    E devo poder criar, editar e visualizar locações

  @sistemaCompleto
  Cenário: Gestão PODE acessar Pagamentos
    Quando clico no menu "Pagamentos"
    Então devo ser redirecionado para "/payments"
    E devo poder visualizar e gerenciar pagamentos

  @sistemaCompleto
  Cenário: Gestão NÃO pode acessar Financeiro
    Quando tento acessar "/financial"
    Então devo ser bloqueado
    E devo permanecer no dashboard ou ver página de erro 403

  @sistemaCompleto
  Cenário: Gestão NÃO pode acessar Configurações
    Quando tento acessar "/settings"
    Então devo ser bloqueado
    E devo permanecer no dashboard ou ver página de erro 403