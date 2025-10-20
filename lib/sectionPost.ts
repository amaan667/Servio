import { belongsToSection } from "./validators";

export function filterSectionItems(section: string, items: unknown[]) {
  const kept: unknown[] = [];
  const moved: unknown[] = [];
  for (const it of items) {
    const price = Number(it.price);
    const verdict = belongsToSection(section, it.name||"", it.description||null, isFinite(price)?price:0);
    if (it.out_of_section || verdict.ok === false) {
      moved.push({ ...it, suggest: (verdict as unknown).suggest ?? null, reason: it.reason ?? (verdict as unknown).reason });
      continue;
    }
    kept.push({ ...it, category: section });
  }
  return { kept, moved };
}
