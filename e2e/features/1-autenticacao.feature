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

  # ==========================================================================
  # O LOGIN PASSOU A ACONTECER NO SERVIDOR (30/ago/2026)
  #
  # Antes, a tela baixava a linha inteira do usuário -- senha inclusive -- e
  # comparava no navegador. Três coisas quebradas nisso, todas reais em
  # produção:
  #
  #   1. a senha de quem tentava entrar viajava até o navegador, e chegava a
  #      ser impressa no console;
  #   2. a contagem de tentativas erradas era gravada pelo navegador, a trava
  #      do banco barrava essa gravação e o erro era engolido em silêncio --
  #      ou seja, o BLOQUEIO POR 3 SENHAS ERRADAS ESTAVA MORTO;
  #   3. a sessão era um objeto solto no navegador, sem nada que provasse
  #      quem era o usuário: dava para escrever "role: admin" no console.
  #
  # Os cenários abaixo protegem as três coisas. Eles falam com a rota
  # /api/auth/login diretamente, porque o que está sendo protegido é o
  # CONTRATO do servidor, não o desenho da tela.
  # ==========================================================================

  @seguranca
  Cenário: A senha nunca volta do servidor
    Quando eu pedir login ao servidor com "admin@teste.com" e a senha "Admin@123"
    Então o servidor deve aceitar
    E a resposta não pode conter nenhuma senha
    E a resposta deve trazer um token que identifica esse usuário

  @seguranca
  Cenário: Senha errada não diz se o usuário existe
    # Dizer "usuário não encontrado" entrega quais logins são válidos para
    # quem estiver tentando adivinhar. As duas respostas têm que ser iguais.
    Quando eu pedir login ao servidor com "admin@teste.com" e a senha "SenhaErrada123"
    E eu pedir login ao servidor com "naoexiste@teste.com" e a senha "SenhaErrada123"
    Então as duas recusas devem dizer a mesma coisa

  @seguranca
  Cenário: Três senhas erradas bloqueiam a conta por 30 minutos
    # Este é o cenário que estava morto: a contagem não era gravada, então
    # dava para tentar senha infinitas vezes.
    Dado que existe um usuário só para este teste
    Quando eu errar a senha dele 3 vezes seguidas
    Então a conta dele deve estar bloqueada no banco
    E a contagem de tentativas dele deve estar em 3
    E a quarta tentativa, mesmo com a senha certa, deve ser recusada
