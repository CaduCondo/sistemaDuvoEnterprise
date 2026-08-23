# language: pt
Funcionalidade: Autenticação de Usuários
  Como um usuário do sistema
  Quero fazer login com minhas credenciais
  Para acessar o sistema de gerenciamento de imóveis

  # ⚠️ Atualizado em 2026-08: não existe mais uma rota "/login" dedicada. O
  # acesso administrativo é um dropdown ("Gerenciador") no cabeçalho da home
  # pública "/" — ver src/components/public/PublicHeader.tsx. Os textos de
  # erro/sucesso abaixo foram conferidos contra o componente real.

  Contexto:
    Dado que estou na página de login

  # Marcado com @smoke: e o unico cenario deste arquivo que roda a cada
  # push. Login do admin e pre-requisito de praticamente todo o resto da
  # suite — se ele quebrar, tudo quebra junto.
  @smoke
  Cenário: Login com sucesso - Usuário Admin
    Quando preencho o campo "Usuário" com "admin@teste.com"
    E preencho o campo "Senha" com "Admin@123"
    E clico no botão "Entrar"
    Então devo ser redirecionado para "/dashboard"
    E devo ver a página do dashboard

  Cenário: Login com sucesso - Usuário Financeiro
    Quando preencho o campo "Usuário" com "financeiro@teste.com"
    E preencho o campo "Senha" com "Financeiro@123"
    E clico no botão "Entrar"
    Então devo ser redirecionado para "/dashboard"
    E devo ver a página do dashboard

  Cenário: Login com credenciais inválidas
    Quando preencho o campo "Usuário" com "invalido@teste.com"
    E preencho o campo "Senha" com "SenhaErrada123"
    E clico no botão "Entrar"
    Então devo permanecer na página de login
    E devo ver uma mensagem de erro

  Cenário: Mostrar/Ocultar senha
    Quando preencho o campo "Senha" com "MinhaSenh@123"
    Então o campo senha deve estar oculto
    Quando clico no botão de visualizar senha
    Então o campo senha deve estar visível
    Quando clico no botão de visualizar senha novamente
    Então o campo senha deve estar oculto

  Cenário: Recuperar senha - E-mail não cadastrado
    Quando clico em "Esqueci minha senha"
    Então devo ver o formulário de recuperação de senha
    Quando preencho o email de recuperação com "nao-cadastrado@teste.com"
    E clico em "Enviar Senha"
    Então devo ver a mensagem "E-mail não encontrado"

  Cenário: Recuperar senha - E-mail válido
    Quando clico em "Esqueci minha senha"
    Então devo ver o formulário de recuperação de senha
    Quando preencho o email de recuperação com "admin@teste.com"
    E clico em "Enviar Senha"
    Então devo ver a mensagem "E-mail Enviado com Sucesso"

  Cenário: Logout
    Dado que fiz login como "admin"
    Quando clico no menu do usuário
    E clico em "Sair"
    Então devo ser redirecionado para "/"
