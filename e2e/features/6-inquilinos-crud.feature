# language: pt
Funcionalidade: CRUD de Inquilinos
  Como um usuário autorizado
  Quero gerenciar inquilinos
  Para manter o cadastro atualizado

  Contexto:
    Dado que fiz login como "admin"
    E estou na página "/tenants"

  Cenário: Visualizar lista de inquilinos
    Então devo ver a lista de inquilinos
    E devo ver as colunas:
      | coluna    |
      | Nome      |
      | CPF/CNPJ  |
      | Telefone  |
      | E-mail    |

  Cenário: Filtrar inquilinos por busca
    Quando preencho o campo de busca com "João"
    Então devo ver apenas inquilinos que contenham "João" no nome

  # ⚠️ Atualizado em 2026-08: o filtro da lista de Inquilinos hoje é por
  # status (Novo/Locatário/Inativo), não por tipo de pessoa (CPF/CNPJ) — ver
  # src/components/tenants/TenantFilters.tsx. Não existe filtro de tipo na UI.
  Cenário: Filtrar inquilinos por status
    Quando seleciono o filtro de status "Locatário"
    Então devo ver apenas inquilinos com status locatário

  Cenário: Abrir formulário de novo inquilino
    Quando clico no botão "Novo Inquilino"
    Então devo ver o formulário de cadastro de inquilino
    E devo ver o seletor de tipo "Pessoa Física / Pessoa Jurídica"

  Cenário: Validar máscara de CPF
    Quando clico no botão "Novo Inquilino"
    E seleciono "Pessoa Física"
    E preencho o CPF com "12345678900"
    Então o campo deve exibir "123.456.789-00"

  Cenário: Validar máscara de CNPJ
    Quando clico no botão "Novo Inquilino"
    E seleciono "Pessoa Jurídica"
    E preencho o CNPJ com "12345678000190"
    Então o campo deve exibir "12.345.678/0001-90"

  Cenário: Validar máscara de Telefone
    Quando clico no botão "Novo Inquilino"
    E preencho o telefone com "11987654321"
    Então o campo deve exibir "(11) 98765-4321"

  Cenário: Validar máscara de CEP
    Quando clico no botão "Novo Inquilino"
    E preencho o CEP com "01310100"
    Então o campo deve exibir "01310-100"

  Cenário: Validar máscara de Renda Mensal
    Quando clico no botão "Novo Inquilino"
    E preencho a renda mensal digitando "5000"
    Então o campo deve exibir "R$ 50,00"
    Quando continuo digitando até "500000"
    Então o campo deve exibir "R$ 5.000,00"

  Cenário: Buscar CEP automaticamente
    Quando clico no botão "Novo Inquilino"
    E preencho o CEP com "01310-100"
    E clico em "Buscar CEP"
    Então os campos de endereço devem ser preenchidos automaticamente

  Cenário: Criar inquilino Pessoa Física com campos opcionais
    Quando clico no botão "Novo Inquilino"
    E seleciono "Pessoa Física"
    E preencho todos os campos obrigatórios:
      | campo     | valor                |
      | Nome      | João Silva           |
      | CPF       | 123.456.789-00       |
      | Telefone  | (11) 98765-4321      |
      | E-mail    | joao@email.com       |
    E preencho os campos opcionais:
      | campo         | valor                |
      | Profissão     | Engenheiro Civil     |
      | Estado Civil  | Casado(a)            |
      | Renda Mensal  | 5500,00              |
    E clico em "Salvar"
    Então devo ver a mensagem de sucesso
    E o inquilino deve aparecer na lista

  Cenário: Editar inquilino e adicionar dados opcionais
    Dado que existe um inquilino "Maria Santos" sem dados opcionais
    Quando abro o inquilino "Maria Santos" para edição
    E preencho os campos opcionais:
      | campo         | valor                |
      | Profissão     | Médica               |
      | Estado Civil  | Solteiro(a)          |
      | Renda Mensal  | 8500,50              |
    E clico em "Atualizar"
    Então devo ver a mensagem de sucesso
    E quando abro o inquilino novamente
    Então devo ver os dados salvos corretamente

  Cenário: Validar opções de Estado Civil
    Quando clico no botão "Novo Inquilino"
    E clico no campo "Estado Civil"
    Então devo ver as seguintes opções:
      | opção            |
      | Solteiro(a)      |
      | Casado(a)        |
      | Divorciado(a)    |
      | Viúvo(a)         |
      | União Estável    |

  Cenário: Criar inquilino sem preencher campos opcionais
    Quando clico no botão "Novo Inquilino"
    E seleciono "Pessoa Física"
    E preencho todos os campos obrigatórios:
      | campo     | valor                |
      | Nome      | Pedro Costa          |
      | CPF       | 987.654.321-00       |
      | Telefone  | (11) 91234-5678      |
      | E-mail    | pedro@email.com      |
    E deixo os campos opcionais vazios:
      | campo         |
      | Profissão     |
      | Estado Civil  |
      | Renda Mensal  |
    E clico em "Salvar"
    Então devo ver a mensagem de sucesso
    E o inquilino deve aparecer na lista sem erros

  # ==========================================================================
  # DEFEITO DE 30/ago/2026 — "cliquei OK e a tela travou"
  #
  # Ao criar um usuário e clicar OK na mensagem de sucesso, a tela inteira
  # parava de responder e só voltava com F5.
  #
  # A causa não estava na tela de usuários: estava no componente da mensagem,
  # usado por TODO o sistema. O botão OK fechava o alerta mexendo no estado
  # direto, e não pelo caminho que o Radix avisa -- justamente o caminho onde
  # mora a limpeza que destrava a página. Fechar com Esc funcionava; fechar no
  # botão, que é o que todo mundo faz, travava.
  #
  # Este cenário usa o cadastro de inquilino porque ele já existe e é rápido,
  # mas o que ele protege vale para toda mensagem de sucesso do sistema.
  # ==========================================================================

  @smoke
  Cenário: A tela continua respondendo depois de fechar a mensagem de sucesso
    Quando clico no botão "Novo Inquilino"
    E seleciono "Pessoa Física"
    E preencho todos os campos obrigatórios:
      | campo    | valor           |
      | Nome     | Travamento E2E  |
      | CPF      | 123.456.789-00  |
      | Telefone | (11) 98765-4321 |
      | E-mail   | travamento@email.com |
    E clico em "Salvar"
    E fecho a mensagem de sucesso no botão OK
    Então a tela deve continuar respondendo

  @smoke
  Cenário: Criar inquilino Pessoa Física
    Quando clico no botão "Novo Inquilino"
    E seleciono "Pessoa Física"
    E preencho todos os campos obrigatórios:
      | campo     | valor                |
      | Nome      | João Silva           |
      | CPF       | 123.456.789-00       |
      | Telefone  | (11) 98765-4321      |
      | E-mail    | joao@email.com       |
    E clico em "Salvar"
    Então devo ver a mensagem de sucesso
    E o inquilino deve aparecer na lista

  Cenário: Criar inquilino Pessoa Jurídica
    Quando clico no botão "Novo Inquilino"
    E seleciono "Pessoa Jurídica"
    E preencho todos os campos obrigatórios:
      | campo         | valor                    |
      | Razão Social  | Empresa LTDA             |
      | CNPJ          | 12.345.678/0001-90       |
      | Telefone      | (11) 3333-4444           |
      | E-mail        | empresa@email.com        |
    E clico em "Salvar"
    Então devo ver a mensagem de sucesso
    E o inquilino deve aparecer na lista