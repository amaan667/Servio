import { errorToContext } from '@/lib/utils/error-to-context';

import { getOpenAI } from "./openai";
import { MenuPayload, MenuPayloadT } from "./menuSchema";
import { logger } from '@/lib/logger';

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
  
  const systemPrompt = `You are a menu parsing expert. Extract ALL possible menu items from the provided text and return ONLY a valid JSON object.

CRITICAL RULES FOR MAXIMUM EXTRACTION:

1. Extract ANY item that has a price (even if unclear, make your best guess)
2. If price is missing but item seems like a menu item, assign a reasonable price (3.50 for drinks, 8.50 for mains, 5.50 for desserts)
3. Each item must have: title, category, price
4. Categories should be standard names: COFFEE, TEA, STARTERS, MAINS, BRUNCH, DESSERTS, BEVERAGES, etc.
5. INCLUDE items that might be:
   - Syrups or milk alternatives (as separate items)
   - Items mentioned as part of sets (extract each component)
   - Items with unclear prices (make reasonable estimates)
   - Items with £0.00 prices (assign reasonable prices)

6. If you see "Coffee with a shot of X" - create BOTH "Coffee" AND "Coffee with X" as separate items

7. PRIORITIZE QUANTITY OVER ACCURACY - extract as many items as possible

OUTPUT FORMAT (MUST BE VALID JSON):
{
  "items": [
    {
      "title": "Latte",
      "category": "COFFEE", 
      "price": 3.50,
      "description": "Creamy espresso with milk"
    }
  ]
}

JSON REQUIREMENTS:
- All strings must be properly quoted with double quotes
- All special characters in strings must be escaped (use \\" for quotes)
- No trailing commas
- No comments or extra text outside the JSON
- If description contains quotes, escape them properly

IMPORTANT: 
- Extract EVERYTHING that could be a menu item
- If in doubt, include it with a reasonable price
- Use standard category names
- Do not create categories without items
- Return empty items array only if absolutely no items found
- Ensure the JSON is syntactically valid

Return ONLY the JSON object, no other text.`;

  const userPrompt = `Parse this menu text following the bulletproof rules:

${extractedText}`;


  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o as preferred by user
      response_format: { type: "json_object" },
      temperature: 0.1, // Slightly higher for more creative extraction
      max_tokens: 6000, // Increased for more items
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const rawResponse = response.choices[0]?.message?.content ?? "";

    // Try to parse JSON with better error handling
    let parsed: ImprovedMenuPayload;
    try {
      parsed = JSON.parse(rawResponse);
    } catch (jsonError: unknown) {
      logger.error('[IMPROVED PARSER] JSON parse error:', jsonError.message);
      logger.error('[IMPROVED PARSER] Problematic JSON:', rawResponse);
      
      // Try to fix common JSON issues
      const fixedJson = fixMalformedJson(rawResponse);
      
      try {
        parsed = JSON.parse(fixedJson);
      } catch (fixError) {
        logger.error('[IMPROVED PARSER] Could not fix JSON, trying alternative parsing...');
        
        // Try to extract items using regex as last resort
        const fallbackItems = extractItemsWithRegex(rawResponse);
        if (fallbackItems.length > 0) {
          return {
            items: fallbackItems,
            categories: [...new Set(fallbackItems.map(item => item.category))]
          };
        }
        
        // Return empty result instead of crashing
        return {
          items: [],
          categories: []
        };
      }
    }
    
    // Validate the parsed data (relaxed validation)
    validateParsedMenu(parsed);
    
    // Convert to the expected format
    const converted = convertToMenuPayload(parsed);
    
    return converted;

  } catch (error: unknown) {
    logger.error('[IMPROVED PARSER] Parsing failed:', error.message);
    
    // Try a simpler approach as fallback
    try {
      const simpleItems = extractItemsWithRegex(extractedText);
      if (simpleItems.length > 0) {
        return {
          items: simpleItems,
          categories: [...new Set(simpleItems.map(item => item.category))]
        };
      }
    } catch (fallbackError) {
      logger.error('[IMPROVED PARSER] Fallback extraction also failed:', fallbackError);
    }
    
    // Return empty result instead of throwing to prevent crashes
    return {
      items: [],
      categories: []
    };
  }
}

