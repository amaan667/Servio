// =====================================================
// ROBUST GPT MENU PARSER WITH JSON REPAIR
// =====================================================
// Handles GPT output errors and ensures valid JSON

import { getOpenAI } from '../openai';
import { getPrompt } from './gptPrompts';
import { repairAndValidateMenuJSON, validateMenuJSON } from './jsonRepair';
import { logger } from '@/lib/logger';

export interface MenuParsingResult {
  success: boolean;
  items: any[];
  json?: string;
  errors?: string[];
  warnings?: string[];
  attempts: number;
  processingTime: number;
}

export interface MenuParsingOptions {
  maxRetries: number;
  enableRepair: boolean;
  enableValidation: boolean;
  batchSize?: number;
  temperature: number;
  model: string;
}

const DEFAULT_OPTIONS: MenuParsingOptions = {
  maxRetries: 3,
  enableRepair: true,
  enableValidation: true,
  temperature: 0,
  model: 'gpt-4o-mini'
};

/**
 * Parses menu text using GPT with robust error handling
 */
export async function parseMenuWithGPT(
  menuText: string,
  options: Partial<MenuParsingOptions> = {}
): Promise<MenuParsingResult> {
  const startTime = Date.now();
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  
  
  let lastError: string = '';
  let attempts = 0;
  
  for (attempts = 1; attempts <= finalOptions.maxRetries; attempts++) {
    try {
      
      // Step 1: Extract menu with GPT
      const extractedJSON = await extractMenuWithGPT(menuText, finalOptions);
      
      // Step 2: Validate JSON
      if (finalOptions.enableValidation) {
        const validation = validateMenuJSON(extractedJSON);
        if (validation.valid) {
          return {
            success: true,
            items: validation.items,
            json: extractedJSON,
            attempts,
            processingTime: Date.now() - startTime
          };
        } else {
          lastError = validation.errors.join(', ');
        }
      } else {
        // Skip validation, return as-is
        return {
          success: true,
          items: [],
          json: extractedJSON,
          attempts,
          processingTime: Date.now() - startTime
        };
      }
      
      // Step 3: Try to repair JSON if validation failed
      if (finalOptions.enableRepair && attempts < finalOptions.maxRetries) {
        const repairResult = repairAndValidateMenuJSON(extractedJSON);
        
        if (repairResult.success) {
          return {
            success: true,
            items: repairResult.items!,
            json: repairResult.json!,
            warnings: ['JSON was repaired during parsing'],
            attempts,
            processingTime: Date.now() - startTime
          };
        } else {
          lastError = repairResult.errors?.join(', ') || 'Repair failed';
        }
      }
      
      // Step 4: Try GPT repair if automatic repair failed
      if (attempts < finalOptions.maxRetries) {
        const gptRepairResult = await repairJSONWithGPT(extractedJSON, lastError, finalOptions);
        
        if (gptRepairResult.success) {
          return {
            success: true,
            items: gptRepairResult.items!,
            json: gptRepairResult.json!,
            warnings: ['JSON was repaired by GPT'],
            attempts,
            processingTime: Date.now() - startTime
          };
        } else {
          lastError = gptRepairResult.errors?.join(', ') || 'GPT repair failed';
        }
      }
      
    } catch (error: any) {
      logger.error(`[ROBUST_PARSER] Attempt ${attempts} failed:`, error);
      lastError = error.message;
      
      if (attempts === finalOptions.maxRetries) {
        break;
      }
      
      // Reduce retry delay for faster processing
      await new Promise(resolve => setTimeout(resolve, 500 * attempts));
    }
  }
  
  logger.error('[ROBUST_PARSER] All attempts failed');
  return {
    success: false,
    items: [],
    errors: [`Failed after ${attempts} attempts: ${lastError}`],
    attempts,
    processingTime: Date.now() - startTime
  };
}

/**
 * Extracts menu using GPT with the main extraction prompt
 */
