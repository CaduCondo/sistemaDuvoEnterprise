import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  Send,
  Trash2,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
} from "lucide-react";
import { KanbanCard, KanbanCardComment, KanbanCardTask } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  getComments,
  addComment,
  getTasks,
  addTask,
  toggleTask,
  removeTask,
} from "@/services/kanbanService";

interface KanbanCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: KanbanCard | null; // null = criando um novo card
  onSave: (data: Partial<KanbanCard> & { title: string }) => Promise<boolean>;
  onDelete?: (id: string) => void;
}

const emptyForm: Partial<KanbanCard> = {
  title: "",
  category: "feature",
  status: "backlog",
  priority: "media",
  module: "",
  problem_description: "",
  assigned_to_name: "",
};

export function KanbanCardDialog({
  open,
  onOpenChange,
  card,
  onSave,
  onDelete,
}: KanbanCardDialogProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<KanbanCard>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Checklist de tarefas
  const [tasks, setTasks] = useState<KanbanCardTask[]>([]);
  const [newTask, setNewTask] = useState("");
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Comentários
  const [comments, setComments] = useState<KanbanCardComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(card ? { ...card } : emptyForm);
      setNewComment("");
      setNewTask("");
      setShowDetails(false);
      if (card?.id) {
        loadTasks(card.id);
        loadComments(card.id);
      } else {
        setTasks([]);
        setComments([]);
      }
    }
  }, [open, card]);

  const loadTasks = async (cardId: string) => {
    try {
      setLoadingTasks(true);
      const data = await getTasks(cardId);
      setTasks(data);
    } catch (error) {
      console.error("Erro ao carregar tarefas:", error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const loadComments = async (cardId: string) => {
    try {
      setLoadingComments(true);
      const data = await getComments(cardId);
      setComments(data);
    } catch (error) {
      console.error("Erro ao carregar comentários:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddTask = async () => {
    if (!card?.id || !newTask.trim()) return;
    try {
      const created = await addTask(card.id, newTask.trim(), tasks.length);
      setTasks((prev) => [...prev, created]);
      setNewTask("");
    } catch (error) {
      console.error("Erro ao adicionar tarefa:", error);
    }
  };

  const handleToggleTask = async (task: KanbanCardTask) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, is_done: !t.is_done } : t))
    );
    try {
      await toggleTask(task.id, !task.is_done);
    } catch (error) {
      console.error("Erro ao atualizar tarefa:", error);
    }
  };

  const handleRemoveTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await removeTask(taskId);
    } catch (error) {
      console.error("Erro ao remover tarefa:", error);
    }
  };

  const handleAddComment = async () => {
    if (!card?.id || !newComment.trim()) return;
    try {
      await addComment({
        card_id: card.id,
        content: newComment.trim(),
        author_id: user?.id,
        author_name: user?.name,
      });
      setNewComment("");
      await loadComments(card.id);
    } catch (error) {
      console.error("Erro ao adicionar comentário:", error);
    }
  };

  const handleSubmit = async () => {
    const title = form.title?.trim();
    if (!title) return;
    setSaving(true);
    const success = await onSave({
      ...form,
      title,
      created_by: card ? form.created_by : user?.id,
      created_by_name: card ? form.created_by_name : user?.name,
    });
    setSaving(false);
    if (success) {
      onOpenChange(false);
    }
  };

  const doneCount = tasks.filter((t) => t.is_done).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent id="kanban-card-dialog" className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{card ? "Editar Item" : "Novo Item do Kanban"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="kanban-title">Título</Label>
            <Input
              id="kanban-title"
              value={form.title || ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Anexo não aparece na listagem de recebimentos"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as KanbanCard["category"] })}
              >
                <SelectTrigger id="kanban-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="melhoria">Melhoria</SelectItem>
                  <SelectItem value="divida_tecnica">Dívida Técnica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v as KanbanCard["priority"] })}
              >
                <SelectTrigger id="kanban-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kanban-problem">Descrição (opcional)</Label>
            <Textarea
              id="kanban-problem"
              value={form.problem_description || ""}
              onChange={(e) => setForm({ ...form, problem_description: e.target.value })}
              placeholder="Do que se trata, em poucas linhas"
              rows={2}
            />
          </div>

          {/* Checklist de tarefas */}
          <Separator />
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Tarefas {tasks.length > 0 && `(${doneCount}/${tasks.length})`}
            </Label>

            {!card?.id ? (
              <p className="text-xs text-muted-foreground">
                Salve o item primeiro para poder adicionar as tarefas dele.
              </p>
            ) : (
              <>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {loadingTasks ? (
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  ) : tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma tarefa ainda.</p>
                  ) : (
                    tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 group">
                        <Checkbox
                          id={`kanban-task-${task.id}`}
                          checked={task.is_done}
                          onCheckedChange={() => handleToggleTask(task)}
                        />
                        <label
                          htmlFor={`kanban-task-${task.id}`}
                          className={`flex-1 text-sm cursor-pointer ${
                            task.is_done ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {task.title}
                        </label>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => handleRemoveTask(task.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Input
                    id="kanban-new-task"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="Adicionar tarefa..."
                    className="h-9"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTask();
                      }
                    }}
                  />
                  <Button
                    id="kanban-add-task"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                    onClick={handleAddTask}
                    disabled={!newTask.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Mais detalhes (opcional) */}
          <Separator />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-between text-muted-foreground"
            onClick={() => setShowDetails(!showDetails)}
          >
            Mais detalhes
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {showDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kanban-module">Módulo</Label>
                  <Input
                    id="kanban-module"
                    value={form.module || ""}
                    onChange={(e) => setForm({ ...form, module: e.target.value })}
                    placeholder="Ex: Recebimentos, Locações..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kanban-assigned">Responsável</Label>
                  <Input
                    id="kanban-assigned"
                    value={form.assigned_to_name || ""}
                    onChange={(e) => setForm({ ...form, assigned_to_name: e.target.value })}
                    placeholder="Nome de quem vai cuidar disso"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Coluna</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as KanbanCard["status"] })}
                >
                  <SelectTrigger id="kanban-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="todo">A Fazer</SelectItem>
                    <SelectItem value="in_progress">Em Progresso</SelectItem>
                    <SelectItem value="done">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {card?.id && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comentários
                </Label>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {loadingComments ? (
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  ) : comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="rounded-md bg-muted/50 p-2 text-sm">
                        <p className="font-medium">{c.author_name || "Usuário"}</p>
                        <p className="text-muted-foreground">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    id="kanban-new-comment"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Adicionar um comentário..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <Button
                    id="kanban-send-comment"
                    variant="outline"
                    size="icon"
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
          {card?.id && onDelete ? (
            <Button
              id="kanban-delete-card"
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDelete(card.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button
              id="kanban-cancel"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              id="kanban-submit"
              onClick={handleSubmit}
              disabled={saving || !form.title?.trim()}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
