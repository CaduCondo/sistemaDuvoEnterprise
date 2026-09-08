-- Parte 2 do backfill: os 9 cards que não tinham par no GitHub.
-- Criei 8 issues novas (#83 a #90) espelhando cada card.
--
-- ⚠️ CORRIGIDO em 08/set/2026, depois que o Cadu barrou o script.
--
-- A 9ª linha vinculava o card "Migrar as rescisoes antigas para o formato de
-- dois recebimentos" à issue #51 -- que JÁ É de outro card ("Migrar rescisões
-- antigas: destrinchar cada uma em dois recebimentos pendentes"). Eu mesmo
-- escrevi no comentário que "parece duplicada" e que vinculava ao #51 "por
-- segurança": não era seguro. Deixaria DOIS cards apontando para a mesma
-- issue, quebrando a regra de que cada card tem um par exato no GitHub e
-- estragando a rastreabilidade -- justamente o que este backfill existe para
-- consertar. Um número de issue repetido também confunde a busca por "#51"
-- na tela do kanban.
--
-- Comparando as descrições dos dois cards, é duplicata mesmo: tratam do mesmo
-- trabalho, e o card #51 é a versão completa (traz a decisão do Cadu de
-- 21/ago/2026, o desenho dos dois recebimentos e os cuidados de rodar antes
-- em DEV, com backup). O outro é um resumo do mesmo assunto.
--
-- O certo não é dar o mesmo número aos dois, é apagar a duplicata -- e isso
-- é decisão do Cadu, na tela do kanban, não de um UPDATE em produção. Por
-- isso a linha foi REMOVIDA daqui.
--
-- Rodar no Supabase de PRODUÇÃO (alvghyfbzrpjwhckmkwx) -- SQL Editor.

BEGIN;

UPDATE kanban_cards SET github_issue_number = 83 WHERE title = 'Refatoração: código duplicado, código morto e ruído (em fases)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 84 WHERE title = 'Rescisao do mes PENDENTE deve gerar UM recebimento, nao dois' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 85 WHERE title = 'Tela do Kanban trava o navegador por ~20 segundos ao carregar' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 86 WHERE title = 'Recibo próprio para o Recebimento de Rescisão' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 87 WHERE title = 'Tela do recebimento as vezes abre sem os dados' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 88 WHERE title = 'Revisar o Manual do Sistema depois das mudancas de agosto' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 89 WHERE title = 'Limpar os dados de teste sobrando no banco de DEV' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 90 WHERE title = 'Encolher o smoke para 5 minutos e criar a suite completa separada' AND github_issue_number IS NULL;

-- (A 9ª linha, que vinculava a duplicata ao #51, foi removida -- ver o
--  cabeçalho deste arquivo.)

COMMIT;

-- Conferência final: deve sobrar UMA linha -- o card duplicado
-- "Migrar as rescisoes antigas para o formato de dois recebimentos".
-- Ele fica sem número de propósito, até ser apagado pela tela do kanban.
SELECT id, title, status, priority
FROM kanban_cards
WHERE github_issue_number IS NULL
ORDER BY title;

-- Confere que nenhum número de issue ficou repetido entre cards.
-- O esperado aqui é 0 linhas.
SELECT github_issue_number, COUNT(*) AS qtd_cards
FROM kanban_cards
WHERE github_issue_number IS NOT NULL
GROUP BY github_issue_number
HAVING COUNT(*) > 1
ORDER BY github_issue_number;
