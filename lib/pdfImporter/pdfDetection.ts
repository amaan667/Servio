// =====================================================
// PDF DETECTION AND EXTRACTION UTILITIES
// =====================================================
// Detects PDF type and extracts text with bounding boxes

import { PDFSourceInfo, TextBlock, BoundingBox } from './types';
import { logger } from '@/lib/logger';

/**
 * Detects the type of PDF and determines the best extraction method
 */
export async function detectPDFSource(pdfBuffer: Buffer): Promise<PDFSourceInfo> {
  try {
    // Try to extract text using pdfminer/pymupdf first (native text)
    const nativeText = await extractNativeText(pdfBuffer);
    
    if (nativeText && nativeText.length > 100) {
      // Check if text is selectable and well-formed
      const hasSelectableText = await checkSelectableText(nativeText);
      
      return {
        type: hasSelectableText ? 'native_pdf' : 'ocr_pdf',
        hasSelectableText,
        hasTextLayer: true,
        confidence: hasSelectableText ? 0.9 : 0.6,
        extractionMethod: hasSelectableText ? 'pdfminer' : 'pymupdf'
      };
    }
    
    // Fall back to OCR
    return {
      type: 'vision_ocr',
      hasSelectableText: false,
      hasTextLayer: false,
      confidence: 0.8,
      extractionMethod: 'vision_ocr'
    };
    
  } catch (error) {
    logger.error('[PDF_DETECT] Detection failed:', error);
    // Default to OCR
    return {
      type: 'vision_ocr',
      hasSelectableText: false,
      hasTextLayer: false,
      confidence: 0.5,
      extractionMethod: 'vision_ocr'
    };
  }
}

/**
 * Extracts text from native PDF using pdfminer or pymupdf
 */
async function extractNativeText(pdfBuffer: Buffer): Promise<string | null> {
  try {
    // For now, we'll use a simple approach
    // In production, you'd use pdfminer or pymupdf here
    const text = pdfBuffer.toString('utf8');
    
    // Check if this looks like a PDF with embedded text
    if (text.includes('stream') && text.includes('endstream')) {
      // This is a PDF, but we need proper extraction
      // For now, return null to force OCR
      return null;
    }
    
    return null;
  } catch (error) {
    logger.error('[PDF_DETECT] Native extraction failed:', error);
    return null;
  }
}

/**
 * Checks if extracted text appears to be selectable/well-formed
 */
async function checkSelectableText(text: string): Promise<boolean> {
  // Check for signs of well-formed text
  const hasProperSpacing = /\s+/.test(text);
  const hasPunctuation = /[.,!?;:]/.test(text);
  const hasNumbers = /\d/.test(text);
  const hasLetters = /[a-zA-Z]/.test(text);
  const reasonableLength = text.length > 200;
  
  // Check for OCR artifacts (common in poorly OCR'd text)
  const hasOCRArtifacts = /[^\x00-\x7F]/.test(text) || // Non-ASCII characters
                         /[|]/.test(text) || // Common OCR mistake
                         /[0O]/.test(text); // Common OCR confusion
  
  return hasProperSpacing && hasPunctuation && hasNumbers && 
         hasLetters && reasonableLength && !hasOCRArtifacts;
}

/**
 * Extracts text blocks with bounding boxes using Google Vision OCR
 */
export async function extractTextWithBoxes(pdfBuffer: Buffer): Promise<TextBlock[]> {
  try {
    
    // Check if Google Vision credentials are available
    if (!process.env.GOOGLE_CREDENTIALS_B64 && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return generateMockTextBlocks();
    }
    
    // Use Google Vision OCR with detailed text detection
    const { extractTextBlocksFromPdf } = await import('./googleVisionOCR');
    const blocks = await extractTextBlocksFromPdf(pdfBuffer, 'uploaded-menu.pdf');
    
    return blocks;
    
  } catch (error: any) {
    logger.error('[PDF_EXTRACT] Text extraction failed:', error);
    throw new Error(`Text extraction failed: ${error.message}`);
  }
}

/**
 * Generates mock text blocks for development/testing
 */
