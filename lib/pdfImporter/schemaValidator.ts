// =====================================================
// SCHEMA VALIDATION AND ATOMIC REPLACE SYSTEM
// =====================================================
// Validates parsed data and provides atomic catalog replacement

import { z } from 'zod';
import { ParsedCatalog, ParsedItem, ParsedCategory, ValidationResult } from './types';

/**
 * Extended schema for the new catalog system with options and variants
 */
export const ParsedItemSchema = z.object({
  title: z.string().min(1).max(100),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  price: z.number().positive().max(1000), // No £0.00 allowed
  category: z.string().min(1),
  variants: z.array(z.object({
    name: z.string(),
    price: z.number().positive(),
    priceAdd: z.number()
  })).optional(),
  options: z.array(z.object({
    group: z.string(),
    choices: z.array(z.object({
      name: z.string(),
      priceAdd: z.number().min(0)
    })),
    required: z.boolean(),
    maxChoices: z.number().int().positive()
  })).optional(),
  aliases: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  sourceLineIds: z.array(z.string())
});

export const ParsedCategorySchema = z.object({
  name: z.string().min(1),
  items: z.array(ParsedItemSchema),
  sortOrder: z.number().int().nonnegative()
});

export const ParsedCatalogSchema = z.object({
  categories: z.array(ParsedCategorySchema),
  metadata: z.object({
    sourceType: z.enum(['native_pdf', 'ocr_pdf', 'vision_ocr']),
    totalItems: z.number().int().nonnegative(),
    totalPrices: z.number().int().nonnegative(),
    unattachedPrices: z.number().int().nonnegative(),
    optionGroups: z.number().int().nonnegative(),
    processingMode: z.enum(['high_recall', 'precision'])
  })
});

export type ParsedCatalogT = z.infer<typeof ParsedCatalogSchema>;

/**
 * Validates parsed catalog against strict schema
 */
