import { getOpenAI } from "./openai";
import { z } from "zod";
import { MenuPayload, MenuPayloadT } from "./menuSchema";


export async function parseMenuStrict(extractedText: string): Promise<MenuPayloadT> {
  const openai = getOpenAI();
  const system = [
    "You extract venue menus from OCR text.",
    "Return ONLY a JSON object that matches the schema:",
    `{
      "items": [
        {"name": "string <=80", "description": "string|null", "price": number, "category": "string", "available": true, "order_index": number}
      ],
      "categories": ["string", "..."]
    }`,
    "Rules:",
    "- Preserve category names and menu order as they appear.",
    "- Include only items with prices; convert £/€ to numbers (no symbols).",
    "- No trailing commas; no extra fields; no prose.",
    "- Extract EVERY single menu item with a price - do not miss any.",
    "- Use exact category names from the menu: STARTERS, MAIN COURSES, DESSERTS, DRINKS, SALADS, etc.",
    "- Be extremely thorough - extract items from all sections.",
  ].join("\n");

  const user = `OCR TEXT:\n${extractedText}`;

  console.log('[MENU PARSE] Attempting strict JSON extraction...');

  // 1) Try strict JSON from the model
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" }, // forces valid JSON
    temperature: 0,
    max_tokens: 4000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "";
  console.log('[MENU PARSE] Raw response length:', raw.length);
  console.log('[MENU PARSE] Raw response preview:', raw.substring(0, 500));

  try {
    // Should be valid JSON by contract
    const parsed = JSON.parse(raw);
    const validated = MenuPayload.parse(parsed);
    console.log('[MENU PARSE] Successfully parsed and validated:', validated.items.length, 'items');
    return validated;
  } catch (e) {
    console.error('[MENU PARSE] Initial parse failed, attempting repair:', e);
    // Fallback to repair flow if something still goes wrong
    return await repairMenuJson(raw);
  }
}

function coarseFix(jsonish: string): string {
  console.log('[MENU PARSE] Attempting coarse fix...');
  
  // Trim junk around JSON and remove BOMs
  const start = jsonish.indexOf("{");
  const end = jsonish.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    console.log('[MENU PARSE] No valid JSON braces found');
    return jsonish;
  }
  let s = jsonish.slice(start, end + 1);

  // Common quick fixes
  s = s.replace(/\r/g, "");
  // Fix single smart quotes inside strings by keeping them (JSON allows apostrophes),
  // but ensure key quotes are standard double quotes (we assume model used them).
  // Remove dangling commas before closing brackets/braces
  s = s.replace(/,\s*([}\]])/g, "$1");
  
  console.log('[MENU PARSE] Coarse fix result length:', s.length);
  return s;
}

async function repairMenuJson(modelOutput: string) {
  console.log('[MENU PARSE] Starting repair process...');
  const openai = getOpenAI();
  
  const fixedAttempt = coarseFix(modelOutput);
  try {
    const parsed = JSON.parse(fixedAttempt);
    const validated = MenuPayload.parse(parsed);
    console.log('[MENU PARSE] Repair successful with coarse fix:', validated.items.length, 'items');
    return validated;
  } catch (e) {
    console.log('[MENU PARSE] Coarse fix failed, asking model to repair...');
    
    // Ask the model to repair to valid JSON exactly matching schema
    const repair = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content: "You fix malformed JSON to valid JSON that matches the exact schema. Return ONLY the JSON object, no prose.",
        },
        {
          role: "user",
          content: `Schema:\n${MenuPayload.toString()}\n\nMalformed JSON:\n${modelOutput}\n\nFix to valid JSON only.`,
        },
      ],
    });
    
    const content = repair.choices[0]?.message?.content ?? "{}";
    console.log('[MENU PARSE] Model repair response length:', content.length);
    
    try {
      const parsed = JSON.parse(content);
      const validated = MenuPayload.parse(parsed);
      console.log('[MENU PARSE] Model repair successful:', validated.items.length, 'items');
      return validated;
    } catch (finalError) {
      console.error('[MENU PARSE] All repair attempts failed:', finalError);
      throw new Error(`Failed to parse menu after all repair attempts: ${finalError}`);
    }
  }
}
