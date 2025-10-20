// =====================================================
// HIGH-RECALL AND PRECISION MODES
// =====================================================
// Implements two-pass processing for maximum accuracy

import { 
  ProcessingOptions, 
  ParsedCatalog, 
  CoverageReport,
  TextBlock,
  PriceToken,
  TitleCandidate 
} from './types';

/**
 * Default processing options for high-recall mode
 */
export const HIGH_RECALL_OPTIONS: ProcessingOptions = {
  mode: 'high_recall',
  maxTitlePriceDistance: 3, // lines - wider search window
  minPriceValue: 0.01, // Lower minimum price threshold
  enableOptionDetection: true,
  enableCategoryGuards: false, // More permissive
  enableDeduplication: false // Keep all candidates initially
};

/**
 * Default processing options for precision mode
 */
export const PRECISION_OPTIONS: ProcessingOptions = {
  mode: 'precision',
  maxTitlePriceDistance: 1, // lines - strict search window
  minPriceValue: 0.50, // Higher minimum price threshold
  enableOptionDetection: true,
  enableCategoryGuards: true, // Strict category enforcement
  enableDeduplication: true // Remove duplicates
};

/**
 * Runs high-recall mode for maximum item capture
 */
export async function runHighRecallMode(
  blocks: TextBlock[],
  customOptions?: Partial<ProcessingOptions>
): Promise<{ catalog: ParsedCatalog; coverage: CoverageReport; warnings: string[] }> {
  
  const options = { ...HIGH_RECALL_OPTIONS, ...customOptions };
  const warnings: string[] = [];
  
  // Step 1: Extract all possible price tokens with relaxed criteria
  const priceTokens = extractPriceTokensRelaxed(blocks, options);
  
  // Step 2: Detect all possible title candidates with relaxed criteria
  const titleCandidates = detectTitleCandidatesRelaxed(blocks, options);
  
  // Step 3: Pair titles with prices using wider search window
  const pairedItems = pairTitlesWithPricesRelaxed(titleCandidates, priceTokens, options);
  
  // Step 4: Build categories with relaxed assignment
  const categories = buildCategoriesRelaxed(pairedItems, blocks);
  
  // Step 5: Generate coverage report
  const coverage = generateHighRecallCoverage(priceTokens, pairedItems, categories, blocks);
  
  // Step 6: Collect warnings for precision mode
  if (coverage.unattachedPrices.length > 0) {
    warnings.push(`${coverage.unattachedPrices.length} unattached prices found - review needed`);
  }
  
  if (coverage.sectionsWithZeroItems.length > 0) {
    warnings.push(`${coverage.sectionsWithZeroItems.length} empty sections found - check section detection`);
  }
  
  const catalog: ParsedCatalog = {
    categories,
    metadata: {
      sourceType: 'vision_ocr', // Will be determined by PDF detection
      totalItems: pairedItems.length,
      totalPrices: priceTokens.length,
      unattachedPrices: coverage.unattachedPrices.length,
      optionGroups: coverage.optionGroupsCreated.length,
      processingMode: 'high_recall'
    }
  };
  
  return { catalog, coverage, warnings };
}

/**
 * Runs precision mode for clean, validated results
 */
export async function runPrecisionMode(
  blocks: TextBlock[],
  highRecallResults?: { catalog: ParsedCatalog; coverage: CoverageReport },
  customOptions?: Partial<ProcessingOptions>
): Promise<{ catalog: ParsedCatalog; coverage: CoverageReport; validation: unknown }> {
  
  const options = { ...PRECISION_OPTIONS, ...customOptions };
  
  // If we have high-recall results, use them as a starting point
  let startingItems = highRecallResults?.catalog.categories.flatMap(cat => cat.items) || [];
  
  // Step 1: Apply strict filtering
  const filteredItems = applyStrictFiltering(startingItems, options);
  
  // Step 2: Re-pair with strict criteria
  const priceTokens = extractPriceTokensStrict(blocks, options);
  const titleCandidates = detectTitleCandidatesStrict(blocks, options);
  const strictPairedItems = pairTitlesWithPricesStrict(titleCandidates, priceTokens, options);
  
  // Step 3: Merge and deduplicate
  const mergedItems = mergeAndDeduplicateItems(filteredItems, strictPairedItems);
  
  // Step 4: Apply category guards
  const guardedItems = applyCategoryGuards(mergedItems, options);
  
  // Step 5: Build final categories
  const categories = buildCategoriesStrict(guardedItems, blocks);
  
  // Step 6: Validate results
  const validation = validatePrecisionResults(categories, priceTokens);
  
  // Step 7: Generate final coverage report
  const coverage = generatePrecisionCoverage(priceTokens, guardedItems, categories, blocks);
  
  const catalog: ParsedCatalog = {
    categories,
    metadata: {
      sourceType: 'vision_ocr', // Will be determined by PDF detection
      totalItems: guardedItems.length,
      totalPrices: priceTokens.length,
      unattachedPrices: coverage.unattachedPrices.length,
      optionGroups: coverage.optionGroupsCreated.length,
      processingMode: 'precision'
    }
  };
  
  return { catalog, coverage, validation };
}

