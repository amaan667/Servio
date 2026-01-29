/**
 * Small helpers for reordering arrays (e.g. drag-and-drop lists).
 *
 * Centralising this logic keeps DnD handlers concise while still being
 * defensive against out-of-range indices.
 */

export function reorderList<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || fromIndex >= items.length) return items;
  if (toIndex < 0 || toIndex > items.length) return items;

  const next = Array.from(items);
  const [removed] = next.splice(fromIndex, 1);
  if (removed === undefined) return items;
  next.splice(toIndex, 0, removed);
  return next;
}
