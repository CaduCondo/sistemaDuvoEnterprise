# language: pt
@imoveis
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

  @sistemaCompleto
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

  @sistemaCompleto
  Cenário: Alternar visualização Grid/Lista
    Quando clico no botão de visualização em grid
    Então devo ver os imóveis em formato de cards
    Quando clico no botão de visualização em lista
    Então devo ver os imóveis em formato de tabela

  @sistemaCompleto
  Cenário: Filtrar imóveis por busca
    Quando preencho o campo de busca com "Centro"
    Então devo ver apenas imóveis que contenham "Centro" no endereço ou localização

  @sistemaCompleto
  Cenário: Filtrar imóveis por localização
    Quando seleciono a localização "São Paulo - Centro"
    Então devo ver apenas imóveis desta localização

  @sistemaCompleto
  Cenário: Filtrar imóveis por status
    Quando seleciono o status "Disponível"
    Então devo ver apenas imóveis disponíveis
    Quando seleciono o status "Ocupado"
    Então devo ver apenas imóveis ocupados

  @sistemaCompleto
  Cenário: Abrir formulário de novo imóvel
    Quando clico no botão "Novo Imóvel"
    Então devo ver o formulário de cadastro de imóvel
    E devo ver os campos obrigatórios:
      | campo      |
      | Local      |
      | Quartos    |
      | Banheiros  |
      | Área (m²)  |

  # ⚠️ Corrigido em 13/set/2026 (issue #99, cluster "Imóveis"): a mensagem
  # de validação real (properties.tsx, handleSubmit) é "Por favor, preencha
  # todos os campos obrigatórios." (plural) -- o cenário procurava "Campo
  # obrigatório" (singular), que não é substring de "campos obrigatórios" e
  # por isso nunca batia.
  @sistemaCompleto
  Cenário: Validar campo obrigatório - Local
    Quando clico no botão "Novo Imóvel"
    E tento salvar sem preencher o local
    Então devo ver a mensagem "preencha todos os campos obrigatórios"

  @sistemaCompleto
  Cenário: Validar campo obrigatório - Quartos
    Quando clico no botão "Novo Imóvel"
    E tento salvar sem preencher os quartos
    Então devo ver a mensagem "preencha todos os campos obrigatórios"

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

  @sistemaCompleto
  Cenário: Editar imóvel existente
    Dado que existe um imóvel "IMO-001"
    Quando clico no botão de editar do imóvel "IMO-001"
    Então devo ver o formulário com os dados preenchidos
    Quando altero o valor do aluguel para "2800.00"
    E clico em "Salvar"
    Então devo ver a mensagem de sucesso
    E o valor deve estar atualizado na lista

  # Cobertura nova para o bug GRAVE de produção de 16/set/2026: até então,
  # nenhum cenário automatizado simulava o envio de uma foto de verdade
  # (Playwright `setInputFiles`) -- por isso a tela conseguiu, por meses,
  # gravar a foto inteira em base64 direto na coluna `images` (em vez de
  # subir pro Supabase Storage) sem que nenhum teste acusasse nada. Isso
  # travava o salvamento de imóveis com muitas fotos ("canceling statement
  # due to statement timeout"). Ver issue do bug para o relato completo.
  @sistemaCompleto
  Cenário: Editar imóvel - Foto enviada vai para o Storage, não para o banco como base64
    Dado que existe um imóvel "IMO-001"
    Quando clico no botão de editar do imóvel "IMO-001"
    E envio a foto "foto-teste.png" do imóvel
    E clico em "Salvar"
    Então devo ver a mensagem de sucesso
    E no banco de dados a foto do imóvel deve estar salva no Storage, não em base64

  @sistemaCompleto
  Cenário: Deletar imóvel - Cancelar
    Dado que existe um imóvel "IMO-001"
    Quando clico no botão de deletar do imóvel "IMO-001"
    Então devo ver o alerta de confirmação
    Quando clico em "Cancelar"
    Então o imóvel deve permanecer na lista

  # ⚠️ Corrigido em 14/set/2026 (issue #99, cluster "Imóveis"): o botão real
  # do alerta de confirmação (PropertyDeleteAlert.tsx) chama-se "Sim,
  # Excluir" -- nunca existiu um botão "Confirmar" nessa tela.
  @sistemaCompleto
  Cenário: Deletar imóvel - Confirmar
    Dado que existe um imóvel "IMO-001"
    Quando clico no botão de deletar do imóvel "IMO-001"
    Então devo ver o alerta de confirmação
    Quando clico em "Sim, Excluir"
    Então devo ver a mensagem de sucesso
    E o imóvel NÃO deve aparecer na lista
