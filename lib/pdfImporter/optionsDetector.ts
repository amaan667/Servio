// =====================================================
// OPTIONS VS ITEMS DETECTION SYSTEM
// =====================================================
// Detects modifiers, extras, and options to prevent fake items

import { 
  TextBlock, 
  ParsedItem, 
  OptionGroup, 
  OptionChoice, 
  ItemVariant,
  ProcessingOptions 
} from './types';

/**
 * Detects and processes options vs items to prevent modifier explosion
 */
export function detectOptionsAndVariants(
  items: ParsedItem[], 
  blocks: TextBlock[], 
  options: ProcessingOptions
): { items: ParsedItem[], optionGroups: OptionGroup[] } {
  
  if (!options.enableOptionDetection) {
    return { items, optionGroups: [] };
  }
  
  const optionGroups: OptionGroup[] = [];
  const processedItems: ParsedItem[] = [];
  
  for (const item of items) {
    // Find blocks that might be related to this item
    const relatedBlocks = findRelatedBlocks(item, blocks);
    
    // Detect options and variants
    const { options: itemOptions, variants } = detectItemOptionsAndVariants(item, relatedBlocks);
    
    if (itemOptions.length > 0) {
      // Add options to the item
      processedItems.push({
        ...item,
        options: itemOptions
      });
      
      // Track option groups
      optionGroups.push(...itemOptions);
    } else if (variants.length > 0) {
      // Add variants to the item
      processedItems.push({
        ...item,
        variants
      });
    } else {
      // No options or variants, keep as-is
      processedItems.push(item);
    }
  }
  
  
  return { items: processedItems, optionGroups };
}

/**
 * Finds text blocks that might be related to an item
 */
function findRelatedBlocks(item: ParsedItem, blocks: TextBlock[]): TextBlock[] {
  const relatedBlocks: TextBlock[] = [];
  
  // Find blocks that are spatially close to the item
  for (const block of blocks) {
    // Check if block is in the same general area as the item
    const isNearby = item.sourceLineIds.some(lineId => {
      const itemBlock = blocks.find(b => b.lineId === lineId);
      if (!itemBlock) return false;
      
      const dx = Math.abs(block.bbox.x - itemBlock.bbox.x);
      const dy = Math.abs(block.bbox.y - itemBlock.bbox.y);
      
      return dx < 200 && dy < 50; // Within reasonable distance
    });
    
    if (isNearby) {
      relatedBlocks.push(block);
    }
  }
  
  return relatedBlocks;
}

/**
 * Detects options and variants for a specific item
 */
function detectItemOptionsAndVariants(item: ParsedItem, relatedBlocks: TextBlock[]): {
  options: OptionGroup[],
  variants: ItemVariant[]
} {
  const options: OptionGroup[] = [];
  const variants: ItemVariant[] = [];
  
  // Look for option cue words
  const optionCues = [
    'syrup', 'milk', 'shot', 'extra', 'add', 'toppings', 'size', 'choice',
    'alternative', 'substitute', 'with', 'without', 'gluten-free', 'vegan'
  ];
  
  for (const block of relatedBlocks) {
    const text = block.text.toLowerCase();
    
    // Check if this block contains option cues
    const hasOptionCues = optionCues.some(cue => text.includes(cue));
    
    if (hasOptionCues) {
      // Try to parse as option group
      const optionGroup = parseOptionGroup(block, item);
      if (optionGroup) {
        options.push(optionGroup);
      }
    }
    
    // Check for size variants (Small/Large, etc.)
    const sizeVariant = parseSizeVariant(block, item);
    if (sizeVariant) {
      variants.push(sizeVariant);
    }
  }
  
  return { options, variants };
}

/**
 * Parses a text block as an option group
 */
function parseOptionGroup(block: TextBlock, item: ParsedItem): OptionGroup | null {
  const text = block.text;
  
  // Pattern 1: "Syrup Salted Caramel / Hazelnut / Vanilla £0.50"
  const listPattern = /^(\w+)\s+([^£]+)\s*£?(\d+(?:\.\d{1,2})?)$/i;
  const listMatch = text.match(listPattern);
  
  if (listMatch) {
    const [, groupName, choicesText, priceText] = listMatch;
    const price = parseFloat(priceText);
    
    // Split choices by common separators
    const choices = choicesText.split(/[\/,|&]/).map(choice => choice.trim());
    
    if (choices.length > 1 && price > 0) {
      return {
        group: groupName,
        choices: choices.map(choice => ({
          name: choice,
          priceAdd: price
        })),
        required: false,
        maxChoices: 1
      };
    }
  }
  
  // Pattern 2: "Extra Shot £0.50"
  const singlePattern = /^(extra\s+)?(\w+)\s*£?(\d+(?:\.\d{1,2})?)$/i;
  const singleMatch = text.match(singlePattern);
  
  if (singleMatch) {
    const [, extra, optionName, priceText] = singleMatch;
    const price = parseFloat(priceText);
    
    if (price > 0) {
      return {
        group: extra ? 'Extras' : 'Options',
        choices: [{
          name: optionName,
          priceAdd: price
        }],
        required: false,
        maxChoices: 1
      };
    }
  }
  
  // Pattern 3: "Alternative Milk: Oat / Soy / Almond £0.50"
  const altPattern = /^alternative\s+(\w+):\s*([^£]+)\s*£?(\d+(?:\.\d{1,2})?)$/i;
  const altMatch = text.match(altPattern);
  
  if (altMatch) {
    const [, groupName, choicesText, priceText] = altMatch;
    const price = parseFloat(priceText);
    
    const choices = choicesText.split(/[\/,|&]/).map(choice => choice.trim());
    
    if (choices.length > 0 && price > 0) {
      return {
        group: `Alternative ${groupName}`,
        choices: choices.map(choice => ({
          name: choice,
          priceAdd: price
        })),
        required: false,
        maxChoices: 1
      };
    }
  }
  
  return null;
}

