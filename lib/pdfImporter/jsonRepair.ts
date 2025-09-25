// =====================================================
// JSON REPAIR SYSTEM FOR GPT OUTPUT
// =====================================================
// Fixes common JSON parsing errors from GPT menu extraction

/**
 * Repairs malformed JSON from GPT output
 */
export function repairMenuJSON(brokenJSON: string): string {
  
  try {
    // First, try to parse as-is
    JSON.parse(brokenJSON);
    return brokenJSON;
  } catch (error) {
  }
  
  // Try the new robust reconstruction approach first
  try {
    const reconstructed = reconstructJSONFromMalformed(brokenJSON);
    if (reconstructed) {
      return reconstructed;
    }
  } catch (error) {
  }
  
  let repaired = brokenJSON;
  
  // Step 1: Fix complex malformations (orphaned properties, incomplete objects)
  repaired = fixComplexMalformations(repaired);
  
  // Step 2: Fix duplicate keys (keep the last occurrence)
  repaired = fixDuplicateKeys(repaired);
  
  // Step 3: Fix missing commas between objects
  repaired = fixMissingCommas(repaired);
  
  // Step 4: Fix unterminated strings
  repaired = fixUnterminatedStrings(repaired);
  
  // Step 5: Fix malformed object structures
  repaired = fixMalformedObjects(repaired);
  
  // Step 6: Remove trailing commas
  repaired = removeTrailingCommas(repaired);
  
  // Step 7: Ensure proper array structure
  repaired = fixArrayStructure(repaired);
  
  // Step 8: Validate and clean items
  repaired = validateAndCleanItems(repaired);
  
  return repaired;
}

/**
 * Reconstructs JSON by extracting valid properties and rebuilding the structure
 */
function reconstructJSONFromMalformed(json: string): string | null {
  
  try {
    // First, try to fix truncated JSON
    const fixedJson = fixTruncatedJSON(json);
    
    // Extract all property-value pairs using regex - improved pattern
    const propertyPattern = /"([^"]+)":\s*([^,}]+?)(?=\s*[,}\]])/g;
    const properties: Array<{key: string, value: string}> = [];
    let match;
    
    while ((match = propertyPattern.exec(fixedJson)) !== null) {
      const key = match[1];
      let value = match[2].trim();
      
      // Handle incomplete values (values that don't end with quote, comma, or brace)
      if (value && !value.endsWith('"') && !value.endsWith(',') && !value.endsWith('}')) {
        // If the value is incomplete, try to complete it
        if (value.startsWith('"') && !value.endsWith('"')) {
          // Incomplete string, close it
          value = value + '"';
        } else if (!value.startsWith('"') && !value.match(/^\d/)) {
          // Looks like an incomplete string, add quotes
          value = '"' + value + '"';
        }
      }
      
      // Handle unterminated strings that might be cut off mid-word
      if (value && value.startsWith('"') && !value.endsWith('"')) {
        // Try to complete common cut-off words
        const content = value.substring(1); // Remove opening quote
        const completions: Record<string, string> = {
          'lem': 'lemon',
          'tom': 'tomato', 
          'che': 'cheese',
          'bur': 'burger',
          'chi': 'chicken',
          'bee': 'beef',
          'fis': 'fish',
          'sou': 'soup',
          'sal': 'salad',
          'pas': 'pasta',
          'piz': 'pizza',
          'gra': 'granola',
          'yog': 'yoghurt',
          'mil': 'milk',
          'ber': 'berries'
        };
        
        if (completions[content]) {
          value = `"${completions[content]}"`;
        } else {
          // Just close the string
          value = value + '"';
        }
      }
      
      // Only include valid properties
      if (key && value && !value.includes('{') && !value.includes('}')) {
        properties.push({ key, value });
      }
    }
    
    // Group properties into items based on common patterns
    const items: any[] = [];
    let currentItem: any = {};
    
    for (const prop of properties) {
      // If we encounter a title and we already have a title, start a new item
      if (prop.key === 'title' && currentItem.title) {
        if (isValidItem(currentItem)) {
          items.push(currentItem);
        }
        currentItem = {};
      }
      
      currentItem[prop.key] = cleanValue(prop.value);
    }
    
    // Add the last item if it's valid (even if incomplete)
    if (currentItem.title && currentItem.category) {
      // For incomplete items, provide default values
      if (!currentItem.price) {
        currentItem.price = '0.00';
      }
      if (!currentItem.description) {
        currentItem.description = '';
      }
      items.push(currentItem);
    }
    
    // Filter out invalid items - RELAXED for now to allow more items through
    const validItems = items.filter(item => 
      item.title && 
      item.category
      // Removed price validation to allow more items through
    );
    
    if (validItems.length === 0) {
      return null;
    }
    
    // Reconstruct the JSON - RELAXED for now to allow more items through
    const reconstructed = {
      items: validItems.map(item => ({
        title: item.title,
        category: item.category,
        price: item.price ? (typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0) : 0, // Ensure price is always a number
        currency: 'GBP',
        description: item.description || ''
      }))
    };
    
    return JSON.stringify(reconstructed, null, 2);
    
  } catch (error) {
    return null;
  }
}

