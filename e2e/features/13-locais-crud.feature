# language: pt
@locais
Funcionalidade: Cadastro de Locais (Configurações)
  Como um usuário Admin
  Quero que o sistema impeça cadastrar dois Locais com o mesmo nome
  Para não acumular locais duplicados que atrapalham na hora de escolher
  o local certo em Permissões e Isenção de Taxa Admin

  Contexto:
    Dado que fiz login como "admin"

  # ⚠️ NOVO (16/set/2026) -- o Cadu encontrou vários Locais duplicados no
  # banco (ex.: "ACÁCIAS" 4x, "São Paulo - Centro" 6x) enquanto configurava
  # permissão do usuário Financeiro -- nem a tela nem o banco impediam
  # cadastrar o mesmo nome duas vezes. Ver docs/REGRAS_DE_NEGOCIO.md.
  @sistemaCompleto
  Cenário: Não deve permitir cadastrar um Local com nome já existente
    Dado que existe um local "Local Duplicado Teste"
    Quando abro a aba "Locais" das Configurações
    E clico em "Novo Local"
    E preencho o nome do local com o mesmo nome que já existe
    E clico em "Cadastrar"
    Então devo ver a mensagem "Já existe um Local chamado"

  # ⚠️ NOVO (17/set/2026) -- regra geral pedida pelo Cadu a partir da #106:
  # "não permitir a inclusão enquanto não conseguisse validar se o item já
  # existe, e essa regra deve ser em todas as inclusões". A tela de Formas de
  # Pagamento não tinha checagem NENHUMA de repetido -- dava pra cadastrar
  # duas "PIX". Ver docs/REGRAS_DE_NEGOCIO.md.
  @sistemaCompleto
  Cenário: Não deve permitir cadastrar uma Forma de Pagamento com nome já existente
    Dado que existe uma forma de pagamento "Forma Duplicada Teste"
    Quando abro a aba "Formas Pagamento" das Configurações
    E clico em "Nova Forma"
    E preencho o nome da forma de pagamento com o mesmo nome que já existe
    E clico em "Criar"
    Então devo ver a mensagem "Já existe uma forma de pagamento"

  # O botão de salvar só libera depois que a lista chega do banco -- é o que
  # garante que a checagem de repetido acima nunca roda contra uma lista vazia.
  @sistemaCompleto
  Cenário: O botão de salvar espera a lista carregar antes de aceitar a inclusão
    Quando abro a aba "Locais" das Configurações
    E clico em "Novo Local"
    Então o botão de salvar do cadastro deve estar liberado
