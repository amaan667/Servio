import { belongsToSection } from "./validators";

export function filterSectionItems(section: string, items: any[]) {
  const kept: any[] = [];
  const moved: any[] = [];
  for (const it of items) {
    const price = Number(it.price);
    const verdict = belongsToSection(section, it.name||"", it.description||null, isFinite(price)?price:0);
    if (it.out_of_section || verdict.ok === false) {
      moved.push({ ...it, suggest: (verdict as any).suggest ?? null, reason: it.reason ?? (verdict as any).reason });
      continue;
    }
    kept.push({ ...it, category: section });
  }
  return { kept, moved };
}
