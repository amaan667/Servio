type Verdict = { ok: true } | { ok: false; reason: string; suggest?: string };

const KW_PLATTER = /\b(PLATTER|MOUNTAIN|FEAST|COMBO|SHARING|RACK|WHOLE|THERMIDOR)\b/i;
const KW_BULK = /\b(18|20|24|50)\b/;
const KW_MAINS = /\b(RIBS|STEAK|SURF AND TURF|SEA BASS|LOBSTER)\b/i;

export function belongsToSection(
  section: string,
  name: string,
  desc: string | null,
  price: number
): Verdict {
  const s = section.toUpperCase();
  const text = `${name} ${desc ?? ""}`;
  const looksPlatter = KW_PLATTER.test(text) || KW_BULK.test(text);
  const looksMain = KW_MAINS.test(text);
  const startersMax = 14; // tune per venue type
  const highPrice = price >= startersMax;

  if (s === "STARTERS") {
    if (looksPlatter || looksMain || highPrice) {
      return { ok: false, reason: "too large/expensive for starters", suggest: "MAIN COURSES" };
    }
  }
  return { ok: true };
}
