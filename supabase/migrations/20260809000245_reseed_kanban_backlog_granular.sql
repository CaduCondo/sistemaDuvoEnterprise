-- Reorganiza o backlog do kanban: descrições curtas + checklist de tarefas
-- granulares por história, em ordem estratégica de implementação (1 = primeiro).
-- Substitui o seed anterior (20260808073905), que tinha textos longos demais.

DELETE FROM kanban_cards; -- cascade limpa comentários e tarefas junto

INSERT INTO kanban_cards (id, title, category, status, priority, module, problem_description, position) VALUES
('caab0b86-63a1-4f13-b460-22425b5550e5', 'Recebimento parcial sobrescreve pagamento anterior', 'bug', 'todo', 'urgente', 'Recebimentos', 'Ao registrar um segundo pagamento parcial, os dados do primeiro (ex: horário) somem. A soma dos pagamentos deve bater com o valor total da dívida.', 1),
('cb59d7ba-4794-486e-9263-03d745e59d90', 'Anexo não aparece na listagem de recebimentos', 'bug', 'todo', 'alta', 'Recebimentos', 'A coluna Anexo mostra "sem anexo" mesmo quando o recebimento tem anexo cadastrado.', 2),
('c7c846c0-b9ed-4893-8022-c16648c918d4', 'Anexo não aparece ao criar locação', 'bug', 'todo', 'alta', 'Locações', 'Anexar um arquivo na criação da locação e, ao reabrir, o anexo não está lá.', 3),
('2e139aba-b9ef-4cc8-80e1-005f2996a17f', 'Anexo some ao editar locação', 'bug', 'todo', 'alta', 'Locações', 'Anexar um arquivo na edição de uma locação existente e, ao salvar e voltar, o anexo desaparece.', 4),
('3118590b-2d26-49ef-a990-8995065a25b6', 'Página de locações trava após editar', 'bug', 'todo', 'alta', 'Locações', 'Depois de salvar a edição, a página fica bloqueada e precisa de F5 para continuar usando.', 5),
('1de4d642-d5a8-4ad0-b0cd-f8a0ee0fa050', 'Erro ao abrir anexo do recebimento do caução', 'bug', 'todo', 'alta', 'Caução', 'Clicar para abrir o anexo de um recebimento de caução dá erro.', 6),
('2b98bc3e-d098-4cec-a60d-220bd7c0f0ed', 'Recebimento de caução aparece na lista de aluguel', 'bug', 'todo', 'alta', 'Caução', 'Recebimentos de caução aparecem misturados na listagem de recebimentos de aluguel.', 7),
('4f379f42-b315-43c9-aafb-30e88b299694', 'Split Supabase dev/prod (sa-east-1)', 'divida_tecnica', 'todo', 'urgente', 'Infra', 'Dev e produção compartilham hoje o mesmo projeto Supabase, na região errada. Separar em dois projetos.', 8),
('e5e718e8-e9b8-4c90-9c65-566faed1d3a5', 'Cron para resetar DEV a partir de PROD', 'feature', 'backlog', 'media', 'Infra', 'Falta uma forma fácil de zerar o banco de DEV e trazer uma cópia fresca do PROD.', 9),
('1ecc8bcb-a950-4182-96d9-dc2674779bea', 'Criar recebimentos com parcelas do caução', 'feature', 'backlog', 'alta', 'Caução', 'Falta um fluxo estruturado para parcelar o caução sem misturar o valor com o de aluguel.', 10),
('fde38fce-3444-41f5-a4d4-5018cc3e69ae', 'Permitir 2 inquilinos na mesma locação', 'feature', 'backlog', 'media', 'Locações', 'Hoje só é possível vincular um inquilino por locação. Precisa suportar dois, com os dois nomes no contrato.', 11),
('611e5305-3ec8-49d1-b74f-b76970caa63c', 'Refatoração geral do código e do banco', 'divida_tecnica', 'backlog', 'media', 'Refatoração', 'Débito técnico acumulado: senha em texto puro, serviços duplicados, console.log em produção, +200 migrations sem consolidação.', 12),
('29caa759-9986-4b9f-80b7-d32ad566a74d', 'Melhorar layout de várias páginas', 'melhoria', 'backlog', 'baixa', 'UI/UX', 'Necessidade de melhorias visuais em várias páginas, ainda sem especificação de quais.', 13),
('2925735d-7bcc-48e9-a4e2-db717ff41f7f', 'E-mail automático com dados de acesso ao criar usuário', 'feature', 'backlog', 'media', 'Email', 'Novo usuário não recebe e-mail automático com os dados de acesso.', 14),
('0cc9aa83-12bb-4859-8bef-ef70b71c6161', 'E-mail com contrato em anexo ao criar locação', 'feature', 'backlog', 'media', 'Email', 'Contrato de locação não é enviado automaticamente por e-mail ao inquilino.', 15),
('f1d9d364-f48c-48b7-8644-18c3eff47768', 'Boleto como forma de pagamento', 'feature', 'backlog', 'media', 'Boleto', 'Boleto ainda não existe como forma de pagamento.', 16),
('702356e0-a6ff-445e-b082-4686a5244e75', 'Envio de e-mail com boleto para o inquilino', 'feature', 'backlog', 'media', 'Boleto', 'Depois de gerado, o boleto precisa ser enviado por e-mail ao inquilino.', 17),
('b2feb485-fee2-40fc-b845-9e2cb7e7759f', 'Área do inquilino', 'feature', 'backlog', 'baixa', 'Área do Inquilino', 'Inquilino não tem acesso próprio ao sistema; precisa ver histórico de pagamento e boleto.', 18),
('fd7c476a-c692-4536-8cd3-ebad64646e04', 'Multi-tenant: mesmo sistema, URL diferente por cliente', 'divida_tecnica', 'backlog', 'media', 'Escala', 'Replicar o sistema para outros clientes variando só a URL, sem duplicar código.', 19)
;

INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
-- 1. Recebimento parcial sobrescreve pagamento anterior
('caab0b86-63a1-4f13-b460-22425b5550e5', 'Mapear onde o pagamento parcial faz update no registro original', 0),
('caab0b86-63a1-4f13-b460-22425b5550e5', 'Manter o registro original intacto com status "pago parcial"', 1),
('caab0b86-63a1-4f13-b460-22425b5550e5', 'Criar novo recebimento para o saldo restante, vinculado ao original', 2),
('caab0b86-63a1-4f13-b460-22425b5550e5', 'Validar que a soma dos dois bate com o valor total esperado', 3),
('caab0b86-63a1-4f13-b460-22425b5550e5', 'Testar o fluxo completo (1º pagamento parcial + 2º quitando)', 4),

-- 2. Anexo não aparece na listagem de recebimentos
('cb59d7ba-4794-486e-9263-03d745e59d90', 'Comparar o campo usado na listagem com o usado na tela de detalhe', 0),
('cb59d7ba-4794-486e-9263-03d745e59d90', 'Corrigir a query/lógica da coluna Anexo na listagem', 1),
('cb59d7ba-4794-486e-9263-03d745e59d90', 'Testar com um recebimento que tem anexo e um que não tem', 2),

-- 3. Anexo não aparece ao criar locação
('c7c846c0-b9ed-4893-8022-c16648c918d4', 'Verificar se o upload roda antes do insert da locação', 0),
('c7c846c0-b9ed-4893-8022-c16648c918d4', 'Ajustar para o upload usar o id da locação recém-criada', 1),
('c7c846c0-b9ed-4893-8022-c16648c918d4', 'Confirmar que o vínculo do anexo é salvo no banco', 2),
('c7c846c0-b9ed-4893-8022-c16648c918d4', 'Testar criando uma locação nova com anexo', 3),

-- 4. Anexo some ao editar locação
('2e139aba-b9ef-4cc8-80e1-005f2996a17f', 'Verificar se o update da locação sobrescreve a lista de anexos', 0),
('2e139aba-b9ef-4cc8-80e1-005f2996a17f', 'Separar "salvar dados da locação" de "salvar anexos"', 1),
('2e139aba-b9ef-4cc8-80e1-005f2996a17f', 'Testar editando uma locação existente e adicionando anexo', 2),

-- 5. Página de locações trava após editar
('3118590b-2d26-49ef-a990-8995065a25b6', 'Reproduzir o travamento e checar overlay do Radix Dialog', 0),
('3118590b-2d26-49ef-a990-8995065a25b6', 'Confirmar que o estado de "salvando" sempre volta a false', 1),
('3118590b-2d26-49ef-a990-8995065a25b6', 'Aplicar limpeza de overlay (mesmo padrão já usado em outros pontos)', 2),
('3118590b-2d26-49ef-a990-8995065a25b6', 'Testar salvar edição várias vezes seguidas sem travar', 3),

