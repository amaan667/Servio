// =====================================================
// GPT CLASSIFICATION HELPERS (SAFE, CONSTRAINED PROMPTS)
// =====================================================
// Uses GPT sparingly as a classifier, not as an extractor

import { getOpenAI } from '../openai';
import { 
  TextBlock, 
  GPTClassificationResult, 
  OptionGroupResult 
} from './types';

/**
 * Classifies a text block using constrained GPT prompts
 */
export async function classifyTextBlock(
  block: TextBlock,
  contextBlocks: TextBlock[]
): Promise<GPTClassificationResult> {
  try {
    
    const openai = getOpenAI();
    
    // Build context from nearby blocks
    const context = contextBlocks
      .slice(0, 3) // Limit context to prevent token explosion
      .map(b => b.text)
      .join(' | ');
    
    const prompt = buildClassificationPrompt(block, context);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use cheaper model for classification
      messages: [
        {
          role: "system",
          content: `You are a menu parsing classifier. Classify text blocks into one of these categories:
- HEADER: Section headers (STARTERS, MAINS, etc.)
- ITEM: Main menu items with prices
- DESCRIPTION: Item descriptions
- MODIFIER: Options, extras, add-ons
- MARKETING: Promotional text, "about us"
- COMPONENT: Part of a set meal or platter

Return ONLY a JSON object with "type" and "confidence" (0-1).`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0, // Deterministic output
      max_tokens: 100, // Limit response size
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT');
    }
    
    const result = JSON.parse(content);
    
    // Validate response
    if (!result.type || !result.confidence) {
      throw new Error('Invalid GPT response format');
    }
    
    if (!['HEADER', 'ITEM', 'DESCRIPTION', 'MODIFIER', 'MARKETING', 'COMPONENT'].includes(result.type)) {
      throw new Error(`Invalid classification type: ${result.type}`);
    }
    
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      throw new Error(`Invalid confidence value: ${result.confidence}`);
    }
    
    
    return {
      type: result.type,
      confidence: result.confidence,
      reason: result.reason
    };
    
  } catch (error: any) {
    console.error('[GPT_CLASSIFY] Classification failed:', error);
    
    // Fallback to rule-based classification
    return fallbackClassification(block, contextBlocks);
  }
}

/**
 * Builds the classification prompt with context
 */
function buildClassificationPrompt(block: TextBlock, context: string): string {
  return `Classify this text block:

TEXT: "${block.text}"
CONTEXT: "${context}"
FONT_SIZE: ${block.fontSize || 'unknown'}
IS_BOLD: ${block.isBold || false}
IS_UPPERCASE: ${block.isUppercase || false}

Return JSON: {"type": "CATEGORY", "confidence": 0.95, "reason": "explanation"}`;
}

/**
 * Fallback rule-based classification when GPT fails
 */
function fallbackClassification(
  block: TextBlock, 
  contextBlocks: TextBlock[]
): GPTClassificationResult {
  const text = block.text.trim();
  
  // Rule-based classification
  if (text === text.toUpperCase() && text.length > 3 && !/^[£$€]\s*\d+/.test(text)) {
    return {
      type: 'HEADER',
      confidence: 0.8,
      reason: 'All caps text, likely section header'
    };
  }
  
  if (/^[£$€]\s*\d+(?:\.\d{1,2})?$/.test(text)) {
    return {
      type: 'MODIFIER',
      confidence: 0.9,
      reason: 'Price only, likely modifier'
    };
  }
  
  if (text.length < 10 && /^(extra|add|with|without)/i.test(text)) {
    return {
      type: 'MODIFIER',
      confidence: 0.8,
      reason: 'Short text with modifier keywords'
    };
  }
  
  if (text.length > 50 && !/^[£$€]/.test(text)) {
    return {
      type: 'DESCRIPTION',
      confidence: 0.7,
      reason: 'Long text without price, likely description'
    };
  }
  
  // Default to ITEM
  return {
    type: 'ITEM',
    confidence: 0.5,
    reason: 'Default classification'
  };
}

/**
 * Classifies option groups using constrained prompts
 */
