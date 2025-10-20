// =====================================================
// ROBUST GPT PROMPTS FOR MENU EXTRACTION
// =====================================================
// Generates clean, valid JSON with strict formatting rules

/**
 * Main prompt for menu extraction with strict JSON formatting
 */
export const MENU_EXTRACTION_PROMPT = `You are a strict JSON generator for a restaurant menu importer.

### Rules:
1. Output **only valid JSON** that can be parsed by \`JSON.parse()\` with no errors.
2. The root must be:
   {
     "items": [
       {
         "title": string,
         "category": string,
         "price": number,
         "currency": "GBP",
         "description": string
       },
       ...
     ]
   }
3. Each object:
   - Must have exactly **one title, one category, one price, one currency, one description**.
   - No duplicate keys.
   - Always include \`"currency": "GBP"\`.
   - Strings must be enclosed in double quotes, properly escaped.
   - If a field is missing, use \`""\` for description or skip the item entirely.
4. No trailing commas.
5. One category per item. If multiple detected, pick the **most specific/closest header**.
6. No £0.00 prices. If price is missing or zero, skip the item.
7. Deduplicate: if an item repeats with slightly different text, keep only the cleanest version.

### Output format:
\`\`\`json
{
  "items": [
    {
      "title": "Labneh",
      "category": "STARTERS",
      "price": 4.50,
      "currency": "GBP",
      "description": "Cream Olive Cheese traditional dip. Served with olives and zaatar."
    },
    {
      "title": "Kibbeh",
      "category": "STARTERS",
      "price": 5.50,
      "currency": "GBP",
      "description": "Crushed wheat mixture with minced meat, deep fried."
    }
  ]
}
\`\`\`

### Critical Requirements:
- **NO duplicate keys** (price, description, etc.)
- **NO trailing commas**
- **NO unterminated strings**
- **NO £0.00 prices**
- **ALWAYS include currency: "GBP"**
- **ONE category per item**
- **Deduplicate similar items**

Input to process:`;

/**
 * Repair prompt for fixing broken JSON
 */
export const JSON_REPAIR_PROMPT = `Your last JSON output was invalid and could not be parsed. Here is the error:

ERROR: {{ERROR_MESSAGE}}

PROBLEMATIC JSON:
{{BROKEN_JSON}}

Please fix the JSON by:
1. Removing duplicate keys (keep the last occurrence)
2. Adding missing commas between objects and properties
3. Fixing unterminated strings
4. Removing trailing commas
5. Ensuring proper object structure
6. Validating all required fields

Output ONLY the corrected JSON with no additional text or explanation.`;

/**
 * Validation prompt for checking JSON structure
 */
export const JSON_VALIDATION_PROMPT = `Validate this JSON structure for a menu importer:

\`\`\`json
{{JSON_TO_VALIDATE}}
\`\`\`

Check for:
1. Valid JSON syntax (no parse errors)
2. Required fields: title, category, price, currency, description
3. No duplicate keys
4. No trailing commas
5. Proper data types (string, number)
6. No £0.00 prices
7. Currency is "GBP"

Respond with:
- "VALID" if the JSON is correct
- "INVALID: [specific error]" if there are issues

Example responses:
- "VALID"
- "INVALID: Missing currency field in item 2"
- "INVALID: Duplicate 'price' key in item 1"`;

/**
 * Category assignment prompt
 */
export const CATEGORY_ASSIGNMENT_PROMPT = `Assign the most appropriate category to each menu item based on the detected section headers.

MENU TEXT:
{{MENU_TEXT}}

DETECTED SECTIONS:
{{SECTIONS}}

ITEMS TO CATEGORIZE:
{{ITEMS}}

Rules:
1. Use the most specific/closest section header
2. If no clear section, use "UNCATEGORIZED"
3. Common categories: STARTERS, MAINS, DESSERTS, DRINKS, BEVERAGES, COFFEE, TEA, BRUNCH, KIDS
4. Be consistent with category naming (use ALL CAPS)

Output JSON with updated categories:
\`\`\`json
{
  "items": [
    {
      "title": "Item Name",
      "category": "ASSIGNED_CATEGORY",
      "price": 10.50,
      "currency": "GBP",
      "description": "Item description"
    }
  ]
}
\`\`\``;

/**
 * Price extraction prompt
 */
export const PRICE_EXTRACTION_PROMPT = `Extract prices from menu text and match them to items.

MENU TEXT:
{{MENU_TEXT}}

ITEMS WITHOUT PRICES:
{{ITEMS}}

Rules:
1. Look for prices in £X.XX format
2. Match prices to the closest item title
3. Skip items if no clear price is found
4. Use 0 if price is missing (will be filtered out later)

Output JSON with prices added:
\`\`\`json
{
  "items": [
    {
      "title": "Item Name",
      "category": "CATEGORY",
      "price": 10.50,
      "currency": "GBP",
      "description": "Item description"
    }
  ]
}
\`\`\``;

