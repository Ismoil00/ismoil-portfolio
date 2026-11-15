import type { Modifier } from "@dnd-kit/core";

/** Keeps a dragged item inside its list (the official @dnd-kit/modifiers helper, without the extra package). */
export const restrictToParentElement: Modifier = ({ containerNodeRect, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !containerNodeRect) return transform;
  const x = Math.min(
    Math.max(transform.x, containerNodeRect.left - draggingNodeRect.left),
    containerNodeRect.right - draggingNodeRect.right,
  );
  const y = Math.min(
    Math.max(transform.y, containerNodeRect.top - draggingNodeRect.top),
    containerNodeRect.bottom - draggingNodeRect.bottom,
  );
  return { ...transform, x, y };
};
