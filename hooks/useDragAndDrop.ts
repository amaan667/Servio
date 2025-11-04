/**
 * Custom Hook: useDragAndDrop
 * Extracted from MenuManagementClient.tsx
 * Manages drag and drop operations for menu items
 */

import { useState, useCallback } from "react";
import { DropResult } from "@hello-pangea/dnd";
import { logger } from "@/lib/logger";

interface MenuItem {
  id: string;
  position?: number;
  [key: string]: unknown;
}

export function useDragAndDrop<T extends MenuItem>(
  items: T[],
  onReorder: (items: T[]) => Promise<{ success: boolean; error?: unknown }>
) {
  const [draggedItem, setDraggedItem] = useState<T | null>(null);
  const [draggedOverItem, setDraggedOverItem] = useState<T | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const handleDragStart = useCallback((item: T) => {
    setDraggedItem(item);
  }, []);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;

      // Reset drag state
      setDraggedItem(null);
      setDraggedOverItem(null);

      // No destination = drag cancelled
      if (!destination) {
        return;
      }

      // Same position = no change
      if (destination.droppableId === source.droppableId && destination.index === source.index) {
        return;
      }

      try {
        setIsReordering(true);

        // Create new array with reordered items
        const newItems = Array.from(items);
        const [removed] = newItems.splice(source.index, 1);
        newItems.splice(destination.index, 0, removed);

        // Update positions
        const reorderedItems = newItems.map((item, index) => ({
          ...item,
          position: index,
        }));

        // Save to database
        const result = await onReorder(reorderedItems);

        if (!result.success) {
          logger.error("Failed to reorder items", { error: result.error });
          throw result.error;
        }
      } catch (error) {
        logger.error("Error reordering items", { error });
        // Could show toast notification here
      } finally {
        setIsReordering(false);
      }
    },
    [items, onReorder]
  );

  const handleDragUpdate = useCallback(
    (update: unknown) => {
      // Optional: Handle drag updates for visual feedback
      const dragUpdate = update as { draggableId?: string };
      if (dragUpdate.draggableId) {
        const item = items.find((i) => i.id === dragUpdate.draggableId);
        if (item) {
          setDraggedOverItem(item);
        }
      }
    },
    [items]
  );

  return {
    draggedItem,
    draggedOverItem,
    isReordering,
    handleDragStart,
    handleDragEnd,
    handleDragUpdate,
  };
}