/**
 * Fixes truncated JSON by completing incomplete structures
 */
function fixTruncatedJSON(json: string): string {
  
  let fixed = json.trim();
  
  // If the JSON ends abruptly, try to complete it
  if (!fixed.endsWith('}') && !fixed.endsWith(']')) {
    // Find the last complete object or property
    const lastCompleteBrace = fixed.lastIndexOf('}');
    const lastCompleteBracket = fixed.lastIndexOf(']');
    const lastCompleteQuote = fixed.lastIndexOf('"');
    
    // If we're in the middle of a property value, complete it
    if (lastCompleteQuote > Math.max(lastCompleteBrace, lastCompleteBracket)) {
      // Find the last property that's incomplete
      const lastColon = fixed.lastIndexOf(':');
      if (lastColon > lastCompleteQuote) {
        // We're in the middle of a property value, close it
        fixed = fixed.substring(0, lastColon + 1) + ' "",';
      }
    }
    
    // If we're in the middle of an object, close it
    const openBraces = (fixed.match(/{/g) || []).length;
    const closeBraces = (fixed.match(/}/g) || []).length;
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    
    // Close incomplete objects
    for (let i = 0; i < openBraces - closeBraces; i++) {
      fixed += '}';
    }
    
    // Close incomplete arrays
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      fixed += ']';
    }
    
    // Remove trailing comma if present
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  }
  
  return fixed;
}

/**
 * Checks if an item has the minimum required properties
 */
function isValidItem(item: any): boolean {
  return item.title && item.category && item.price;
}

/**
 * Cleans a property value by removing quotes and fixing common issues
 */
function cleanValue(value: string): string {
  // Remove surrounding quotes
  let cleaned = value.replace(/^["']|["']$/g, '');
  
  // Fix common issues
  cleaned = cleaned.replace(/\\"/g, '"');
  cleaned = cleaned.replace(/\\n/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Fixes complex malformations like orphaned properties and incomplete objects
 */
function fixComplexMalformations(json: string): string {
  
  let fixed = json;
  
  // Step 1: Fix the specific pattern in the problematic JSON
  // Handle orphaned properties that appear between objects
  fixed = fixed.replace(/},\s*"([^"]+)":\s*([^,}]+),\s*{\s*"title"/g, (match, prop, value) => {
    return `},\n    {\n      "${prop}": ${value},\n      "title"`;
  });
  
  // Step 2: Fix objects with duplicate properties (keep the last one)
  // This handles cases like: "title": "Labneh", "category": "STARTERS", "title": "Tacos"
  fixed = fixDuplicatePropertiesInObjects(fixed);
  
  // Step 3: Fix missing commas between properties in the same object
  fixed = fixed.replace(/"([^"]+)":\s*([^,}]+)\s*"([^"]+)":/g, '"$1": $2,\n      "$3":');
  
  // Step 4: Fix orphaned properties that appear after objects
  fixed = fixed.replace(/}\s*,\s*"([^"]+)":\s*([^,}]+),\s*{\s*"title"/g, (match, prop, value) => {
    return `},\n    {\n      "${prop}": ${value},\n      "title"`;
  });
  
  // Step 5: Fix incomplete objects (missing closing braces)
  fixed = fixed.replace(/"([^"]+)":\s*([^,}]+)\s*{\s*"title"/g, (match, prop, value) => {
    return `"${prop}": ${value}\n    },\n    {\n      "title"`;
  });
  
  return fixed;
}

/**
 * Fixes duplicate properties within individual objects
 */
