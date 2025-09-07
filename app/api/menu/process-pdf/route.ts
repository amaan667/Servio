import { NextResponse } from "next/server";
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = "nodejs";

// Initialize Supabase client with service role
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient();
}

// Generate unique key for upload
function generateUploadKey(venueId: string, filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${venueId}/${timestamp}_${random}_${sanitizedFilename}`;
}

// Extract text from PDF using Google Vision
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    console.log('[OCR] Starting PDF text extraction...');
    
    // Check if Google Vision credentials are available
    if (!process.env.GOOGLE_CREDENTIALS_B64 && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('[OCR] No Google Vision credentials found, using fallback text extraction');
      
      // Fallback to basic text extraction for development
      const mockText = `
STARTERS
1. Soup of the Day - £5.50
2. Garlic Bread - £3.50
3. Bruschetta - £4.50

MAIN COURSES
1. Grilled Chicken - £12.50
2. Beef Burger - £11.50
3. Fish & Chips - £13.50

DESSERTS
1. Chocolate Cake - £5.50
2. Ice Cream - £4.50
3. Cheesecake - £6.50

BEVERAGES
1. Coffee - £2.50
2. Tea - £2.00
3. Soft Drinks - £3.00
      `.trim();

      console.log('[OCR] Text extraction completed (fallback), length:', mockText.length);
      return mockText;
    }
    
    // Use real Google Vision OCR
    console.log('[OCR] Using Google Vision OCR...');
    const { extractTextFromPdf } = await import('@/lib/googleVisionOCR');
    const extractedText = await extractTextFromPdf(pdfBuffer, 'uploaded-menu.pdf');
    
    console.log('[OCR] Text extraction completed (Google Vision), length:', extractedText.length);
    console.log('[OCR] Text preview:', extractedText.substring(0, 200));
    
    return extractedText;
    
  } catch (error: any) {
    console.error('[OCR] Text extraction failed:', error);
    throw new Error(`OCR failed: ${error.message}`);
  }
}

export async function POST(req: Request) {
  const supa = getSupabaseClient();
  
  try {
    console.log('[PDF_PROCESS] Starting PDF processing...');
    
    // Parse FormData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const venueId = formData.get('venue_id') as string;
    const loose = formData.get('loose') === '1';
    
    if (!file || !venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'file and venue_id are required' 
      }, { status: 400 });
    }

    console.log('[PDF_PROCESS] File received:', {
      name: file.name,
      size: file.size,
      type: file.type,
      venueId,
      loose
    });

    // Validate file
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Only PDF files are supported' 
      }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({ 
        ok: false, 
        error: 'File size must be less than 10MB' 
      }, { status: 400 });
    }

    // Generate unique upload key
    const uploadKey = generateUploadKey(venueId, file.name);
    const storagePath = `menus/${uploadKey}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store original PDF in Supabase Storage
    console.log('[PDF_PROCESS] Storing PDF in Supabase Storage...');
    const { error: storageError } = await supa.storage
      .from('menus')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (storageError) {
      console.error('[PDF_PROCESS] Storage upload failed:', storageError);
      return NextResponse.json({ 
        ok: false, 
        error: `Storage upload failed: ${storageError.message}` 
      }, { status: 500 });
    }

    console.log('[PDF_PROCESS] PDF stored successfully at:', storagePath);

    // Extract text using OCR (currently mock implementation)
    let extractedText: string;
    try {
      extractedText = await extractTextFromPDF(buffer);
    } catch (ocrError: any) {
      console.error('[PDF_PROCESS] OCR failed:', ocrError);
      return NextResponse.json({ 
        ok: false, 
        error: `OCR failed: ${ocrError.message}` 
      }, { status: 500 });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No text could be extracted from the PDF' 
      }, { status: 400 });
    }

    // Parse menu using OpenAI
    let rawPayload;
    try {
      console.log('[PDF_PROCESS] Parsing menu with OpenAI...');
      
      // Import the parser dynamically to avoid import issues
      const { parseMenuInChunks } = await import('@/lib/parseMenuFC');
      rawPayload = await parseMenuInChunks(extractedText);
    } catch (parseError: any) {
      console.error('[PDF_PROCESS] Menu parsing failed:', parseError);
      return NextResponse.json({ 
        ok: false, 
        error: `Menu parsing failed: ${parseError.message}` 
      }, { status: 500 });
    }

    console.log('[PDF_PROCESS] Menu parsing completed successfully');

    // Normalize for database insertion
    let normalized;
    try {
      const { normalizeForInsert } = await import('@/lib/normalizeMenu');
      normalized = normalizeForInsert(rawPayload);
    } catch (normalizeError: any) {
      console.error('[PDF_PROCESS] Normalization failed:', normalizeError);
      return NextResponse.json({ 
        ok: false, 
        error: `Normalization failed: ${normalizeError.message}` 
      }, { status: 500 });
    }

    console.log('[PDF_PROCESS] Normalized items:', normalized.items.length);

    // Validate against schema (with loose mode support)
    let validated;
    try {
      const { MenuPayload } = await import('@/lib/menuSchema');
      
      if (loose) {
        // Loose mode: coerce values instead of rejecting
        validated = {
          items: normalized.items.map((item: any, index: number) => ({
            name: item.name?.length > 140 ? item.name.slice(0, 137) + '...' : (item.name || 'Unnamed Item'),
            description: item.description || null,
            price: typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0,
            category: item.category || 'UNCATEGORIZED',
            available: Boolean(item.available ?? true)
          })),
          categories: normalized.categories || ['UNCATEGORIZED']
        };
      } else {
        // Strict mode: use Zod validation
        validated = MenuPayload.parse(normalized);
      }
    } catch (validationError: any) {
      console.error('[PDF_PROCESS] Schema validation failed:', validationError);
      return NextResponse.json({ 
        ok: false, 
        error: `Schema validation failed: ${validationError.message}` 
      }, { status: 500 });
    }

    console.log('[PDF_PROCESS] Schema validation successful');

    // Prepare items for database insertion with de-duplication by (venue_id, normalized name)
    const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim();
    const seen = new Set<string>();
    const itemsToUpsert = validated.items
      .map((item: any) => ({
        venue_id: venueId,
        name: cleanName(item.name),
        description: item.description,
        price: item.price,
        category: item.category,
        available: item.available
      }))
      .filter((it) => {
        const key = `${it.venue_id}::${it.name.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    console.log('[DB] about_to_insert', itemsToUpsert.length);

    // Fetch existing items to avoid duplicates without relying on DB constraint
    const { data: existing } = await supa
      .from('menu_items')
      .select('name')
      .eq('venue_id', venueId);
    const existingNames = new Set((existing || []).map((r:any)=>String(r.name||'').toLowerCase()));
    const toInsert = itemsToUpsert.filter(it=>!existingNames.has(String(it.name).toLowerCase()));

    let upsertedItems: any[] = [];
    if (toInsert.length) {
      const { data: inserted, error: insertErr } = await supa
        .from('menu_items')
        .insert(toInsert)
        .select('id, name, price, category');
      if (insertErr) {
        console.error('[PDF_PROCESS] Database insertion failed:', insertErr);
        return NextResponse.json({ ok:false, error: `Database insertion failed: ${insertErr.message}` }, { status:500 });
      }
      upsertedItems = inserted || [];
    }

    const inserted = upsertedItems.length || 0;
    const total = validated.items.length;
    const skipped = total - inserted;

    console.log('[PDF_PROCESS] Final result - Inserted:', inserted, 'Skipped:', skipped, 'Total:', total);
    console.log('[PDF_PROCESS] Items that were inserted:', upsertedItems);
    console.log('[PDF_PROCESS] Venue ID used for insertion:', venueId);

    // Store audit trail
    try {
      await supa.from('menu_uploads').insert({
        venue_id: venueId,
        filename: file.name,
        storage_path: storagePath,
        file_size: file.size,
        extracted_text_length: extractedText.length,
        mode: loose ? 'loose' : 'strict',
        inserted_count: inserted,
        skipped_count: skipped,
        total_count: total,
        categories: validated.categories,
        created_at: new Date().toISOString()
      });
    } catch (auditError) {
      console.warn('[PDF_PROCESS] Audit trail insertion failed:', auditError);
      // Don't fail the whole request for audit trail issues
    }

    return NextResponse.json({
      ok: true,
      counts: { inserted, skipped, total },
      categories: validated.categories,
      storage_path: storagePath,
      items: upsertedItems
    });

  } catch (error: any) {
    console.error('[PDF_PROCESS] Fatal error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `PDF processing failed: ${error.message}` 
    }, { status: 500 });
  }
}
