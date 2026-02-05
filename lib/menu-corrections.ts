/**
 * Apply user corrections to menu items (by menu_item_id or item name match).
 * Used at display time (getPublicMenuFull) and at extraction time to train the system
 * (re-extraction respects past corrections by item name).
 */

/**
 * Train the system: apply stored corrections to extracted items (by item name) before insert.
 * When user re-extracts, past corrections override extracted values so the DB stores corrected data.
 */
export function applyCorrectionsToExtractedItems<T extends { name: string; description?: string; price?: number; category?: string; image_url?: string }>(
  items: T[],
  corrections: CorrectionRow[]
): T[] {
  if (corrections.length === 0) return items;
  const byItemName = new Map<string, CorrectionRow[]>();
  for (const c of corrections) {
    if (c.item_name?.trim()) {
      const key = c.item_name.toLowerCase().trim();
      const list = byItemName.get(key) ?? [];
      list.push(c);
      byItemName.set(key, list);
    }
  }
  return items.map((item) => {
    const list = byItemName.get(item.name?.toLowerCase().trim() ?? "") ?? [];
    if (list.length === 0) return item;
    const out = { ...item };
    for (const c of list) {
      if (c.field === "name" && c.value_text != null) out.name = c.value_text;
      if (c.field === "description" && c.value_text != null) out.description = c.value_text;
      if (c.field === "price" && c.value_number != null) out.price = c.value_number;
      if (c.field === "category" && c.value_text != null) out.category = c.value_text;
      if (c.field === "image_url" && c.value_text != null) out.image_url = c.value_text;
    }
    return out;
  });
}

export interface MenuItemForCorrection {
  id: string;
  name: string;
  description?: string | null;
  price?: number;
  category?: string | null;
  image_url?: string | null;
  [key: string]: unknown;
}

export interface CorrectionRow {
  menu_item_id: string | null;
  item_name: string | null;
  field: string;
  value_text: string | null;
  value_number: number | null;
}

export function applyCorrections(
  items: MenuItemForCorrection[],
  corrections: CorrectionRow[]
): MenuItemForCorrection[] {
  if (corrections.length === 0) return items;

  const byItemId = new Map<string, CorrectionRow[]>();
  const byItemName = new Map<string, CorrectionRow[]>();
  for (const c of corrections) {
    if (c.menu_item_id) {
      const list = byItemId.get(c.menu_item_id) ?? [];
      list.push(c);
      byItemId.set(c.menu_item_id, list);
    }
    if (c.item_name?.trim()) {
      const key = c.item_name.toLowerCase().trim();
      const list = byItemName.get(key) ?? [];
      list.push(c);
      byItemName.set(key, list);
    }
  }

  return items.map((item) => {
    const byId = byItemId.get(item.id) ?? [];
    const byName = byItemName.get(item.name?.toLowerCase().trim() ?? "") ?? [];
    const all = [...byId, ...byName];
    if (all.length === 0) return item;

    const out = { ...item };
    for (const c of all) {
      if (c.field === "name" && c.value_text != null) out.name = c.value_text;
      if (c.field === "description" && c.value_text != null) out.description = c.value_text;
      if (c.field === "price" && c.value_number != null) out.price = c.value_number;
      if (c.field === "category" && c.value_text != null) out.category = c.value_text;
      if (c.field === "image_url" && c.value_text != null) out.image_url = c.value_text;
    }
    return out;
  });
}
