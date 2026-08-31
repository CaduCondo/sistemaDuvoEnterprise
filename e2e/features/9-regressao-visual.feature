# language: pt
@regressaoVisual
Funcionalidade: Testes de Regressão Visual
  Como desenvolvedor
  Quero garantir que mudanças em uma página não afetem outras
  Para manter a estabilidade do sistema

  @sistemaCompleto
  Cenário: Mudança em Imóveis não afeta Inquilinos
    Dado que fiz login como "admin"
    Quando acesso a página "/properties"
    E faço uma alteração em um imóvel
    Então ao acessar "/tenants"
    E a página deve carregar normalmente
    E todos os elementos devem estar presentes
    E os filtros devem funcionar

  @sistemaCompleto
  Cenário: Mudança em Locações não afeta Pagamentos
    Dado que fiz login como "admin"
    Quando acesso a página "/rentals"
    E crio uma nova locação
    Então ao acessar "/payments"
    E a página deve carregar normalmente
    E os filtros de mês/ano devem funcionar
    E os pagamentos devem ser exibidos corretamente

  @sistemaCompleto
  Cenário: Layout do header permanece consistente
    Dado que fiz login como "admin"
    Quando navego entre as páginas:
      | página       |
      | /dashboard   |
      | /properties  |
      | /tenants     |
      | /rentals     |
      | /payments    |
      | /financial   |
      | /settings    |
    Então o header deve estar sempre visível
    E o menu lateral deve estar sempre funcional
    E o botão de logout deve estar sempre acessível

  @sistemaCompleto
  Cenário: Breadcrumbs corretos em todas as páginas
    Dado que fiz login como "admin"
    Quando acesso "/properties"
    Então devo ver "Dashboard > Imóveis"
    Quando acesso "/tenants"
    Então devo ver "Dashboard > Inquilinos"
    Quando acesso "/rentals"
    Então devo ver "Dashboard > Locações"

  @sistemaCompleto
  Cenário: Tema escuro/claro consistente
    Dado que fiz login como "admin"
    Quando alterno para tema escuro
    Então todas as páginas devem usar o tema escuro
    E os contraste devem estar adequados
    Quando alterno para tema claro
    Então todas as páginas devem usar o tema claro

  @sistemaCompleto
  Cenário: Responsividade em mobile
    Dado que fiz login como "admin"
    E estou usando um dispositivo mobile
    Quando navego entre as páginas:
      | página       |
      | /dashboard   |
      | /properties  |
      | /tenants     |
    Então o menu deve ser colapsável
    E todos os elementos devem estar acessíveis
    E as tabelas devem ser scrolláveis horizontalmente

  @sistemaCompleto
  Cenário: Cards do Dashboard sempre presentes
    Dado que fiz login como qualquer perfil autorizado
    Quando acesso "/dashboard"
    Então devo sempre ver o card de "Bem-vindo"
    E devo ver pelo menos um card de métrica
    E os cards devem ter a mesma altura

  @sistemaCompleto
  Cenário: Filtros mantêm estado entre navegações
    Dado que fiz login como "admin"
    Quando acesso "/properties"
    E filtro por "São Paulo - Centro"
    E navego para "/tenants"
    E retorno para "/properties"
    Então o filtro "São Paulo - Centro" NÃO deve estar aplicado
    E devo ver todos os imóveis