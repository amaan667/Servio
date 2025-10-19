// =====================================================
// MAIN PDF IMPORTER WITH COMPREHENSIVE GUARDRAILS
// =====================================================
// Orchestrates the entire PDF→Menu import process with error handling

import { 
  ParsedCatalog, 
  CoverageReport, 
  ProcessingOptions,
  PDFSourceInfo,
  ValidationResult 
} from './types';
import { detectPDFSource, extractTextWithBoxes, normalizeText, mergeHyphenatedWords } from './pdfDetection';
import { parseLayout } from './layoutParser';
import { detectOptionsAndVariants } from './optionsDetector';
import { validateParsedCatalog, replaceCatalogAtomically, sanitizeItemData, deduplicateItems, enforceCategoryGuards } from './schemaValidator';
import { generateCoverageReport, generateCoverageSummary, validateCoverageReport } from './coverageReporter';
import { runHighRecallMode, runPrecisionMode, HIGH_RECALL_OPTIONS, PRECISION_OPTIONS } from './processingModes';
import { batchClassifyBlocks } from './gptClassifier';
import { parseMenuWithGPT, parseMenuInBatches, validateMenuParsingResult } from './robustMenuParser';
import { logger } from '@/lib/logger';

/**
 * Main PDF importer function with comprehensive error handling
 */
