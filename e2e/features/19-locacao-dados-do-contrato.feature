# language: pt
@contrato
Funcionalidade: Locação nova só é criada com todos os dados do contrato (regra do Cadu, 18/nov/2026)
  Como administrador
  Quero que o sistema recuse criar uma locação quando faltar qualquer dado que vai no contrato
  Para nunca ter uma locação sem contrato possível

  # Regras:
  #   - ao clicar em "Criar Locação", o sistema confere os dados do inquilino, do
  #     locador, do imóvel e da locação que entram no contrato;
  #   - se faltar algo, mostra a lista do que falta e a locação NÃO é criada
  #     (nada no banco, imóvel continua disponível);
  #   - com tudo preenchido, cria a locação e abre o contrato com o nome do
  #     locador, do inquilino e a assinatura do locador;
  #   - "Baixar PDF" gera um arquivo PDF só com o contrato.
  # Observação: com um único locador cadastrado ele já vem escolhido no combo
  # "Quem é o Locador?" -- por isso não há cenário de "locador em branco" aqui.

  Contexto:
    Dado que fiz login como "admin"

  @sistemaCompleto
  Cenário: Inquilino sem os dados do contrato - a locação NÃO é criada
    Dado um imóvel disponível e um inquilino de teste SEM os dados do contrato
    Quando preencho uma nova locação para esse imóvel e esse inquilino
    E clico em criar locação
    Então devo ver o aviso "Locação NÃO criada" listando "Inquilino: sexo"
    E o aviso também deve listar "Inquilino: estado civil"
    E o aviso também deve listar "Inquilino: profissão"
    E o aviso também deve listar "Inquilino: RG"
    E o aviso também deve listar "Inquilino: endereço completo"
    E nenhuma locação deve existir para esse inquilino
    E o imóvel de teste deve continuar "available"

  @sistemaCompleto
  Cenário: Falta só o RG do inquilino - o aviso cita só o RG e a locação NÃO é criada
    Dado um imóvel disponível e um inquilino de teste SEM apenas o RG
    Quando preencho uma nova locação para esse imóvel e esse inquilino
    E clico em criar locação
    Então devo ver o aviso "Locação NÃO criada" listando "Inquilino: RG"
    E o aviso NÃO deve listar "Inquilino: sexo"
    E nenhuma locação deve existir para esse inquilino
    E o imóvel de teste deve continuar "available"

  @sistemaCompleto
  Cenário: Depois de completar os dados do inquilino a locação é criada e o contrato abre assinado
    Dado um imóvel disponível e um inquilino de teste COM todos os dados do contrato
    Quando preencho uma nova locação para esse imóvel e esse inquilino
    E clico em criar locação
    Então o contrato deve abrir com o nome do inquilino e o texto do locador
    E a assinatura do locador deve aparecer no contrato
    E uma locação deve existir para esse inquilino

  @sistemaCompleto
  Cenário: Baixar PDF gera só o contrato em um arquivo PDF
    Dado um imóvel disponível e um inquilino de teste COM todos os dados do contrato
    Quando preencho uma nova locação para esse imóvel e esse inquilino
    E clico em criar locação
    E clico em "Baixar PDF" no contrato
    Então o arquivo baixado deve ser um PDF chamado com o nome do inquilino

  @sistemaCompleto
  Cenário: O contrato é guardado sozinho nos anexos, uma única vez, e o rodapé só tem Baixar PDF e Fechar
    Dado um imóvel disponível e um inquilino de teste COM todos os dados do contrato
    Quando preencho uma nova locação para esse imóvel e esse inquilino
    E clico em criar locação
    Então o contrato deve abrir com o nome do inquilino e o texto do locador
    E o rodapé do contrato deve ter só os botões "Baixar PDF" e "Fechar"
    E o contrato deve ser guardado sozinho nos anexos da locação em 1 arquivo PDF
    Quando clico em "Baixar PDF" no contrato
    Então a locação deve continuar com 1 só contrato nos anexos

  @sistemaCompleto
  Cenário: A lista de locações não tem botão de gerar contrato
    Quando acesso "/rentals"
    Então a lista de locações não deve ter botão de gerar contrato

  @sistemaCompleto
  Cenário: Locação com 2 inquilinos - contrato com os dois nomes, assinaturas na mesma linha e capa
    Dado um imóvel disponível e um inquilino de teste COM todos os dados do contrato
    E um segundo inquilino de teste COM todos os dados do contrato
    Quando preencho uma nova locação para esse imóvel e esse inquilino
    E marco "Locação com 2 inquilinos" e escolho o 2º inquilino
    E clico em criar locação
    Então o contrato deve abrir com o nome do inquilino e o texto do locador
    E o contrato deve citar os dois inquilinos como LOCATÁRIOS
    E as assinaturas dos dois inquilinos devem ficar na mesma linha
    E o contrato deve começar com a capa, o logotipo, o site e os dados do escritório
    E a locação deve ter o 2º inquilino gravado

  @sistemaCompleto
  Cenário: Marcou 2 inquilinos e não escolheu o segundo - a locação NÃO é criada
    Dado um imóvel disponível e um inquilino de teste COM todos os dados do contrato
    Quando preencho uma nova locação para esse imóvel e esse inquilino
    E marco "Locação com 2 inquilinos" sem escolher o 2º inquilino
    E clico em criar locação
    Então devo ver o aviso "Erro" listando "Escolha o 2º inquilino"
    E nenhuma locação deve existir para esse inquilino

  @sistemaCompleto
  Cenário: 2º inquilino sem o RG - o aviso cita o 2º inquilino e a locação NÃO é criada
    Dado um imóvel disponível e um inquilino de teste COM todos os dados do contrato
    E um segundo inquilino de teste SEM apenas o RG
    Quando preencho uma nova locação para esse imóvel e esse inquilino
    E marco "Locação com 2 inquilinos" e escolho o 2º inquilino
    E clico em criar locação
    Então devo ver o aviso "Locação NÃO criada" listando "2º inquilino: RG"
    E o aviso NÃO deve listar "1º inquilino"
    E nenhuma locação deve existir para esse inquilino

  @sistemaCompleto
  Cenário: Lista de usuários mostra a coluna Locador? com V verde e X vermelho
    Quando acesso "/settings"
    E clico na aba "Usuários"
    Então a coluna "Locador?" deve existir na lista de usuários
    E deve haver pelo menos um usuário com o V verde de locador
    E deve haver pelo menos um usuário com o X vermelho de não locador

  @sistemaCompleto
  Cenário: Cadastro do usuário - combo de Banco com busca, PIX ao lado da Conta e assinatura como anexo
    Dado um usuário de teste que ainda não é locador
    Quando acesso "/settings"
    E clico na aba "Usuários"
    E abro o cadastro desse usuário de teste
    E marco a caixa "Também é locador"
    Então o campo Chave PIX deve ficar na mesma linha do campo Conta
    Quando abro o combo de Banco
    Então a lista de bancos não deve ter o item "valor atual"
    Quando pesquiso "itaú" no combo de Banco
    Então devo ver o banco "0341 - Itaú Unibanco" na lista
    Quando escolho o banco "0341 - Itaú Unibanco"
    Então o combo de Banco deve mostrar "0341 - Itaú Unibanco"
    Quando anexo uma imagem de assinatura
    Então devo ver a miniatura da assinatura
    E o botão "Escolher Arquivo" da assinatura não deve aparecer
    Quando removo a assinatura pelo X vermelho
    Então a miniatura da assinatura não deve aparecer
    E o botão "Escolher Arquivo" da assinatura deve aparecer
