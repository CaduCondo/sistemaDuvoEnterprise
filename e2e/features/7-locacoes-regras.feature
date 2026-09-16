# language: pt
@locacoes
Funcionalidade: Regras de Negócio de Locações
  Como um usuário autorizado
  Quero gerenciar locações
  Para garantir que as regras de negócio sejam aplicadas corretamente

  Contexto:
    Dado que fiz login como "admin"
    E estou na página "/rentals"

  # Bug reportado pelo Cadu em 11/set/2026: o combo de Status vinha com
  # "Ativo" selecionado, mas a tabela mostrava locações Ativas E Encerradas
  # juntas, e escolher "Encerrado" não achava nenhuma. Causa raiz: a
  # rescisão só atualiza a coluna `status` da locação, nunca `is_active`,
  # e a tela filtrava por `is_active` só (ver rentalService.ts).
  @sistemaCompleto
  Cenário: Filtro de Status da lista respeita o status real da locação
    Dado que existe uma locação ativa do cenário
    E que existe uma locação encerrada do cenário
    Quando acesso a página "/rentals"
    Então o filtro de Status está com "Ativo" selecionado
    E vejo a locação ativa do cenário na lista
    E NÃO vejo a locação encerrada do cenário na lista
    Quando seleciono o filtro de Status "Encerrado"
    Então vejo a locação encerrada do cenário na lista
    E NÃO vejo a locação ativa do cenário na lista

  # ✅ Reescrito em 14/set/2026 (issue #99): o passo "seleciono um imóvel que
  # está 'Ocupado'" era um STUB (só um `waitForTimeout`, nunca selecionava
  # nada de verdade) -- e nem tinha como ser diferente: lendo
  # RentalFormDialog.tsx, o dropdown de imóvel numa locação NOVA já usa
  # `availableProperties` (não `properties`), ou seja, um imóvel "Ocupado"
  # nunca aparece como opção pra começo de conversa. Não existe "selecionar
  # um imóvel ocupado e ver erro" -- a regra real, mais forte, é "imóvel
  # ocupado nunca aparece pra selecionar". Reescrito pra validar isso de
  # verdade: cria um imóvel ocupado e confere que ele não está entre as
  # opções do dropdown.
  @sistemaCompleto
  Cenário: Criar locação - Imóvel ocupado não aparece para seleção
    Dado que existe um imóvel ocupado do cenário
    Quando clico no botão "Nova Locação"
    Então o imóvel ocupado do cenário NÃO deve aparecer para seleção

  # ✅ Criado em 14/set/2026: o Cadu confirmou a regra ("os campos
  # obrigatórios da tela de criar uma locação são: imóvel, inquilino, data
  # início e fim de contrato e dia de vencimento") e isso revelou um bug
  # real -- a tela deixava salvar sem Data Fim (o rótulo tinha "*", mas a
  # checagem do código nunca incluía esse campo). O efeito não era só falta
  # de aviso: rentalService.create() só gera os recebimentos de aluguel se
  # Data Início, Data Fim E Dia de Vencimento estiverem todos preenchidos --
  # uma locação sem Data Fim ficava com ZERO recebimentos gerados, em
  # silêncio, sem erro nenhum pro usuário perceber. Corrigido em
  # RentalFormDialog.tsx (handleSubmit). Aproveitado também pra consertar
  # "não devo poder continuar", que checava um botão "Salvar" que nunca
  # existiu nesta tela (o botão real é "Criar Locação"/"Atualizar Locação")
  # -- o passo sempre "passava" mesmo sem checar nada de verdade.
  @sistemaCompleto
  Cenário: Criar locação - Data Fim obrigatória
    Quando clico no botão "Nova Locação"
    E preencho todos os campos obrigatórios, exceto a data fim
    E tento salvar
    Então devo ver uma mensagem de erro
    E não devo poder continuar

  # ✅ Decisão do Cadu (14/set/2026, issue #99, decisão #2): "na locação o
  # caução deve ser opcional porque essa informação pode ser colocada
  # depois da locação já ter sido criada". Confirma a investigação de
  # 14/set/2026 (RentalFormDialog.tsx/handleSubmit): os únicos campos com
  # validação obrigatória de verdade são Imóvel, Inquilino, Data início e
  # Dia de vencimento -- nem o valor nem a data de pagamento da caução
  # entram nessa checagem, mesmo os dois tendo "*" no rótulo da tela (que
  # é só visual, não é aplicado). Reescrito para validar a regra real (em
  # vez de só apagar a cobertura): criar uma locação sem preencher NADA de
  # caução precisa funcionar normalmente.
  @sistemaCompleto
  Cenário: Criar locação sem preencher a caução
    Quando clico no botão "Nova Locação"
    E preencho todos os campos obrigatórios
    E NÃO preencho o valor da caução
    E salvo a locação
    Então a locação deve ser criada com sucesso

  # ✅ ATUALIZADO: Reflete nova estrutura de parcelas de caução
  @sistemaCompleto
  Cenário: Criar locação - Parcelamento de caução (3 parcelas)
    Quando clico no botão "Nova Locação"
    E preencho todos os campos obrigatórios
    E preencho o valor da caução com "6000.00"
    E marco a opção "Parcelar caução"
    E seleciono "3 parcelas"
    E preencho:
      | campo                           | valor      |
      | 1ª parcela - Valor              | 2000.00    |
      | 1ª parcela - Data Pagamento     | 01/08/2026 |
      | 2ª parcela - Valor              | 2000.00    |
      | 2ª parcela - Data Vencimento    | 01/09/2026 |
      | 3ª parcela - Valor              | 2000.00    |
      | 3ª parcela - Data Vencimento    | 01/10/2026 |
    E salvo a locação
    Então na aba "Cauções" da página Financeiro devo ver:
      | Parcela | Valor   | Data Vencimento | Data Pagamento | Status   |
      | 1/3     | 2000.00 | 01/08/2026      | 01/08/2026     | Pendente |
      | 2/3     | 2000.00 | 01/09/2026      | (vazio)        | Pendente |
      | 3/3     | 2000.00 | 01/10/2026      | (vazio)        | Pendente |

  # ✅ NOVO: Testa que 1ª parcela salva em due_date E payment_date
  #
  # ⚠️ Corrigido em 16/set/2026: faltavam "preencho o valor da caução" e o
  # valor/vencimento da 2ª parcela. Sem eles, RentalFormDialog.tsx nem deixa
  # salvar -- recusa com "Preencha o valor da 2ª parcela" (o botão Salvar
  # nunca desabilita, só mostra o alerta e mantém o formulário aberto) -- e
  # sem valor de caução preenchido (depositAmount = 0), o sistema nem tenta
  # criar nenhuma parcela mesmo que o salvamento fosse adiante. Resultado
  # real observado: 0 parcelas de caução para conferir.
  @sistemaCompleto
  Cenário: Criar locação - 1ª parcela de caução preenche ambas as datas
    Quando clico no botão "Nova Locação"
    E preencho todos os campos obrigatórios
    E preencho o valor da caução com "3000.00"
    E marco a opção "Parcelar caução"
    E seleciono "2 parcelas"
    E preencho a "Data Pagamento" da 1ª parcela com "15/08/2026"
    E preencho:
      | campo                        | valor      |
      | 2ª parcela - Valor           | 1500.00    |
      | 2ª parcela - Data Vencimento | 15/09/2026 |
    E salvo a locação
    Então no banco de dados a parcela 1 deve ter:
      | campo        | valor      |
      | due_date     | 15/08/2026 |
      | payment_date | 15/08/2026 |
    E a parcela 2 deve ter:
      | campo        | valor      |
      | due_date     | (preenchido)|
      | payment_date | NULL       |

  # ⚠️ NOVO (31/ago/2026) — regressão do bug real em produção na locação
  # LEMOS APTO 06: "Renovar Contrato" avançava a data fim certinho, mas não
  # criava nenhum recebimento de aluguel até lá. Ver issue #59 no GitHub.
  @sistemaCompleto
  Cenário: Renovar contrato cria os recebimentos até a nova data fim
    Dado uma locação ativa cujo contrato está para vencer, com aluguel de "1500.00" e vencimento dia "15"
    Quando clico em "Renovar Contrato" dessa locação
    E confirmo a renovação
    Então a data fim da locação deve avançar 1 ano
    E deve existir um recebimento de aluguel pendente para cada mês até a nova data fim
    E o último recebimento deve ser proporcional aos dias até a nova data fim

  # ⚠️ NOVO (07/set/2026) — bug real relatado pelo Cadu, issue #91: quando a
  # data fim passava, o sistema encerrava a locação sozinho E a tela escondia
  # todos os botões de ação. Como o inquilino costuma responder com alguns
  # dias de atraso, a equipe ficava travada justamente na hora de agir.
  # Agora a locação continua "Ativa" (com aviso "Vencido") até alguém
  # decidir: Renovar ou Rescindir.
  @sistemaCompleto
  Cenário: Locação com a data fim vencida continua ativa e com os botões de ação
    Dado uma locação ativa cuja data fim já passou
    Quando abro a tela de Locações e procuro por essa locação
    Então o status dela deve aparecer como "Vencido"
    E os botões "Renovar Contrato", "Rescisão de Contrato" e "Excluir" devem estar disponíveis
    E o status dela no banco deve continuar "active"
    E o imóvel dela deve continuar "occupied"

  # ✅ NOVO: Testa carregamento de parcelas ao visualizar locação
  @sistemaCompleto
  Cenário: Visualizar locação - Carregar dados de caução da tabela
    Dado que existe uma locação com caução parcelado em 3x:
      | Parcela | Valor   | Data Vencimento | Código PIX |
      | 1/3     | 2000.00 | 01/08/2026      | PIX123     |
      | 2/3     | 2000.00 | 01/09/2026      | PIX456     |
      | 3/3     | 2000.00 | 01/10/2026      |            |
    Quando abro a locação em modo "Visualizar"
    Então no bloco "Informações do Caução" devo ver:
      | campo                        | valor      |
      | 1ª parcela - Valor           | 2000.00    |
      | 1ª parcela - Data Pagamento  | 01/08/2026 |
      | 1ª parcela - Código PIX      | PIX123     |
      | 2ª parcela - Valor           | 2000.00    |
      | 2ª parcela - Data Vencimento | 01/09/2026 |
      | 2ª parcela - Código PIX      | PIX456     |
      | 3ª parcela - Valor           | 2000.00    |
      | 3ª parcela - Data Vencimento | 01/10/2026 |
      | 3ª parcela - Código PIX      | (vazio)    |

  # FORA DO SMOKE (30/ago/2026): o cenário abre "Nova Locação" e preenche só os
  # campos do caução -- nunca escolhe imóvel, inquilino nem as datas, que são
  # obrigatórios. O formulário não tem como ser gravado.
  # Ver docs/tickets/smoke-30-ago.md.
  @quebrado
  Cenário: Criar locação - Caução integral
    Quando clico no botão "Nova Locação"
    E preencho o valor da caução com "5000.00"
    E NÃO marco a opção "Parcelar caução"
    E preencho a "Data Pagamento" com "01/08/2026"
    E salvo a locação
    Então na aba "Cauções" devo ver:
      | Parcela | Valor   | Data Vencimento | Data Pagamento |
      | 1/1     | 5000.00 | 01/08/2026      | 01/08/2026     |

  @smoke
  Cenário: Criar locação - Garagem opcional
    Quando clico no botão "Nova Locação"
    E marco a opção "Possui garagem"
    Então devo ver o campo "Valor da garagem"
    E devo poder preencher o valor

  @sistemaCompleto
  # ⚠️ Reescrito em 15/set/2026 (issue #99, confirmado pelo CI run
  # 34928289217 + regra real explicada pelo Cadu): o cenário original
  # esperava que marcar "Corretor Parceiro?" abrisse campos "Nome do
  # corretor" e "Taxa (%)" no PRÓPRIO formulário de Locação -- isso nunca
  # existiu (RentalFormDialog.tsx só tem o checkbox, sem esses campos).
  # A regra real (confirmada pelo Cadu, 14/set/2026): o checkbox só marca
  # a locação como tendo corretor parceiro; o VALOR da comissão é
  # lançado depois, direto na tabela de Financeiro > Cauções, coluna
  # "Valor Parceiro" -- já coberto em 10-caucoes.feature ("Editar
  # comissão de corretor parceiro inline"). Aqui o cenário passa a
  # validar só o que o formulário de Locação realmente faz: marcar o
  # sinalizador no banco.
  Cenário: Criar locação - Corretor parceiro
    Quando clico no botão "Nova Locação"
    E preencho todos os campos obrigatórios
    E marco a opção "Corretor parceiro"
    E salvo a locação
    Então a locação deve ser criada com sucesso
    E a locação criada tem corretor parceiro marcado

  # FORA DO SMOKE (30/ago/2026): o passo de preparo cria a locação direto no
  # banco, e quem gera os 12 recebimentos é a tela. Sem passar pela tela, não
  # existe recebimento nenhum para contar -- o cenário não tem como passar.
  # Ver docs/tickets/smoke-30-ago.md.
  @quebrado
  Cenário: Criar locação - Gerar pagamentos automaticamente
    Dado que existe um imóvel disponível "IMO-001" com aluguel de "2500.00"
    E existe um inquilino "João Silva"
    Quando crio uma locação com:
      | campo          | valor      |
      | Imóvel         | IMO-001    |
      | Inquilino      | João Silva |
      | Dia vencimento | 10         |
      | Data início    | 01/01/2026 |
      | Data fim       | 31/12/2026 |
    Então devem ser criados 12 pagamentos
    E cada pagamento deve ter valor de "2500.00"
    E todos os pagamentos devem vencer no dia 10

  # ⚠️ REESCRITOS em 09/set/2026 (issue #95).
  #
  # Os dois cenários mandavam "alterar o valor do aluguel" dentro do
  # formulário de Locação -- e esse campo NÃO EXISTE lá. Conferido em
  # RentalFormDialog.tsx: o valor do aluguel é só EXIBIDO
  # (`formatCurrency(selectedProperty?.value)`), porque ele pertence ao
  # cadastro do IMÓVEL, não ao da locação.
  #
  # O caminho real (confirmado em rentalService.update -- a variável
  # `rentPaymentsChanged` compara `rental.value` com `oldRental.monthlyRent`)
  # é: muda-se o valor do IMÓVEL e depois basta abrir a locação e SALVAR,
  # mesmo sem mexer em mais nada -- os recebimentos são ressincronizados
  # com o valor novo. É a regra que o Cadu lembrava "mais ou menos"; agora
  # está confirmada no código e protegida por estes cenários.
  @sistemaCompleto
  Cenário: Editar locação - Atualizar valor do aluguel
    Dado que existe uma locação ativa
    Quando o valor do imóvel dessa locação muda para "2800.00"
    E edito a locação
    E salvo as alterações
    Então os pagamentos futuros devem ser atualizados para "2800.00"
    E os pagamentos já pagos devem manter o valor original

  @sistemaCompleto
  Cenário: Editar locação - Preservar snapshot em pagamentos pagos
    Dado que existe uma locação ativa com aluguel de "2500.00"
    E o pagamento de Janeiro/2026 está "Pago" com valor de "2500.00"
    Quando o valor do imóvel dessa locação muda para "2800.00"
    E edito a locação
    E altero a garagem para "400.00"
    E salvo as alterações
    E visualizo o recibo do pagamento de Janeiro/2026
    Então no bloco "Informações do Contrato" devo ver:
      | campo             | valor   |
      | Valor do Aluguel  | 2500.00 |
      | Valor da Garagem  | 0.00    |
      | Valor Total       | 2500.00 |
    E no bloco "Formação de Valores" devo ver:
      | descrição | valor   |
      | Aluguel   | 2500.00 |
    Quando visualizo um pagamento futuro
    Então no bloco "Informações do Contrato" devo ver:
      | campo             | valor   |
      | Valor do Aluguel  | 2800.00 |
      | Valor da Garagem  | 400.00  |
      | Valor Total       | 3200.00 |
    E no bloco "Formação de Valores" devo ver:
      | descrição | valor   |
      | Aluguel   | 2800.00 |
      | Garagem   | 400.00  |

  # ⚠️ CORRIGIDO em 12/set/2026 (issue #99, cluster "bug no teste"): este
  # cenário tentava alterar o valor do aluguel DENTRO do formulário de
  # Locação ("E altero o valor do aluguel para..."), campo que não existe
  # ali -- o valor pertence ao cadastro do IMÓVEL (mesmo motivo já
  # documentado acima, nos cenários "Atualizar valor do aluguel" e
  # "Preservar snapshot em pagamentos pagos"). O Playwright falhava com
  # "Element is not an <input>...". Ajustado para o mesmo padrão correto
  # dos dois cenários irmãos: muda o valor no imóvel primeiro, depois abre
  # e salva a locação.
  @sistemaCompleto
  Cenário: Editar locação - Não atualizar pagamentos passados pendentes
    Dado que existe uma locação ativa com aluguel de "2500.00"
    E o pagamento de Novembro/2025 está "Pendente" com valor de "2500.00"
    E o pagamento de Dezembro/2025 está "Pendente" com valor de "2500.00"
    E o pagamento de Março/2026 está "Pendente" com valor de "2500.00"
    Quando o valor do imóvel dessa locação muda para "2800.00"
    E edito a locação em "15/02/2026"
    E salvo as alterações
    Então o pagamento de Novembro/2025 deve manter "2500.00"
    E o pagamento de Dezembro/2025 deve manter "2500.00"
    E o pagamento de Março/2026 deve ser atualizado para "2800.00"
    E pagamentos futuros devem ter "2800.00"

  # ✅ NOVO (bug corrigido 21/ago/2026): quando a data de início é
  # corrigida DEPOIS que a parcela do mês já tinha sido criada, o valor
  # dessa parcela precisa ser recalculado — antes ficava "preso" no valor
  # de mês cheio, mesmo quando a nova data tornava a parcela proporcional.
  @sistemaCompleto
  Cenário: Editar locação - Corrigir data de início recalcula parcela já criada
    Dado que existe uma locação ativa com aluguel de "2500.00"
    E o dia de vencimento é "20"
    E o pagamento de referência Junho/2026 está "Pendente" com valor de "2500.00"
    Quando edito a locação
    E altero a data de início para "18/06/2026"
    E salvo as alterações
    Então o pagamento de referência Junho/2026 deve ser atualizado para "166.67"

  # ⚠️ MARCADO @quebrado em 13/set/2026 (issue #99, cluster "Locações"):
  # o passo "que existe uma locação com:" cria a locação DIRETO NO BANCO
  # (payments.steps.ts), sem passar pela tela. O Comprovante de Contrato
  # (RentalContract.tsx) só aparece automaticamente logo depois que uma
  # locação é criada PELO FORMULÁRIO (RentalFormDialog.tsx,
  # setShowContract(true) no fluxo de criação) -- não existe hoje nenhum
  # botão "Ver Contrato"/"Comprovante" para reabrir isso numa locação já
  # existente (conferido em rentals.tsx: o único botão com ícone de
  # documento na lista é "Histórico de Pagamentos", outra tela). Ou seja,
  # o passo "visualizo o Comprovante de Contrato de Locação" procura um
  # botão que nunca existiu -- mesma classe de defeito já documentada em
  # "Criar locação - Gerar pagamentos automaticamente" (preparo direto no
  # banco pula a tela que a asserção depende). Fica fora das rodadas até
  # o cenário ser reescrito para criar a locação pela tela (ou até o
  # produto ganhar um botão de reabrir o comprovante).
  @quebrado
  Cenário: Comprovante de Contrato - Somar aluguel e garagem
    Dado que existe uma locação com:
      | campo          | valor   |
      | Aluguel        | 1500.00 |
      | Garagem        | 400.00  |
    Quando visualizo o "Comprovante de Contrato de Locação"
    Então no campo "Valor Total" devo ver "1900.00"
    E não apenas o valor do aluguel

  # ⚠️ Corrigido em 13/set/2026 (issue #99, cluster "Locações") -- 2 causas:
  # 1) não existe (e nunca existiu) botão "Encerrar Locação" na tela -- o
  #    botão real (rentals.tsx) chama-se "Rescisão de Contrato" (ícone X,
  #    abre RentalTerminationDialog.tsx, onde vive o campo de data
  #    #termination-date que o próximo passo já preenche).
  # 2) mesmo corrigindo o nome, a locação do cenário é criada DIRETO NO
  #    BANCO depois que "/rentals" já tinha carregado (Contexto) -- a lista
  #    em tela nunca via a locação nova, então o clique caía fora (ou pegava
  #    outra linha). Precisa recarregar a lista antes de agir nela, mesmo
  #    padrão já usado em outros cenários que criam dado direto no banco.
  @sistemaCompleto
  Cenário: Encerrar locação antecipadamente
    Dado que existe uma locação ativa com término em "31/12/2026"
    Quando volto para a lista de locações
    E clico em "Rescisão de Contrato"
    E preencho a data de encerramento com "30/06/2026"
    E confirmo o encerramento
    Então a data de término deve ser atualizada para "30/06/2026"
    E os pagamentos após "30/06/2026" devem ser cancelados
    E o imóvel deve ficar "Disponível"