export async function importPDFToMenu(
  pdfBuffer: Buffer,
  venueId: string,
  supabaseClient: any,
  options: {
    mode?: 'high_recall' | 'precision' | 'auto';
    customOptions?: Partial<ProcessingOptions>;
    enableGPT?: boolean;
    enableValidation?: boolean;
  } = {}
): Promise<{
  success: boolean;
  catalog?: ParsedCatalog;
  coverage?: CoverageReport;
  validation?: ValidationResult;
  error?: string;
  warnings?: string[];
  metadata?: {
    sourceType: PDFSourceInfo;
    processingTime: number;
    itemsProcessed: number;
    pricesFound: number;
    coverageRate: number;
  };
}> {
  const startTime = Date.now();
  const warnings: string[] = [];
  
  try {
    
    // Step 0: Detect PDF source type
    const sourceInfo = await detectPDFSource(pdfBuffer);
    
    // Step 1: Extract text with bounding boxes
    let blocks = await extractTextWithBoxes(pdfBuffer);
    
    if (blocks.length === 0) {
      throw new Error('No text blocks could be extracted from PDF');
    }
    
    // Step 2: Normalize and clean text
    blocks = blocks.map(block => ({
      ...block,
      text: normalizeText(block.text)
    }));
    
    // Merge hyphenated words
    blocks = mergeHyphenatedWords(blocks);
    
    // Step 3: Determine processing mode
    const processingMode = determineProcessingMode(options.mode, sourceInfo, blocks.length);
    
    let catalog: ParsedCatalog;
    let coverage: CoverageReport;
    let validation: ValidationResult;
    
    try {
      if (processingMode === 'high_recall') {
        // Step 4a: Run high-recall mode
        const highRecallOptions = { ...HIGH_RECALL_OPTIONS, ...options.customOptions };
        const highRecallResult = await runHighRecallMode(blocks, highRecallOptions);
        
        catalog = highRecallResult.catalog;
        coverage = highRecallResult.coverage;
        warnings.push(...highRecallResult.warnings);
        
        // Step 5a: Run precision mode on high-recall results
        const precisionOptions = { ...PRECISION_OPTIONS, ...options.customOptions };
        const precisionResult = await runPrecisionMode(blocks, highRecallResult, precisionOptions);
        
        catalog = precisionResult.catalog;
        coverage = precisionResult.coverage;
        validation = precisionResult.validation;
        
      } else {
        // Step 4b: Run precision mode directly
        const precisionOptions = { ...PRECISION_OPTIONS, ...options.customOptions };
        const precisionResult = await runPrecisionMode(blocks, undefined, precisionOptions);
        
        catalog = precisionResult.catalog;
        coverage = precisionResult.coverage;
        validation = precisionResult.validation;
      }
    } catch (layoutError: any) {
      logger.warn('[PDF_IMPORT] Layout parsing failed, falling back to robust GPT parser:', layoutError.message);
      warnings.push(`Layout parsing failed: ${layoutError.message}`);
      
      // Fallback to robust GPT parser
      const menuText = blocks.map(block => block.text).join('\n');
      const gptResult = await parseMenuWithGPT(menuText, {
        maxRetries: 3,
        enableRepair: true,
        enableValidation: true,
        temperature: 0,
        model: 'gpt-4o-mini'
      });
      
      if (gptResult.success) {
        // Convert GPT result to catalog format
        catalog = {
          categories: [{
            name: 'UNCATEGORIZED',
            items: gptResult.items.map((item: any) => ({
              title: item.title,
              subtitle: undefined,
              description: item.description,
              price: item.price,
              category: item.category,
              confidence: 0.8,
              sourceLineIds: ['gpt_fallback']
            })),
            sortOrder: 0
          }],
          metadata: {
            sourceType: sourceInfo.type,
            totalItems: gptResult.items.length,
            totalPrices: gptResult.items.length,
            unattachedPrices: 0,
            optionGroups: 0,
            processingMode: 'precision'
          }
        };
        
        coverage = {
          pricesFound: gptResult.items.length,
          pricesAttached: gptResult.items.length,
          unattachedPrices: [],
          sectionsWithZeroItems: [],
          optionGroupsCreated: [],
          processingWarnings: ['Used GPT fallback parser']
        };
        
        validation = {
          valid: true,
          errors: [],
          warnings: gptResult.warnings || [],
          itemsCount: gptResult.items.length,
          zeroPriceCount: 0,
          missingPriceCount: 0
        };
        
        warnings.push('Used GPT fallback parser due to layout parsing failure');
      } else {
        throw new Error(`Both layout parsing and GPT fallback failed: ${gptResult.errors?.join(', ')}`);
      }
    }
    
    // Step 6: Apply post-processing
    catalog = applyPostProcessing(catalog, options);
    
    // Step 7: Validate results
    if (options.enableValidation !== false) {
      validation = validateParsedCatalog(catalog);
      
      if (!validation.valid) {
        warnings.push(`Validation issues: ${validation.errors.join(', ')}`);
      }
      
      if (validation.warnings.length > 0) {
        warnings.push(...validation.warnings);
      }
    }
    
    // Step 8: Generate final coverage report
    coverage = generateCoverageReport(
      [], // Price tokens will be extracted from catalog
      catalog.categories.flatMap(cat => cat.items),
      catalog.categories,
      blocks,
      warnings
    );
    
    // Step 9: Validate coverage
    const coverageValidation = validateCoverageReport(coverage);
    if (!coverageValidation.isValid) {
      warnings.push(`Coverage issues: ${coverageValidation.issues.join(', ')}`);
    }
    
    // Step 10: Replace catalog atomically
    const replaceResult = await replaceCatalogAtomically(venueId, catalog, supabaseClient);
    
    if (!replaceResult.success) {
      throw new Error(`Catalog replacement failed: ${replaceResult.error}`);
    }
    
    const processingTime = Date.now() - startTime;
    const totalItems = catalog.categories.reduce((sum, cat) => sum + cat.items.length, 0);
    const coverageRate = coverage.pricesFound > 0 ? (coverage.pricesAttached / coverage.pricesFound) * 100 : 0;
    
    
    return {
      success: true,
      catalog,
      coverage,
      validation,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: {
        sourceType: sourceInfo,
        processingTime,
        itemsProcessed: totalItems,
        pricesFound: coverage.pricesFound,
        coverageRate
      }
    };
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logger.error('[PDF_IMPORT] Import failed:', error);
    
    return {
      success: false,
      error: error.message,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: {
        sourceType: { type: 'vision_ocr', hasSelectableText: false, hasTextLayer: false, confidence: 0, extractionMethod: 'vision_ocr' },
        processingTime,
        itemsProcessed: 0,
        pricesFound: 0,
        coverageRate: 0
      }
    };
  }
}

/**
 * Determines the best processing mode based on options and PDF characteristics
 */
function determineProcessingMode(
  requestedMode: 'high_recall' | 'precision' | 'auto' | undefined,
  sourceInfo: PDFSourceInfo,
  blockCount: number
): 'high_recall' | 'precision' {
  if (requestedMode && requestedMode !== 'auto') {
    return requestedMode;
  }
  
  // Auto mode: choose based on PDF characteristics
  if (sourceInfo.type === 'native_pdf' && sourceInfo.confidence > 0.8) {
    // High-quality native PDF - use precision mode
    return 'precision';
  } else if (blockCount > 100) {
    // Large number of blocks - use high-recall to catch everything
    return 'high_recall';
  } else {
    // Default to precision mode
    return 'precision';
  }
}

