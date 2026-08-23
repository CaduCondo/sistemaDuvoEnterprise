# language: pt
Funcionalidade: Anúncio público de imóvel
  Como um interessado que recebeu um link de anúncio
  Quero abrir o anúncio direto pelo link, sem precisar de login
  Para ver o imóvel e entrar em contato

  # ⚠️ Este arquivo nasceu de um bug real (23/ago/2026): o link curto do
  # anúncio (ex.: /imovel/0139) jogava TODO visitante não logado de volta
  # para a home. A causa era a lista de rotas públicas em
  # src/contexts/AuthContext.tsx, que não incluía "/imovel/[id]".
  #
  # Quem estava logado no Gerenciador não via o problema — e por isso ele
  # passou despercebido justamente na página que a empresa divulga.
  # O cenário abaixo está marcado com @smoke para que isso nunca mais volte
  # sem alguém perceber.

  @smoke
  Cenário: Visitante sem login abre o anúncio pelo link curto
    Dado que existe um imóvel disponível anunciado
    Quando abro o link curto do anúncio sem estar logado
    Então devo continuar na página do anúncio
    E devo ver o valor do aluguel no anúncio