/**
 * Parses a text block as a size variant
 */
function parseSizeVariant(block: TextBlock, item: ParsedItem): ItemVariant | null {
  const text = block.text;
  
  // Pattern: "Small £2.50 / Large £3.50"
  const sizePattern = /^(small|medium|large|regular|grande|venti)\s*£?(\d+(?:\.\d{1,2})?)/i;
  const sizeMatch = text.match(sizePattern);
  
  if (sizeMatch) {
    const [, sizeName, priceText] = sizeMatch;
    const price = parseFloat(priceText);
    
    if (price > 0) {
      return {
        name: sizeName.charAt(0).toUpperCase() + sizeName.slice(1),
        price: price,
        priceAdd: price - item.price
      };
    }
  }
  
  return null;
}

/**
 * Detects if a text block is a modifier/option rather than a standalone item
 */
export function isModifierBlock(block: TextBlock, contextBlocks: TextBlock[]): boolean {
  const text = block.text.toLowerCase();
  
  // Check for modifier indicators
  const modifierIndicators = [
    'extra', 'add', 'with', 'without', 'substitute', 'alternative',
    'syrup', 'shot', 'milk', 'topping', 'size', 'choice'
  ];
  
  const hasModifierIndicators = modifierIndicators.some(indicator => 
    text.includes(indicator)
  );
  
  // Check for small price (modifiers usually have small prices)
  const priceMatch = text.match(/£?(\d+(?:\.\d{1,2})?)/);
  const hasSmallPrice = (priceMatch && parseFloat(priceMatch[1]) < 2.0) || false;
  
  // Check if it's indented or positioned as a sub-item
  const isIndented = contextBlocks.some(context => 
    block.bbox.x > context.bbox.x + 20
  ) || false;
  
  // Check for list-like formatting
  const isListLike = /^[•\-\*]\s/.test(block.text) || 
                     /^\d+\.\s/.test(block.text) ||
                     /^[a-z]\)\s/.test(block.text);
  
  return hasModifierIndicators || (hasSmallPrice && (isIndented || isListLike));
}

/**
 * Filters out modifier blocks that shouldn't become standalone items
 */
export function filterModifierBlocks(blocks: TextBlock[]): TextBlock[] {
  return blocks.filter(block => {
    // Skip blocks that are clearly modifiers
    if (isModifierBlock(block, blocks)) {
      return false;
    }
    
    // Skip blocks that are just prices without context
    if (/^[£$€]\s*\d+(?:\.\d{1,2})?$/.test(block.text.trim())) {
      return false;
    }
    
    // Skip blocks that are just numbers
    if (/^\d+$/.test(block.text.trim())) {
      return false;
    }
    
    return true;
  });
}

/**
 * Groups related options together
 */
export function groupRelatedOptions(optionGroups: OptionGroup[]): OptionGroup[] {
  const grouped = new Map<string, OptionGroup>();
  
  for (const option of optionGroups) {
    const key = option.group.toLowerCase();
    
    if (grouped.has(key)) {
      // Merge with existing group
      const existing = grouped.get(key)!;
      existing.choices.push(...option.choices);
    } else {
      // Create new group
      grouped.set(key, { ...option });
    }
  }
  
  return Array.from(grouped.values());
}

/**
 * Validates option groups for consistency
 */
export function validateOptionGroups(optionGroups: OptionGroup[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (const group of optionGroups) {
    // Check for empty choices
    if (group.choices.length === 0) {
      errors.push(`Option group "${group.group}" has no choices`);
    }
    
    // Check for duplicate choice names
    const choiceNames = group.choices.map(c => c.name.toLowerCase());
    const duplicates = choiceNames.filter((name, index) => 
      choiceNames.indexOf(name) !== index
    );
    
    if (duplicates.length > 0) {
      errors.push(`Option group "${group.group}" has duplicate choices: ${duplicates.join(', ')}`);
    }
    
    // Check for unreasonable prices
    const highPrices = group.choices.filter(c => c.priceAdd > 5.0);
    if (highPrices.length > 0) {
      warnings.push(`Option group "${group.group}" has high prices: ${highPrices.map(c => c.name).join(', ')}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