export async function classifyOptionGroup(
  text: string,
  context: string
): Promise<OptionGroupResult | null> {
  try {
    
    const openai = getOpenAI();
    
    const prompt = buildOptionGroupPrompt(text, context);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an option group parser. Extract option groups from menu text.

Return JSON with:
- group: name of the option group (e.g., "Syrup", "Milk", "Size")
- choices: array of choice names
- price_add: additional price for the option
- confidence: 0-1

If this is not an option group, return null.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT');
    }
    
    const result = JSON.parse(content);
    
    // Check if result is null
    if (result === null || result.group === null) {
      return null;
    }
    
    // Validate result
    if (!result.group || !Array.isArray(result.choices) || typeof result.price_add !== 'number') {
      throw new Error('Invalid option group format');
    }
    
    
    return {
      group: result.group,
      choices: result.choices,
      priceAdd: result.price_add,
      confidence: result.confidence || 0.8
    };
    
  } catch (error: any) {
    console.error('[GPT_OPTIONS] Option group classification failed:', error);
    return null;
  }
}

/**
 * Builds the option group classification prompt
 */
function buildOptionGroupPrompt(text: string, context: string): string {
  return `Parse this text as an option group:

TEXT: "${text}"
CONTEXT: "${context}"

Examples:
- "Syrup Salted Caramel / Hazelnut / Vanilla £0.50" → {"group": "Syrup", "choices": ["Salted Caramel", "Hazelnut", "Vanilla"], "price_add": 0.5, "confidence": 0.9}
- "Extra Shot £0.50" → {"group": "Extras", "choices": ["Shot"], "price_add": 0.5, "confidence": 0.8}
- "Alternative Milk: Oat / Soy £0.50" → {"group": "Alternative Milk", "choices": ["Oat", "Soy"], "price_add": 0.5, "confidence": 0.9}

Return JSON or null if not an option group.`;
}

/**
 * Validates GPT classification results
 */
export function validateClassificationResult(result: GPTClassificationResult): boolean {
  const validTypes = ['HEADER', 'ITEM', 'DESCRIPTION', 'MODIFIER', 'MARKETING', 'COMPONENT'];
  
  return validTypes.includes(result.type) && 
         typeof result.confidence === 'number' && 
         result.confidence >= 0 && 
         result.confidence <= 1;
}

/**
 * Filters out low-confidence classifications
 */
export function filterLowConfidenceClassifications(
  results: GPTClassificationResult[],
  minConfidence: number = 0.7
): GPTClassificationResult[] {
  return results.filter(result => result.confidence >= minConfidence);
}

/**
 * Aggregates classification results for a set of blocks
 */
export function aggregateClassifications(
  results: Array<{ block: TextBlock; classification: GPTClassificationResult }>
): {
  headers: TextBlock[];
  items: TextBlock[];
  descriptions: TextBlock[];
  modifiers: TextBlock[];
  marketing: TextBlock[];
  components: TextBlock[];
} {
  const aggregated = {
    headers: [] as TextBlock[],
    items: [] as TextBlock[],
    descriptions: [] as TextBlock[],
    modifiers: [] as TextBlock[],
    marketing: [] as TextBlock[],
    components: [] as TextBlock[]
  };
  
  for (const { block, classification } of results) {
    switch (classification.type) {
      case 'HEADER':
        aggregated.headers.push(block);
        break;
      case 'ITEM':
        aggregated.items.push(block);
        break;
      case 'DESCRIPTION':
        aggregated.descriptions.push(block);
        break;
      case 'MODIFIER':
        aggregated.modifiers.push(block);
        break;
      case 'MARKETING':
        aggregated.marketing.push(block);
        break;
      case 'COMPONENT':
        aggregated.components.push(block);
        break;
    }
  }
  
  return aggregated;
}

/**
 * Batch classifies multiple blocks efficiently
 */
export async function batchClassifyBlocks(
  blocks: TextBlock[],
  contextWindow: number = 3
): Promise<Array<{ block: TextBlock; classification: GPTClassificationResult }>> {
  
  const results: Array<{ block: TextBlock; classification: GPTClassificationResult }> = [];
  
  // Process blocks in batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < blocks.length; i += batchSize) {
    const batch = blocks.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (block) => {
      const contextBlocks = blocks.slice(
        Math.max(0, i - contextWindow), 
        Math.min(blocks.length, i + batchSize + contextWindow)
      );
      
      const classification = await classifyTextBlock(block, contextBlocks);
      return { block, classification };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Reduce delay between batches for faster processing
    if (i + batchSize < blocks.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  return results;
}
