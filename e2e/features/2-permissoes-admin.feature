# language: pt
@permissoesAdmin
Funcionalidade: Permissões do Perfil Admin
  Como um usuário com perfil Admin
  Quero ter acesso completo a todas as funcionalidades
  Para gerenciar todo o sistema

  Contexto:
    Dado que fiz login como "admin"

  @sistemaCompleto
  Cenário: Admin deve ver todos os menus
    Quando acesso o dashboard
    Então devo ver os seguintes menus:
      | menu         |
      | Dashboard    |
      | Imóveis      |
      | Inquilinos   |
      | Locações     |
      | Pagamentos   |
      | Financeiro   |
      | Configurações|

  @sistemaCompleto
  Cenário: Admin pode acessar página de Imóveis
    Quando clico no menu "Imóveis"
    Então devo ser redirecionado para "/properties"
    E devo ver o botão "Novo Imóvel"
    E devo ver a lista de imóveis

  @sistemaCompleto
  Cenário: Admin pode acessar página de Inquilinos
    Quando clico no menu "Inquilinos"
    Então devo ser redirecionado para "/tenants"
    E devo ver o botão "Novo Inquilino"
    E devo ver a lista de inquilinos

  @sistemaCompleto
  Cenário: Admin pode acessar página de Locações
    Quando clico no menu "Locações"
    Então devo ser redirecionado para "/rentals"
    E devo ver o botão "Nova Locação"
    E devo ver a lista de locações

  @sistemaCompleto
  Cenário: Admin pode acessar página de Pagamentos
    Quando clico no menu "Pagamentos"
    Então devo ser redirecionado para "/payments"
    E devo ver filtros de mês e ano
    E devo ver a lista de pagamentos

  @sistemaCompleto
  Cenário: Admin pode acessar página Financeiro
    Quando clico no menu "Financeiro"
    Então devo ser redirecionado para "/financial"
    E devo ver as abas de "Locações" e "Cauções"

  @sistemaCompleto
  Cenário: Admin pode acessar Configurações
    Quando clico no menu "Configurações"
    Então devo ser redirecionado para "/settings"
    E devo ver as abas:
      | aba         |
      | Usuários    |
      | Permissões  |

  # ⚠️ Corrigido em 13/set/2026 (issue #99): o botão que abre o formulário
  # se chama "Adicionar Usuário" (UsersTab.tsx) -- "Novo Usuário" é só o
  # TÍTULO do formulário depois que ele abre, nunca foi o texto de um
  # botão clicável. O passo procurava um botão que não existia e estourava
  # os 20s.
  @sistemaCompleto
  Cenário: Admin pode criar usuário
    Quando acesso "/settings"
    E clico na aba "Usuários"
    E clico em "Adicionar Usuário"
    Então devo ver o formulário de criação de usuário

  @sistemaCompleto
  Cenário: Admin pode editar permissões
    Quando acesso "/settings"
    E clico na aba "Permissões"
    Então devo ver a lista de perfis e permissões