import { MenuPayloadT } from "./menuSchema";

const MAX_NAME = 80;
const MAX_DESC = 240;

function cleanStr(s: unknown) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeForInsert(payload: MenuPayloadT) {
  // sanitize first
  const items = (payload.items ?? []).map((it, _idx) => {
    const name = cleanStr(it.name).slice(0, MAX_NAME);
    const descriptionRaw = it.description == null ? null : cleanStr(it.description);
    const description = descriptionRaw ? descriptionRaw.slice(0, MAX_DESC) : null;

    const priceNum = Number(it.price);
    const price = Number.isFinite(priceNum) ? Math.round(priceNum * 100) / 100 : 0;

    const category = cleanStr(it.category);

    // Note: order_index column doesn't exist in database, so we don't include it
    // Items will be ordered by created_at timestamp instead

    return {
      name,
      description,
      price,
      category,
      available: Boolean(it.available ?? true),
    };
  });

  const categories = (payload.categories ?? []).map((c) => cleanStr(c)).filter(Boolean);

  return { items, categories };
}
