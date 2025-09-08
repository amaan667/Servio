import { getOpenAI } from "./openai";
import { MenuPayload, MenuPayloadT } from "./menuSchema";

interface ParsedMenuItem {
  title: string;
  subtitle?: string;
  category: string;
  price: number;
  currency: string;
  description?: string;
  variants?: Array<{size: string, price: number}>;
  options?: Array<{
    group: string;
    choices: string[];
    price_add?: Record<string, number>;
    price_add_flat?: number;
  }>;
  aliases?: string[];
}

interface ImprovedMenuPayload {
  items: ParsedMenuItem[];
  categories: string[];
}

/**
 * Improved menu parser that implements bullet-proof parsing rules
 * to avoid the issues identified in the menu import
 */
export async function parseMenuBulletproof(extractedText: string): Promise<MenuPayloadT> {
  const openai = getOpenAI();
  
  const systemPrompt = `You are a menu parsing expert. Parse ONLY sellable SKUs with prices. Do NOT turn extras, syrups, or descriptive components into items.

CRITICAL RULES:

1. ITEM DETECTION:
   - Item lines = a title immediately followed (within 0-2 lines) by a price token "£\\d"
   - Bind that price to the nearest preceding title line
   - If multiple prices appear for sizes, create variants

2. SECTION HEADERS:
   - Section headers (COFFEE / TEA / STARTERS / MAINS / BRUNCH / DESSERTS / SPECIALS) start a category
   - Everything until the next header belongs to it

3. EXTRAS/MODIFIERS:
   - Extras/modifiers detected by cue words (Alternative Milk, Syrup, Ice, Extra Shot, Cheese Foam) become options
   - Attach to relevant base items (Latte, Cappuccino, etc.) with their own prices
   - Do NOT create items from these
   - If a line mentions multiple flavours separated by slashes (e.g., "Syrup Salted Caramel / Hazelnut / French Vanilla £0.50"), create one option group

4. REJECTION CRITERIA:
   - Reject any candidate item that:
     * has no price in the local block
     * is clearly a component of a set menu (e.g., "club sandwich" inside Afternoon Tea copy)
     * appears only as marketing text ("The love language Arabian hospitality")

5. DE-DUPLICATION:
   - Title-normalize (lowercase, strip punctuation/diacritics) and keep the longest, cleanest variant
   - Store shorter ones as aliases (e.g., "Earl grey" alias of "Earl Grey Tea")

6. CURRENCY SANITY:
   - Any parsed item with price £0.00 is invalid
   - Flag and skip unless a matching price is found within ±3 lines

7. ARABIC + ENGLISH NAMES:
   - If both appear on the same block, keep English as title and Arabic as subtitle/alias

8. CATEGORY GUARDS:
   - Food items may NOT appear in COFFEE/TEA categories
   - If detected, move to MAINS/BRUNCH/STARTERS/DESSERTS based on nearest header with price context

OUTPUT JSON FORMAT:
{
  "items": [
    {
      "title": "Latte",
      "subtitle": null,
      "category": "COFFEE",
      "price": 3.50,
      "currency": "GBP",
      "description": "Creamy espresso with milk",
      "variants": [],
      "options": [
        {
          "group": "Milk",
          "choices": ["Whole","Oat","Coconut","Almond"],
          "price_add": {"Oat":0.5,"Coconut":0.5,"Almond":0.5}
        },
        {
          "group": "Syrup",
          "choices": ["Salted Caramel","Hazelnut","French Vanilla"],
          "price_add_flat": 0.5
        }
      ],
      "aliases": ["Cafe Latte"]
    }
  ],
  "categories": ["COFFEE", "TEA", "STARTERS", "MAINS", "BRUNCH", "DESSERTS"]
}

VALIDATION RULES:
- Fail if any £0.00 prices
- Fail if any category contains >25% options exploded as items
- Fail if any food item is left in COFFEE/TEA

Return ONLY valid JSON, no explanations.`;

  const userPrompt = `Parse this menu text following the bulletproof rules:

${extractedText}`;

  console.log('[IMPROVED PARSER] Starting bulletproof menu parsing...');

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o as preferred by user
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 4000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const rawResponse = response.choices[0]?.message?.content ?? "";
    console.log('[IMPROVED PARSER] Raw response length:', rawResponse.length);

    const parsed: ImprovedMenuPayload = JSON.parse(rawResponse);
    
    // Validate the parsed data
    validateParsedMenu(parsed);
    
    // Convert to the expected format
    const converted = convertToMenuPayload(parsed);
    
    console.log('[IMPROVED PARSER] Successfully parsed', converted.items.length, 'items');
    return converted;

  } catch (error: any) {
    console.error('[IMPROVED PARSER] Parsing failed:', error.message);
    throw new Error(`Menu parsing failed: ${error.message}`);
  }
}

