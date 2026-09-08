-- Backfill de github_issue_number nos cards do kanban interno (kanban_cards)
-- Rodar no Supabase de PRODUÇÃO (alvghyfbzrpjwhckmkwx) -- SQL Editor.
-- Casamento feito por título exato do card. O "AND github_issue_number IS NULL"
-- é só uma trava de segurança pra não sobrescrever nada que já tenha número.
--
-- 70 cards casados por título. Os outros 2 que já tinham número (#82 e #79)
-- não entram aqui. Faltam 9 cards sem par no GitHub -- ver mensagem em separado.

BEGIN;

UPDATE kanban_cards SET github_issue_number = 17 WHERE title = 'Erro ao registrar recebimento de caução (migração de schema não aplicada em produção)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 72 WHERE title = 'Segurança: JWT hardcoded, endpoint sem login e scripts perigosos (já corrigido)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 71 WHERE title = 'Segurança: proteção da maioria das tabelas em produção depende só da tela — chave anon pública alcança o banco direto' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 51 WHERE title = 'Migrar rescisões antigas: destrinchar cada uma em dois recebimentos pendentes' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 76 WHERE title = 'Testes BDD com passos que não verificam nada — falso positivo em regras de Locação/Pagamentos' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 73 WHERE title = 'Segurança + limpeza (03/set): pendências da auditoria' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 74 WHERE title = 'Segurança: bucket uploads aceita upload público sem login (Storage Policies)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 62 WHERE title = 'Rescisão: avisar sobre caução pendente/parcial e cancelar parcelas nunca pagas' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 75 WHERE title = 'CI: relatório de testes por e-mail abrindo errado (texto puro + link mascarado no GitHub)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 52 WHERE title = 'Remover o remendo que exclui valores negativos do cálculo das taxas (só depois da migração)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 77 WHERE title = 'Relatório de testes automáticos muito raso -- sem contagens, evidências, gráficos ou link de bugs achados' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 78 WHERE title = 'Kanban: card precisa mostrar um ID (mesmo número da issue do GitHub)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 34 WHERE title = 'Local "Outros" no cadastro do imóvel: campos de endereço manual + exibir no anúncio' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 35 WHERE title = 'Editor de texto (negrito/itálico/tamanho) no campo Descrição do Imóvel' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 33 WHERE title = 'Possível travamento ao pagar/editar parcela de Caução (mesmo padrão já corrigido em Locação)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 66 WHERE title = 'Testes e2e: cliente Supabase sem timeout -- uma falha de rede trava o job inteiro por 20min' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 53 WHERE title = 'Mostrar o total somado da rescisão (aluguel + rescisão) para não ter que fazer conta na mão' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 70 WHERE title = 'CI: e-mail do relatório deveria linkar direto pro HTML, sem precisar baixar zip do GitHub Actions' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 36 WHERE title = 'Cron para resetar DEV a partir de PROD' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 37 WHERE title = 'Permitir 2 inquilinos na mesma locação' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 38 WHERE title = 'Refatoração geral do código e do banco' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 39 WHERE title = 'E-mail automático com dados de acesso ao criar usuário' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 40 WHERE title = 'E-mail com contrato em anexo ao criar locação' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 41 WHERE title = 'Boleto como forma de pagamento' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 42 WHERE title = 'Envio de e-mail com boleto para o inquilino' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 43 WHERE title = 'Multi-tenant: mesmo sistema, URL diferente por cliente' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 58 WHERE title = 'Reescrever os 4 cenarios de teste que sairam do smoke' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 44 WHERE title = 'Coluna attachments de deposit_installments está com tipo diferente em DEV (jsonb) e PROD (text[])' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 60 WHERE title = 'Sincronização de recebimentos ao editar locação recalcula valores antigos pendentes sem avisar' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 45 WHERE title = 'Melhorar layout de várias páginas' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 46 WHERE title = 'Área do inquilino' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 50 WHERE title = 'Relatório das rescisões antigas contaminadas pelo caução (diagnóstico, só leitura)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 15 WHERE title = 'Smoke test automático em produção pós-deploy' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 30 WHERE title = 'Criar recebimentos com parcelas do caução' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 31 WHERE title = 'Mover fotos de imóveis para o Supabase Storage' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 20 WHERE title = 'Erro ao finalizar recebimento com anexos (breakdown.find is not a function)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 23 WHERE title = 'Página de anúncios mostra total/lista de imóveis diferente dependendo do aparelho (cache desatualizado)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 14 WHERE title = 'Bug: criação de locação com caução parcelado (2 ou 3x) só salva a 1ª parcela' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 32 WHERE title = 'Build da aplicação falha no CI (GitHub Actions) — testes automatizados nunca rodam' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 47 WHERE title = 'Recebimento proporcional não recalculado ao corrigir data de início da locação (1ª parcela cobra mês cheio)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 65 WHERE title = 'CI: 124 de 135 cenários falharam no push do fix do Resend (login como admin quebrado só na rodada Sistema completo)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 67 WHERE title = 'Segurança: senhas gravadas em texto puro em system_users' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 21 WHERE title = 'Inquilinos criados aparecem em branco (nome, documento, telefone, e-mail vazios)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 22 WHERE title = 'Erro ao abrir detalhes de locação com anexo antigo (formato string)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 49 WHERE title = 'Rescisão mistura aluguel e caução no mesmo recebimento e contamina as taxas de adm/gerenciamento' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 48 WHERE title = 'CI (GitHub Actions) sempre falhando - testes travam em clique mesmo com elemento encontrado, em telas sem relação com as mudanças' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 57 WHERE title = 'Cadastro de usuarios, troca de senha e bloqueio por tentativas barrados em producao' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 59 WHERE title = 'Renovar Contrato não cria os recebimentos até a nova data fim' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 64 WHERE title = 'Resend sem API key trava (não falha) o job Sistema completo no cenário de recuperar senha' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 24 WHERE title = 'Recebimento parcial sobrescreve pagamento anterior' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 25 WHERE title = 'Split Supabase dev/prod (sa-east-1)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 63 WHERE title = 'Varrer producao atras de outras telas travadas por RLS' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 6 WHERE title = 'Visualizador de imagem (Lightbox) travava a página com um formulário aberto' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 13 WHERE title = 'Bug: parcelamento do caução (nº de parcelas) não é salvo ao editar a locação' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 29 WHERE title = 'Logs de Auditoria (Configurações > Logs) sempre vazio em produção' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 5 WHERE title = 'Tela em branco ao expirar a sessão (rota /login não existe)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 3 WHERE title = 'Data Pagamento e código PIX do caução não eram salvos ao editar Locação' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 4 WHERE title = 'Padronizar componente de Anexos (upload + visualização) em todas as telas' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 61 WHERE title = 'CI (GitHub Actions) derrubou 122 de 132 cenários: teste de segurança bloqueou a conta admin@teste.com compartilhada' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 7 WHERE title = 'Anexo não aparece na listagem de recebimentos' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 8 WHERE title = 'Anexo não aparece ao criar locação' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 9 WHERE title = 'Anexo some ao editar locação' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 10 WHERE title = 'Página de locações trava após editar' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 11 WHERE title = 'Erro ao abrir anexo do recebimento do caução' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 12 WHERE title = 'Caução aparecer na tela de Recebimentos' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 26 WHERE title = 'Remover abertura automática do Recibo ao editar/salvar recebimento' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 68 WHERE title = 'CI: sempre guardar o relatório de testes (não só quando falha)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 69 WHERE title = 'CI: enviar o relatório de testes por e-mail (Resend) após a rodada completa' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 27 WHERE title = 'Levantamento e limpeza de anexos antigos perdidos (Locações e Recebimentos)' AND github_issue_number IS NULL;
UPDATE kanban_cards SET github_issue_number = 28 WHERE title = '[FALSO POSITIVO - NÃO É BUG REAL] Criação de Imóvel/Inquilino — diagnóstico corrigido' AND github_issue_number IS NULL;

COMMIT;

-- Conferência: depois de rodar, veja quais cards continuam sem número.
-- O esperado são só 9 (os que não têm par no GitHub ainda -- ver mensagem em separado).
-- Se aparecer mais que isso na lista, algum título não bateu exatamente (acento/
-- travessão diferente) e precisa ser ajustado manualmente.
SELECT id, title, status, priority
FROM kanban_cards
WHERE github_issue_number IS NULL
ORDER BY title;