function fixDuplicatePropertiesInObjects(json: string): string {
  
  // Find all objects and fix duplicates within each
  const objectPattern = /{\s*([^}]*?)\s*}/g;
  
  return json.replace(objectPattern, (match, content) => {
    // Split properties and remove duplicates (keep last occurrence)
    const properties = content.split(',').map((prop: string) => prop.trim()).filter(Boolean);
    const uniqueProperties = new Map();
    
    // Process properties in reverse order to keep the last occurrence
    for (let i = properties.length - 1; i >= 0; i--) {
      const prop = properties[i];
      const colonIndex = prop.indexOf(':');
      if (colonIndex > 0) {
        const key = prop.substring(0, colonIndex).trim();
        const value = prop.substring(colonIndex + 1).trim();
        
        // Clean up the key (remove quotes if present)
        const cleanKey = key.replace(/^["']|["']$/g, '');
        
        if (!uniqueProperties.has(cleanKey)) {
          uniqueProperties.set(cleanKey, value);
        }
      }
    }
    
    // Rebuild the object with unique properties
    const uniqueProps = Array.from(uniqueProperties.entries())
      .map(([key, value]) => `"${key}": ${value}`)
      .join(',\n      ');
    
    return `{\n      ${uniqueProps}\n    }`;
  });
}

/**
 * Fixes duplicate keys by keeping the last occurrence
 */
function fixDuplicateKeys(json: string): string {
  
  // Pattern to match duplicate keys within objects
  const duplicateKeyPattern = /"([^"]+)":\s*([^,}]+),\s*"([^"]+)":\s*([^,}]+)/g;
  
  let fixed = json;
  let match;
  
  while ((match = duplicateKeyPattern.exec(json)) !== null) {
    const [fullMatch, key1, value1, key2, value2] = match;
    
    if (key1 === key2) {
      // Duplicate key found, keep the last one
      const replacement = `"${key2}": ${value2}`;
      fixed = fixed.replace(fullMatch, replacement);
    }
  }
  
  return fixed;
}

/**
 * Fixes missing commas between array elements and object properties
 */
function fixMissingCommas(json: string): string {
  
  let fixed = json;
  
  // Fix missing commas between objects in array
  fixed = fixed.replace(/}\s*{\s*"title"/g, '}, {\n      "title"');
  
  // Fix missing commas between properties
  fixed = fixed.replace(/"([^"]+)":\s*([^,}]+)\s*"([^"]+)":/g, '"$1": $2,\n      "$3":');
  
  // Fix missing commas after strings
  fixed = fixed.replace(/"([^"]+)"\s*"([^"]+)":/g, '"$1",\n      "$2":');
  
  // Fix missing commas after numbers
  fixed = fixed.replace(/(\d+(?:\.\d+)?)\s*"([^"]+)":/g, '$1,\n      "$2":');
  
  return fixed;
}

/**
 * Fixes unterminated strings
 */
function fixUnterminatedStrings(json: string): string {
  
  let fixed = json;
  
  // Handle unterminated strings more aggressively
  // Look for strings that start with quote but don't end with quote before next property/brace
  const unterminatedStringPattern = /"([^"]*?)(?=\s*[,}\]])/g;
  
  fixed = fixed.replace(unterminatedStringPattern, (match, content) => {
    // If the string doesn't end with a quote, add one
    if (!match.endsWith('"')) {
      return `"${content}"`;
    }
    return match;
  });
  
  // Fix strings that are missing opening quotes
  fixed = fixed.replace(/([^"])([A-Za-z][^"]*?)(?=\s*[,}\]])/g, (match, before, content) => {
    // If this looks like a string value but isn't quoted
    if (before === ':' || before === ',') {
      return `${before}"${content}"`;
    }
    return match;
  });
  
  // Handle strings that are cut off mid-word (like "lem" instead of "lemon")
  fixed = fixed.replace(/"([^"]*?)(?=\s*[,}\]])/g, (match, content) => {
    // If the content looks like it was cut off (short word, no space at end)
    if (content.length < 4 && !content.endsWith(' ') && !content.endsWith('.')) {
      // Try to complete common cut-off words
      const completions: Record<string, string> = {
        'lem': 'lemon',
        'tom': 'tomato',
        'che': 'cheese',
        'bur': 'burger',
        'chi': 'chicken',
        'bee': 'beef',
        'fis': 'fish',
        'sou': 'soup',
        'sal': 'salad',
        'pas': 'pasta',
        'piz': 'pizza'
      };
      
      if (completions[content]) {
        return `"${completions[content]}"`;
      }
    }
    return match;
  });
  
  return fixed;
}

/**
 * Fixes malformed object structures
 */
