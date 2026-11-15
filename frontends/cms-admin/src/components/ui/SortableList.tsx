"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import { restrictToParentElement } from "./dnd-modifiers";
import { CSS } from "@dnd-kit/utilities";
import { LuGripVertical } from "react-icons/lu";

export interface DragHandle {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
}

/**
 * A list you can reorder by dragging the handle (or with the keyboard: Space, arrows, Space).
 * `onReorder` gets the new order of ids.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  layout = "list",
  className = "",
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  renderItem: (item: T, handle: DragHandle, index: number) => ReactNode;
  layout?: "list" | "grid";
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToParentElement]}>
      <SortableContext items={items.map((i) => i.id)} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => renderItem(item, handle, index)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: DragHandle) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative ${isDragging ? "z-10 opacity-90 [&>*]:shadow-[0_20px_50px_-20px_var(--pop-shadow)]" : ""}`}
    >
      {children({ attributes, listeners })}
    </li>
  );
}

/** The grip button that starts a drag. */
export function DragGrip({ handle, label = "Drag to reorder" }: { handle: DragHandle; label?: string }) {
  return (
    <button
      type="button"
      {...handle.attributes}
      {...handle.listeners}
      aria-label={label}
      title={label}
      className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-faint transition-colors hover:bg-tint/[0.06] hover:text-fg active:cursor-grabbing"
    >
      <LuGripVertical className="size-4" />
    </button>
  );
}
