# language: pt
@contrato
Funcionalidade: Contrato de locação gerado pelo sistema (#125)
  Como administrador
  Quero gerar o contrato da locação com um clique
  Para não digitar o contrato na mão e saber exatamente o que falta cadastrar

  # Regras combinadas com o Cadu (02 a 15/nov/2026) -- ver docs/REGRAS_DE_NEGOCIO.md,
  # seção "Contrato de locação":
  #   - o locador é um usuário do sistema marcado "Também é locador", escolhido
  #     no combo "Quem é o locador?" da locação;
  #   - o texto muda para locatário/locatária conforme o campo Sexo do inquilino;
  #   - se faltar qualquer dado (do locador, do inquilino, do imóvel ou da
  #     locação), o sistema NÃO gera o contrato e lista o que falta;
  #   - com tudo preenchido, mostra o contrato, baixa em PDF e guarda o PDF nos
  #     Anexos da locação.

  Contexto:
    Dado que fiz login como "admin"

  @sistemaCompleto
  Cenário: Locação sem locador e sem sexo do inquilino - o contrato avisa o que falta
    Dado uma locação com estes recebimentos em aberto:
      | tipo    | vencimento | valor   |
      | aluguel | hoje+15    | 1500.00 |
    Quando abro "Gerar contrato" dessa locação na tela de Locações
    Então o contrato não deve ser gerado
    E a lista do que falta deve citar "Locador: nome"
    E a lista do que falta deve citar "Inquilino: sexo"
