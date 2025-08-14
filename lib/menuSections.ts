export type Section = { name: string; start: number; end: number };

const HEADING_RX = /(SALADS|STARTERS|KILLER\s+Combos|KILLER\s+Grills|WORLD\s+Kitchen|PASTA\s+Kitchen|SIDES|SOUPS|DESSERTS|BEVERAGES|WEEKLY\s+SPECIALS)\b/gi;

export function findSections(ocr: string): Section[] {
  const hits: { name: string; idx: number }[] = [];
  let m;
  while ((m = HEADING_RX.exec(ocr)) !== null) {
    hits.push({ name: m[1].replace(/\s+/g, " ").toUpperCase(), idx: m.index });
  }
  hits.sort((a, b) => a.idx - b.idx);
  const sections: Section[] = [];
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].idx;
    const end = i + 1 < hits.length ? hits[i + 1].idx : ocr.length;
    sections.push({ name: hits[i].name, start, end });
  }
  return sections;
}

export function sliceSection(ocr: string, s: Section) {
  return ocr.slice(s.start, s.end);
}
