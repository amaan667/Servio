// =====================================================
// ENHANCED GOOGLE VISION OCR WITH BOUNDING BOXES
// =====================================================
// Extracts text blocks with precise coordinates for layout-aware parsing

import vision from '@google-cloud/vision';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { TextBlock, BoundingBox } from './types';

const bucketName = process.env.GCS_BUCKET_NAME;

// Google clients with Railway-compatible credentials
let client: any, storage: any;

try {
  console.log('[OCR] Initializing Google Cloud clients...');
  
  // For Railway: handle base64 encoded credentials
  if (process.env.GOOGLE_CREDENTIALS_B64) {
    console.log('[OCR] Using base64 encoded service account credentials');
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, 'base64').toString('utf8');
    const credentials = JSON.parse(credentialsJson);
    
    client = new vision.ImageAnnotatorClient({ 
      credentials,
      projectId: process.env.GOOGLE_PROJECT_ID 
    });
    storage = new Storage({ 
      credentials,
      projectId: process.env.GOOGLE_PROJECT_ID 
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('[OCR] Using service account credentials from environment variable');
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    
    client = new vision.ImageAnnotatorClient({ 
      credentials,
      projectId: process.env.GOOGLE_PROJECT_ID 
    });
    storage = new Storage({ 
      credentials,
      projectId: process.env.GOOGLE_PROJECT_ID 
    });
  } else {
    console.log('[OCR] No credentials found, using default credentials');
    client = new vision.ImageAnnotatorClient({
      projectId: process.env.GOOGLE_PROJECT_ID
    });
    storage = new Storage({
      projectId: process.env.GOOGLE_PROJECT_ID
    });
  }
  
  console.log('[OCR] Google Cloud clients initialized successfully');
} catch (error) {
  console.error('[OCR] Failed to initialize Google Cloud clients:', error);
  throw new Error(`Google Cloud credentials not properly configured: ${(error as any).message}`);
}

/**
 * Extracts text blocks with bounding boxes from PDF using Google Vision OCR
 */
export async function extractTextBlocksFromPdf(pdfBuffer: Buffer, fileName: string): Promise<TextBlock[]> {
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME environment variable is required');
  }

  if (!process.env.GOOGLE_PROJECT_ID) {
    throw new Error('GOOGLE_PROJECT_ID environment variable is required');
  }

  const tempFileName = `${uuidv4()}-${fileName}`;
  const gcsUri = `gs://${bucketName}/${tempFileName}`;

  console.log('[OCR] Starting Google Vision OCR with bounding boxes...');
  console.log('[OCR] Project ID:', process.env.GOOGLE_PROJECT_ID);
  console.log('[OCR] Bucket:', bucketName);
  console.log('[OCR] File:', tempFileName);

  try {
    // Upload to GCS
    await storage.bucket(bucketName).file(tempFileName).save(pdfBuffer);
    console.log(`[OCR] Uploaded PDF to ${gcsUri}`);

    // Run OCR on the PDF with detailed text detection
    const [operation] = await client.asyncBatchAnnotateFiles({
      requests: [
        {
          inputConfig: {
            mimeType: 'application/pdf',
            gcsSource: { uri: gcsUri }
          },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          outputConfig: {
            gcsDestination: { uri: `gs://${bucketName}/ocr-output/${tempFileName}/` },
            batchSize: 1
          }
        }
      ]
    });

    console.log(`[OCR] Processing started...`);
    await operation.promise();
    console.log(`[OCR] Processing complete.`);

    // Download OCR JSON output
    const [files] = await storage.bucket(bucketName).getFiles({
      prefix: `ocr-output/${tempFileName}/`
    });

    const allBlocks: TextBlock[] = [];
    let blockId = 0;

    for (const file of files) {
      const [contents] = await file.download();
      const parsed = JSON.parse(contents.toString('utf8'));
      
      parsed.responses.forEach((page: any, pageIndex: number) => {
        if (page.fullTextAnnotation?.pages) {
          const blocks = extractBlocksFromPage(page.fullTextAnnotation, pageIndex);
          allBlocks.push(...blocks);
        }
      });
    }

    console.log(`[OCR] Extracted ${allBlocks.length} text blocks`);
    console.log(`[OCR] Sample blocks:`, allBlocks.slice(0, 3).map(b => ({ text: b.text, bbox: b.bbox })));

    // Clean up temporary files
    try {
      await storage.bucket(bucketName).file(tempFileName).delete();
      console.log(`[OCR] Cleaned up temporary file: ${tempFileName}`);
    } catch (cleanupError) {
      console.warn(`[OCR] Failed to cleanup temporary file:`, (cleanupError as any).message);
    }

    return allBlocks;

  } catch (error) {
    console.error('[OCR] Error during OCR process:', error);
    throw error;
  }
}