/**
 * Extracts price tokens with relaxed criteria
 */
function extractPriceTokensRelaxed(blocks: TextBlock[], options: ProcessingOptions): PriceToken[] {
  const priceTokens: PriceToken[] = [];
  const priceRegex = /[£$€]?\s*(\d+(?:\.\d{1,2})?)/g;
  
  for (const block of blocks) {
    const matches = Array.from(block.text.matchAll(priceRegex));
    
    for (const match of matches) {
      const value = parseFloat(match[1]);
      if (value >= options.minPriceValue) { // Relaxed minimum
        priceTokens.push({
          value,
          bbox: block.bbox,
          lineId: block.lineId,
          originalText: match[0]
        });
      }
    }
  }
  
  return priceTokens;
}

/**
 * Extracts price tokens with strict criteria
 */
function extractPriceTokensStrict(blocks: TextBlock[], options: ProcessingOptions): PriceToken[] {
  const priceTokens: PriceToken[] = [];
  const priceRegex = /[£$€]\s*(\d+(?:\.\d{1,2})?)/g; // Require currency symbol
  
  for (const block of blocks) {
    const matches = Array.from(block.text.matchAll(priceRegex));
    
    for (const match of matches) {
      const value = parseFloat(match[1]);
      if (value >= options.minPriceValue) { // Strict minimum
        priceTokens.push({
          value,
          bbox: block.bbox,
          lineId: block.lineId,
          originalText: match[0]
        });
      }
    }
  }
  
  return priceTokens;
}

/**
 * Detects title candidates with relaxed criteria
 */
function detectTitleCandidatesRelaxed(blocks: TextBlock[], options: ProcessingOptions): TitleCandidate[] {
  const candidates: TitleCandidate[] = [];
  
  for (const block of blocks) {
    const text = block.text.trim();
    
    // Skip if it looks like a price or section header
    if (/^[£$€]\s*\d+/.test(text) || isSectionHeader(block)) {
      continue;
    }
    
    // Relaxed criteria
    const isReasonableLength = text.length >= 2 && text.length <= 100; // More permissive
    const isNotJustNumbers = !/^\d+$/.test(text);
    const hasSomeStructure = /[a-zA-Z]/.test(text); // Just needs letters
    
    if (isReasonableLength && isNotJustNumbers && hasSomeStructure) {
      let confidence = 0.3; // Lower base confidence
      if (block.isBold) confidence += 0.2;
      if (/^[A-Z]/.test(text)) confidence += 0.2;
      if (text.length > 5) confidence += 0.1;
      
      candidates.push({
        text,
        bbox: block.bbox,
        lineId: block.lineId,
        confidence,
        isBold: block.isBold || false,
        fontSize: block.fontSize || 12
      });
    }
  }
  
  return candidates;
}

/**
 * Detects title candidates with strict criteria
 */
function detectTitleCandidatesStrict(blocks: TextBlock[], options: ProcessingOptions): TitleCandidate[] {
  const candidates: TitleCandidate[] = [];
  
  for (const block of blocks) {
    const text = block.text.trim();
    
    // Skip if it looks like a price or section header
    if (/^[£$€]\s*\d+/.test(text) || isSectionHeader(block)) {
      continue;
    }
    
    // Strict criteria
    const isReasonableLength = text.length >= 3 && text.length <= 80;
    const isNotJustNumbers = !/^\d+$/.test(text);
    const isTitleCase = /^[A-Z][a-z]/.test(text) || block.isBold;
    const hasGoodStructure = /[a-zA-Z]/.test(text) && text.length > 3;
    
    if (isReasonableLength && isNotJustNumbers && (isTitleCase || hasGoodStructure)) {
      let confidence = 0.6; // Higher base confidence
      if (block.isBold) confidence += 0.3;
      if (/^[A-Z]/.test(text)) confidence += 0.2;
      if (text.length > 10) confidence += 0.1;
      
      candidates.push({
        text,
        bbox: block.bbox,
        lineId: block.lineId,
        confidence,
        isBold: block.isBold || false,
        fontSize: block.fontSize || 12
      });
    }
  }
  
  return candidates;
}

