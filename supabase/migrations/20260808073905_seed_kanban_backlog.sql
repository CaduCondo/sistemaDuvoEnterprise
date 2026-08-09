-- Popula o kanban com o backlog inicial levantado pelo cadu em 2026-08-08.
-- Cada card já traz: o problema, o que fazer, e como fazer (orientação técnica).

INSERT INTO kanban_cards (title, category, status, priority, module, problem_description, action_plan, how_to, position) VALUES

('Anexo não aparece na listagem de recebimentos', 'bug', 'todo', 'alta', 'Recebimentos',
'A coluna Anexo na listagem de recebimentos mostra "sem anexo" mesmo quando o recebimento tem anexo cadastrado.',
'Revisar a query/lógica que popula a coluna Anexo na tabela de recebimentos e comparar com a fonte real do anexo usada na tela de detalhe (que exibe corretamente).',
'No componente de listagem de recebimentos, checar se o campo usado para decidir "tem anexo" é diferente do campo populado na criação/edição (ex: lê attachment_url mas grava em outro campo). Achar a função de fetch usada na tabela e comparar com a usada na tela de detalhe.',
1),

('Anexo não aparece ao criar locação', 'bug', 'todo', 'alta', 'Locações',
'Ao anexar um arquivo durante a criação de uma locação e salvar, ao reabrir a locação o anexo não está presente.',
'Verificar se o upload do arquivo ocorre antes ou depois do insert da locação, e se o registro do anexo está vinculado ao rental_id correto.',
'Checar o fluxo no formulário de locação: o upload deve acontecer só depois de existir o id da locação recém-criada, ou usar upload temporário com vínculo posterior. Conferir a tabela de anexos e se o insert do vínculo é de fato chamado no fluxo de criação.',
2),

('Anexo some ao editar locação', 'bug', 'todo', 'alta', 'Locações',
'Ao anexar um arquivo durante a edição de uma locação existente e salvar, o anexo desaparece ao reabrir depois.',
'Revisar o update de locação para garantir que ele não está removendo/sobrescrevendo os anexos anteriores.',
'No serviço de update de locação, conferir se ele reenvia a lista completa de anexos (podendo apagar os que não vieram no payload) em vez de fazer append incremental. Separar "salvar dados da locação" de "salvar anexos" como operações independentes.',
3),

('Página de locações trava após editar (precisa refresh)', 'bug', 'todo', 'alta', 'Locações',
'Depois de salvar a edição de uma locação, a página fica bloqueada e é preciso atualizar a página para continuar usando.',
'Investigar se é o mesmo tipo de problema de overlay do Radix Dialog não sendo limpo corretamente, ou um estado de loading que não reseta após o save.',
'No componente de formulário de locação, confirmar que o estado de "salvando" sempre volta a false após o save (inclusive em caso de sucesso). Se for overlay preso do Radix, aplicar a mesma limpeza já usada em outros pontos do sistema (remoção de overlay/focus-guard/portal órfão).',
4),

('Erro ao abrir anexo do recebimento do caução', 'bug', 'todo', 'alta', 'Caução',
'Ao clicar para abrir o anexo de um recebimento de caução, o sistema dá erro.',
'Verificar se recebimentos de caução usam uma estrutura de anexo diferente dos recebimentos normais de aluguel, e se o handler de abrir anexo espera o formato errado.',
'Comparar o componente/handler de "abrir anexo" usado nos recebimentos normais com o usado nos de caução — provavelmente reaproveita um handler que espera uma URL/formato que o caução não tem.',
5),

('Recebimento de caução aparece na lista de recebimentos de aluguel', 'bug', 'todo', 'alta', 'Caução',
'Recebimentos de caução aparecem misturados na listagem de recebimentos de aluguel, quando deveriam estar separados.',
'Adicionar filtro por tipo de recebimento (aluguel vs caução) na query da listagem de Recebimentos.',
'Identificar o campo que distingue o tipo de recebimento e adicionar filtro na query de listagem; considerar uma aba/tela separada para recebimentos de caução.',
6),

