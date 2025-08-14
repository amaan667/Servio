import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { MenuPayload, MenuPayloadT, MenuItem } from "./menuSchema";
import { findSections, sliceSection } from "./menuSections";
import { sectionPrompt } from "./prompts";
import { filterSectionItems } from "./sectionPost";
import { reassignMoved } from "./reassign";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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

// Soft normalization functions
function clampName(s: string) {
  return s.length <= 80 ? s : s.slice(0, 77) + '...';
}

function parsePriceAny(p: any) {
  if (typeof p === 'number') return p;
  const m = String(p||'').replace(',', '.').match(/(\d+(\.\d{1,2})?)/);
  return m ? Number(m[1]) : NaN;
}

function reassignCategory(it: any) {
  const t = (it.name||'').toUpperCase();
  if (/PLATTER|MOUNTAIN|THERMIDOR|RACK|SURF AND TURF|SEA BASS|RIBS/.test(t)) return 'MAIN COURSES';
  if (/FRIES|GARLIC BREAD|ONION RINGS|SIDE/.test(t)) return 'SIDES';
  return null;
}

async function callMenuTool(system: string, user: string) {
  console.log('[MENU PARSE] Calling menu tool with system prompt length:', system.length);
  console.log('[MENU PARSE] User prompt length:', user.length);

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
    console.error('[MENU PARSE] Model did not return tool_calls');
    throw new Error("Model did not return tool_calls.");
  }

  let args = call.function.arguments || "{}";
  console.log('[MENU PARSE] Tool arguments length:', args.length);
  console.log('[MENU PARSE] Tool arguments preview:', args.substring(0, 200));

  // Enhanced error handling for JSON parsing
  try {
    return JSON.parse(args);
  } catch (parseError) {
    console.log('[MENU PARSE] Initial parse failed, attempting jsonrepair...');
    console.log('[MENU PARSE] Raw arguments:', args);
    console.log('[MENU PARSE] Parse error:', parseError.message);
    
    try {
      const repaired = jsonrepair(args);
      console.log('[MENU PARSE] jsonrepair successful, length:', repaired.length);
      console.log('[MENU PARSE] Repaired JSON preview:', repaired.substring(0, 200));
      return JSON.parse(repaired);
    } catch (repairError) {
      console.error('[MENU PARSE] jsonrepair also failed:', repairError);
      console.error('[MENU PARSE] Failed arguments:', args);
      
      // Try to extract any valid JSON from the response
      const jsonMatch = args.match(/\{.*\}/s);
      if (jsonMatch) {
        try {
          console.log('[MENU PARSE] Attempting to extract JSON from response...');
          return JSON.parse(jsonMatch[0]);
        } catch (extractError) {
          console.error('[MENU PARSE] JSON extraction failed:', extractError);
        }
      }
      
      throw new Error(`Failed to parse tool arguments after repair. Original: ${args.substring(0, 100)}`);
    }
  }
}

export async function parseMenuInChunks(ocrText: string): Promise<MenuPayloadT> {
  console.log('[MENU PARSE] Starting enhanced section-based menu parsing...');
  console.log('[MENU PARSE] OCR text length:', ocrText.length);

  // 1) Find sections in OCR text
  const sections = findSections(ocrText);
  console.log('[MENU PARSE] Found sections:', sections.map(s => s.name));

  if (sections.length === 0) {
    console.log('[MENU PARSE] No sections found, falling back to old method');
    // Fallback to old method if no sections found
    return await parseMenuInChunksFallback(ocrText);
  }

  // 2) Process each section individually with strict windowing
  const itemsAll: any[] = [];
  const movedAll: any[] = [];
  let rawTotal = 0;

  for (const sec of sections) {
    const slice = sliceSection(ocrText, sec);
    console.log(`[MENU PARSE] Processing section "${sec.name}" (${slice.length} chars)`);

    try {
      const prompt = sectionPrompt(sec.name);
      const raw = await callMenuTool(prompt, slice);
      
      // A) Instrument the funnel (counts + reasons)
      console.log('[PARSE] found_raw', raw.items.length);
      rawTotal += raw.items.length;

      const tooLong = raw.items.filter((i: any) => (i.name||'').length > 80);
      console.log('[PARSE] drop_name_too_long', tooLong.length, tooLong.map((i: any) => i.name.slice(0,50)));

      const noPrice = raw.items.filter((i: any) => typeof i.price !== 'number' || isNaN(i.price));
      console.log('[PARSE] drop_no_price', noPrice.length, noPrice.map((i: any) => i.name));

      const afterBasic = raw.items.filter((i: any) => (i.name||'').length && typeof i.price === 'number' && !isNaN(i.price));
      console.log('[PARSE] basic_ok', afterBasic.length);

      const { kept, moved } = filterSectionItems(sec.name, afterBasic);
      console.log('[PARSE] kept_in_section', kept.length, 'moved_out', moved.length, moved.map((m: any) => ({ name: m.name, suggest: m.suggest||m.reason })));

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
      
      console.log(`[MENU PARSE] ${sec.name}: kept=${normalizedKept.length} reassigned=${reassigned.length}`);
    } catch (e) {
      console.warn(`[MENU PARSE] Section "${sec.name}" failed:`, e);
      // Continue with other sections instead of failing completely
    }
  }

  // C) Final processing and validation
  const finalItems = itemsAll.concat(movedAll);
  console.log('[DB] about_to_insert', finalItems.length);

  // D) Soft validation with transformation
  const validatedItems = finalItems.map((item: any, index: number) => ({
    name: clampName(item.name || 'Item'),
    description: item.description || null,
    price: parsePriceAny(item.price),
    category: item.category || 'Uncategorized',
    available: Boolean(item.available ?? true),
    order_index: Number.isFinite(item.order_index) ? item.order_index : index,
  })).filter((item: any) => !isNaN(item.price) && item.name.length > 0);

  console.log('[VERIFY] source_total', rawTotal, 'final_validated', validatedItems.length);

  // 5) Validate final shape
  const payload = { 
    items: validatedItems, 
    categories: sections.map(s => s.name) 
  };
  const validated = MenuPayload.parse(payload);
  
  console.log('[MENU PARSE] Final validation successful:', validated.items.length, 'items,', validated.categories.length, 'categories');
  return validated;
}

// Fallback method for when no sections are found
async function parseMenuInChunksFallback(ocrText: string): Promise<MenuPayloadT> {
  console.log('[MENU PARSE] Using fallback parsing method...');
  
  // Use the old method as fallback
  const system = [
    "You extract restaurant/cafe menus from OCR text.",
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
    "- Extract EVERY single menu item with a price - do not miss any.",
  ].join("\n");

  const user = `OCR TEXT:\n${sanitizeText(ocrText)}`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 4000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "";
  
  try {
    const parsed = JSON.parse(raw);
    const validated = MenuPayload.parse(parsed);
    console.log('[MENU PARSE] Fallback parsing successful:', validated.items.length, 'items');
    return validated;
  } catch (e) {
    console.error('[MENU PARSE] Fallback parsing failed:', e);
    throw new Error("Failed to parse menu with fallback method.");
  }
}
