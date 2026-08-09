import { useState, useEffect, useCallback } from "react";
import { KanbanCard, KanbanStatus } from "@/types";
import {
  getAll as getAllCards,
  create as createCard,
  update as updateCard,
  remove as deleteCard,
  updateStatus as updateCardStatus,
} from "@/services/kanbanService";
import { useAlert } from "@/contexts/AlertContext";

export function useKanban() {
  const { showAlert } = useAlert();
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getAllCards();
      setCards(data);
    } catch (error) {
      console.error("Erro ao carregar cards do kanban:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createCardHandler = useCallback(
    async (data: Partial<KanbanCard> & { title: string }) => {
      try {
        await createCard(data);
        await loadData();
        showAlert({
          title: "Card criado!",
          description: "O item foi adicionado ao kanban.",
          type: "success",
        });
        return true;
      } catch (error) {
        showAlert({
          title: "Erro",
          description: "Não foi possível criar o card.",
          type: "error",
        });
        return false;
      }
    },
    [showAlert, loadData]
  );

  const updateCardHandler = useCallback(
    async (id: string, data: Partial<KanbanCard>) => {
      try {
        await updateCard(id, data);
        await loadData();
        showAlert({
          title: "Card atualizado!",
          description: "As alterações foram salvas.",
          type: "success",
        });
        return true;
      } catch (error) {
        showAlert({
          title: "Erro",
          description: "Não foi possível atualizar o card.",
          type: "error",
        });
        return false;
      }
    },
    [showAlert, loadData]
  );

  const moveCardHandler = useCallback(
    async (id: string, status: KanbanStatus) => {
      // Atualização otimista para o board parecer instantâneo
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status } : c))
      );
      try {
        await updateCardStatus(id, status);
      } catch (error) {
        showAlert({
          title: "Erro",
          description: "Não foi possível mover o card.",
          type: "error",
        });
        await loadData();
      }
    },
    [showAlert, loadData]
  );

  const deleteCardHandler = useCallback(
    async (id: string) => {
      try {
        await deleteCard(id);
        await loadData();
        showAlert({
          title: "Card removido",
          description: "O item foi removido do kanban.",
          type: "success",
        });
      } catch (error) {
        showAlert({
          title: "Erro",
          description: "Não foi possível remover o card.",
          type: "error",
        });
      }
    },
    [showAlert, loadData]
  );

  return {
    cards,
    isLoading,
    reload: loadData,
    createCard: createCardHandler,
    updateCard: updateCardHandler,
    moveCard: moveCardHandler,
    deleteCard: deleteCardHandler,
  };
}