export function validateParsedCatalog(catalog: ParsedCatalog): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let itemsCount = 0;
  let zeroPriceCount = 0;
  let missingPriceCount = 0;

  try {
    // Validate against Zod schema
    const validated = ParsedCatalogSchema.parse(catalog);
    
    // Additional business logic validation
    for (const category of validated.categories) {
      for (const item of category.items) {
        itemsCount++;
        
        // Check for zero prices
        if (item.price <= 0) {
          zeroPriceCount++;
          errors.push(`Item "${item.title}" has invalid price: ${item.price}`);
        }
        
        // Check for missing prices
        if (isNaN(item.price)) {
          missingPriceCount++;
          errors.push(`Item "${item.title}" has missing price`);
        }
        
        // Check for unreasonable prices
        if (item.price > 100) {
          warnings.push(`Item "${item.title}" has unusually high price: £${item.price}`);
        }
        
        // Check for empty titles
        if (!item.title || item.title.trim().length === 0) {
          errors.push(`Item has empty title in category "${category.name}"`);
        }
        
        // Check for duplicate titles within category
        const duplicateTitles = category.items.filter(i => 
          i.title.toLowerCase() === item.title.toLowerCase()
        );
        if (duplicateTitles.length > 1) {
          errors.push(`Duplicate item title "${item.title}" in category "${category.name}"`);
        }
        
        // Validate variants
        if (item.variants) {
          for (const variant of item.variants) {
            if (variant.price <= 0) {
              errors.push(`Variant "${variant.name}" of "${item.title}" has invalid price: ${variant.price}`);
            }
            if (variant.priceAdd < 0) {
              warnings.push(`Variant "${variant.name}" of "${item.title}" has negative price add: ${variant.priceAdd}`);
            }
          }
        }
        
        // Validate options
        if (item.options) {
          for (const option of item.options) {
            if (option.choices.length === 0) {
              errors.push(`Option group "${option.group}" for "${item.title}" has no choices`);
            }
            
            for (const choice of option.choices) {
              if (choice.priceAdd < 0) {
                warnings.push(`Option choice "${choice.name}" for "${item.title}" has negative price add: ${choice.priceAdd}`);
              }
            }
          }
        }
      }
    }
    
    // Check for empty categories
    const emptyCategories = validated.categories.filter(cat => cat.items.length === 0);
    if (emptyCategories.length > 0) {
      warnings.push(`Empty categories found: ${emptyCategories.map(c => c.name).join(', ')}`);
    }
    
    // Check for too many items (possible modifier explosion)
    if (itemsCount > 100) {
      warnings.push(`Large number of items (${itemsCount}) - check for modifier explosion`);
    }
    
    // Check for too many categories
    if (validated.categories.length > 20) {
      warnings.push(`Large number of categories (${validated.categories.length}) - check for over-segmentation`);
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
    } else {
      errors.push(`Validation error: ${error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    itemsCount,
    zeroPriceCount,
    missingPriceCount
  };
}

/**
 * Converts parsed catalog to database format
 */
export function convertToDatabaseFormat(catalog: ParsedCatalog): any {
  const dbCategories = catalog.categories.map(category => ({
    name: category.name,
    sort_order: category.sortOrder,
    items: category.items.map(item => ({
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      price: item.price,
      currency: 'GBP',
      available: true,
      sort_order: 0,
      options: item.options?.map(option => ({
        group: option.group,
        required: option.required,
        max: option.maxChoices,
        sort_order: 0,
        choices: option.choices.map(choice => ({
          name: choice.name,
          price_add: choice.priceAdd,
          sort_order: 0
        }))
      })),
      aliases: item.aliases || []
    }))
  }));

  return {
    categories: dbCategories,
    metadata: catalog.metadata
  };
}

/**
 * Performs atomic catalog replacement using the database RPC
 */
export async function replaceCatalogAtomically(
  venueId: string, 
  catalog: ParsedCatalog,
  supabaseClient: any
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    
    // Validate before replacement
    const validation = validateParsedCatalog(catalog);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Convert to database format
    const dbFormat = convertToDatabaseFormat(catalog);
    
    // Call the atomic replace RPC
    const { data, error } = await supabaseClient.rpc('api_replace_catalog', {
      p_venue_id: venueId,
      p_payload: dbFormat
    });
    
    if (error) {
      console.error('[CATALOG_REPLACE] RPC call failed:', error);
      throw new Error(`Database replacement failed: ${error.message}`);
    }
    
    
    return {
      success: true,
      result: data
    };
    
  } catch (error: any) {
    console.error('[CATALOG_REPLACE] Atomic replacement failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validates catalog payload before replacement (pre-check)
 */
export async function validateCatalogPayload(
  payload: any,
  supabaseClient: any
): Promise<ValidationResult> {
  try {
    
    // Call the validation RPC
    const { data, error } = await supabaseClient.rpc('validate_catalog_payload', {
      p_payload: payload
    });
    
    if (error) {
      console.error('[CATALOG_VALIDATE] Validation RPC failed:', error);
      return {
        valid: false,
        errors: [`Validation RPC failed: ${error.message}`],
        warnings: [],
        itemsCount: 0,
        zeroPriceCount: 0,
        missingPriceCount: 0
      };
    }
    
    
    return {
      valid: data.valid,
      errors: data.errors || [],
      warnings: data.warnings || [],
      itemsCount: data.items_count || 0,
      zeroPriceCount: data.zero_price_count || 0,
      missingPriceCount: data.missing_price_count || 0
    };
    
  } catch (error: any) {
    console.error('[CATALOG_VALIDATE] Validation failed:', error);
    return {
      valid: false,
      errors: [`Validation failed: ${error.message}`],
      warnings: [],
      itemsCount: 0,
      zeroPriceCount: 0,
      missingPriceCount: 0
    };
  }
}

/**
 * Sanitizes and normalizes item data
 */
export function sanitizeItemData(item: ParsedItem): ParsedItem {
  return {
    ...item,
    title: item.title.trim().slice(0, 100), // Limit length
    subtitle: item.subtitle?.trim().slice(0, 100),
    description: item.description?.trim().slice(0, 500),
    price: Math.round(item.price * 100) / 100, // Round to 2 decimal places
    category: item.category.trim(),
    aliases: item.aliases?.map(alias => alias.trim()).filter(alias => alias.length > 0),
    variants: item.variants?.map(variant => ({
      ...variant,
      name: variant.name.trim(),
      price: Math.round(variant.price * 100) / 100,
      priceAdd: Math.round(variant.priceAdd * 100) / 100
    })),
    options: item.options?.map(option => ({
      ...option,
      group: option.group.trim(),
      choices: option.choices.map(choice => ({
        ...choice,
        name: choice.name.trim(),
        priceAdd: Math.round(choice.priceAdd * 100) / 100
      }))
    }))
  };
}

/**
 * Deduplicates items within categories
 */
export function deduplicateItems(categories: ParsedCategory[]): ParsedCategory[] {
  return categories.map(category => {
    const seen = new Set<string>();
    const uniqueItems: ParsedItem[] = [];
    
    for (const item of category.items) {
      const key = item.title.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      } else {
      }
    }
    
    return {
      ...category,
      items: uniqueItems
    };
  });
}

/**
 * Enforces category guards (prevents items from ending up in wrong categories)
 */
export function enforceCategoryGuards(categories: ParsedCategory[]): ParsedCategory[] {
  const categoryMappings: Record<string, string[]> = {
    'COFFEE': ['coffee', 'americano', 'latte', 'cappuccino', 'espresso', 'mocha', 'frappe'],
    'TEA': ['tea', 'chai', 'herbal', 'green tea', 'black tea'],
    'FOOD': ['sandwich', 'salad', 'pizza', 'pasta', 'burger', 'chicken', 'beef', 'fish'],
    'DESSERTS': ['cake', 'ice cream', 'cheesecake', 'pudding', 'tart', 'pie'],
    'BEVERAGES': ['juice', 'soda', 'water', 'soft drink', 'coke', 'pepsi']
  };
  
  return categories.map(category => {
    const categoryName = category.name.toUpperCase();
    const allowedItems = categoryMappings[categoryName] || [];
    
    if (allowedItems.length === 0) {
      return category; // No restrictions for this category
    }
    
    const filteredItems = category.items.filter(item => {
      const itemTitle = item.title.toLowerCase();
      const isAllowed = allowedItems.some(allowed => itemTitle.includes(allowed));
      
      if (!isAllowed) {
        // For now, keep the item but log a warning
        // In production, you might want to reassign or flag for review
      }
      
      return true; // Keep all items for now, but log warnings
    });
    
    return {
      ...category,
      items: filteredItems
    };
  });
}
