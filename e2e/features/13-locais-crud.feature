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