('Recebimento parcial sobrescreve dados do pagamento anterior', 'bug', 'backlog', 'urgente', 'Recebimentos',
'Quando um recebimento é pago parcialmente, ao registrar o segundo pagamento os dados do primeiro (ex: horário) são sobrescritos e somem. O valor pago nas duas vezes, somado, deve ser igual ao valor total da dívida original.',
'Redesenhar o fluxo: em vez de atualizar o mesmo registro a cada pagamento parcial, manter o registro original do primeiro pagamento intacto e gerar um novo card de recebimento para o saldo restante.',
'No fluxo de "pagamento parcial": 1) manter o pagamento original com valor pago = valor parcial e status "pago parcial"; 2) criar um novo registro de recebimento para o saldo restante, vinculado ao original (campo tipo original_payment_id); 3) ao quitar o segundo, ele fecha normalmente; 4) validar que a soma dos dois bate com o valor total esperado.',
7),

('Criar recebimentos com parcelas do caução', 'feature', 'backlog', 'alta', 'Caução',
'Não existe hoje um fluxo estruturado para gerar recebimentos parcelados do caução sem misturar esse valor com o de aluguel.',
'Desenhar o parcelamento do caução como registros independentes dos recebimentos de aluguel, com soma controlada até bater o valor total do caução.',
'Já existe uma tabela de parcelas de depósito no projeto (verificar deposit_installments) — avaliar se cobre o caso antes de criar algo novo. Cada parcela deve ter valor, status pago/pendente, e validação de que a soma das parcelas pagas bate com o valor total do caução antes de marcar como quitado.',
8),

('Permitir 2 inquilinos na mesma locação', 'feature', 'backlog', 'media', 'Locações',
'Hoje o sistema só permite um inquilino vinculado a uma locação. É necessário suportar dois inquilinos no mesmo contrato, com os dois nomes aparecendo no contrato gerado.',
'Mudar a relação de "1 locação → 1 inquilino" para "1 locação → N inquilinos" via tabela de junção, atualizando formulário e geração de contrato.',
'Criar tabela de junção rental_tenants (rental_id, tenant_id), migrar os dados existentes (1 registro por locação atual), atualizar o formulário de locação para multi-seleção de inquilinos, e atualizar o gerador de contrato para listar os nomes de todos os inquilinos vinculados.',
9),

('Split Supabase dev/prod na região correta (sa-east-1)', 'divida_tecnica', 'todo', 'urgente', 'Infra',
'Dev e produção compartilham hoje o mesmo projeto Supabase, na região errada (US em vez de São Paulo), com dados reais em risco.',
'Criar projeto de produção em sa-east-1, migrar schema real (via pg_dump, não replay de migrations) e dados, redeployar edge functions, atualizar variáveis de ambiente, validar, e só então pausar o projeto antigo.',
'1) criar novo projeto sa-east-1 para produção; 2) manter o projeto atual (US) como DEV; 3) pg_dump --schema-only do projeto atual para extrair o schema real; 4) aplicar no novo projeto; 5) migrar os dados de produção reais; 6) redeploy das edge functions; 7) atualizar .env.local (dev aponta para o projeto US) e variáveis da Vercel (prod aponta para o novo projeto sa-east-1); 8) validar login/CRUD nos dois antes de considerar concluído.',
10),

('Cron para resetar BD de DEV a partir do BD de PROD', 'feature', 'backlog', 'media', 'Infra',
'Falta uma forma fácil de zerar o banco de DEV e trazer uma cópia fresca do banco de PROD para testar sem risco.',
'Criar um script que faça dump do projeto PROD e restore no projeto DEV, disponível para rodar manualmente ou agendado.',
'Usar pg_dump/pg_restore (ou supabase db dump) contra a connection string de PROD somente leitura, restaurando no projeto DEV. Adicionar como script npm (ex: db:sync-dev-from-prod). Considerar mascarar dados sensíveis de inquilinos antes de trazer para DEV.',
11),

('Refatoração geral do código e do banco', 'divida_tecnica', 'backlog', 'media', 'Refatoração',
'Código com duplicações e débito técnico acumulado: autenticação com senha em texto puro, arquivos de serviço quase idênticos (ex: adminFeeExemptionService e managementFeeExemptionService), console.log de debug em produção, além de mais de 200 migrations sem consolidação.',
'Abordar em fases pequenas e testáveis, depois da suíte de testes estar confiável e do split dev/prod feito — nunca como reescrita geral de uma vez.',
'Fase 1: trocar senha em texto puro por hash (bcrypt), migrando senhas existentes. Fase 2: unificar serviços de isenção de taxa duplicados num serviço único parametrizado. Fase 3: remover console.log de produção (ou trocar por logger condicional). Fase 4: revisitar os candidatos a código morto já identificados e não removidos.',
12),