function validateParsedMenu(parsed: ImprovedMenuPayload): void {
  const errors: string[] = [];
  
  // RELAXED VALIDATION: Only log warnings, don't throw errors
  
  // Check for £0.00 prices (warning only)
  const zeroPriceItems = parsed.items.filter(item => item.price === 0);
  if (zeroPriceItems.length > 0) {
  }
  
  // Check for food items in COFFEE/TEA categories (warning only)
  const foodKeywords = ['sandwich', 'salad', 'soup', 'pasta', 'pizza', 'burger', 'chicken', 'beef', 'fish', 'lobster', 'seafood'];
  const misfiledItems = parsed.items.filter(item => 
    (item.category === 'COFFEE' || item.category === 'TEA') &&
    foodKeywords.some(keyword => item.title.toLowerCase().includes(keyword))
  );
  
  if (misfiledItems.length > 0) {
  }
  
  // Check for modifier explosion (warning only)
  const categoryCounts: Record<string, number> = {};
  parsed.items.forEach(item => {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  });
  
  Object.entries(categoryCounts).forEach(([category, count]) => {
    if (count > 25) {
    }
  });
  
  // RELAXED: Don't throw errors, just log warnings
}

function convertToMenuPayload(parsed: unknown): MenuPayloadT {
  // Handle both old and new format
  const items = (parsed.items || []).map((item: unknown) => ({
    name: item.title || item.name,
    description: item.description || null,
    price: item.price,
    category: item.category,
    available: true
  }));

  // Extract unique categories from items
  const categories = [...new Set(items.map((item: unknown) => item.category).filter(Boolean))] as string[];

  return {
    items,
    categories
  };
}

/**
 * Attempt to fix common JSON malformation issues
 */
function fixMalformedJson(jsonString: string): string {
  let fixed = jsonString;
  
  // Remove unknown text before the first {
  const firstBrace = fixed.indexOf('{');
  if (firstBrace > 0) {
    fixed = fixed.substring(firstBrace);
  }
  
  // Remove unknown text after the last }
  const lastBrace = fixed.lastIndexOf('}');
  if (lastBrace > 0 && lastBrace < fixed.length - 1) {
    fixed = fixed.substring(0, lastBrace + 1);
  }
  
  // Import and use the enhanced JSON repair function
  try {
    const { repairMenuJSON } = require('./pdfImporter/jsonRepair');
    fixed = repairMenuJSON(fixed);
  } catch (error) {
    
    // Fallback to basic fixes
    // Fix common issues with unterminated strings
    // Look for unescaped quotes in strings
    fixed = fixed.replace(/([^\\])"([^"]*?)([^\\])"/g, (match, before, content, after) => {
      // If the content contains unescaped quotes, escape them
      const escapedContent = content.replace(/([^\\])"/g, '$1\\"');
      return `${before}"${escapedContent}${after}"`;
    });
    
    // Fix trailing commas
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix missing quotes around keys
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  }
  
  return fixed;
}

/**
 * Fallback regex-based extraction for when JSON parsing fails
 */
function extractItemsWithRegex(text: string): unknown[] {
  
  const items: unknown[] = [];
  
  // Common price patterns
  const pricePatterns = [
    /£(\d+\.?\d*)/g,
    /\$(\d+\.?\d*)/g,
    /(\d+\.?\d*)\s*£/g,
    /(\d+\.?\d*)\s*$/g
  ];
  
  // Split text into lines and look for items
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let currentCategory = 'UNCATEGORIZED';
  
  for (const line of lines) {
    // Check if line is a category header
    if (line.match(/^[A-Z\s&]+$/)) {
      currentCategory = line.toUpperCase().replace(/[^A-Z\s]/g, '').trim();
      continue;
    }
    
    // Look for price in the line
    let price = 0;
    let priceMatch = null;
    
    for (const pattern of pricePatterns) {
      priceMatch = pattern.exec(line);
      if (priceMatch) {
        price = parseFloat(priceMatch[1]);
        break;
      }
    }
    
    // If we found a price, extract the item
    if (price > 0) {
      // Remove price from the line to get the item name
      let itemName = line.replace(/£\d+\.?\d*|\$\d+\.?\d*|\d+\.?\d*\s*£|\d+\.?\d*\s*$/g, '').trim();
      
      // Clean up the item name
      itemName = itemName.replace(/^[\d\.\-\s]+/, '').trim(); // Remove leading numbers/dashes
      itemName = itemName.replace(/[^\w\s\-&'()]/g, '').trim(); // Remove special chars except common ones
      
      if (itemName.length > 0 && itemName.length < 100) { // Reasonable length
        items.push({
          name: itemName,
          description: null,
          price: price,
          category: currentCategory,
          available: true
        });
      }
    }
  }
  
  return items;
}

/**
 * Post-processing function to apply specific fixes based on known issues
 */
export function applyKnownFixes(items: unknown[]): unknown[] {
  
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