async function extractMenuWithGPT(
  menuText: string,
  options: MenuParsingOptions
): Promise<string> {
  const openai = getOpenAI();
  
  const prompt = getPrompt('extract') + '\n\n' + menuText;
  
  const response = await openai.chat.completions.create({
    model: options.model,
    messages: [
      {
        role: 'system',
        content: 'You are a menu parsing expert. Extract menu items and return ONLY valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: options.temperature,
    max_tokens: 4000,
    response_format: { type: 'json_object' }
  });
  
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from GPT');
  }
  
  // Clean the response (remove markdown code blocks if present)
  const cleanedContent = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  
  return cleanedContent;
}

/**
 * Repairs JSON using GPT with the repair prompt
 */
async function repairJSONWithGPT(
  brokenJSON: string,
  errorMessage: string,
  options: MenuParsingOptions
): Promise<MenuParsingResult> {
  const openai = getOpenAI();
  
  const prompt = getPrompt('repair', {
    error: errorMessage,
    json: brokenJSON
  });
  
  try {
    const response = await openai.chat.completions.create({
      model: options.model,
      messages: [
        {
          role: 'system',
          content: 'You are a JSON repair expert. Fix the broken JSON and return ONLY the corrected JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0, // Deterministic for repair
      max_tokens: 4000
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT repair');
    }
    
    // Clean the response
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    // Validate the repaired JSON
    const validation = validateMenuJSON(cleanedContent);
    
    if (validation.valid) {
      return {
        success: true,
        items: validation.items,
        json: cleanedContent,
        attempts: 1,
        processingTime: 0
      };
    } else {
      return {
        success: false,
        items: [],
        errors: validation.errors,
        attempts: 1,
        processingTime: 0
      };
    }
    
  } catch (error: any) {
    return {
      success: false,
      items: [],
      errors: [`GPT repair failed: ${error.message}`],
      attempts: 1,
      processingTime: 0
    };
  }
}

/**
 * Parses menu in batches for large menus
 */
export async function parseMenuInBatches(
  menuText: string,
  options: Partial<MenuParsingOptions> = {}
): Promise<MenuParsingResult> {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const batchSize = finalOptions.batchSize || 2000; // characters per batch
  
  
  // Split menu text into batches
  const batches = splitTextIntoBatches(menuText, batchSize);
  
  const allItems: any[] = [];
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    const batchResult = await parseMenuWithGPT(batch, {
      ...finalOptions,
      maxRetries: 2 // Fewer retries for batches
    });
    
    if (batchResult.success) {
      allItems.push(...batchResult.items);
      if (batchResult.warnings) {
        allWarnings.push(...batchResult.warnings);
      }
    } else {
      allErrors.push(`Batch ${i + 1}: ${batchResult.errors?.join(', ')}`);
    }
  }
  
  // Deduplicate items across batches
  const uniqueItems = deduplicateItems(allItems);
  
  return {
    success: allErrors.length === 0,
    items: uniqueItems,
    errors: allErrors.length > 0 ? allErrors : undefined,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
    attempts: batches.length,
    processingTime: 0
  };
}

/**
 * Splits text into batches of specified size
 */
function splitTextIntoBatches(text: string, batchSize: number): string[] {
  const batches: string[] = [];
  let currentBatch = '';
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (currentBatch.length + line.length > batchSize && currentBatch.length > 0) {
      batches.push(currentBatch.trim());
      currentBatch = line;
    } else {
      currentBatch += (currentBatch ? '\n' : '') + line;
    }
  }
  
  if (currentBatch.trim()) {
    batches.push(currentBatch.trim());
  }
  
  return batches;
}

/**
 * Deduplicates items based on normalized title
 */
function deduplicateItems(items: any[]): any[] {
  const seen = new Set<string>();
  const unique: any[] = [];
  
  for (const item of items) {
    const normalizedTitle = item.title?.toLowerCase().trim();
    if (normalizedTitle && !seen.has(normalizedTitle)) {
      seen.add(normalizedTitle);
      unique.push(item);
    }
  }
  
  return unique;
}

/**
 * Validates menu parsing result
 */
export function validateMenuParsingResult(result: MenuParsingResult): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  if (!result.success) {
    issues.push('Menu parsing failed');
    return { isValid: false, issues, recommendations };
  }
  
  if (result.items.length === 0) {
    issues.push('No items extracted');
    recommendations.push('Check if menu text contains recognizable items with prices');
  }
  
  if (result.attempts > 1) {
    issues.push(`Required ${result.attempts} attempts to parse`);
    recommendations.push('Consider improving menu text quality or adjusting parsing parameters');
  }
  
  if (result.warnings && result.warnings.length > 0) {
    issues.push(`${result.warnings.length} warnings during parsing`);
  }
  
  // Check for common issues
  const itemsWithZeroPrice = result.items.filter(item => item.price <= 0);
  if (itemsWithZeroPrice.length > 0) {
    issues.push(`${itemsWithZeroPrice.length} items with zero or invalid prices`);
    recommendations.push('Review price extraction logic');
  }
  
  const itemsWithoutDescription = result.items.filter(item => !item.description || item.description.trim() === '');
  if (itemsWithoutDescription.length > result.items.length * 0.5) {
    issues.push('Many items missing descriptions');
    recommendations.push('Improve description extraction');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    recommendations
  };
}
