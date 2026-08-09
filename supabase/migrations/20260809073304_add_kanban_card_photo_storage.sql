-- Adiciona ao backlog: mover fotos de imóveis do JSONB (base64) para o
-- Supabase Storage. Achado durante o split dev/prod: a tabela properties
-- sozinha ficou com 113 MB para só 139 linhas, quase certamente por causa
-- disso.

DO $$
DECLARE
  v_card_id UUID;
BEGIN
  INSERT INTO kanban_cards (title, category, status, priority, module, problem_description, position)
  VALUES (
    'Mover fotos de imóveis para o Supabase Storage',
    'divida_tecnica',
    'backlog',
    'alta',
    'Refatoração',
    'As fotos dos imóveis são salvas como texto base64 dentro da coluna JSONB de properties, em vez de um bucket de Storage. Isso deixou a tabela com 113 MB para só 139 linhas — pesa toda query, encareceu e travou o dump/restore do split dev/prod.',
    12
  )
  RETURNING id INTO v_card_id;

  INSERT INTO kanban_card_tasks (card_id, title, position) VALUES
  (v_card_id, 'Criar um bucket no Supabase Storage para fotos de imóveis', 0),
  (v_card_id, 'Escrever script de migração: decodificar o base64 já salvo e subir pro Storage', 1),
  (v_card_id, 'Atualizar o upload de fotos para usar o Storage em vez de salvar base64 no banco', 2),
  (v_card_id, 'Atualizar listagem/detalhe de imóvel para usar a URL do Storage', 3),
  (v_card_id, 'Depois de migrado, limpar o campo antigo de base64 do banco', 4);
END $$;
