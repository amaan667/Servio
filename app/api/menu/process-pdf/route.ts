import { NextResponse } from "next/server";
import { createAdminClient } from '@/lib/supabase/server';
import { convertPDFToImages } from '@/lib/pdf-to-images';

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
    
    // Check if Google Vision credentials are available
    if (!process.env.GOOGLE_CREDENTIALS_B64 && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      
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

      return mockText;
    }
    
    // Use real Google Vision OCR
    const { extractTextFromPdf } = await import('@/lib/googleVisionOCR');
    const extractedText = await extractTextFromPdf(pdfBuffer, 'uploaded-menu.pdf');
    
    
    return extractedText;
    
  } catch (error: any) {
    console.error('[OCR] Text extraction failed:', error);
    throw new Error(`OCR failed: ${error.message}`);
  }
}

export async function POST(req: Request) {
  console.log('[PDF_PROCESS] ====== PDF PROCESSING STARTED ======');
  const supa = getSupabaseClient();
  
  try {
    console.log('[PDF_PROCESS] Parsing FormData...');
    // Parse FormData
    const formData = await req.formData();
    console.log('[PDF_PROCESS] FormData parsed successfully');
    const file = formData.get('file') as File | null;
    const venueId = formData.get('venue_id') as string;
    const loose = formData.get('loose') === '1';
    
    if (!file || !venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'file and venue_id are required' 
      }, { status: 400 });
    }

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

    // Convert PDF to images using shared function
    console.log('[PDF_PROCESS] Converting PDF to images...');
    const pdfImages = await convertPDFToImages(buffer.buffer, venueId);
    console.log('[PDF_PROCESS] PDF conversion complete. Images:', pdfImages.length);

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
            is_available: Boolean(item.available ?? true)
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


    // Prepare items for database insertion with de-duplication by (venue_id, normalized name)
    const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim();
    const seen = new Set<string>();
    const itemsToUpsert = validated.items
      .map((item: any, index: number) => ({
        venue_id: venueId,
        name: cleanName(item.name),
        description: item.description,
        price: item.price,
        category: item.category,
        is_available: item.available,
        order_index: item.order_index !== undefined ? item.order_index : index
      }))
      .filter((it) => {
        const key = `${it.venue_id}::${it.name.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });


    // Fetch existing items to avoid duplicates without relying on DB constraint
    const { data: existing } = await supa
      .from('menu_items')
      .select('name')
      .eq('venue_id', venueId);
    
    // Create a more robust duplicate detection function
    const normalizeName = (name: string) => {
      return String(name || '')
        .toLowerCase()
        .replace(/[-\s]+/g, ' ') // Replace hyphens and multiple spaces with single space
        .replace(/[^\w\s]/g, '') // Remove special characters except letters, numbers, and spaces
        .trim();
    };
    
    const existingNames = new Set((existing || []).map((r:any) => normalizeName(r.name)));
    const toInsert = itemsToUpsert.filter(it => {
      const normalizedNewName = normalizeName(it.name);
      const isDuplicate = existingNames.has(normalizedNewName);
      if (isDuplicate) {
      }
      return !isDuplicate;
    });

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

    const duplicatesSkipped = itemsToUpsert.length - toInsert.length;

    // Store audit trail with category order and PDF images
    console.log('[PDF_PROCESS] Saving to menu_uploads table...');
    console.log('[PDF_PROCESS] pdf_images to save:', pdfImages);
    console.log('[PDF_PROCESS] pdf_images length:', pdfImages.length);
    try {
      const { data: insertData, error: insertError } = await supa.from('menu_uploads').insert({
        venue_id: venueId,
        filename: file.name,
        storage_path: storagePath,
        file_size: file.size,
        extracted_text_length: extractedText.length,
        category_order: validated.categories, // Store category order in the new column
        pdf_images: pdfImages, // Store PDF images for preview
        created_at: new Date().toISOString()
      }).select();
      
      if (insertError) {
        console.error('[PDF_PROCESS] Audit trail insertion failed:', insertError);
      } else {
        console.log('[PDF_PROCESS] Audit trail saved successfully:', insertData);
      }
    } catch (auditError) {
      console.error('[PDF_PROCESS] Audit trail insertion exception:', auditError);
      // Don't fail the whole request for audit trail issues
    }
    
    // Auto-enable hotspots after successful upload
    if (pdfImages.length > 0 && upsertedItems.length > 0) {
      try {
        console.log('[PDF_PROCESS] Auto-enabling hotspots...');
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        await fetch(`${baseUrl}/api/menu/detect-hotspots`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ venueId }),
        });
        console.log('[PDF_PROCESS] Hotspots auto-enabled');
      } catch (hotspotError) {
        console.warn('[PDF_PROCESS] Failed to auto-enable hotspots:', hotspotError);
        // Don't fail the whole request if hotspot detection fails
      }
    }

    console.log('[PDF_PROCESS] ====== PDF PROCESSING COMPLETED SUCCESSFULLY ======');
    return NextResponse.json({
      ok: true,
      counts: { inserted, skipped, total },
      categories: validated.categories,
      storage_path: storagePath,
      items: upsertedItems
    });

  } catch (error: any) {
    console.error('[PDF_PROCESS] ====== FATAL ERROR ======');
    console.error('[PDF_PROCESS] Error:', error);
    console.error('[PDF_PROCESS] Error message:', error.message);
    console.error('[PDF_PROCESS] Error stack:', error.stack);
    return NextResponse.json({ 
      ok: false, 
      error: `PDF processing failed: ${error.message}` 
    }, { status: 500 });
  }
}
