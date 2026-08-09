-- Ideia do cadu (2026-08-09): agora que dev/prod são bancos separados, a
-- suíte completa de testes continua só em DEV (ela cria/edita/apaga dados),
-- mas falta um smoke test enxuto e só-leitura rodando contra PRODUÇÃO depois
-- de cada deploy. Teria pego automaticamente o bug do cliente Supabase com
-- credenciais fixas (achado manualmente hoje durante a validação do split).

DO $$
DECLARE
  v_card_id UUID;
BEGIN
  INSERT INTO kanban_cards (title, category, status, priority, module, problem_description, position)
  VALUES (
    'Smoke test automático em produção pós-deploy',
    'divida_tecnica',
    'backlog',
    'alta',
    'Testes',
    'A suíte completa de testes (BDD/Playwright) roda só em DEV — correto, já que ela cria/edita/apaga dados. Mas não existe hoje nenhuma verificação automática rodando contra produção depois de um deploy. Foi assim que o bug do cliente Supabase com credenciais fixas passou despercebido até ser testado manualmente.',
    9
  )
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
  (v_card_id, 'Definir a lista curta de smoke tests (login, dashboard carrega, 2-3 páginas principais respondem)', 0),
  (v_card_id, 'Garantir que os smoke tests são só leitura — nunca criam/editam/apagam dado real', 1),
  (v_card_id, 'Criar um teste específico que confirma que o app está conectado no projeto Supabase certo (evita repetir o bug de hoje)', 2),
  (v_card_id, 'Configurar esse conjunto para rodar automaticamente depois de cada deploy de produção na Vercel', 3),
  (v_card_id, 'Configurar alerta (e-mail/notificação) se o smoke test falhar', 4),
  (v_card_id, 'Confirmar que a suíte completa de regressão continua configurada para rodar só contra DEV', 5);
END $$;
