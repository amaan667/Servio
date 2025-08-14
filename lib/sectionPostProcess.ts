import { classifyBelongs } from "./validators";

export function keepOnlyBelongingItems(sectionName: string, items: any[]) {
  const kept: any[] = [];
  const moved: any[] = [];
  const dropped: any[] = [];

  for (const it of items) {
    const belongs = classifyBelongs(sectionName, it.name ?? "", it.description ?? null, Number(it.price));
    if (it.out_of_section === true || belongs.ok === false) {
      moved.push({ ...it, target: belongs.suggest ?? null, reason: it.reasons ?? belongs.reason ?? "model/out-of-section" });
      continue;
    }
    kept.push({ ...it, category: sectionName });
  }

  return { kept, moved, dropped }; // (dropped reserved if you want a third path)
}
