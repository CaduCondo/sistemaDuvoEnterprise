# language: pt
Funcionalidade: CRUD de Imóveis
  Como um usuário autorizado
  Quero gerenciar imóveis
  Para manter o cadastro atualizado

  # ⚠️ Atualizado em 2026-08 para refletir o formulário e a tabela atuais
  # (colunas "Código"/"Endereço" foram removidas/renomeadas — ver task-2 do
  # board Softgen: "Renomear coluna Endereço para Complemento").

  Contexto:
    Dado que fiz login como "admin"
    E estou na página "/properties"

  Cenário: Visualizar lista de imóveis
    Então devo ver a lista de imóveis
    E devo ver as colunas:
      | coluna       |
      | Local        |
      | Complemento  |
      | Valor        |
      | Quartos      |
      | Banheiros    |
      | Área Útil    |
      | Status       |
      | Foto         |

  Cenário: Alternar visualização Grid/Lista
    Quando clico no botão de visualização em grid
    Então devo ver os imóveis em formato de cards
    Quando clico no botão de visualização em lista
    Então devo ver os imóveis em formato de tabela

  Cenário: Filtrar imóveis por busca
    Quando preencho o campo de busca com "Centro"
    Então devo ver apenas imóveis que contenham "Centro" no endereço ou localização

  Cenário: Filtrar imóveis por localização
    Quando seleciono a localização "São Paulo - Centro"
    Então devo ver apenas imóveis desta localização

  Cenário: Filtrar imóveis por status
    Quando seleciono o status "Disponível"
    Então devo ver apenas imóveis disponíveis
    Quando seleciono o status "Ocupado"
    Então devo ver apenas imóveis ocupados

  Cenário: Abrir formulário de novo imóvel
    Quando clico no botão "Novo Imóvel"
    Então devo ver o formulário de cadastro de imóvel
    E devo ver os campos obrigatórios:
      | campo      |
      | Local      |
      | Quartos    |
      | Banheiros  |
      | Área (m²)  |

  Cenário: Validar campo obrigatório - Local
    Quando clico no botão "Novo Imóvel"
    E tento salvar sem preencher o local
    Então devo ver a mensagem "Campo obrigatório"

  Cenário: Validar campo obrigatório - Quartos
    Quando clico no botão "Novo Imóvel"
    E tento salvar sem preencher os quartos
    Então devo ver a mensagem "Campo obrigatório"

  @smoke
  Cenário: Criar imóvel com sucesso
    # O campo "Local" é uma lista vinda do banco: sem criar a localização antes,
    # a opção simplesmente não existe na tela.
    Dado existe uma localização "São Paulo - Centro"
    E estou na página "/properties"
    Quando clico no botão "Novo Imóvel"
    E preencho todos os campos obrigatórios:
      | campo        | valor              |
      | Local        | São Paulo - Centro |
      | Complemento  | Apto 101           |
      | Quartos      | 2                  |
      | Banheiros    | 1                  |
      | Área         | 80                 |
      | Valor        | 2500.00            |
    E clico em "Salvar"
    Então devo ver a mensagem de sucesso
    E o imóvel deve aparecer na lista

  Cenário: Editar imóvel existente
    Dado que existe um imóvel "IMO-001"
    Quando clico no botão de editar do imóvel "IMO-001"
    Então devo ver o formulário com os dados preenchidos
    Quando altero o valor do aluguel para "2800.00"
    E clico em "Salvar"
    Então devo ver a mensagem de sucesso
    E o valor deve estar atualizado na lista

  Cenário: Deletar imóvel - Cancelar
    Dado que existe um imóvel "IMO-001"
    Quando clico no botão de deletar do imóvel "IMO-001"
    Então devo ver o alerta de confirmação
    Quando clico em "Cancelar"
    Então o imóvel deve permanecer na lista

  Cenário: Deletar imóvel - Confirmar
    Dado que existe um imóvel "IMO-001"
    Quando clico no botão de deletar do imóvel "IMO-001"
    Então devo ver o alerta de confirmação
    Quando clico em "Confirmar"
    Então devo ver a mensagem de sucesso
    E o imóvel NÃO deve aparecer na lista
