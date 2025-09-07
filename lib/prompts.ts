export const sectionPrompt = (sectionName: string) => `
You extract menu items ONLY for the section "${sectionName}".

Return JSON:
{"items":[{"name":"string","description":"string|null","price":number,"category":"${sectionName}","available":true,"out_of_section":boolean,"reason":"string|null"}]}

Rules:
- Include ONLY items that clearly belong to "${sectionName}".
- CRITICAL: Only include items that have a clear price. If no price is visible, DO NOT include the item.
- Look for price patterns: £X.XX, €X.XX, $X.XX, or just numbers.
- If an item looks like a main/sharing platter (large quantities, "platter", "mountain", "50 prawns", "whole", "rack", "thermidor") or the price is unusually high for starters, set out_of_section=true with a short reason and KEEP category as "${sectionName}" (we will filter later).
- No invented items. Normalize price to a number (e.g., 7.5, 28, 64).
- DO NOT include items without prices - skip them entirely.

Counter-examples (mark these as out_of_section for "${sectionName}"):
- "WORLD FAMOUS Jimmy's Mountain of Killer Prawns" £59.00 → out_of_section=true (sharing platter)
- "LOBSTER THERMIDOR 700g 800g" £64.00 → out_of_section=true (whole lobster)
- "MILLIONAIRES PLATTER" £136.00 → out_of_section=true (platter)
- "JIMMY'S SAUCY PRAWNS (18 Medium Prawns)" £28.00 → out_of_section=true (quantity/main)

Only output JSON.`;