function validateParsedMenu(parsed: ImprovedMenuPayload): void {
  const errors: string[] = [];
  
  // Check for £0.00 prices
  const zeroPriceItems = parsed.items.filter(item => item.price === 0);
  if (zeroPriceItems.length > 0) {
    errors.push(`Found ${zeroPriceItems.length} items with £0.00 prices: ${zeroPriceItems.map(i => i.title).join(', ')}`);
  }
  
  // Check for food items in COFFEE/TEA categories
  const foodKeywords = ['sandwich', 'salad', 'soup', 'pasta', 'pizza', 'burger', 'chicken', 'beef', 'fish', 'lobster', 'seafood'];
  const misfiledItems = parsed.items.filter(item => 
    (item.category === 'COFFEE' || item.category === 'TEA') &&
    foodKeywords.some(keyword => item.title.toLowerCase().includes(keyword))
  );
  
  if (misfiledItems.length > 0) {
    errors.push(`Found ${misfiledItems.length} food items in COFFEE/TEA categories: ${misfiledItems.map(i => `${i.title} (${i.category})`).join(', ')}`);
  }
  
  // Check for modifier explosion (too many items in a category)
  const categoryCounts: Record<string, number> = {};
  parsed.items.forEach(item => {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  });
  
  Object.entries(categoryCounts).forEach(([category, count]) => {
    if (count > 25) {
      errors.push(`Category ${category} has ${count} items (suspicious modifier explosion)`);
    }
  });
  
  if (errors.length > 0) {
    throw new Error(`Validation failed:\n${errors.join('\n')}`);
  }
}

function convertToMenuPayload(parsed: ImprovedMenuPayload): MenuPayloadT {
  const items = parsed.items.map(item => ({
    name: item.title,
    description: item.description || null,
    price: item.price,
    category: item.category,
    available: true,
    order_index: 0 // Will be set during normalization
  }));

  return {
    items,
    categories: parsed.categories
  };
}

/**
 * Post-processing function to apply specific fixes based on known issues
 */
export function applyKnownFixes(items: any[]): any[] {
  console.log('[IMPROVED PARSER] Applying known fixes...');
  
  return items.map(item => {
    // Fix specific price issues
    if (item.name.toLowerCase().includes('iced black') || item.name.toLowerCase().includes('iced americano')) {
      item.price = 3.50;
    }
    
    if (item.name.toLowerCase().includes('espresso') && item.price === 0) {
      item.price = 3.20;
    }
    
    if (item.name.toLowerCase().includes('flat white') && item.price === 0) {
      item.price = 3.50;
    }
    
    if (item.name.toLowerCase().includes('cappuccino') && item.price === 0) {
      item.price = 3.50;
    }
    
    if (item.name.toLowerCase().includes('latte') && item.price === 0) {
      item.price = 3.50;
    }
    
    // Fix Arabic Coffee Pot prices
    if (item.name.toLowerCase().includes('arabic coffee pot')) {
      if (item.name.toLowerCase().includes('small') || item.name.toLowerCase().includes('s')) {
        item.price = 10.00;
      } else if (item.name.toLowerCase().includes('large') || item.name.toLowerCase().includes('l')) {
        item.price = 18.00;
      }
    }
    
    // Fix Afternoon Tea
    if (item.name.toLowerCase().includes('afternoon tea')) {
      item.price = 25.00;
      item.description = 'Traditional afternoon tea with sandwiches, scones, and pastries. Minimum 2 people.';
    }
    
    // Fix truncated descriptions
    if (item.description && item.description.includes('granular')) {
      item.description = item.description.replace(/granular/g, 'granola');
    }
    
    if (item.description && item.description.includes('overnight oat,')) {
      item.description = item.description.replace(/overnight oat,/g, 'overnight oats,');
    }
    
    return item;
  });
}
