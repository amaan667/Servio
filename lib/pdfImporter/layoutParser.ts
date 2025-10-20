// =====================================================
// LAYOUT-AWARE PARSING WITH COORDINATE-BASED PAIRING
// =====================================================
// Implements two-pass, layout-aware parsing for maximum accuracy

import { 
  TextBlock, 
  PriceToken, 
  TitleCandidate, 
  ParsedItem, 
  ParsedCategory, 
  ReadingOrder, 
  ColumnInfo, 
  SectionInfo,
  ProcessingOptions 
} from './types';

/**
 * Main layout parsing function - orchestrates the two-pass approach
 */
export async function parseLayout(
  blocks: TextBlock[], 
  options: ProcessingOptions
): Promise<{ categories: ParsedCategory[], coverage: unknown }> {
  
  // Step 1: Page layout & reading order
  const readingOrder = analyzePageLayout(blocks);
  
  // Step 2: Structural detection
  const sections = detectSections(readingOrder.lines);
  
  // Step 3: Extract price tokens and title candidates
  const priceTokens = extractPriceTokens(readingOrder.lines);
  const titleCandidates = detectTitleCandidates(readingOrder.lines);
  
  
  // Step 4: Title↔Price pairing (layout-aware)
  const pairedItems = pairTitlesWithPrices(titleCandidates, priceTokens, options);
  
  // Step 5: Build categories
  const categories = buildCategories(pairedItems, sections);
  
  // Step 6: Generate coverage report
  const coverage = generateCoverageReport(priceTokens, pairedItems, sections);
  
  return { categories, coverage };
}

/**
 * Analyzes page layout and determines reading order
 */
function analyzePageLayout(blocks: TextBlock[]): ReadingOrder {
  // Sort blocks by y-coordinate first, then x-coordinate
  const sortedBlocks = [...blocks].sort((a, b) => {
    const yDiff = a.bbox.y - b.bbox.y;
    if (Math.abs(yDiff) > 10) return yDiff; // Different lines
    return a.bbox.x - b.bbox.x; // Same line, sort by x
  });
  
  // Detect columns using k-means clustering on x-coordinates
  const columns = detectColumns(sortedBlocks);
  
  // Sort lines within each column
  const lines = sortLinesInReadingOrder(sortedBlocks, columns);
  
  return {
    columns,
    lines,
    sections: [] // Will be populated later
  };
}

/**
 * Detects columns using k-means clustering on x-coordinates
 */
function detectColumns(blocks: TextBlock[]): ColumnInfo[] {
  if (blocks.length === 0) return [];
  
  // Extract x-coordinates
  const xCoords = blocks.map(block => block.bbox.x);
  
  // Simple k-means with k=1,2,3
  let bestColumns: ColumnInfo[] = [];
  let bestScore = Infinity;
  
  for (let k = 1; k <= 3; k++) {
    const columns = kMeansColumns(xCoords, k);
    const score = calculateColumnScore(blocks, columns);
    
    if (score < bestScore) {
      bestScore = score;
      bestColumns = columns;
    }
  }
  
  // Assign blocks to columns
  for (const column of bestColumns) {
    column.blocks = blocks.filter(block => 
      block.bbox.x >= column.x && 
      block.bbox.x < column.x + column.width
    );
  }
  
  return bestColumns;
}

/**
 * Simple k-means clustering for column detection
 */
function kMeansColumns(xCoords: number[], k: number): ColumnInfo[] {
  if (k === 1) {
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    return [{ x: minX, width: maxX - minX, blocks: [] }];
  }
  
  // Initialize centroids
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const centroids: number[] = [];
  
  for (let i = 0; i < k; i++) {
    centroids.push(minX + (i * (maxX - minX)) / (k - 1));
  }
  
  // Iterate until convergence
  let iterations = 0;
  while (iterations < 10) {
    const clusters: number[][] = Array(k).fill(null).map(() => []);
    
    // Assign each point to nearest centroid
    for (const x of xCoords) {
      let nearestCentroid = 0;
      let minDistance = Math.abs(x - centroids[0]);
      
      for (let i = 1; i < k; i++) {
        const distance = Math.abs(x - centroids[i]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestCentroid = i;
        }
      }
      
      clusters[nearestCentroid].push(x);
    }
    
    // Update centroids
    const newCentroids: number[] = [];
    for (const cluster of clusters) {
      if (cluster.length > 0) {
        newCentroids.push(cluster.reduce((sum, x) => sum + x, 0) / cluster.length);
      } else {
        newCentroids.push(0);
      }
    }
    
    // Check for convergence
    let converged = true;
    for (let i = 0; i < k; i++) {
      if (Math.abs(centroids[i] - newCentroids[i]) > 1) {
        converged = false;
        break;
      }
    }
    
    if (converged) break;
    centroids.splice(0, centroids.length, ...newCentroids);
    iterations++;
  }
  
  // Create column info
  const columns: ColumnInfo[] = [];
  for (let i = 0; i < k; i++) {
    const clusterXCoords = xCoords.filter((x, idx) => {
      let nearestCentroid = 0;
      let minDistance = Math.abs(x - centroids[0]);
      
      for (let j = 1; j < k; j++) {
        const distance = Math.abs(x - centroids[j]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestCentroid = j;
        }
      }
      
      return nearestCentroid === i;
    });
    
    if (clusterXCoords.length > 0) {
      const minX = Math.min(...clusterXCoords);
      const maxX = Math.max(...clusterXCoords);
      columns.push({
        x: minX,
        width: maxX - minX,
        blocks: []
      });
    }
  }
  
  return columns;
}