/**
 * Applies post-processing to the catalog
 */
function applyPostProcessing(catalog: ParsedCatalog, options: any): ParsedCatalog {
  
  // Sanitize item data
  const sanitizedCategories = catalog.categories.map(category => ({
    ...category,
    items: category.items.map(item => sanitizeItemData(item))
  }));
  
  // Deduplicate items
  const deduplicatedCategories = sanitizedCategories.map(category => ({
    ...category,
    items: deduplicateItems([category]).flatMap(cat => cat.items)
  }));
  
  // Enforce category guards
  const guardedCategories = deduplicatedCategories.map(category => ({
    ...category,
    items: enforceCategoryGuards([category]).flatMap(cat => cat.items)
  }));
  
  return {
    ...catalog,
    categories: guardedCategories
  };
}

/**
 * Generates a comprehensive import report
 */
export function generateImportReport(result: any): string {
  const lines: string[] = [];
  
  lines.push('=== PDF IMPORT REPORT ===');
  lines.push(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  
  if (result.metadata) {
    lines.push(`Processing time: ${result.metadata.processingTime}ms`);
    lines.push(`Source type: ${result.metadata.sourceType.type}`);
    lines.push(`Items processed: ${result.metadata.itemsProcessed}`);
    lines.push(`Prices found: ${result.metadata.pricesFound}`);
    lines.push(`Coverage rate: ${result.metadata.coverageRate.toFixed(1)}%`);
  }
  
  if (result.coverage) {
    lines.push('');
    lines.push('=== COVERAGE SUMMARY ===');
    lines.push(generateCoverageSummary(result.coverage));
  }
  
  if (result.validation) {
    lines.push('');
    lines.push('=== VALIDATION RESULTS ===');
    lines.push(`Valid: ${result.validation.valid ? 'YES' : 'NO'}`);
    if (result.validation.errors.length > 0) {
      lines.push('Errors:');
      result.validation.errors.forEach((error: any) => lines.push(`  • ${error}`));
    }
    if (result.validation.warnings.length > 0) {
      lines.push('Warnings:');
      result.validation.warnings.forEach((warning: any) => lines.push(`  • ${warning}`));
    }
  }
  
  if (result.warnings && result.warnings.length > 0) {
    lines.push('');
    lines.push('=== PROCESSING WARNINGS ===');
    result.warnings.forEach((warning: any) => lines.push(`  • ${warning}`));
  }
  
  if (result.error) {
    lines.push('');
    lines.push('=== ERROR ===');
    lines.push(result.error);
  }
  
  return lines.join('\n');
}

/**
 * Validates import result for quality assurance
 */
export function validateImportResult(result: any): {
  isHighQuality: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  if (!result.success) {
    issues.push('Import failed');
    return { isHighQuality: false, issues, recommendations };
  }
  
  // Check coverage rate
  if (result.metadata && result.metadata.coverageRate < 80) {
    issues.push(`Low coverage rate: ${result.metadata.coverageRate.toFixed(1)}%`);
    recommendations.push('Review unattached prices and consider adjusting search parameters');
  }
  
  // Check processing time
  if (result.metadata && result.metadata.processingTime > 30000) {
    issues.push(`Long processing time: ${result.metadata.processingTime}ms`);
    recommendations.push('Consider optimizing PDF or reducing complexity');
  }
  
  // Check validation
  if (result.validation && !result.validation.valid) {
    issues.push(`Validation failed: ${result.validation.errors.length} errors`);
    recommendations.push('Review and fix validation errors before using the catalog');
  }
  
  // Check warnings
  if (result.warnings && result.warnings.length > 5) {
    issues.push(`High number of warnings: ${result.warnings.length}`);
    recommendations.push('Review warnings and consider adjusting processing parameters');
  }
  
  const isHighQuality = issues.length === 0;
  
  return { isHighQuality, issues, recommendations };
}

/**
 * Exports import result to JSON format
 */
export function exportImportResult(result: any): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    success: result.success,
    metadata: result.metadata,
    coverage: result.coverage,
    validation: result.validation,
    warnings: result.warnings,
    error: result.error
  }, null, 2);
}
