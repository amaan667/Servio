// =====================================================
// JSON REPAIR SYSTEM FOR GPT OUTPUT
// =====================================================
// Fixes common JSON parsing errors from GPT menu extraction

/**
 * Repairs malformed JSON from GPT output
 */
export function repairMenuJSON(brokenJSON: string): string {
  console.log('[JSON_REPAIR] Starting JSON repair...');
  
  try {
    // First, try to parse as-is
    JSON.parse(brokenJSON);
    console.log('[JSON_REPAIR] JSON is already valid');
    return brokenJSON;
  } catch (error) {
    console.log('[JSON_REPAIR] JSON needs repair, error:', error.message);
  }
  
  let repaired = brokenJSON;
  
  // Step 1: Fix duplicate keys (keep the last occurrence)
  repaired = fixDuplicateKeys(repaired);
  
  // Step 2: Fix missing commas between objects
  repaired = fixMissingCommas(repaired);
  
  // Step 3: Fix unterminated strings
  repaired = fixUnterminatedStrings(repaired);
  
  // Step 4: Fix malformed object structures
  repaired = fixMalformedObjects(repaired);
  
  // Step 5: Remove trailing commas
  repaired = removeTrailingCommas(repaired);
  
  // Step 6: Ensure proper array structure
  repaired = fixArrayStructure(repaired);
  
  // Step 7: Validate and clean items
  repaired = validateAndCleanItems(repaired);
  
  console.log('[JSON_REPAIR] JSON repair completed');
  return repaired;
}

/**
 * Fixes duplicate keys by keeping the last occurrence
 */
function fixDuplicateKeys(json: string): string {
  console.log('[JSON_REPAIR] Fixing duplicate keys...');
  
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
      console.log(`[JSON_REPAIR] Fixed duplicate key: ${key1}`);
    }
  }
  
  return fixed;
}

/**
 * Fixes missing commas between array elements and object properties
 */
function fixMissingCommas(json: string): string {
  console.log('[JSON_REPAIR] Fixing missing commas...');
  
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
  console.log('[JSON_REPAIR] Fixing unterminated strings...');
  
  let fixed = json;
  
  // Find unterminated strings and close them
  const unterminatedPattern = /"([^"]*?)(?=\s*[,}\]])/g;
  
  fixed = fixed.replace(unterminatedPattern, (match, content) => {
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
  
  return fixed;
}

/**
 * Fixes malformed object structures
 */
function fixMalformedObjects(json: string): string {
  console.log('[JSON_REPAIR] Fixing malformed objects...');
  
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
  console.log('[JSON_REPAIR] Removing trailing commas...');
  
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
  console.log('[JSON_REPAIR] Fixing array structure...');
  
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
  console.log('[JSON_REPAIR] Validating and cleaning items...');
  
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
          console.log('[JSON_REPAIR] Removing item with missing fields:', item);
          return false;
        }
        
        // Remove items with zero or negative prices
        if (item.price <= 0) {
          console.log('[JSON_REPAIR] Removing item with invalid price:', item.title, item.price);
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
        console.log('[JSON_REPAIR] Removing duplicate item:', item.title);
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
      
      if (typeof item.price !== 'number' || item.price <= 0) {
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
    errors.push(`JSON parse error: ${error.message}`);
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
  console.log('[JSON_REPAIR] Starting complete repair pipeline...');
  
  try {
    // Step 1: Repair the JSON
    const repaired = repairMenuJSON(brokenJSON);
    
    // Step 2: Validate the repaired JSON
    const validation = validateMenuJSON(repaired);
    
    if (validation.valid) {
      console.log('[JSON_REPAIR] Repair successful:', validation.items.length, 'items');
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
      errors: [`Repair failed: ${error.message}`]
    };
  }
}