/**
 * Deduplication prompt
 */
export const DEDUPLICATION_PROMPT = `Remove duplicate items from this menu JSON, keeping only the cleanest version of each item.

\`\`\`json
{{JSON_WITH_DUPLICATES}}
\`\`\`

Rules:
1. Compare items by normalized title (lowercase, trimmed)
2. Keep the item with the most complete information
3. Prefer items with better descriptions
4. Remove items with identical titles

Output the cleaned JSON with duplicates removed.`;

/**
 * Quality check prompt
 */
export const QUALITY_CHECK_PROMPT = `Perform a quality check on this menu JSON:

\`\`\`json
{{MENU_JSON}}
\`\`\`

Check for:
1. **Data Quality**: Are titles clear and descriptive?
2. **Price Reasonableness**: Are prices realistic for the items?
3. **Category Accuracy**: Do items belong in their assigned categories?
4. **Description Quality**: Are descriptions helpful and accurate?
5. **Completeness**: Are all required fields present?

Respond with:
- "HIGH QUALITY" if the menu is ready for use
- "MEDIUM QUALITY: [issues]" if there are minor issues
- "LOW QUALITY: [issues]" if there are major issues

Provide specific feedback on unknown problems found.`;

/**
 * Error recovery prompt
 */
export const ERROR_RECOVERY_PROMPT = `The menu extraction failed with this error:

ERROR: {{ERROR_MESSAGE}}

ORIGINAL MENU TEXT:
{{MENU_TEXT}}

Please try a different approach:
1. Extract items one section at a time
2. Use simpler JSON structure
3. Focus on items with clear prices
4. Skip ambiguous items

Output a minimal but valid JSON with just the most obvious items.`;

/**
 * Batch processing prompt
 */
export const BATCH_PROCESSING_PROMPT = `Process this menu text in batches to avoid token limits.

MENU TEXT (BATCH {{BATCH_NUMBER}}):
{{MENU_TEXT_BATCH}}

CONTEXT FROM PREVIOUS BATCHES:
{{PREVIOUS_ITEMS}}

Rules:
1. Extract items from this batch only
2. Maintain consistency with previous batches
3. Use the same category names
4. Output valid JSON for this batch only

Output JSON for this batch:
\`\`\`json
{
  "items": [
    {
      "title": "Item Name",
      "category": "CATEGORY",
      "price": 10.50,
      "currency": "GBP",
      "description": "Item description"
    }
  ]
}
\`\`\``;

/**
 * Gets the appropriate prompt based on the task
 */
export function getPrompt(task: 'extract' | 'repair' | 'validate' | 'categorize' | 'deduplicate' | 'quality' | 'recovery' | 'batch', context?: unknown): string {
  switch (task) {
    case 'extract':
      return MENU_EXTRACTION_PROMPT;
    case 'repair':
      return JSON_REPAIR_PROMPT
        .replace('{{ERROR_MESSAGE}}', context?.error || 'Unknown error')
        .replace('{{BROKEN_JSON}}', context?.json || '');
    case 'validate':
      return JSON_VALIDATION_PROMPT
        .replace('{{JSON_TO_VALIDATE}}', context?.json || '');
    case 'categorize':
      return CATEGORY_ASSIGNMENT_PROMPT
        .replace('{{MENU_TEXT}}', context?.menuText || '')
        .replace('{{SECTIONS}}', context?.sections || '')
        .replace('{{ITEMS}}', context?.items || '');
    case 'deduplicate':
      return DEDUPLICATION_PROMPT
        .replace('{{JSON_WITH_DUPLICATES}}', context?.json || '');
    case 'quality':
      return QUALITY_CHECK_PROMPT
        .replace('{{MENU_JSON}}', context?.json || '');
    case 'recovery':
      return ERROR_RECOVERY_PROMPT
        .replace('{{ERROR_MESSAGE}}', context?.error || '')
        .replace('{{MENU_TEXT}}', context?.menuText || '');
    case 'batch':
      return BATCH_PROCESSING_PROMPT
        .replace('{{BATCH_NUMBER}}', context?.batchNumber || '1')
        .replace('{{MENU_TEXT_BATCH}}', context?.menuText || '')
        .replace('{{PREVIOUS_ITEMS}}', context?.previousItems || '');
    default:
      return MENU_EXTRACTION_PROMPT;
  }
}
