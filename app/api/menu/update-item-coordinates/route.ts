import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Use legacy build for Node.js environment
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

interface TextRun {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ExtractedItem {
  name: string;
  price: number;
  bbox: { x: number; y: number; w: number; h: number };
  pageNumber: number;
}

export async function POST(req: NextRequest) {
  try {
    const { venueId } = await req.json();

    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId is required' 
      }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Get existing menu items
    const { data: existingItems, error: itemsError } = await supabase
      .from('menu_items')
      .select('id, name, price, category')
      .eq('venue_id', venueId);

    if (itemsError || !existingItems || existingItems.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No menu items found. Upload a menu first.' 
      }, { status: 404 });
    }

    // Get the most recent PDF upload
    const { data: upload, error: uploadError } = await supabase
      .from('menu_uploads')
      .select('*')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No PDF upload found' 
      }, { status: 404 });
    }

    // Download PDF
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
    
    // Use legacy build for server-side
    const pdf = await pdfjsLib.getDocument({ 
      data: pdfArrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    }).promise;
    
    const numPages = pdf.numPages;

    console.log(`[COORD_UPDATE] Extracting coordinates from ${numPages} pages for ${existingItems.length} items`);

    // Extract items from PDF
    const extractedItems: ExtractedItem[] = [];
    const pdfImages = upload.pdf_images || upload.pdf_images_cc || [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      const textRuns: TextRun[] = [];
      for (const item of textContent.items) {
        if ('str' in item && 'transform' in item) {
          textRuns.push({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width || 0,
            height: item.height || 0
          });
        }
      }

      const pageItems = parseItemsFromTextRuns(textRuns, pageNum, viewport);
      extractedItems.push(...pageItems);
    }

    console.log(`[COORD_UPDATE] Extracted ${extractedItems.length} items from PDF`);

    // Match extracted items to existing items
    const matches = matchItems(existingItems, extractedItems);
    console.log(`[COORD_UPDATE] Matched ${matches.length} items`);

    // Update menu_items with coordinates
    let updatedCount = 0;
    for (const match of matches) {
      const { data, error } = await supabase
        .from('menu_items')
        .update({
          bbox_x: match.bbox.x,
          bbox_y: match.bbox.y,
          bbox_w: match.bbox.w,
          bbox_h: match.bbox.h,
          page_number: match.pageNumber,
          pdf_image_url: pdfImages[match.pageNumber - 1]
        })
        .eq('id', match.itemId);

      if (!error) {
        updatedCount++;
      }
    }

    console.log(`[COORD_UPDATE] Updated ${updatedCount} items with coordinates`);

    return NextResponse.json({
      ok: true,
      result: {
        total_items: existingItems.length,
        extracted_items: extractedItems.length,
        matched_items: matches.length,
        updated_items: updatedCount
      }
    });

  } catch (error: any) {
    console.error('[COORD_UPDATE] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Failed to update coordinates' 
    }, { status: 500 });
  }
}

function parseItemsFromTextRuns(
  textRuns: TextRun[], 
  pageNumber: number,
  viewport: any
): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  const priceRegex = /£?\s*(\d+(?:\.\d{1,2})?)/;

  // Group into lines
  const lines: TextRun[][] = [];
  let currentLine: TextRun[] = [];
  let currentY = textRuns[0]?.y || 0;

  for (const run of textRuns) {
    if (Math.abs(run.y - currentY) > 5) {
      if (currentLine.length > 0) lines.push(currentLine);
      currentLine = [run];
      currentY = run.y;
    } else {
      currentLine.push(run);
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  // Extract items
  for (const line of lines) {
    const lineText = line.map(r => r.str).join(' ').trim();
    const priceMatch = lineText.match(priceRegex);
    
    if (!priceMatch) continue;

    const price = parseFloat(priceMatch[1]);
    const priceIndex = lineText.indexOf(priceMatch[0]);
    const name = lineText.substring(0, priceIndex).trim();

    if (!name || name.length < 2) continue;

    const minX = Math.min(...line.map(r => r.x));
    const maxX = Math.max(...line.map(r => r.x + r.width));
    const minY = Math.min(...line.map(r => r.y));
    const maxY = Math.max(...line.map(r => r.y + r.height));

    items.push({
      name,
      price,
      bbox: {
        x: minX,
        y: viewport.height - maxY,
        w: maxX - minX,
        h: maxY - minY
      },
      pageNumber
    });
  }

  return items;
}

function matchItems(existingItems: any[], extractedItems: ExtractedItem[]): any[] {
  const matches: any[] = [];

  for (const existing of existingItems) {
    // Find best match by name similarity
    let bestMatch: ExtractedItem | null = null;
    let bestScore = 0;

    for (const extracted of extractedItems) {
      const score = similarity(existing.name, extracted.name);
      if (score > bestScore && score > 0.7) { // 70% similarity threshold
        bestScore = score;
        bestMatch = extracted;
      }
    }

    if (bestMatch) {
      matches.push({
        itemId: existing.id,
        name: existing.name,
        bbox: bestMatch.bbox,
        pageNumber: bestMatch.pageNumber
      });
    }
  }

  return matches;
}

function similarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Levenshtein distance
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

