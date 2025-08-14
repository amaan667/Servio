import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { MenuPayload, MenuPayloadT, MenuItem } from "./menuSchema";

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
            },
            required: ["name", "price", "category", "available"],
            additionalProperties: false,
          },
        },
        categories: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["items", "categories"],
      additionalProperties: false,
    },
  },
};

function sanitizeText(s: string) {
  // Make the OCR a bit safer for prompts
  return s.replace(/\u0000/g, "").slice(0, 180_000); // keep under ~180k chars
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
    tool_choice: { type: "function", function: { name: "return_menu" } }, // force tool
  });

  const call = resp.choices[0]?.message?.tool_calls?.[0];
  if (!call) {
    console.error('[MENU PARSE] Model did not return tool_calls');
    throw new Error("Model did not return tool_calls.");
  }

  let args = call.function.arguments || "{}";
  console.log('[MENU PARSE] Tool arguments length:', args.length);
  console.log('[MENU PARSE] Tool arguments preview:', args.substring(0, 200));

  // Quick repair if any weirdness
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

export async function extractCategories(ocrText: string): Promise<string[]> {
  console.log('[MENU PARSE] Extracting categories from OCR text...');
  
  const system = [
    "You extract category headings from a restaurant/cafe menu OCR.",
    "Return categories in reading order. Use exact headings from the text.",
    "Look for section headers like STARTERS, MAIN COURSES, DESSERTS, DRINKS, SALADS, etc.",
  ].join("\n");
  const user = `OCR TEXT:\n${sanitizeText(ocrText)}\nReturn via the function. items may be empty; categories must be filled.`;

  const out = await callMenuTool(system, user);
  const categories: string[] = Array.isArray(out?.categories) ? out.categories : [];
  const filtered = categories.filter(Boolean).map((c: string) => c.trim());
  
  console.log('[MENU PARSE] Extracted categories:', filtered);
  return filtered;
}

export async function extractItemsForCategory(ocrText: string, category: string, catIndex: number): Promise<MenuPayloadT["items"]> {
  console.log(`[MENU PARSE] Extracting items for category: "${category}" (index: ${catIndex})`);
  
  const system = [
    "You extract menu items with prices from OCR text for ONE category.",
    "Only return items belonging to the requested category heading.",
    "Preserve item order as in the text. Use numbers for price with no symbols.",
    "Extract EVERY single menu item with a price - do not miss any.",
    "Include items even if description is missing.",
  ].join("\n");

  const user = [
    `OCR TEXT (snippet may include other categories):\n${sanitizeText(ocrText)}`,
    `Target category: "${category}" (category_index=${catIndex}).`,
    "Return only items of this category via the function. categories can include just this category.",
  ].join("\n\n");

  const out = await callMenuTool(system, user);

  // Basic normalization & order_index fill
  const items = Array.isArray(out?.items) ? out.items : [];
  const normalized = items.map((it: any, i: number) => ({
    name: String(it.name ?? "").trim(),
    description: it.description ?? null,
    price: Number(it.price ?? 0),
    category,
    available: Boolean(it.available ?? true),
    order_index: Number.isFinite(it.order_index) ? it.order_index : i,
  }));

  console.log(`[MENU PARSE] Extracted ${normalized.length} items for category "${category}"`);
  return normalized;
}

export async function parseMenuInChunks(ocrText: string): Promise<MenuPayloadT> {
  console.log('[MENU PARSE] Starting chunked menu parsing...');
  console.log('[MENU PARSE] OCR text length:', ocrText.length);

  // 1) Get categories
  let cats = await extractCategories(ocrText);
  if (!cats.length) {
    console.log('[MENU PARSE] No categories found, using fallback "Menu" category');
    // fallback: ask for items globally
    cats = ["Menu"];
  }

  // 2) Collect items per category (chunked)
  const allItems: MenuPayloadT["items"] = [];
  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i];
    try {
      const items = await extractItemsForCategory(ocrText, cat, i);
      allItems.push(...items);
    } catch (e) {
      console.warn(`[MENU PARSE] Category "${cat}" failed:`, e);
      // continue other categories
    }
  }

  console.log('[MENU PARSE] Total items collected:', allItems.length);

  // 3) Sanitize names before validation to prevent 80-char limit errors
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
  const payload = { items: sanitizedItems, categories: cats };
  const validated = MenuPayload.parse(payload);
  
  console.log('[MENU PARSE] Final validation successful:', validated.items.length, 'items,', validated.categories.length, 'categories');
  return validated;
}