('Melhorar layout de várias páginas', 'melhoria', 'backlog', 'baixa', 'UI/UX',
'Necessidade de melhorias visuais em várias páginas do sistema, ainda sem especificação de quais.',
'Levantar com o cadu quais páginas específicas precisam de melhoria e o que exatamente incomoda (responsividade, densidade de informação, cores, etc.) antes de iniciar.',
'Aguardando o cadu detalhar as páginas e pontos específicos.',
13),

('E-mail automático com dados de acesso ao criar usuário', 'feature', 'backlog', 'media', 'Email',
'Ao criar um novo usuário do sistema, ele não recebe automaticamente um e-mail com os dados de acesso.',
'Integrar um serviço de e-mail transacional e disparar e-mail de boas-vindas com usuário e senha temporária no fluxo de criação de usuário.',
'Criar uma edge function (ex: send-welcome-email) chamada após o insert em system_users, usando a API do provedor de e-mail escolhido (ex: Resend). Reaproveitar o campo requires_password_change já existente para forçar troca no primeiro login.',
14),

('E-mail com contrato em anexo ao criar locação', 'feature', 'backlog', 'media', 'Email',
'Ao criar um contrato de locação, o sistema não envia automaticamente o contrato em PDF para o inquilino.',
'Gerar o PDF do contrato na criação da locação e enviar por e-mail para o(s) inquilino(s) vinculado(s).',
'Reaproveitar a mesma infraestrutura de e-mail do item anterior, anexando o PDF gerado. Verificar se já existe geração de PDF de contrato/recibo em algum componente do sistema para usar como referência de padrão.',
15),

('Boleto como forma de pagamento', 'feature', 'backlog', 'media', 'Boleto',
'Boleto ainda não existe como forma de pagamento no sistema.',
'Integrar um gateway de emissão de boletos e adicionar "Boleto" como nova forma de pagamento, com geração de linha digitável/código de barras por recebimento.',
'Revisar a análise de gateway de pagamento já existente no projeto (docs/ANALISE_GATEWAY_PAGAMENTO.md) antes de escolher o gateway. Criar serviço de boleto com criação/consulta/cancelamento via API do gateway escolhido, e adicionar boleto na tabela de formas de pagamento.',
16),

('Envio de e-mail com boleto para o inquilino', 'feature', 'backlog', 'media', 'Boleto',
'Depois de gerado o boleto, ele precisa ser enviado por e-mail ao inquilino.',
'Reaproveitar a infraestrutura de e-mail transacional para anexar o PDF do boleto retornado pelo gateway.',
'Disparar o envio automaticamente após a criação do boleto ter sucesso na integração com o gateway. Depende do item "Boleto como forma de pagamento" estar pronto.',
17),

('Área do inquilino (login, histórico de pagamento e boleto)', 'feature', 'backlog', 'baixa', 'Área do Inquilino',
'O inquilino não tem hoje nenhum acesso próprio ao sistema; precisa ver seu histórico de pagamentos e o boleto atual.',
'Criar um login e uma área restrita e simples para o inquilino, só com histórico de pagamentos e boleto do mês.',
'Decidir entre reaproveitar system_users com um novo perfil "tenant" (mais rápido, usa a infra de auth já existente) ou um sistema de login totalmente separado (mais isolado, mais trabalho). Dado o padrão atual do projeto, reaproveitar system_users com permissões bem restritas é o caminho mais rápido. Depende do boleto estar pronto para fazer sentido completo.',
18),

('Multi-tenant: mesmo sistema, URL diferente por cliente', 'divida_tecnica', 'backlog', 'media', 'Escala',
'Vontade de replicar o sistema para outros clientes variando só a URL de acesso, sem duplicar a base de código (para não ter que corrigir o mesmo bug em vários lugares).',
'Modelar como multi-tenancy real dentro do mesmo deploy: tabela de tenants, coluna tenant_id em todas as tabelas de dados, e roteamento por subdomínio/domínio customizado.',
'Já existe um documento sobre isso no projeto (docs/MULTI_TENANT_URLS.md) — revisar antes de desenhar do zero. Arquitetura recomendada: 1) tabela tenants; 2) tenant_id em todas as tabelas principais; 3) middleware do Next.js identificando o tenant pelo host da requisição; 4) todas as queries passam a filtrar por tenant_id; 5) domínios customizados configurados na Vercel apontando para o mesmo projeto. Não é preciso trocar de infraestrutura — GitHub, Vercel e Supabase já suportam isso; é modelagem de dados e roteamento.',
19)

;
