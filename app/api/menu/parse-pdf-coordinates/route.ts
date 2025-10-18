import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js worker
if (typeof window === 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.min.js');
}

interface TextRun {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
}

interface ParsedMenuItem {
  name: string;
  description?: string;
  price: number;
  bbox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  pageNumber: number;
  confidence: number;
  source: 'pdfjs' | 'ocr' | 'manual';
}

export async function POST(req: NextRequest) {
  try {
    const { menuUploadId, venueId } = await req.json();

    if (!menuUploadId || !venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'menuUploadId and venueId are required' 
      }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Get the menu upload record
    const { data: upload, error: uploadError } = await supabase
      .from('menu_uploads')
      .select('*')
      .eq('id', menuUploadId)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Menu upload not found' 
      }, { status: 404 });
    }

    // Download PDF from storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('menus')
      .download(upload.filename || upload.storage_path);

    if (downloadError || !pdfData) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to download PDF' 
      }, { status: 500 });
    }

    const pdfArrayBuffer = await pdfData.arrayBuffer();
    
    // Load PDF with pdf.js
    const pdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise;
    const numPages = pdf.numPages;

    console.log(`[PDF_PARSE] Parsing ${numPages} pages for venue ${venueId}`);

    const allItems: ParsedMenuItem[] = [];
    const pages: any[] = [];

    // Process each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });

      console.log(`[PDF_PARSE] Processing page ${pageNum}/${numPages} (${viewport.width}x${viewport.height})`);

      // Extract text content with coordinates
      const textContent = await page.getTextContent();
      const textRuns: TextRun[] = [];

      // Convert text items to runs with coordinates
      for (const item of textContent.items) {
        if ('str' in item && 'transform' in item) {
          const transform = item.transform;
          const fontSize = Math.abs(transform[0]);
          const textRun: TextRun = {
            str: item.str,
            x: transform[4],
            y: transform[5],
            width: item.width || 0,
            height: item.height || 0,
            fontName: item.fontName || 'Arial',
            fontSize: fontSize
          };
          textRuns.push(textRun);
        }
      }

      console.log(`[PDF_PARSE] Extracted ${textRuns.length} text runs from page ${pageNum}`);

      // Parse menu items from text runs
      const pageItems = parseMenuItemsFromTextRuns(textRuns, pageNum, viewport);
      allItems.push(...pageItems);

      // Store page metadata
      const imageUrl = upload.pdf_images?.[pageNum - 1] || upload.pdf_images_cc?.[pageNum - 1];
      pages.push({
        venue_id: venueId,
        menu_upload_id: menuUploadId,
        page_number: pageNum,
        width: viewport.width,
        height: viewport.height,
        image_url: imageUrl,
        pdf_url: upload.filename || upload.storage_path
      });

      console.log(`[PDF_PARSE] Parsed ${pageItems.length} items from page ${pageNum}`);
    }

    console.log(`[PDF_PARSE] Total items parsed: ${allItems.length}`);

    // Store pages in database
    const { data: insertedPages, error: pagesError } = await supabase
      .from('menu_pages')
      .insert(pages)
      .select('id, page_number');

    if (pagesError) {
      console.error('[PDF_PARSE] Error inserting pages:', pagesError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to store pages: ${pagesError.message}` 
      }, { status: 500 });
    }

    console.log(`[PDF_PARSE] Inserted ${insertedPages.length} pages`);

    // Store items in database
    const itemsToInsert = allItems.map((item, idx) => {
      const pageRecord = insertedPages.find(p => p.page_number === item.pageNumber);
      if (!pageRecord) {
        throw new Error(`Page record not found for page ${item.pageNumber}`);
      }

      return {
        menu_page_id: pageRecord.id,
        venue_id: venueId,
        page_number: item.pageNumber,
        name: item.name,
        description: item.description,
        price_minor: Math.round(item.price * 100), // Convert to pence
        currency: 'GBP',
        bbox_x: item.bbox.x,
        bbox_y: item.bbox.y,
        bbox_w: item.bbox.w,
        bbox_h: item.bbox.h,
        source: item.source,
        confidence: item.confidence,
        is_available: true
      };
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from('menu_items_parsed')
      .insert(itemsToInsert)
      .select('id, name, price_minor');

    if (itemsError) {
      console.error('[PDF_PARSE] Error inserting items:', itemsError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to store items: ${itemsError.message}` 
      }, { status: 500 });
    }

    console.log(`[PDF_PARSE] Inserted ${insertedItems.length} items`);

    return NextResponse.json({
      ok: true,
      result: {
        pages_created: insertedPages.length,
        items_created: insertedItems.length,
        items: insertedItems
      }
    });

  } catch (error: any) {
    console.error('[PDF_PARSE] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Failed to parse PDF' 
    }, { status: 500 });
  }
}

