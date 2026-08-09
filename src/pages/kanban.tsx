import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, ChevronLeft, ChevronRight, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useKanban } from "@/hooks/useKanban";
import { KanbanCardDialog } from "@/components/kanban/KanbanCardDialog";
import { KanbanCard, KanbanStatus, KanbanPriority } from "@/types";

const COLUMNS: { key: KanbanStatus; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "A Fazer" },
  { key: "in_progress", label: "Em Progresso" },
  { key: "done", label: "Concluído" },
];

const PRIORITIES: { key: KanbanPriority; label: string }[] = [
  { key: "urgente", label: "Urgente" },
  { key: "alta", label: "Alta" },
  { key: "media", label: "Média" },
  { key: "baixa", label: "Baixa" },
];

const CATEGORY_LABEL: Record<string, string> = {
  bug: "Bug",
  feature: "Feature",
  melhoria: "Melhoria",
  divida_tecnica: "Dívida Técnica",
};

const CATEGORY_CLASS: Record<string, string> = {
  bug: "bg-red-100 text-red-800 border-red-200",
  feature: "bg-blue-100 text-blue-800 border-blue-200",
  melhoria: "bg-purple-100 text-purple-800 border-purple-200",
  divida_tecnica: "bg-amber-100 text-amber-800 border-amber-200",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const PRIORITY_CLASS: Record<string, string> = {
  urgente: "bg-red-600 text-white border-red-600",
  alta: "bg-orange-100 text-orange-800 border-orange-200",
  media: "bg-slate-100 text-slate-700 border-slate-200",
  baixa: "bg-green-100 text-green-800 border-green-200",
};

const PRIORITY_DOT: Record<string, string> = {
  urgente: "bg-red-600",
  alta: "bg-orange-500",
  media: "bg-slate-400",
  baixa: "bg-green-500",
};

export default function KanbanPage() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { cards, isLoading, createCard, updateCard, moveCard, deleteCard } = useKanban();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [cardToDelete, setCardToDelete] = useState<KanbanCard | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  // Apenas admin e corretor têm acesso ao kanban
  const canAccess = authUser?.role === "admin" || authUser?.role === "broker";

  useEffect(() => {
    if (authUser && !canAccess) {
      router.push("/dashboard");
    }
  }, [authUser, canAccess, router]);

  const cardsByColumn = useMemo(() => {
    const map: Record<KanbanStatus, Record<KanbanPriority, KanbanCard[]>> = {
      backlog: { urgente: [], alta: [], media: [], baixa: [] },
      todo: { urgente: [], alta: [], media: [], baixa: [] },
      in_progress: { urgente: [], alta: [], media: [], baixa: [] },
      done: { urgente: [], alta: [], media: [], baixa: [] },
    };
    cards.forEach((c) => {
      if (map[c.status] && map[c.status][c.priority]) {
        map[c.status][c.priority].push(c);
      }
    });
    return map;
  }, [cards]);

  const columnTotal = (status: KanbanStatus) =>
    Object.values(cardsByColumn[status]).reduce((sum, list) => sum + list.length, 0);

  const handleCreateNew = () => {
    setSelectedCard(null);
    setDialogOpen(true);
  };

  const handleOpenCard = (card: KanbanCard) => {
    setSelectedCard(card);
    setDialogOpen(true);
  };

  const handleSave = async (data: Partial<KanbanCard> & { title: string }) => {
    if (selectedCard) {
      return updateCard(selectedCard.id, data);
    }
    return createCard(data);
  };

  const handleDeleteRequest = (id: string) => {
    const card = cards.find((c) => c.id === id) || null;
    setCardToDelete(card);
    setDialogOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (cardToDelete) {
      await deleteCard(cardToDelete.id);
      setCardToDelete(null);
    }
  };

  const moveColumn = (card: KanbanCard, direction: 1 | -1) => {
    const currentIndex = COLUMNS.findIndex((c) => c.key === card.status);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= COLUMNS.length) return;
    moveCard(card.id, { status: COLUMNS[nextIndex].key });
  };

  // Drag and drop: arrastar para o lado muda a coluna (status),
  // arrastar para cima/baixo muda a faixa de prioridade dentro da coluna.
  const handleDragStart = (e: DragEvent<HTMLDivElement>, card: KanbanCard) => {
    setDraggingId(card.id);
    e.dataTransfer.setData("text/plain", card.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverZone(null);
  };

  const handleZoneDragOver = (e: DragEvent<HTMLDivElement>, zoneKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverZone !== zoneKey) setDragOverZone(zoneKey);
  };

  const handleZoneDragLeave = (zoneKey: string) => {
    setDragOverZone((current) => (current === zoneKey ? null : current));
  };

  const handleZoneDrop = (
    e: DragEvent<HTMLDivElement>,
    status: KanbanStatus,
    priority: KanbanPriority
  ) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    setDragOverZone(null);
    if (!cardId) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    if (card.status === status && card.priority === priority) return;
    moveCard(card.id, { status, priority });
  };

  if (!canAccess) {
    return null;
  }

  return (
    <Layout>
      <SEO
        title="Kanban - Duvo Enterprise"
        description="Backlog de bugs e melhorias do sistema"
      />

      <div id="kanban-page" className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold mb-1">Kanban</h1>
            <p className="text-sm text-muted-foreground">
              Backlog de bugs, features e melhorias do sistema. Arraste um card para o lado para
              mudar de coluna, ou para cima/baixo para mudar a prioridade.
            </p>
          </div>
          <Button id="kanban-new-button" onClick={handleCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Item
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Carregando kanban...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {COLUMNS.map((column, columnIndex) => (
              <div key={column.key} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                    {column.label}
                  </h2>
                  <Badge variant="secondary">{columnTotal(column.key)}</Badge>
                </div>

                <div className="space-y-3">
                  {PRIORITIES.map((priority) => {
                    const zoneKey = `${column.key}-${priority.key}`;
                    const bandCards = cardsByColumn[column.key][priority.key];
                    const isOver = dragOverZone === zoneKey;

                    return (
                      <div key={zoneKey}>
                        <div className="flex items-center gap-1.5 px-1 pb-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[priority.key]}`} />
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                            {priority.label}
                          </span>
                          {bandCards.length > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              ({bandCards.length})
                            </span>
                          )}
                        </div>

                        <div
                          className={`space-y-2 min-h-[32px] rounded-md p-1 -m-1 transition-colors ${
                            isOver ? "bg-primary/10 ring-1 ring-primary/40" : ""
                          }`}
                          onDragOver={(e) => handleZoneDragOver(e, zoneKey)}
                          onDragLeave={() => handleZoneDragLeave(zoneKey)}
                          onDrop={(e) => handleZoneDrop(e, column.key, priority.key)}
                        >
                          {bandCards.map((card) => (
                            <Card
                              key={card.id}
                              id={`kanban-card-${card.id}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, card)}
                              onDragEnd={handleDragEnd}
                              className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                                draggingId === card.id ? "opacity-40" : ""
                              }`}
                              onClick={() => handleOpenCard(card)}
                            >
                              <CardContent className="p-3 space-y-2">
                                <p className="text-sm font-medium leading-snug">{card.title}</p>

                                <div className="flex flex-wrap gap-1">
                                  <Badge className={`text-[10px] px-1.5 py-0 ${CATEGORY_CLASS[card.category]}`}>
                                    {CATEGORY_LABEL[card.category]}
                                  </Badge>
                                  <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_CLASS[card.priority]}`}>
                                    {PRIORITY_LABEL[card.priority]}
                                  </Badge>
                                  {card.module && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {card.module}
                                    </Badge>
                                  )}
                                </div>

                                {card.assigned_to_name && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <UserIcon className="h-3 w-3" />
                                    {card.assigned_to_name}
                                  </div>
                                )}

                                <div className="flex items-center justify-between pt-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    disabled={columnIndex === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveColumn(card, -1);
                                    }}
                                    title="Mover para a coluna anterior"
                                  >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    disabled={columnIndex === COLUMNS.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveColumn(card, 1);
                                    }}
                                    title="Mover para a próxima coluna"
                                  >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {columnTotal(column.key) === 0 && (
                    <p className="text-xs text-muted-foreground px-1">Nenhum item aqui.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <KanbanCardDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          card={selectedCard}
          onSave={handleSave}
          onDelete={handleDeleteRequest}
        />

        <AlertDialog open={!!cardToDelete} onOpenChange={(open) => !open && setCardToDelete(null)}>
          <AlertDialogContent id="kanban-delete-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir item do kanban?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir &quot;{cardToDelete?.title}&quot;? Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCardToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