/**
 * Calculates score for column configuration (lower is better)
 */
function calculateColumnScore(blocks: TextBlock[], columns: ColumnInfo[]): number {
  let score = 0;
  
  for (const block of blocks) {
    let minDistance = Infinity;
    for (const column of columns) {
      const distance = Math.min(
        Math.abs(block.bbox.x - column.x),
        Math.abs(block.bbox.x - (column.x + column.width))
      );
      minDistance = Math.min(minDistance, distance);
    }
    score += minDistance;
  }
  
  return score;
}

/**
 * Sorts lines in reading order (top to bottom, left to right)
 */
function sortLinesInReadingOrder(blocks: TextBlock[], columns: ColumnInfo[]): TextBlock[] {
  // Group blocks by approximate line (y-coordinate)
  const lineGroups = new Map<number, TextBlock[]>();
  
  for (const block of blocks) {
    const lineY = Math.round(block.bbox.y / 10) * 10; // Round to nearest 10px
    if (!lineGroups.has(lineY)) {
      lineGroups.set(lineY, []);
    }
    lineGroups.get(lineY)!.push(block);
  }
  
  // Sort lines by y-coordinate, then sort blocks within each line by x-coordinate
  const sortedLines: TextBlock[] = [];
  const sortedLineYs = Array.from(lineGroups.keys()).sort((a, b) => a - b);
  
  for (const lineY of sortedLineYs) {
    const lineBlocks = lineGroups.get(lineY)!;
    lineBlocks.sort((a, b) => a.bbox.x - b.bbox.x);
    sortedLines.push(...lineBlocks);
  }
  
  return sortedLines;
}

/**
 * Detects section headers (large font, ALLCAPS, etc.)
 */