/**
 * Parse menu items from text runs using heuristics
 */
function parseMenuItemsFromTextRuns(
  textRuns: TextRun[], 
  pageNumber: number,
  viewport: any
): ParsedMenuItem[] {
  if (textRuns.length === 0) {
    return [];
  }

  const items: ParsedMenuItem[] = [];
  const priceRegex = /£?\s*(\d+(?:\.\d{1,2})?)/;

  // Group text runs into lines by y-coordinate
  const lines: TextRun[][] = [];
  let currentLine: TextRun[] = [];
  let currentY = textRuns[0].y;
  const lineThreshold = 5; // pixels

  for (const run of textRuns) {
    if (Math.abs(run.y - currentY) > lineThreshold) {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = [run];
      currentY = run.y;
    } else {
      currentLine.push(run);
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  console.log(`[PDF_PARSE] Grouped ${textRuns.length} runs into ${lines.length} lines`);

  // Detect columns by clustering x-coordinates
  const xPositions = textRuns.map(r => r.x);
  const columns = detectColumns(xPositions);

  console.log(`[PDF_PARSE] Detected ${columns.length} columns`);

  // Process each line
  for (const line of lines) {
    const lineText = line.map(r => r.str).join(' ').trim();
    
    if (!lineText || lineText.length < 2) {
      continue;
    }

    // Check if line contains a price
    const priceMatch = lineText.match(priceRegex);
    if (!priceMatch) {
      continue;
    }

    const price = parseFloat(priceMatch[1]);
    const priceIndex = lineText.indexOf(priceMatch[0]);

    // Extract item name (everything before the price)
    const name = lineText.substring(0, priceIndex).trim();
    
    if (!name || name.length < 2) {
      continue;
    }

    // Calculate bounding box
    const minX = Math.min(...line.map(r => r.x));
    const maxX = Math.max(...line.map(r => r.x + r.width));
    const minY = Math.min(...line.map(r => r.y));
    const maxY = Math.max(...line.map(r => r.y + r.height));

    // Invert Y coordinate (PDF has origin at bottom-left, we want top-left)
    const invertedY = viewport.height - maxY;

    items.push({
      name: name,
      price: price,
      bbox: {
        x: minX,
        y: invertedY,
        w: maxX - minX,
        h: maxY - minY
      },
      pageNumber: pageNumber,
      confidence: 0.8,
      source: 'pdfjs'
    });
  }

  return items;
}

/**
 * Detect columns in a list of x-coordinates using k-means clustering
 */
function detectColumns(xPositions: number[]): number[] {
  if (xPositions.length === 0) {
    return [];
  }

  // Sort and get unique positions
  const sorted = [...new Set(xPositions)].sort((a, b) => a - b);
  
  if (sorted.length <= 2) {
    return sorted;
  }

  // Use a simple threshold-based clustering
  const clusters: number[] = [];
  let currentCluster = sorted[0];
  const threshold = 100; // pixels

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - currentCluster > threshold) {
      clusters.push(currentCluster);
      currentCluster = sorted[i];
    }
  }
  clusters.push(currentCluster);

  return clusters;
}

