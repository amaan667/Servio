export function reassignMoved(moved: unknown[]) {
  return moved.map(m => {
    const t = (m.name||"").toUpperCase();
    if (/PLATTER|MOUNTAIN|THERMIDOR|RACK|SURF AND TURF/.test(t)) return { ...m, category: "MAIN COURSES" };
    if (/FRIES|GARLIC BREAD|ONION RINGS|SIDE/.test(t)) return { ...m, category: "SIDES" };
    return null;
  }).filter(Boolean);
}