/**
 * Extracts text blocks from a single page of OCR results
 */
function extractBlocksFromPage(pageAnnotation: any, pageIndex: number): TextBlock[] {
  const blocks: TextBlock[] = [];
  let blockId = 0;

  if (!pageAnnotation.blocks) {
    return blocks;
  }

  for (const block of pageAnnotation.blocks) {
    if (block.paragraphs) {
      for (const paragraph of block.paragraphs) {
        if (paragraph.words) {
          // Group words into lines based on y-coordinate
          const lines = groupWordsIntoLines(paragraph.words);
          
          for (const line of lines) {
            const text = line.words.map((w: any) => w.text).join(' ');
            const bbox = calculateLineBoundingBox(line.words);
            const confidence = calculateAverageConfidence(line.words);
            
            if (text.trim().length > 0) {
              blocks.push({
                text: text.trim(),
                bbox,
                confidence,
                lineId: `page_${pageIndex}_block_${blockId}_line_${blocks.length}`,
                fontSize: estimateFontSize(bbox.height),
                isBold: estimateBoldness(line.words),
                isUppercase: text === text.toUpperCase() && text.length > 1
              });
            }
          }
        }
      }
    }
    blockId++;
  }

  return blocks;
}

/**
 * Groups words into lines based on y-coordinate proximity
 */
function groupWordsIntoLines(words: any[]): Array<{ words: any[] }> {
  if (words.length === 0) return [];

  // Sort words by y-coordinate
  const sortedWords = [...words].sort((a, b) => {
    const aY = a.boundingBox.vertices[0].y;
    const bY = b.boundingBox.vertices[0].y;
    return aY - bY;
  });

  const lines: Array<{ words: any[] }> = [];
  let currentLine: any[] = [sortedWords[0]];
  let currentY = sortedWords[0].boundingBox.vertices[0].y;

  for (let i = 1; i < sortedWords.length; i++) {
    const word = sortedWords[i];
    const wordY = word.boundingBox.vertices[0].y;
    
    // If y-coordinate is close enough, add to current line
    if (Math.abs(wordY - currentY) < 10) { // 10 pixel tolerance
      currentLine.push(word);
    } else {
      // Start new line
      lines.push({ words: currentLine });
      currentLine = [word];
      currentY = wordY;
    }
  }

  // Add the last line
  if (currentLine.length > 0) {
    lines.push({ words: currentLine });
  }

  return lines;
}

/**
 * Calculates bounding box for a line of words
 */
function calculateLineBoundingBox(words: any[]): BoundingBox {
  if (words.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const word of words) {
    for (const vertex of word.boundingBox.vertices) {
      minX = Math.min(minX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxX = Math.max(maxX, vertex.x);
      maxY = Math.max(maxY, vertex.y);
    }
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Calculates average confidence for a line of words
 */
function calculateAverageConfidence(words: any[]): number {
  if (words.length === 0) return 0;

  const totalConfidence = words.reduce((sum, word) => {
    return sum + (word.confidence || 0.5);
  }, 0);

  return totalConfidence / words.length;
}

/**
 * Estimates font size based on bounding box height
 */
function estimateFontSize(height: number): number {
  // Rough estimation: 1 pixel ≈ 0.75 points
  return Math.round(height * 0.75);
}

/**
 * Estimates if text is bold based on word properties
 */
function estimateBoldness(words: any[]): boolean {
  // This is a heuristic - in practice, you'd need more sophisticated analysis
  // For now, we'll use text characteristics
  const text = words.map((w: any) => w.text).join(' ');
  
  // Check for common bold indicators
  const isAllCaps = text === text.toUpperCase() && text.length > 1;
  const hasNumbers = /\d/.test(text);
  const isShort = text.length < 20;
  
  // Heuristic: short, all-caps text with numbers is likely bold
  return isAllCaps && (hasNumbers || isShort);
}

/**
 * Legacy function for backward compatibility
 */
export async function extractTextFromPdf(pdfBuffer: Buffer, fileName: string): Promise<string> {
  const blocks = await extractTextBlocksFromPdf(pdfBuffer, fileName);
  return blocks.map(block => block.text).join('\n');
}
