export type Section = { name: string; start: number; end: number };

const HEADINGS = [
  "STARTERS","SALADS","MAIN COURSES","KILLER COMBOS","KILLER GRILLS",
  "WORLD KITCHEN","PASTA KITCHEN","SIDES","SOUPS","DESSERTS",
  "BEVERAGES","WEEKLY SPECIALS"
];
const HEADING_RX = new RegExp(
  `\\b(${HEADINGS.map(h=>h.replace(/\s+/g,"\\s+")).join("|")})\\b`,
  "gi"
);

export function findSections(ocr: string): Section[] {
  const hits: { name: string; idx: number }[] = [];
  let m; while ((m = HEADING_RX.exec(ocr)) !== null) {
    hits.push({ name: m[1].replace(/\s+/g," ").toUpperCase(), idx: m.index });
  }
  hits.sort((a,b)=>a.idx-b.idx);
  const out: Section[] = [];
  for (let i=0;i<hits.length;i++){
    out.push({ name: hits[i].name, start: hits[i].idx, end: i+1<hits.length? hits[i+1].idx : ocr.length});
  }
  return out;
}
export const sliceSection = (ocr: string, s: Section) => ocr.slice(s.start, s.end);
