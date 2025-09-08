// =====================================================
// PDF IMPORTER MODULE EXPORTS
// =====================================================
// Main entry point for the comprehensive PDF→Menu importer

// Main importer
export { importPDFToMenu, generateImportReport, validateImportResult, exportImportResult } from './mainImporter';

// Core types
export type {
  BoundingBox,
  TextBlock,
  PriceToken,
  TitleCandidate,
  ParsedItem,
  ItemVariant,
  OptionGroup,
  OptionChoice,
  ParsedCategory,
  ParsedCatalog,
  CoverageReport,
  ProcessingOptions,
  GPTClassificationResult,
  OptionGroupResult,
  PDFSourceInfo,
  ColumnInfo,
  ReadingOrder,
  SectionInfo,
  ValidationResult
} from './types';

// PDF detection and extraction
export { 
  detectPDFSource, 
  extractTextWithBoxes, 
  normalizeText, 
  mergeHyphenatedWords 
} from './pdfDetection';

// Enhanced Google Vision OCR
export { 
  extractTextBlocksFromPdf, 
  extractTextFromPdf 
} from './googleVisionOCR';

// Layout-aware parsing
export { parseLayout } from './layoutParser';

// Options detection
export { 
  detectOptionsAndVariants,
  isModifierBlock,
  filterModifierBlocks,
  groupRelatedOptions,
  validateOptionGroups
} from './optionsDetector';

// Schema validation and atomic replace
export { 
  validateParsedCatalog,
  convertToDatabaseFormat,
  replaceCatalogAtomically,
  validateCatalogPayload,
  sanitizeItemData,
  deduplicateItems,
  enforceCategoryGuards,
  ParsedItemSchema,
  ParsedCategorySchema,
  ParsedCatalogSchema
} from './schemaValidator';

// Coverage reporting
export { 
  generateCoverageReport,
  generateCoverageSummary,
  validateCoverageReport,
  exportCoverageReport,
  generatePriceRangeAnalysis
} from './coverageReporter';

// GPT classification helpers
export { 
  classifyTextBlock,
  classifyOptionGroup,
  validateClassificationResult,
  filterLowConfidenceClassifications,
  aggregateClassifications,
  batchClassifyBlocks
} from './gptClassifier';

// Processing modes
export { 
  runHighRecallMode,
  runPrecisionMode,
  HIGH_RECALL_OPTIONS,
  PRECISION_OPTIONS
} from './processingModes';
