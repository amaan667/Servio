import { errorToContext } from '@/lib/utils/error-to-context';

import { getOpenAI } from "./openai";
import { jsonrepair } from "jsonrepair";
import { MenuPayload, MenuPayloadT, MenuItem, clampName, parsePriceAny } from "./menuSchema";
import { findSections, sliceSection } from "./menuSections";
import { sectionPrompt } from "./prompts";
import { filterSectionItems } from "./sectionPost";
import { reassignMoved } from "./reassign";
import { logger } from '@/lib/logger';


const menuFunction = {
  type: "function" as const,
  function: {
    name: "return_menu",
    description: "Return structured menu data parsed from OCR text.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: ["string", "null"] },
              price: { type: "number" },
              category: { type: "string" },
              available: { type: "boolean" },
              order_index: { type: "integer" },
              out_of_section: { type: "boolean" },
              reason: { type: ["string", "null"] },
            },
            required: ["name", "price", "category", "available"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
};

function sanitizeText(s: string) {
  return s.replace(/\u0000/g, "").slice(0, 180_000);
}

function reassignCategory(it: any) {
  const t = (it.name||'').toUpperCase();
  if (/PLATTER|MOUNTAIN|THERMIDOR|RACK|SURF AND TURF|SEA BASS|RIBS/.test(t)) return 'MAIN COURSES';
  if (/FRIES|GARLIC BREAD|ONION RINGS|SIDE/.test(t)) return 'SIDES';
  return null;
}

async function callMenuTool(system: string, user: string) {

  const openai = getOpenAI();
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 4000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    tools: [menuFunction],
    tool_choice: { type: "function", function: { name: "return_menu" } },
  });

  const call = resp.choices[0]?.message?.tool_calls?.[0];
  if (!call) {
    logger.error('[MENU PARSE] Model did not return tool_calls');
    throw new Error("Model did not return tool_calls.");
  }

  let args = (call as any).function.arguments || "{}";

  // Enhanced error handling for JSON parsing
  try {
    return JSON.parse(args);
  } catch (parseError) {
    
    try {
      const repaired = jsonrepair(args);
      return JSON.parse(repaired);
    } catch (repairError) {
      logger.error('[MENU PARSE] jsonrepair also failed:', repairError);
      logger.error('[MENU PARSE] Failed arguments:', args);
      
      // Try to extract any valid JSON from the response
      const jsonMatch = args.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (extractError) {
          logger.error('[MENU PARSE] JSON extraction failed:', extractError);
        }
      }
      
      throw new Error(`Failed to parse tool arguments after repair. Original: ${args.substring(0, 100)}`);
    }
  }
}

export async function parseMenuInChunks(ocrText: string): Promise<MenuPayloadT> {

  // 1) Find sections in OCR text
  const sections = findSections(ocrText);

  if (sections.length === 0) {
    // Fallback to old method if no sections found
    return await parseMenuInChunksFallback(ocrText);
  }

  // 2) Process each section individually with strict windowing
  const itemsAll: any[] = [];
  const movedAll: any[] = [];
  let rawTotal = 0;

  for (const sec of sections) {
    const slice = sliceSection(ocrText, sec);

    try {
      const prompt = sectionPrompt(sec.name);
      const raw = await callMenuTool(prompt, slice);
      
      // A) Instrument the funnel (counts + reasons)
      rawTotal += raw.items.length;

      const tooLong = raw.items.filter((i: any) => (i.name||'').length > 80);

      const noPrice = raw.items.filter((i: any) => typeof i.price !== 'number' || isNaN(i.price) || i.price === 0);

      const afterBasic = raw.items.filter((i: any) => (i.name||'').length && typeof i.price === 'number' && !isNaN(i.price) && i.price > 0);

      const { kept, moved } = filterSectionItems(sec.name, afterBasic);

      // B) Soft-normalize instead of reject
      const normalizedKept = kept.map((item: any) => ({
        ...item,
        name: clampName(item.name || 'Item'),
        price: parsePriceAny(item.price),
        category: sec.name
      })).filter((item: any) => !isNaN(item.price));

      const reassigned = moved.map((m: any) => {
        const newCategory = reassignCategory(m);
        return newCategory ? { ...m, category: newCategory, name: clampName(m.name || 'Item'), price: parsePriceAny(m.price) } : null;
      }).filter((m: any) => m && !isNaN(m.price));

      itemsAll.push(...normalizedKept);
      movedAll.push(...reassigned);
      
    } catch (e) {
      logger.warn(`[MENU PARSE] Section "${sec.name}" failed:`, errorToContext(e));
      // Continue with other sections instead of failing completely
    }
  }

  // C) Final processing and validation
  const finalItems = itemsAll.concat(movedAll);

  // D) Soft validation with transformation
  const validatedItems = finalItems.map((item: any, index: number) => ({
    name: clampName(item.name || 'Item'),
    description: item.description || null,
    price: parsePriceAny(item.price),
    category: item.category || 'Uncategorized',
    available: Boolean(item.available ?? true),
    order_index: Number.isFinite(item.order_index) ? item.order_index : index,
  })).filter((item: any) => !isNaN(item.price) && item.price > 0 && item.name.length > 0);


  // 5) Validate final shape
  const payload = { 
    items: validatedItems, 
    categories: sections.map(s => s.name) 
  };
  const validated = MenuPayload.parse(payload);
  
  return validated;
}

// Fallback method for when no sections are found
async function parseMenuInChunksFallback(ocrText: string): Promise<MenuPayloadT> {
  
  // Enhanced fallback method that tries to extract more items
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
    "- MANDATORY: Read the PDF from TOP TO BOTTOM and list categories in that exact sequence.",
    "- DO NOT alphabetize or reorder categories - maintain PDF layout order.",
    "- UNIVERSAL: This works for any menu structure - preserve whatever order the PDF shows.",
    "- CRITICAL: Only include items with clear prices. If no price is visible, DO NOT include the item.",
    "- Look for price patterns like £X.XX, €X.XX, $X.XX, or just numbers.",
    "- Extract EVERY single menu item with a price - do not miss any.",
    "- If no clear categories exist, group items logically (e.g., 'FOOD', 'DRINKS').",
    "- Be thorough - extract ALL items with prices, even if they seem incomplete.",
    "- For items without clear categories, assign a default category based on context.",
    "- DO NOT include items without prices - skip them entirely.",
    "- IMPORTANT: If the menu shows 'STARTERS' first, then 'MAINS', then 'DESSERTS', the categories array should be ['STARTERS', 'MAINS', 'DESSERTS'] in that exact order.",
  ].join("\n");

  const user = `OCR TEXT:\n${sanitizeText(ocrText)}`;

  const openai = getOpenAI();
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 8000, // Increased token limit for larger menus
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "";
  
  try {
    const parsed = JSON.parse(raw);
    const validated = MenuPayload.parse(parsed);
    return validated;
  } catch (e) {
    logger.error('[MENU PARSE] Fallback parsing failed:', errorToContext(e));
    throw new Error("Failed to parse menu with fallback method.");
  }
}
