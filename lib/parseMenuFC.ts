import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { MenuPayload, MenuPayloadT, MenuItem } from "./menuSchema";
import { findSections, sliceSection } from "./menuSections";
import { sectionPrompt } from "./prompts";
import { keepOnlyBelongingItems } from "./sectionPostProcess";

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
              reasons: { type: ["string", "null"] },
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

  try {
    return JSON.parse(args);
  } catch (parseError) {
    console.log('[MENU PARSE] Initial parse failed, attempting jsonrepair...');
    try {
      const repaired = jsonrepair(args);
      console.log('[MENU PARSE] jsonrepair successful, length:', repaired.length);
      return JSON.parse(repaired);
    } catch (repairError) {
      console.error('[MENU PARSE] jsonrepair also failed:', repairError);
      throw new Error("Failed to parse tool arguments after repair.");
    }
  }
}

export async function parseMenuInChunks(ocrText: string): Promise<MenuPayloadT> {
  console.log('[MENU PARSE] Starting section-based menu parsing...');
  console.log('[MENU PARSE] OCR text length:', ocrText.length);

  // 1) Find sections in OCR text
  const sections = findSections(ocrText);
  console.log('[MENU PARSE] Found sections:', sections.map(s => s.name));

  if (sections.length === 0) {
    console.log('[MENU PARSE] No sections found, falling back to old method');
    // Fallback to old method if no sections found
    return await parseMenuInChunksFallback(ocrText);
  }

  // 2) Process each section individually
  const allItems: MenuPayloadT["items"] = [];
  const movedAll: any[] = [];

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const prev = sections[i - 1]?.name;
    const next = sections[i + 1]?.name;
    const slice = sliceSection(ocrText, sec);

    console.log(`[MENU PARSE] Processing section "${sec.name}" (${slice.length} chars)`);

    try {
      const prompt = sectionPrompt(sec.name, { prev, next });
      const raw = await callMenuTool(prompt, slice);

      const { kept, moved } = keepOnlyBelongingItems(sec.name, raw.items ?? []);
      allItems.push(...kept);
      movedAll.push(...moved);

      console.log(`[MENU PARSE] ${sec.name}: kept ${kept.length}, moved ${moved.length}`);
    } catch (e) {
      console.warn(`[MENU PARSE] Section "${sec.name}" failed:`, e);
    }
  }

  if (movedAll.length) {
    console.warn("[MENU PARSE] Items moved due to misclassification:", movedAll.slice(0, 5));
  }

  // 3) Sanitize names before validation
  const sanitizedItems = allItems.map(item => {
    const originalName = item.name;
    const sanitizedName = item.name.length > 80
      ? item.name.slice(0, 77).trim() + "..."
      : item.name;
    
    if (originalName !== sanitizedName) {
      console.log(`[MENU PARSE] Truncated long name: "${originalName}" -> "${sanitizedName}"`);
    }
    
    return {
      ...item,
      name: sanitizedName
    };
  });

  // 4) Validate final shape
  const payload = { 
    items: sanitizedItems, 
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
