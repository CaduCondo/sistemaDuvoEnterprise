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

  # ⚠️ Destagueado em 13/set/2026 (issue #99, cluster "Regressão Visual"):
  # não é bug de teste -- o sistema não tem breadcrumbs. Existe um
  # componente de UI pronto (src/components/ui/breadcrumb.tsx, do
  # shadcn/ui) mas ele nunca foi usado em nenhuma página (grep confirma:
  # zero imports fora do próprio arquivo). Sem tag até a funcionalidade
  # ser implementada de verdade -- ver "Esquema de tags" no CLAUDE.md.
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

  # Issues #134, #135, #136 (pedido do Cadu, 25/nov/2026, vendo pelo celular).
  # O cenário "Responsividade em mobile" acima conferia só que EXISTIA algum
  # elemento com rolagem na página -- não pegou a tabela de Imóveis cortada.
  # Estes medem a tela de verdade (390 px de largura, como um celular).
  @sistemaCompleto
  Cenário: Tabela de Imóveis rola para o lado no celular (#134)
    Dado que fiz login como "admin"
    E estou usando um dispositivo mobile
    E estou na página "/properties"
    E que existe um imóvel de teste com "Rolagem" no complemento
    Quando clico no botão de visualização em lista
    Então a tabela deve rolar para o lado sem a página rolar

  @sistemaCompleto
  Cenário: Card de locação no celular mantém o valor em uma linha e botões abaixo (#135)
    Dado que fiz login como "admin"
    E que existe uma locação ativa do cenário
    E estou usando um dispositivo mobile
    Quando acesso a página "/rentals"
    E clico na visão em grade de Locações
    Então no card da locação o valor fica em uma linha e os botões abaixo dele

  @sistemaCompleto
  Cenário: Combos e botão de Locações ficam um abaixo do outro no celular (#136)
    Dado que fiz login como "admin"
    E estou usando um dispositivo mobile
    Quando acesso a página "/rentals"
    Então os combos e o botão de Locações devem estar um abaixo do outro

  # Varredura de layout no celular (#102/#45): achou "Novo Inquilino" cortado
  # (25/nov/2026). Nenhuma página principal pode cortar elementos fora da tela.
  @sistemaCompleto
  Esquema do Cenário: Nenhum elemento fica cortado no celular em <pagina>
    Dado que fiz login como "admin"
    E estou usando um dispositivo mobile
    Quando acesso a página "<pagina>"
    Então nenhum elemento deve ficar cortado fora da tela

    Exemplos:
      | pagina      |
      | /dashboard  |
      | /properties |
      | /tenants    |
      | /rentals    |
      | /payments   |
      | /financial  |
      | /settings   |
