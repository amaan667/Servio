import { MenuPayloadT } from "./menuSchema";

export function normalizeForInsert(payload: MenuPayloadT) {
  const items = payload.items.map((it, idx) => ({
    name: it.name.trim(),
    description: (it.description ?? null) || null,
    category: it.category.trim(),
    price: Number.isFinite(it.price) ? Number(it.price) : 0,
    available: it.available ?? true,
    order_index: Number.isFinite(it.order_index!) ? it.order_index! : idx,
  }));
  const categories = payload.categories.map((c) => c.trim());
  return { items, categories };
}
