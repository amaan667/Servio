// =====================================================
// COVERAGE REPORTING FOR ACCURACY PROOF
// =====================================================
// Generates comprehensive reports to prove nothing was missed

import { 
  PriceToken, 
  ParsedItem, 
  ParsedCategory, 
  CoverageReport, 
  TextBlock,
  BoundingBox 
} from './types';

/**
 * Generates comprehensive coverage report for accuracy proof
 */
export function generateCoverageReport(
  priceTokens: PriceToken[],
  items: ParsedItem[],
  categories: ParsedCategory[],
  blocks: TextBlock[],
  processingWarnings: string[] = []
): CoverageReport {
  console.log('[COVERAGE_REPORT] Generating coverage report...');
  
  // Track which prices have been attached to items
  const attachedPriceLineIds = new Set<string>();
  const attachedPriceValues = new Set<number>();
  
  for (const item of items) {
    for (const lineId of item.sourceLineIds) {
      attachedPriceLineIds.add(lineId);
    }
    
    // Track the main price
    attachedPriceValues.add(item.price);
    
    // Track variant prices
    if (item.variants) {
      for (const variant of item.variants) {
        attachedPriceValues.add(variant.price);
      }
    }
  }
  
  // Find unattached prices
  const unattachedPrices = priceTokens.filter(price => 
    !attachedPriceLineIds.has(price.lineId)
  );
  
  // Find sections with zero items
  const sectionsWithZeroItems = categories.filter(category => 
    category.items.length === 0
  ).map(category => category.name);
  
  // Count option groups created
  const optionGroupsCreated = categories.flatMap(category => 
    category.items.flatMap(item => 
      (item.options || []).map(option => ({
        group: option.group,
        itemCount: 1,
        choiceCount: option.choices.length
      }))
    )
  );
  
  // Group option groups by name
  const optionGroupSummary = new Map<string, { itemCount: number; choiceCount: number }>();
  for (const group of optionGroupsCreated) {
    if (optionGroupSummary.has(group.group)) {
      const existing = optionGroupSummary.get(group.group)!;
      existing.itemCount += group.itemCount;
      existing.choiceCount += group.choiceCount;
    } else {
      optionGroupSummary.set(group.group, {
        itemCount: group.itemCount,
        choiceCount: group.choiceCount
      });
    }
  }
  
  const report: CoverageReport = {
    pricesFound: priceTokens.length,
    pricesAttached: priceTokens.length - unattachedPrices.length,
    unattachedPrices: unattachedPrices.map(price => ({
      text: price.originalText,
      bbox: price.bbox,
      lineId: price.lineId,
      reason: determineUnattachedReason(price, blocks, items)
    })),
    sectionsWithZeroItems,
    optionGroupsCreated: Array.from(optionGroupSummary.entries()).map(([group, stats]) => ({
      group,
      itemCount: stats.itemCount,
      choiceCount: stats.choiceCount
    })),
    processingWarnings
  };
  
  console.log('[COVERAGE_REPORT] Report generated:', {
    pricesFound: report.pricesFound,
    pricesAttached: report.pricesAttached,
    unattachedCount: report.unattachedPrices.length,
    emptySections: report.sectionsWithZeroItems.length,
    optionGroups: report.optionGroupsCreated.length
  });
  
  return report;
}

/**
 * Determines why a price was not attached to any item
 */
function determineUnattachedReason(
  price: PriceToken, 
  blocks: TextBlock[], 
  items: ParsedItem[]
): string {
  // Find the block containing this price
  const priceBlock = blocks.find(block => block.lineId === price.lineId);
  if (!priceBlock) {
    return 'Price block not found';
  }
  
  // Check if there are nearby title candidates
  const nearbyBlocks = blocks.filter(block => {
    const dx = Math.abs(block.bbox.x - priceBlock.bbox.x);
    const dy = Math.abs(block.bbox.y - priceBlock.bbox.y);
    return dx < 200 && dy < 50;
  });
  
  const nearbyTitles = nearbyBlocks.filter(block => 
    !isPriceBlock(block) && !isSectionHeader(block) && block.text.trim().length > 2
  );
  
  if (nearbyTitles.length === 0) {
    return 'No nearby title candidates found';
  }
  
  // Check if price is too far from any title
  const minDistance = Math.min(...nearbyTitles.map(title => 
    Math.abs(title.bbox.y - priceBlock.bbox.y)
  ));
  
  if (minDistance > 30) {
    return `Too far from nearest title (${minDistance}px)`;
  }
  
  // Check if price is in a modifier/option context
  if (isModifierContext(priceBlock, nearbyBlocks)) {
    return 'Price appears to be for a modifier/option, not a main item';
  }
  
  return 'No suitable title found within search window';
}

/**
 * Checks if a block contains a price
 */