-- 6. Erro ao abrir anexo do recebimento do caução
('1de4d642-d5a8-4ad0-b0cd-f8a0ee0fa050', 'Comparar o handler de abrir anexo do caução com o do aluguel normal', 0),
('1de4d642-d5a8-4ad0-b0cd-f8a0ee0fa050', 'Corrigir o formato/caminho esperado para o anexo do caução', 1),
('1de4d642-d5a8-4ad0-b0cd-f8a0ee0fa050', 'Testar abrindo o anexo de um recebimento de caução real', 2),

-- 7. Recebimento de caução aparece na lista de aluguel
('2b98bc3e-d098-4cec-a60d-220bd7c0f0ed', 'Identificar o campo que distingue tipo de recebimento', 0),
('2b98bc3e-d098-4cec-a60d-220bd7c0f0ed', 'Adicionar filtro na query da listagem de Recebimentos', 1),
('2b98bc3e-d098-4cec-a60d-220bd7c0f0ed', 'Testar que a lista de aluguel não mostra mais registros de caução', 2),

-- 8. Split Supabase dev/prod
('4f379f42-b315-43c9-aafb-30e88b299694', 'Criar projeto novo no Supabase em sa-east-1 para produção', 0),
('4f379f42-b315-43c9-aafb-30e88b299694', 'Extrair o schema real do projeto atual via pg_dump --schema-only', 1),
('4f379f42-b315-43c9-aafb-30e88b299694', 'Aplicar o schema extraído no projeto novo', 2),
('4f379f42-b315-43c9-aafb-30e88b299694', 'Migrar os dados reais de produção para o projeto novo', 3),
('4f379f42-b315-43c9-aafb-30e88b299694', 'Redeploy das edge functions no projeto novo', 4),
('4f379f42-b315-43c9-aafb-30e88b299694', 'Atualizar .env.local para apontar para o projeto atual (agora DEV)', 5),
('4f379f42-b315-43c9-aafb-30e88b299694', 'Atualizar variáveis de ambiente da Vercel para o projeto novo (PROD)', 6),
('4f379f42-b315-43c9-aafb-30e88b299694', 'Validar login e CRUD básico nos dois ambientes', 7),

-- 9. Cron para resetar DEV a partir de PROD
('e5e718e8-e9b8-4c90-9c65-566faed1d3a5', 'Escrever script de dump do projeto PROD', 0),
('e5e718e8-e9b8-4c90-9c65-566faed1d3a5', 'Escrever script de restore no projeto DEV', 1),
('e5e718e8-e9b8-4c90-9c65-566faed1d3a5', 'Adicionar como script npm (ex: db:sync-dev-from-prod)', 2),
('e5e718e8-e9b8-4c90-9c65-566faed1d3a5', 'Avaliar mascarar dados sensíveis de inquilinos antes de trazer para DEV', 3),

-- 10. Criar recebimentos com parcelas do caução
('1ecc8bcb-a950-4182-96d9-dc2674779bea', 'Conferir se a tabela de parcelas de depósito já existente cobre o caso', 0),
('1ecc8bcb-a950-4182-96d9-dc2674779bea', 'Definir valor e status (pago/pendente) de cada parcela', 1),
('1ecc8bcb-a950-4182-96d9-dc2674779bea', 'Validar que a soma das parcelas pagas bate com o valor total do caução', 2),
('1ecc8bcb-a950-4182-96d9-dc2674779bea', 'Testar o fluxo completo de parcelamento do caução', 3),

-- 11. Permitir 2 inquilinos na mesma locação
('fde38fce-3444-41f5-a4d4-5018cc3e69ae', 'Criar tabela de junção rental_tenants (rental_id, tenant_id)', 0),
('fde38fce-3444-41f5-a4d4-5018cc3e69ae', 'Migrar os dados existentes (1 registro por locação atual)', 1),
('fde38fce-3444-41f5-a4d4-5018cc3e69ae', 'Atualizar o formulário de locação para multi-seleção de inquilinos', 2),
('fde38fce-3444-41f5-a4d4-5018cc3e69ae', 'Atualizar o gerador de contrato para listar todos os nomes', 3),

