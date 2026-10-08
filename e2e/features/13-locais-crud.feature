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

  # ⚠️ NOVO (08/out/2026) -- bug reportado pelo Cadu (prints anexados): clicou
  # em excluir um Local duplicado, o sistema mostrou "Local excluído com
  # sucesso", mas ao voltar para a lista o Local continuava lá.
  #
  # Causa raiz (locationService.ts, deleteLocation): a policy de RLS de
  # DELETE em "locations" era restrita a `TO authenticated` (sessão real do
  # Supabase Auth). Este sistema usa login próprio (system_users) e nunca cria
  # sessão do Supabase Auth -- a API sempre bate no banco como "anon". Quando
  # o RLS barra um DELETE, o Supabase NÃO retorna erro: só devolve 0 linhas
  # afetadas. O código fazia `.delete().eq("id", id)` sem conferir quantas
  # linhas vieram de volta, então tratava "0 linhas apagadas" como sucesso.
  #
  # Corrigido em dois lugares:
  #   1) Migration supabase/migrations/20261008194839_fix_locations_rls.sql
  #      -- troca as policies de DELETE/UPDATE de "locations" para públicas,
  #      igual ao padrão já usado em location_expenses e já corrigido antes
  #      para payment_methods (20260809163323_fix_payment_methods_rls.sql).
  #   2) locationService.ts -- `.delete().select("id")` agora confere se
  #      alguma linha voltou e lança erro explícito se vier vazio, para que
  #      um bloqueio futuro (RLS, permissão, local já excluído por outra
  #      pessoa) nunca mais seja mostrado como sucesso.
  @sistemaCompleto
  Cenário: Excluir um Local realmente remove ele da lista
    Dado que existe um local "Local Exclusão E2E"
    Quando abro a aba "Locais" das Configurações
    E excluo o local da lista
    Então devo ver a mensagem "Local excluído com sucesso"
    E o local não deve mais aparecer na lista de Locais