function isPriceBlock(block: TextBlock): boolean {
  return /^[£$€]\s*\d+(?:\.\d{1,2})?$/.test(block.text.trim());
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
 * Checks if a price is in a modifier/option context
 */
function isModifierContext(priceBlock: TextBlock, nearbyBlocks: TextBlock[]): boolean {
  const modifierKeywords = [
    'extra', 'add', 'with', 'without', 'syrup', 'shot', 'milk', 
    'topping', 'size', 'choice', 'alternative', 'substitute'
  ];
  
  const nearbyText = nearbyBlocks.map(block => block.text.toLowerCase()).join(' ');
  
  return modifierKeywords.some(keyword => nearbyText.includes(keyword));
}

/**
 * Generates a human-readable coverage summary
 */
export function generateCoverageSummary(report: CoverageReport): string {
  const lines: string[] = [];
  
  lines.push('=== COVERAGE REPORT ===');
  lines.push(`Prices found: ${report.pricesFound}`);
  lines.push(`Prices attached to items: ${report.pricesAttached}`);
  lines.push(`Unattached prices: ${report.unattachedPrices.length}`);
  lines.push(`Coverage rate: ${((report.pricesAttached / report.pricesFound) * 100).toFixed(1)}%`);
  lines.push('');
  
  if (report.unattachedPrices.length > 0) {
    lines.push('UNATTACHED PRICES:');
    for (const price of report.unattachedPrices) {
      lines.push(`  • ${price.text} (${price.reason})`);
    }
    lines.push('');
  }
  
  if (report.sectionsWithZeroItems.length > 0) {
    lines.push('SECTIONS WITH ZERO ITEMS:');
    for (const section of report.sectionsWithZeroItems) {
      lines.push(`  • ${section}`);
    }
    lines.push('');
  }
  
  if (report.optionGroupsCreated.length > 0) {
    lines.push('OPTION GROUPS CREATED:');
    for (const group of report.optionGroupsCreated) {
      lines.push(`  • ${group.group}: ${group.choiceCount} choices across ${group.itemCount} items`);
    }
    lines.push('');
  }
  
  if (report.processingWarnings.length > 0) {
    lines.push('PROCESSING WARNINGS:');
    for (const warning of report.processingWarnings) {
      lines.push(`  • ${warning}`);
    }
    lines.push('');
  }
  
  // Overall assessment
  const coverageRate = (report.pricesAttached / report.pricesFound) * 100;
  if (coverageRate >= 95) {
    lines.push('✅ EXCELLENT: 95%+ price coverage achieved');
  } else if (coverageRate >= 90) {
    lines.push('✅ GOOD: 90%+ price coverage achieved');
  } else if (coverageRate >= 80) {
    lines.push('⚠️  FAIR: 80%+ price coverage - review unattached prices');
  } else {
    lines.push('❌ POOR: <80% price coverage - significant issues detected');
  }
  
  return lines.join('\n');
}

/**
 * Validates coverage report for quality assurance
 */
export function validateCoverageReport(report: CoverageReport): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  const coverageRate = (report.pricesAttached / report.pricesFound) * 100;
  
  // Check coverage rate
  if (coverageRate < 80) {
    issues.push(`Low coverage rate: ${coverageRate.toFixed(1)}%`);
    recommendations.push('Review unattached prices and consider widening search window');
  }
  
  // Check for empty sections
  if (report.sectionsWithZeroItems.length > 0) {
    issues.push(`${report.sectionsWithZeroItems.length} sections have no items`);
    recommendations.push('Check if section headers were correctly identified');
  }
  
  // Check for too many unattached prices
  if (report.unattachedPrices.length > report.pricesFound * 0.1) {
    issues.push(`High number of unattached prices: ${report.unattachedPrices.length}`);
    recommendations.push('Consider adjusting title detection or price pairing algorithm');
  }
  
  // Check for modifier explosion (too many option groups)
  if (report.optionGroupsCreated.length > 20) {
    issues.push(`High number of option groups: ${report.optionGroupsCreated.length}`);
    recommendations.push('Review option detection to prevent modifier explosion');
  }
  
  // Check for processing warnings
  if (report.processingWarnings.length > 5) {
    issues.push(`High number of processing warnings: ${report.processingWarnings.length}`);
    recommendations.push('Review processing warnings and consider adjusting parameters');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * Exports coverage report to JSON format
 */
export function exportCoverageReport(report: CoverageReport): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      pricesFound: report.pricesFound,
      pricesAttached: report.pricesAttached,
      coverageRate: (report.pricesAttached / report.pricesFound) * 100,
      unattachedCount: report.unattachedPrices.length,
      emptySectionsCount: report.sectionsWithZeroItems.length,
      optionGroupsCount: report.optionGroupsCreated.length
    },
    details: report
  }, null, 2);
}

/**
 * Generates coverage report for specific price ranges
 */
export function generatePriceRangeAnalysis(
  priceTokens: PriceToken[],
  items: ParsedItem[]
): {
  ranges: Array<{ range: string; found: number; attached: number; coverage: number }>;
  summary: string;
} {
  const ranges = [
    { min: 0, max: 5, label: '£0-5' },
    { min: 5, max: 10, label: '£5-10' },
    { min: 10, max: 20, label: '£10-20' },
    { min: 20, max: 50, label: '£20-50' },
    { min: 50, max: Infinity, label: '£50+' }
  ];
  
  const rangeAnalysis = ranges.map(range => {
    const foundPrices = priceTokens.filter(p => p.value >= range.min && p.value < range.max);
    const attachedPrices = items.filter(item => 
      item.price >= range.min && item.price < range.max
    );
    
    return {
      range: range.label,
      found: foundPrices.length,
      attached: attachedPrices.length,
      coverage: foundPrices.length > 0 ? (attachedPrices.length / foundPrices.length) * 100 : 100
    };
  });
  
  const summary = rangeAnalysis.map(r => 
    `${r.range}: ${r.attached}/${r.found} (${r.coverage.toFixed(1)}%)`
  ).join(', ');
  
  return { ranges: rangeAnalysis, summary };
}