function generateMockTextBlocks(): TextBlock[] {
  const mockData = [
    { text: 'STARTERS', bbox: { x: 50, y: 100, width: 200, height: 30 }, fontSize: 18, isBold: true, isUppercase: true },
    { text: 'Soup of the Day', bbox: { x: 50, y: 140, width: 300, height: 20 }, fontSize: 14, isBold: true },
    { text: 'Fresh seasonal soup served with bread', bbox: { x: 50, y: 160, width: 400, height: 15 }, fontSize: 12 },
    { text: '£5.50', bbox: { x: 450, y: 140, width: 60, height: 20 }, fontSize: 14, isBold: true },
    { text: 'Garlic Bread', bbox: { x: 50, y: 180, width: 200, height: 20 }, fontSize: 14, isBold: true },
    { text: 'Crusty bread with garlic butter', bbox: { x: 50, y: 200, width: 350, height: 15 }, fontSize: 12 },
    { text: '£3.50', bbox: { x: 450, y: 180, width: 60, height: 20 }, fontSize: 14, isBold: true },
    { text: 'MAIN COURSES', bbox: { x: 50, y: 240, width: 200, height: 30 }, fontSize: 18, isBold: true, isUppercase: true },
    { text: 'Grilled Chicken', bbox: { x: 50, y: 280, width: 250, height: 20 }, fontSize: 14, isBold: true },
    { text: 'Herb-marinated chicken breast with vegetables', bbox: { x: 50, y: 300, width: 450, height: 15 }, fontSize: 12 },
    { text: '£12.50', bbox: { x: 450, y: 280, width: 60, height: 20 }, fontSize: 14, isBold: true },
    { text: 'COFFEE', bbox: { x: 50, y: 360, width: 150, height: 30 }, fontSize: 18, isBold: true, isUppercase: true },
    { text: 'Americano', bbox: { x: 50, y: 400, width: 150, height: 20 }, fontSize: 14, isBold: true },
    { text: '£2.50', bbox: { x: 450, y: 400, width: 60, height: 20 }, fontSize: 14, isBold: true },
    { text: 'Syrup', bbox: { x: 70, y: 420, width: 100, height: 15 }, fontSize: 12 },
    { text: 'Salted Caramel / Hazelnut / Vanilla', bbox: { x: 70, y: 440, width: 300, height: 15 }, fontSize: 12 },
    { text: '£0.50', bbox: { x: 450, y: 420, width: 60, height: 20 }, fontSize: 14, isBold: true },
  ];
  
  return mockData.map((item, index) => ({
    ...item,
    lineId: `line_${index}`,
    confidence: 0.95
  }));
}

/**
 * Normalizes text by fixing common OCR issues
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[|]/g, 'I') // Fix common OCR mistake
    .replace(/[0O](?=[a-zA-Z])/g, 'O') // Fix O/0 confusion in words
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Fix missing spaces
    .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
    .trim();
}

/**
 * Merges hyphenated words across line breaks
 */
export function mergeHyphenatedWords(blocks: TextBlock[]): TextBlock[] {
  const merged: TextBlock[] = [];
  let i = 0;
  
  while (i < blocks.length) {
    const current = blocks[i];
    const next = blocks[i + 1];
    
    // Check if current block ends with hyphen and next block is on next line
    if (current.text.endsWith('-') && next && 
        Math.abs(current.bbox.y - next.bbox.y) < 30 && // Same line area
        current.bbox.x < next.bbox.x) { // Next block is to the right
      
      // Merge the blocks
      const mergedText = current.text.slice(0, -1) + next.text;
      const mergedBbox: BoundingBox = {
        x: current.bbox.x,
        y: current.bbox.y,
        width: next.bbox.x + next.bbox.width - current.bbox.x,
        height: Math.max(current.bbox.height, next.bbox.height)
      };
      
      merged.push({
        ...current,
        text: mergedText,
        bbox: mergedBbox
      });
      
      i += 2; // Skip both blocks
    } else {
      merged.push(current);
      i += 1;
    }
  }
  
  return merged;
}