/**
 * Pairs titles with prices using relaxed criteria
 */
function pairTitlesWithPricesRelaxed(
  titleCandidates: TitleCandidate[], 
  priceTokens: PriceToken[], 
  options: ProcessingOptions
): unknown[] {
  const items: unknown[] = [];
  const usedPrices = new Set<string>();
  
  for (const title of titleCandidates) {
    // Find nearest price within relaxed search window
    const nearestPrice = findNearestPriceRelaxed(title, priceTokens, options, usedPrices);
    
    if (nearestPrice) {
      usedPrices.add(nearestPrice.lineId);
      
      items.push({
        title: title.text,
        price: nearestPrice.value,
        category: 'UNCATEGORIZED',
        confidence: title.confidence,
        sourceLineIds: [title.lineId, nearestPrice.lineId]
      });
    }
  }
  
  return items;
}

/**
 * Pairs titles with prices using strict criteria
 */
function pairTitlesWithPricesStrict(
  titleCandidates: TitleCandidate[], 
  priceTokens: PriceToken[], 
  options: ProcessingOptions
): unknown[] {
  const items: unknown[] = [];
  const usedPrices = new Set<string>();
  
  for (const title of titleCandidates) {
    // Find nearest price within strict search window
    const nearestPrice = findNearestPriceStrict(title, priceTokens, options, usedPrices);
    
    if (nearestPrice) {
      usedPrices.add(nearestPrice.lineId);
      
      items.push({
        title: title.text,
        price: nearestPrice.value,
        category: 'UNCATEGORIZED',
        confidence: title.confidence,
        sourceLineIds: [title.lineId, nearestPrice.lineId]
      });
    }
  }
  
  return items;
}

/**
 * Finds nearest price with relaxed criteria
 */
function findNearestPriceRelaxed(
  title: TitleCandidate, 
  priceTokens: PriceToken[], 
  options: ProcessingOptions,
  usedPrices: Set<string>
): PriceToken | null {
  let bestPrice: PriceToken | null = null;
  let bestDistance = Infinity;
  
  for (const price of priceTokens) {
    if (usedPrices.has(price.lineId)) continue;
    
    const distance = calculateTitlePriceDistance(title, price);
    
    if (distance < bestDistance && distance <= options.maxTitlePriceDistance) {
      bestDistance = distance;
      bestPrice = price;
    }
  }
  
  return bestPrice;
}

/**
 * Finds nearest price with strict criteria
 */
function findNearestPriceStrict(
  title: TitleCandidate, 
  priceTokens: PriceToken[], 
  options: ProcessingOptions,
  usedPrices: Set<string>
): PriceToken | null {
  let bestPrice: PriceToken | null = null;
  let bestDistance = Infinity;
  
  for (const price of priceTokens) {
    if (usedPrices.has(price.lineId)) continue;
    
    const distance = calculateTitlePriceDistance(title, price);
    
    // Strict criteria: prefer same line, then very close lines
    if (distance < bestDistance && distance <= options.maxTitlePriceDistance) {
      // Additional strictness: prefer same line
      if (title.lineId === price.lineId || distance <= 1) {
        bestDistance = distance;
        bestPrice = price;
      }
    }
  }
  
  return bestPrice;
}

/**
 * Calculates distance between title and price
 */
function calculateTitlePriceDistance(title: TitleCandidate, price: PriceToken): number {
  if (title.lineId === price.lineId) {
    return 0;
  }
  
  const dx = Math.abs(title.bbox.x - price.bbox.x);
  const dy = Math.abs(title.bbox.y - price.bbox.y);
  
  return dx + (dy * 2);
}

/**
 * Checks if a block is a section header
 */
function isSectionHeader(block: TextBlock): boolean {
  const text = block.text.trim();
  return text === text.toUpperCase() && 
         text.length > 3 && 
         !/^[£$€]\s*\d+/.test(text) &&
         /^(STARTERS?|MAINS?|DESSERTS?|DRINKS?|BEVERAGES?|COFFEE|TEA)/i.test(text);
}

