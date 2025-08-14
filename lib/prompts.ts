export const sectionPrompt = (sectionName: string, neighborHints?: { prev?: string; next?: string }) => `
You extract menu items ONLY for the section: "${sectionName}".
Return JSON with EXACT schema:

{
  "items": [
    {
      "name": "string",
      "description": "string|null",
      "price": number,
      "category": "string",        // MUST equal "${sectionName}"
      "available": true,
      "out_of_section": boolean,   // true if it looks like it belongs to another section
      "reasons": "string|null"     // brief reason if out_of_section
    }
  ]
}

Rules:
- Include ONLY items that clearly belong to "${sectionName}".
- If a line looks like a different course (e.g., platter, 18 prawns, rack of ribs, mains-level pricing),
  set out_of_section=true and explain in reasons.
- Price extraction: normalize like 7.50 or 25.95 (GBP, no symbols).
- Do NOT invent items. Skip headings or marketing text.

Hints:
Prev section: ${neighborHints?.prev ?? "n/a"}
Next section: ${neighborHints?.next ?? "n/a"}
`;