-- 12. Refatoração geral do código e do banco
('611e5305-3ec8-49d1-b74f-b76970caa63c', 'Trocar senha em texto puro por hash (bcrypt), migrando senhas existentes', 0),
('611e5305-3ec8-49d1-b74f-b76970caa63c', 'Unificar os serviços de isenção de taxa duplicados', 1),
('611e5305-3ec8-49d1-b74f-b76970caa63c', 'Remover console.log de produção (ou usar logger condicional)', 2),
('611e5305-3ec8-49d1-b74f-b76970caa63c', 'Revisitar os candidatos a código morto já identificados', 3),

-- 13. Melhorar layout de várias páginas
('29caa759-9986-4b9f-80b7-d32ad566a74d', 'Levantar com o cadu quais páginas e pontos específicos precisam de ajuste', 0),

-- 14. E-mail automático com dados de acesso
('2925735d-7bcc-48e9-a4e2-db717ff41f7f', 'Escolher provedor de e-mail transacional (ex: Resend)', 0),
('2925735d-7bcc-48e9-a4e2-db717ff41f7f', 'Criar edge function de envio de e-mail de boas-vindas', 1),
('2925735d-7bcc-48e9-a4e2-db717ff41f7f', 'Disparar a função após o insert em system_users', 2),
('2925735d-7bcc-48e9-a4e2-db717ff41f7f', 'Testar criando um usuário novo', 3),

-- 15. E-mail com contrato em anexo
('0cc9aa83-12bb-4859-8bef-ef70b71c6161', 'Verificar se já existe geração de PDF de contrato/recibo no sistema', 0),
('0cc9aa83-12bb-4859-8bef-ef70b71c6161', 'Gerar o PDF do contrato na criação da locação', 1),
('0cc9aa83-12bb-4859-8bef-ef70b71c6161', 'Reaproveitar a infra de e-mail para enviar com o PDF anexado', 2),
('0cc9aa83-12bb-4859-8bef-ef70b71c6161', 'Testar criando uma locação nova', 3),

-- 16. Boleto como forma de pagamento
('f1d9d364-f48c-48b7-8644-18c3eff47768', 'Revisar a análise de gateway de pagamento já existente no projeto', 0),
('f1d9d364-f48c-48b7-8644-18c3eff47768', 'Escolher o gateway de boleto', 1),
('f1d9d364-f48c-48b7-8644-18c3eff47768', 'Criar serviço de emissão/consulta/cancelamento de boleto', 2),
('f1d9d364-f48c-48b7-8644-18c3eff47768', 'Adicionar boleto na tabela de formas de pagamento', 3),
('f1d9d364-f48c-48b7-8644-18c3eff47768', 'Testar emissão de um boleto de ponta a ponta', 4),

-- 17. Envio de e-mail com boleto
('702356e0-a6ff-445e-b082-4686a5244e75', 'Disparar envio automático após a criação do boleto', 0),
('702356e0-a6ff-445e-b082-4686a5244e75', 'Reaproveitar a infra de e-mail para anexar o PDF do boleto', 1),
('702356e0-a6ff-445e-b082-4686a5244e75', 'Testar o envio de ponta a ponta', 2),

-- 18. Área do inquilino
('b2feb485-fee2-40fc-b845-9e2cb7e7759f', 'Decidir entre novo perfil "tenant" em system_users ou login separado', 0),
('b2feb485-fee2-40fc-b845-9e2cb7e7759f', 'Criar tela simples de login do inquilino', 1),
('b2feb485-fee2-40fc-b845-9e2cb7e7759f', 'Criar tela de histórico de pagamentos', 2),
('b2feb485-fee2-40fc-b845-9e2cb7e7759f', 'Exibir o boleto do mês atual', 3),
('b2feb485-fee2-40fc-b845-9e2cb7e7759f', 'Restringir permissões para só ver os próprios dados', 4),

-- 19. Multi-tenant
('fd7c476a-c692-4536-8cd3-ebad64646e04', 'Revisar o documento docs/MULTI_TENANT_URLS.md já existente no projeto', 0),
('fd7c476a-c692-4536-8cd3-ebad64646e04', 'Criar tabela tenants', 1),
('fd7c476a-c692-4536-8cd3-ebad64646e04', 'Adicionar tenant_id nas tabelas principais', 2),
('fd7c476a-c692-4536-8cd3-ebad64646e04', 'Criar middleware do Next.js para identificar o tenant pelo host', 3),
('fd7c476a-c692-4536-8cd3-ebad64646e04', 'Filtrar todas as queries por tenant_id', 4),
('fd7c476a-c692-4536-8cd3-ebad64646e04', 'Configurar domínios customizados na Vercel', 5)
;
