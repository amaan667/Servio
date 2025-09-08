// =====================================================
// PDF IMPORTER TYPES
// =====================================================
// Type definitions for the high-accuracy PDF→Menu importer

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextBlock {
  text: string;
  bbox: BoundingBox;
  confidence?: number;
  fontSize?: number;
  isBold?: boolean;
  isUppercase?: boolean;
  lineId: string;
}

export interface PriceToken {
  value: number;
  bbox: BoundingBox;
  lineId: string;
  originalText: string;
}

export interface TitleCandidate {
  text: string;
  bbox: BoundingBox;
  lineId: string;
  confidence: number;
  isBold: boolean;
  fontSize: number;
}

export interface ParsedItem {
  title: string;
  subtitle?: string;
  description?: string;
  price: number;
  category: string;
  variants?: ItemVariant[];
  options?: OptionGroup[];
  aliases?: string[];
  confidence: number;
  sourceLineIds: string[];
}

export interface ItemVariant {
  name: string;
  price: number;
  priceAdd: number;
}

export interface OptionGroup {
  group: string;
  choices: OptionChoice[];
  required: boolean;
  maxChoices: number;
}

export interface OptionChoice {
  name: string;
  priceAdd: number;
}

export interface ParsedCategory {
  name: string;
  items: ParsedItem[];
  sortOrder: number;
}

export interface ParsedCatalog {
  categories: ParsedCategory[];
  metadata: {
    sourceType: 'native_pdf' | 'ocr_pdf' | 'vision_ocr';
    totalItems: number;
    totalPrices: number;
    unattachedPrices: number;
    optionGroups: number;
    processingMode: 'high_recall' | 'precision';
  };
}

export interface CoverageReport {
  pricesFound: number;
  pricesAttached: number;
  unattachedPrices: Array<{
    text: string;
    bbox: BoundingBox;
    lineId: string;
    reason: string;
  }>;
  sectionsWithZeroItems: string[];
  optionGroupsCreated: Array<{
    group: string;
    itemCount: number;
    choiceCount: number;
  }>;
  processingWarnings: string[];
}

export interface ProcessingOptions {
  mode: 'high_recall' | 'precision';
  maxTitlePriceDistance: number; // lines
  minPriceValue: number;
  enableOptionDetection: boolean;
  enableCategoryGuards: boolean;
  enableDeduplication: boolean;
}

export interface GPTClassificationResult {
  type: 'HEADER' | 'ITEM' | 'DESCRIPTION' | 'MODIFIER' | 'MARKETING' | 'COMPONENT';
  confidence: number;
  reason?: string;
}

export interface OptionGroupResult {
  group: string;
  choices: string[];
  priceAdd: number;
  confidence: number;
}

// PDF Source Detection
export interface PDFSourceInfo {
  type: 'native_pdf' | 'ocr_pdf' | 'vision_ocr';
  hasSelectableText: boolean;
  hasTextLayer: boolean;
  confidence: number;
  extractionMethod: 'pdfminer' | 'pymupdf' | 'vision_ocr' | 'tesseract';
}

// Layout Analysis
export interface ColumnInfo {
  x: number;
  width: number;
  blocks: TextBlock[];
}

export interface ReadingOrder {
  columns: ColumnInfo[];
  lines: TextBlock[];
  sections: SectionInfo[];
}

export interface SectionInfo {
  name: string;
  startLine: number;
  endLine: number;
  bbox: BoundingBox;
  confidence: number;
}

// Validation Results
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  itemsCount: number;
  zeroPriceCount: number;
  missingPriceCount: number;
}