function detectSections(lines: TextBlock[]): SectionInfo[] {
  const sections: SectionInfo[] = [];
  let currentSection: SectionInfo | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line looks like a section header
    if (isSectionHeader(line)) {
      // Close previous section
      if (currentSection) {
        currentSection.endLine = i - 1;
        sections.push(currentSection);
      }
      
      // Start new section
      currentSection = {
        name: line.text,
        startLine: i,
        endLine: i,
        bbox: line.bbox,
        confidence: line.confidence || 0.8
      };
    }
  }
  
  // Close last section
  if (currentSection) {
    currentSection.endLine = lines.length - 1;
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Checks if a text block looks like a section header
 */
function isSectionHeader(block: TextBlock): boolean {
  const text = block.text.trim();
  
  // Must be reasonably long and not just a price
  if (text.length < 3 || /^[£$€]\s*\d+/.test(text)) {
    return false;
  }
  
  // Check for header characteristics
  const isAllCaps = text === text.toUpperCase();
  const isBold = block.isBold || false;
  const isLargeFont = (block.fontSize || 12) > 14;
  const hasCommonHeaderWords = /^(STARTERS?|MAINS?|DESSERTS?|DRINKS?|BEVERAGES?|COFFEE|TEA|APPETIZERS?|ENTREES?|SIDES?|SPECIALS?|LUNCH|DINNER|BREAKFAST)/i.test(text);
  
  // Score the likelihood of being a header
  let score = 0;
  if (isAllCaps) score += 3;
  if (isBold) score += 2;
  if (isLargeFont) score += 2;
  if (hasCommonHeaderWords) score += 4;
  
  return score >= 4;
}

/**
 * Extracts price tokens from text blocks
 */
function extractPriceTokens(lines: TextBlock[]): PriceToken[] {
  const priceTokens: PriceToken[] = [];
  const priceRegex = /[£$€]?\s*(\d+(?:\.\d{1,2})?)/g;
  
  for (const line of lines) {
    const matches = Array.from(line.text.matchAll(priceRegex));
    
    for (const match of matches) {
      const value = parseFloat(match[1]);
      if (value > 0) { // Only valid prices
        priceTokens.push({
          value,
          bbox: line.bbox,
          lineId: line.lineId,
          originalText: match[0]
        });
      }
    }
  }
  
  return priceTokens;
}

/**
 * Detects title candidates (bold, title-case, leading tokens)
 */
function detectTitleCandidates(lines: TextBlock[]): TitleCandidate[] {
  const candidates: TitleCandidate[] = [];
  
  for (const line of lines) {
    const text = line.text.trim();
    
    // Skip if it looks like a price or section header
    if (/^[£$€]\s*\d+/.test(text) || isSectionHeader(line)) {
      continue;
    }
    
    // Check for title characteristics
    const isBold = line.isBold || false;
    const isTitleCase = /^[A-Z][a-z]/.test(text);
    const isReasonableLength = text.length >= 3 && text.length <= 80;
    const isNotJustNumbers = !/^\d+$/.test(text);
    
    if (isReasonableLength && isNotJustNumbers && (isBold || isTitleCase)) {
      let confidence = 0.5;
      if (isBold) confidence += 0.3;
      if (isTitleCase) confidence += 0.2;
      if (text.length > 10) confidence += 0.1;
      
      candidates.push({
        text,
        bbox: line.bbox,
        lineId: line.lineId,
        confidence,
        isBold,
        fontSize: line.fontSize || 12
      });
    }
  }
  
  return candidates;
}

/**
 * Pairs titles with prices using layout-aware algorithm
 */
function pairTitlesWithPrices(
  titleCandidates: TitleCandidate[], 
  priceTokens: PriceToken[], 
  options: ProcessingOptions
): ParsedItem[] {
  const items: ParsedItem[] = [];
  const usedPrices = new Set<string>();
  
  for (const title of titleCandidates) {
    // Find nearest price within search window
    const nearestPrice = findNearestPrice(title, priceTokens, options, usedPrices);
    
    if (nearestPrice) {
      usedPrices.add(nearestPrice.lineId);
      
      items.push({
        title: title.text,
        price: nearestPrice.value,
        category: 'UNCATEGORIZED', // Will be assigned later
        confidence: title.confidence,
        sourceLineIds: [title.lineId, nearestPrice.lineId]
      });
    }
  }
  
  return items;
}

/**
 * Finds the nearest price to a title candidate
 */
function findNearestPrice(
  title: TitleCandidate, 
  priceTokens: PriceToken[], 
  options: ProcessingOptions,
  usedPrices: Set<string>
): PriceToken | null {
  let bestPrice: PriceToken | null = null;
  let bestDistance = Infinity;
  
  for (const price of priceTokens) {
    if (usedPrices.has(price.lineId)) continue;
    
    // Calculate distance (prioritize same line, then nearby lines)
    const distance = calculateTitlePriceDistance(title, price);
    
    if (distance < bestDistance && distance <= options.maxTitlePriceDistance) {
      bestDistance = distance;
      bestPrice = price;
    }
  }
  
  return bestPrice;
}

/**
 * Calculates distance between title and price (lower is better)
 */
function calculateTitlePriceDistance(title: TitleCandidate, price: PriceToken): number {
  // Same line: very high priority
  if (title.lineId === price.lineId) {
    return 0;
  }
  
  // Calculate spatial distance
  const dx = Math.abs(title.bbox.x - price.bbox.x);
  const dy = Math.abs(title.bbox.y - price.bbox.y);
  
  // Prioritize horizontal proximity over vertical
  return dx + (dy * 2);
}

/**
 * Builds categories from paired items and sections
 */
function buildCategories(items: ParsedItem[], sections: SectionInfo[]): ParsedCategory[] {
  const categoryMap = new Map<string, ParsedItem[]>();
  
  // Assign items to categories based on sections
  for (const item of items) {
    let categoryName = 'UNCATEGORIZED';
    
    // Find the section this item belongs to
    for (const section of sections) {
      // This is a simplified assignment - in practice, you'd use line numbers
      if (item.sourceLineIds.some(lineId => 
        parseInt(lineId.split('_')[1]) >= section.startLine && 
        parseInt(lineId.split('_')[1]) <= section.endLine
      )) {
        categoryName = section.name;
        break;
      }
    }
    
    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, []);
    }
    categoryMap.get(categoryName)!.push(item);
  }
  
  // Convert to ParsedCategory array
  const categories: ParsedCategory[] = [];
  let sortOrder = 0;
  
  for (const [name, categoryItems] of categoryMap) {
    categories.push({
      name,
      items: categoryItems,
      sortOrder: sortOrder++
    });
  }
  
  return categories;
}

/**
 * Generates coverage report for accuracy proof
 */
function generateCoverageReport(
  priceTokens: PriceToken[], 
  items: ParsedItem[], 
  sections: SectionInfo[]
): unknown {
  const usedPriceLineIds = new Set<string>();
  
  for (const item of items) {
    for (const lineId of item.sourceLineIds) {
      usedPriceLineIds.add(lineId);
    }
  }
  
  const unattachedPrices = priceTokens.filter(price => 
    !usedPriceLineIds.has(price.lineId)
  );
  
  const sectionsWithZeroItems = sections.filter(section => 
    items.every(item => !item.sourceLineIds.some(lineId => 
      parseInt(lineId.split('_')[1]) >= section.startLine && 
      parseInt(lineId.split('_')[1]) <= section.endLine
    ))
  );
  
  return {
    pricesFound: priceTokens.length,
    pricesAttached: priceTokens.length - unattachedPrices.length,
    unattachedPrices: unattachedPrices.map(price => ({
      text: price.originalText,
      bbox: price.bbox,
      lineId: price.lineId,
      reason: 'No nearby title found'
    })),
    sectionsWithZeroItems: sectionsWithZeroItems.map(s => s.name),
    optionGroupsCreated: [], // Will be populated by options system
    processingWarnings: []
  };
}
