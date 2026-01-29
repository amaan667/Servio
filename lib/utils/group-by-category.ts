/**
 * Utility helpers for grouping menu-like items by category.
 *
 * Many components render menu items grouped by `category`. This helper
 * centralizes the common reduce logic so components stay lean and consistent.
 */

export type Categorizable = {
  category?: string | null;
};

/**
 * Group items by their `category` field.
 *
 * - Normalizes missing categories to an empty string.
 * - Keeps insertion order for categories (callers can sort keys if needed).
 */
export function groupByCategory<T extends Categorizable>(items: T[]): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const cat = item.category ?? "";
    const arr = acc[cat] ?? [];
    arr.push(item);
    acc[cat] = arr;
    return acc;
  }, {});
}