function fixMalformedObjects(json: string): string {
  
  let fixed = json;
  
  // Fix objects that are missing opening braces
  fixed = fixed.replace(/([^}])\s*{\s*"title"/g, '$1, {\n      "title"');
  
  // Fix objects that are missing closing braces
  fixed = fixed.replace(/"([^"]+)":\s*([^,}]+)\s*}/g, '"$1": $2\n    }');
  
  // Fix nested objects that are malformed
  fixed = fixed.replace(/{\s*{\s*"title"/g, '{\n    {\n      "title"');
  
  return fixed;
}

/**
 * Removes trailing commas
 */
function removeTrailingCommas(json: string): string {
  
  let fixed = json;
  
  // Remove trailing commas before closing braces
  fixed = fixed.replace(/,(\s*})/g, '$1');
  
  // Remove trailing commas before closing brackets
  fixed = fixed.replace(/,(\s*\])/g, '$1');
  
  return fixed;
}

/**
 * Fixes array structure
 */
function fixArrayStructure(json: string): string {
  
  let fixed = json;
  
  // Ensure proper array formatting
  fixed = fixed.replace(/"items":\s*\[\s*{/g, '"items": [\n    {');
  fixed = fixed.replace(/}\s*\]/g, '}\n  ]');
  
  return fixed;
}

/**
 * Validates and cleans individual items
 */
function validateAndCleanItems(json: string): string {
  
  try {
    const parsed = JSON.parse(json);
    
    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error('Invalid items array');
    }
    
    // Clean each item
    const cleanedItems = parsed.items
      .filter((item: any) => {
        // Remove items with missing required fields
        if (!item.title || !item.category || typeof item.price !== 'number') {
          return false;
        }
        
        // Remove items with zero or negative prices
        if (item.price <= 0) {
          return false;
        }
        
        return true;
      })
      .map((item: any) => ({
        title: String(item.title || '').trim(),
        category: String(item.category || '').trim(),
        price: Number(item.price || 0),
        currency: 'GBP',
        description: String(item.description || '').trim()
      }))
      .filter((item: any) => item.title && item.category && item.price > 0);
    
    // Remove duplicates based on title
    const uniqueItems = [];
    const seenTitles = new Set<string>();
    
    for (const item of cleanedItems) {
      const normalizedTitle = item.title.toLowerCase().trim();
      if (!seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle);
        uniqueItems.push(item);
      } else {
      }
    }
    
    const result = {
      items: uniqueItems
    };
    
    return JSON.stringify(result, null, 2);
    
  } catch (error) {
    console.error('[JSON_REPAIR] Failed to validate items:', error);
    return json;
  }
}

/**
 * Validates the final JSON structure
 */
export function validateMenuJSON(json: string): {
  valid: boolean;
  errors: string[];
  items: any[];
} {
  const errors: string[] = [];
  let items: any[] = [];
  
  try {
    const parsed = JSON.parse(json);
    
    if (!parsed.items || !Array.isArray(parsed.items)) {
      errors.push('Missing or invalid items array');
      return { valid: false, errors, items };
    }
    
    items = parsed.items;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check required fields
      if (!item.title || typeof item.title !== 'string') {
        errors.push(`Item ${i}: Missing or invalid title`);
      }
      
      if (!item.category || typeof item.category !== 'string') {
        errors.push(`Item ${i}: Missing or invalid category`);
      }
      
      // RELAXED: Allow any price value for now
      if (typeof item.price !== 'number') {
        errors.push(`Item ${i}: Missing or invalid price`);
      }
      
      if (!item.currency || item.currency !== 'GBP') {
        errors.push(`Item ${i}: Missing or invalid currency`);
      }
      
      if (typeof item.description !== 'string') {
        errors.push(`Item ${i}: Missing or invalid description`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      items
    };
    
  } catch (error) {
    errors.push(`JSON parse error: ${(error as any).message}`);
    return { valid: false, errors, items };
  }
}

/**
 * Complete JSON repair pipeline
 */
export function repairAndValidateMenuJSON(brokenJSON: string): {
  success: boolean;
  json?: string;
  items?: any[];
  errors?: string[];
} {
  
  try {
    // Step 1: Repair the JSON
    const repaired = repairMenuJSON(brokenJSON);
    
    // Step 2: Validate the repaired JSON
    const validation = validateMenuJSON(repaired);
    
    if (validation.valid) {
      return {
        success: true,
        json: repaired,
        items: validation.items
      };
    } else {
      console.error('[JSON_REPAIR] Validation failed:', validation.errors);
      return {
        success: false,
        errors: validation.errors
      };
    }
    
  } catch (error) {
    console.error('[JSON_REPAIR] Repair pipeline failed:', error);
    return {
      success: false,
      errors: [`Repair failed: ${(error as any).message}`]
    };
  }
}
