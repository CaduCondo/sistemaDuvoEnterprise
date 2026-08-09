import { supabase } from "@/integrations/supabase/client";
import { KanbanCard, KanbanCardComment, KanbanCardTask } from "@/types";

/**
 * Serviço do Kanban interno (backlog de bugs e features).
 * Visível dentro do sistema para os perfis admin e broker (corretor).
 */

export async function getAll(): Promise<KanbanCard[]> {
  const { data, error } = await supabase
    .from("kanban_cards")
    .select("*")
    .order("status", { ascending: true })
    .order("position", { ascending: true });

  if (error) {
    console.error("Erro ao buscar cards do kanban:", error);
    throw error;
  }

  return (data || []) as KanbanCard[];
}

export async function create(
  data: Partial<KanbanCard> & { title: string }
): Promise<KanbanCard> {
  const { data: result, error } = await supabase
    .from("kanban_cards")
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar card do kanban:", error);
    throw error;
  }

  return result as KanbanCard;
}

export async function update(
  id: string,
  data: Partial<KanbanCard>
): Promise<KanbanCard> {
  const { data: result, error } = await supabase
    .from("kanban_cards")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar card do kanban:", error);
    throw error;
  }

  return result as KanbanCard;
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from("kanban_cards").delete().eq("id", id);

  if (error) {
    console.error("Erro ao remover card do kanban:", error);
    throw error;
  }
}

export async function updateStatus(
  id: string,
  status: KanbanCard["status"]
): Promise<KanbanCard> {
  return update(id, { status });
}

export async function getComments(cardId: string): Promise<KanbanCardComment[]> {
  const { data, error } = await supabase
    .from("kanban_card_comments")
    .select("*")
    .eq("card_id", cardId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar comentários do card:", error);
    throw error;
  }

  return (data || []) as KanbanCardComment[];
}

export async function addComment(
  data: Partial<KanbanCardComment> & { card_id: string; content: string }
): Promise<KanbanCardComment> {
  const { data: result, error } = await supabase
    .from("kanban_card_comments")
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error("Erro ao adicionar comentário:", error);
    throw error;
  }

  return result as KanbanCardComment;
}

export async function getTasks(cardId: string): Promise<KanbanCardTask[]> {
  const { data, error } = await supabase
    .from("kanban_card_tasks")
    .select("*")
    .eq("card_id", cardId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Erro ao buscar tarefas do card:", error);
    throw error;
  }

  return (data || []) as KanbanCardTask[];
}

export async function addTask(
  cardId: string,
  title: string,
  position: number
): Promise<KanbanCardTask> {
  const { data: result, error } = await supabase
    .from("kanban_card_tasks")
    .insert([{ card_id: cardId, title, position }])
    .select()
    .single();

  if (error) {
    console.error("Erro ao adicionar tarefa:", error);
    throw error;
  }

  return result as KanbanCardTask;
}

export async function toggleTask(id: string, isDone: boolean): Promise<void> {
  const { error } = await supabase
    .from("kanban_card_tasks")
    .update({ is_done: isDone })
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar tarefa:", error);
    throw error;
  }
}

export async function removeTask(id: string): Promise<void> {
  const { error } = await supabase.from("kanban_card_tasks").delete().eq("id", id);

  if (error) {
    console.error("Erro ao remover tarefa:", error);
    throw error;
  }
}
