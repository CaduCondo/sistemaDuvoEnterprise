# language: pt
@smoke @fundacao
Funcionalidade: Fundação da esteira de testes
  Como responsável pelo sistema
  Quero saber, a cada mudança, se o sistema continua de pé
  Para não descobrir que quebrou depois que o usuário reclamou

  # Estes cenários não testam regra de negócio nenhuma. Eles testam o
  # "chão": a aplicação sobe, a tela abre, o login entra. Se algum deles
  # falhar, não adianta olhar os testes de regra de negócio — o problema
  # está na base.
  #
  # São os primeiros cenários marcados com @smoke. Essa marca é o que
  # define quem roda automaticamente a cada push. Para trazer mais
  # cobertura de volta, basta marcar mais cenários com @smoke — ver
  # e2e/SMOKE.md.

  Cenário: A aplicação está no ar
    Quando consulto o endereço de saúde da aplicação
    Então a aplicação responde que está no ar

  Cenário: A página pública abre sem erro
    Dado que estou na página inicial pública
    Então devo ver o botão "Gerenciador"
    E a página não deve ter erros de JavaScript

  Cenário: O formulário de login abre
    Dado que estou na página de login
    Então devo ver o botão "Entrar"
