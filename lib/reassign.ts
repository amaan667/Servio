const CANON = ["STARTERS","SALADS","MAIN COURSES","KILLER COMBOS","KILLER GRILLS","WORLD KITCHEN","PASTA KITCHEN","SIDES","SOUPS","DESSERTS","BEVERAGES","WEEKLY SPECIALS"];

export function guessTargetCategory(moved: {name: string; reason?: string}[]) {
  // very simple keyword map
  return moved.map(m => {
    const t = m.name.toUpperCase();
    if (/RIBS|STEAK|SURF AND TURF|PLATTER|COMBO|SEAFOOD MIX/.test(t)) return "MAIN COURSES";
    if (/FRIES|SIDES?|ONION RINGS|GARLIC BREAD/.test(t)) return "SIDES";
    if (/MOCKTAIL|SOFT DRINK|WATER|JUICE|SHAKE/.test(t)) return "BEVERAGES";
    return null;
  });
}
