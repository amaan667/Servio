import { errorToContext } from '@/lib/utils/error-to-context';

import { getOpenAI } from "./openai";
import { z } from "zod";
import { MenuPayload, MenuPayloadT } from "./menuSchema";
import { logger } from '@/lib/logger';


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
    "- CRITICAL: Preserve the EXACT order of categories as they appear in the menu from top to bottom.",
    "- The 'categories' array must list categories in the same order they appear in the PDF.",
    "- MANDATORY: Read the PDF from top to bottom and list categories in that exact sequence.",
    "- DO NOT alphabetize or reorder categories - maintain PDF layout order.",
    "- UNIVERSAL: This works for unknown menu structure - preserve whatever order the PDF shows.",
    "- Include only items with prices; convert £/€ to numbers (no symbols).",
    "- No trailing commas; no extra fields; no prose.",
    "- Extract EVERY single menu item with a price - do not miss unknown.",
    "- Use exact category names from the menu: STARTERS, MAIN COURSES, DESSERTS, DRINKS, SALADS, etc.",
    "- Be extremely thorough - extract items from all sections.",
    "- IMPORTANT: If the menu shows 'STARTERS' first, then 'MAINS', then 'DESSERTS', the categories array should be ['STARTERS', 'MAINS', 'DESSERTS'] in that exact order.",
  ].join("\n");

  const user = `OCR TEXT:\n${extractedText}`;


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

  try {
    // Should be valid JSON by contract
    const parsed = JSON.parse(raw);
    const validated = MenuPayload.parse(parsed);
    return validated;
  } catch (e) {
    logger.error('[MENU PARSE] Initial parse failed, attempting repair:', errorToContext(e));
    // Fallback to repair flow if something still goes wrong
    return await repairMenuJson(raw);
  }
}

function coarseFix(jsonish: string): string {
  
  // Trim junk around JSON and remove BOMs
  const start = jsonish.indexOf("{");
  const end = jsonish.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return jsonish;
  }
  let s = jsonish.slice(start, end + 1);

  // Common quick fixes
  s = s.replace(/\r/g, "");
  // Fix single smart quotes inside strings by keeping them (JSON allows apostrophes),
  // but ensure key quotes are standard double quotes (we assume model used them).
  // Remove dangling commas before closing brackets/braces
  s = s.replace(/,\s*([}\]])/g, "$1");
  
  return s;
}

async function repairMenuJson(modelOutput: string) {
  const openai = getOpenAI();
  
  const fixedAttempt = coarseFix(modelOutput);
  try {
    const parsed = JSON.parse(fixedAttempt);
    const validated = MenuPayload.parse(parsed);
    return validated;
  } catch (e) {
    
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
    
    try {
      const parsed = JSON.parse(content);
      const validated = MenuPayload.parse(parsed);
      return validated;
    } catch (finalError) {
      logger.error('[MENU PARSE] All repair attempts failed:', finalError);
      throw new Error(`Failed to parse menu after all repair attempts: ${finalError}`);
    }
  }
}
