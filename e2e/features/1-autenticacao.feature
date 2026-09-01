# language: pt
@autenticacao
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

  @sistemaCompleto
  Cenário: Login com sucesso - Usuário Financeiro
    Quando preencho o campo "Usuário" com "financeiro@teste.com"
    E preencho o campo "Senha" com "Financeiro@123"
    E clico no botão "Entrar"
    Então devo ser redirecionado para "/dashboard"
    E devo ver a página do dashboard

  @sistemaCompleto
  Cenário: Login com credenciais inválidas
    Quando preencho o campo "Usuário" com "invalido@teste.com"
    E preencho o campo "Senha" com "SenhaErrada123"
    E clico no botão "Entrar"
    Então devo permanecer na página de login
    E devo ver uma mensagem de erro

  @sistemaCompleto
  Cenário: Mostrar/Ocultar senha
    Quando preencho o campo "Senha" com "MinhaSenh@123"
    Então o campo senha deve estar oculto
    Quando clico no botão de visualizar senha
    Então o campo senha deve estar visível
    Quando clico no botão de visualizar senha novamente
    Então o campo senha deve estar oculto

  # ⚠️ Atualizado em 31/ago/2026: antes esta tela dizia "E-mail não
  # encontrado" para um e-mail que não existe no sistema -- e isso é um
  # vazamento (dá para descobrir, por tentativa e erro, quais e-mails têm
  # conta aqui). A rota /api/auth/forgot-password agora responde a MESMA
  # mensagem de sucesso não importa se o e-mail existe ou não -- ver o
  # cabeçalho daquele arquivo. Por isso este cenário passou a esperar a
  # mesma tela de sucesso do cenário abaixo, e não mais um erro.
  @sistemaCompleto
  Cenário: Recuperar senha - E-mail não cadastrado não revela isso
    Quando clico em "Esqueci minha senha"
    Então devo ver o formulário de recuperação de senha
    Quando preencho o email de recuperação com "nao-cadastrado@teste.com"
    E clico em "Enviar Senha"
    Então devo ver a mensagem "E-mail Enviado com Sucesso"

  @sistemaCompleto
  Cenário: Recuperar senha - E-mail válido
    Quando clico em "Esqueci minha senha"
    Então devo ver o formulário de recuperação de senha
    Quando preencho o email de recuperação com "admin@teste.com"
    E clico em "Enviar Senha"
    Então devo ver a mensagem "E-mail Enviado com Sucesso"

  @sistemaCompleto
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
  @sistemaCompleto
  Cenário: A senha nunca volta do servidor
    Quando eu pedir login ao servidor com "admin@teste.com" e a senha "Admin@123"
    Então o servidor deve aceitar
    E a resposta não pode conter nenhuma senha
    E a resposta deve trazer um token que identifica esse usuário

  @seguranca
  @sistemaCompleto
  Cenário: Senha errada não diz se o usuário existe
    # Dizer "usuário não encontrado" entrega quais logins são válidos para
    # quem estiver tentando adivinhar. As duas respostas têm que ser iguais.
    #
    # ⚠️ Corrigido em 01/set/2026: este cenário errava a senha do
    # "admin@teste.com" de propósito -- a mesma conta que quase todo outro
    # cenário da suíte usa via "Dado que fiz login como admin". O bloqueio
    # por senha errada passou a funcionar de verdade em 30/ago (antes o RLS
    # engolia a gravação em silêncio), então tentativas deste cenário
    # acumuladas entre pushes de CI derrubaram a conta admin e, com ela, a
    # rodada inteira (ver ticket "CI derruba a suíte inteira..."). Agora usa
    # um usuário descartável, do mesmo jeito que os cenários de bloqueio
    # abaixo já faziam.
    Dado que existe um usuário só para este teste
    Quando eu pedir login ao servidor com o e-mail desse usuário e a senha "SenhaErrada123"
    E eu pedir login ao servidor com "naoexiste@teste.com" e a senha "SenhaErrada123"
    Então as duas recusas devem dizer a mesma coisa

  @seguranca
  @sistemaCompleto
  Cenário: Três senhas erradas bloqueiam a conta por 30 minutos
    # Este é o cenário que estava morto: a contagem não era gravada, então
    # dava para tentar senha infinitas vezes.
    Dado que existe um usuário só para este teste
    Quando eu errar a senha dele 3 vezes seguidas
    Então a conta dele deve estar bloqueada no banco
    E a contagem de tentativas dele deve estar em 3
    E a quarta tentativa, mesmo com a senha certa, deve ser recusada

  # ==========================================================================
  # GERENCIAR USUÁRIOS TAMBÉM PASSOU A ACONTECER NO SERVIDOR (31/ago/2026)
  #
  # Mesma causa raiz do bloco acima: `system_users` tem RLS ligado com regra
  # que exige `auth.uid()`, e este sistema não usa o login do Supabase. Além
  # do login, isso também travava criar/editar/excluir usuário, desbloquear
  # e trocar senha -- todos batiam direto no banco com a chave pública
  # (anon) e o RLS recusava em silêncio. Ver o cabeçalho de
  # src/pages/api/users/index.ts.
  #
  # Estes cenários falam com as rotas /api/users/* direto, pelo mesmo motivo
  # do bloco de login: o que está sendo protegido é a gravação de verdade
  # acontecer, não o desenho da tela -- e é exatamente esse pulo (o clique
  # "funcionar" na tela vs. a linha realmente aparecer no banco) que o
  # cenário antigo "Admin pode criar usuário" (2-permissoes-admin.feature)
  # não cobria: ele só conferia o formulário abrir.
  # ==========================================================================

  @seguranca
  @sistemaCompleto
  Cenário: Criar usuário pelo servidor grava de verdade no banco
    Dado que estou autenticado como admin pelo servidor
    Quando eu pedir para criar um usuário pelo servidor
    Então o servidor deve aceitar a criação
    E o usuário deve existir de verdade no banco

  @seguranca
  @sistemaCompleto
  Cenário: Quem não é admin não consegue criar usuário
    Dado que estou autenticado como "broker" pelo servidor
    Quando eu pedir para criar um usuário pelo servidor
    Então o servidor deve recusar com "403"

  @seguranca
  @sistemaCompleto
  Cenário: Editar, trocar a própria senha e excluir pelo servidor
    Dado que existe um usuário só para este teste de gerenciamento
    Quando eu editar o nome dele pelo servidor para "Nome Editado E2E"
    Então o nome dele no banco deve ser "Nome Editado E2E"
    Quando ele troca a própria senha pelo servidor para "NovaSenha@123"
    Então a senha dele no banco deve ser "NovaSenha@123"
    Quando eu excluir esse usuário pelo servidor
    Então ele não deve mais existir no banco

  @seguranca
  @sistemaCompleto
  Cenário: Desbloquear usuário pelo servidor limpa o bloqueio
    Dado que existe um usuário só para este teste
    E eu errar a senha dele 3 vezes seguidas
    Quando eu pedir para desbloquear esse usuário pelo servidor
    Então o bloqueio dele deve estar limpo no banco
