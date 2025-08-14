export function classifyBelongs(section: string, name: string, desc: string | null, price: number) {
  const s = section.toUpperCase();
  const text = `${name} ${desc ?? ""}`.toUpperCase();

  // Heuristics
  const isLargeQuantity = /\b(18|20|24|50)\b/.test(text) || /\bPLATTER|SHARING|FEAST|COMBO|RACK|WHOLE\b/.test(text);
  const looksLikeMainByPrice = price >= 15;  // tweak per region
  const startersMax = 14;                    // tweak per venue type

  if (s === "STARTERS") {
    if (isLargeQuantity || looksLikeMainByPrice || price > startersMax) {
      return { ok: false, suggest: "MAIN COURSES", reason: "quantity/price too large for STARTERS" };
    }
  }

  if (s === "SALADS" && /\bRIBS|STEAK|PRAWN(?! COCKTAIL)\b/.test(text) && price >= 16) {
    return { ok: false, suggest: "MAIN COURSES", reason: "protein + mains price" };
  }

  // Add lightweight rules per section as needed…

  return { ok: true };
}