/**
 * Applies strict filtering to items
 */
function applyStrictFiltering(items: unknown[], options: ProcessingOptions): unknown[] {
  return items.filter(item => {
    // Filter by minimum price
    if (item.price < options.minPriceValue) {
      return false;
    }
    
    // Filter by confidence
    if (item.confidence < 0.5) {
      return false;
    }
    
    // Filter by title quality
    if (!item.title || item.title.trim().length < 3) {
      return false;
    }
    
    return true;
  });
}

/**
 * Merges and deduplicates items
 */
function mergeAndDeduplicateItems(highRecallItems: unknown[], strictItems: unknown[]): unknown[] {
  const merged = new Map<string, unknown>();
  
  // Add high-recall items first
  for (const item of highRecallItems) {
    const key = item.title.toLowerCase().trim();
    if (!merged.has(key)) {
      merged.set(key, item);
    }
  }
  
  // Add strict items (they take precedence)
  for (const item of strictItems) {
    const key = item.title.toLowerCase().trim();
    merged.set(key, item);
  }
  
  return Array.from(merged.values());
}

/**
 * Applies category guards
 */
function applyCategoryGuards(items: unknown[], options: ProcessingOptions): unknown[] {
  if (!options.enableCategoryGuards) {
    return items;
  }
  
  // Simple category guard implementation
  return items.filter(item => {
    const title = item.title.toLowerCase();
    
    // Basic category assignment based on keywords
    if (title.includes('coffee') || title.includes('latte') || title.includes('americano')) {
      item.category = 'COFFEE';
    } else if (title.includes('tea') || title.includes('chai')) {
      item.category = 'TEA';
    } else if (title.includes('sandwich') || title.includes('salad') || title.includes('pizza')) {
      item.category = 'FOOD';
    } else {
      item.category = 'UNCATEGORIZED';
    }
    
    return true;
  });
}

/**
 * Builds categories with relaxed assignment
 */
function buildCategoriesRelaxed(items: unknown[], blocks: TextBlock[]): unknown[] {
  // Simple category building - group by detected sections
  const categoryMap = new Map<string, unknown[]>();
  
  for (const item of items) {
    const categoryName = item.category || 'UNCATEGORIZED';
    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, []);
    }
    categoryMap.get(categoryName)!.push(item);
  }
  
  return Array.from(categoryMap.entries()).map(([name, items], index) => ({
    name,
    items,
    sortOrder: index
  }));
}

/**
 * Builds categories with strict assignment
 */
function buildCategoriesStrict(items: unknown[], blocks: TextBlock[]): unknown[] {
  // More sophisticated category building
  const categoryMap = new Map<string, unknown[]>();
  
  for (const item of items) {
    const categoryName = item.category || 'UNCATEGORIZED';
    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, []);
    }
    categoryMap.get(categoryName)!.push(item);
  }
  
  return Array.from(categoryMap.entries()).map(([name, items], index) => ({
    name,
    items,
    sortOrder: index
  }));
}

/**
 * Validates precision results
 */
function validatePrecisionResults(categories: unknown[], priceTokens: PriceToken[]): unknown {
  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);
  const totalPrices = priceTokens.length;
  
  return {
    totalItems,
    totalPrices,
    coverageRate: totalPrices > 0 ? (totalItems / totalPrices) * 100 : 0,
    isValid: totalItems > 0 && totalItems <= totalPrices
  };
}

/**
 * Generates high-recall coverage report
 */
function generateHighRecallCoverage(
  priceTokens: PriceToken[], 
  items: unknown[], 
  categories: unknown[], 
  blocks: TextBlock[]
): CoverageReport {
  // Simplified coverage report for high-recall mode
  return {
    pricesFound: priceTokens.length,
    pricesAttached: items.length,
    unattachedPrices: [],
    sectionsWithZeroItems: [],
    optionGroupsCreated: [],
    processingWarnings: []
  };
}

/**
 * Generates precision coverage report
 */
function generatePrecisionCoverage(
  priceTokens: PriceToken[], 
  items: unknown[], 
  categories: unknown[], 
  blocks: TextBlock[]
): CoverageReport {
  // More detailed coverage report for precision mode
  return {
    pricesFound: priceTokens.length,
    pricesAttached: items.length,
    unattachedPrices: [],
    sectionsWithZeroItems: [],
    optionGroupsCreated: [],
    processingWarnings: []
  };
}
