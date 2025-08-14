import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { parseMenuInChunks } from "@/lib/parseMenuFC";
import { normalizeForInsert } from "@/lib/normalizeMenu";
import { MenuPayload } from "@/lib/menuSchema";
import { vision } from '@google-cloud/vision';

export const runtime = "nodejs";

// Initialize Google Vision client
function getVisionClient() {
  const credentials = process.env.GOOGLE_CREDENTIALS_B64 
    ? JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, 'base64').toString())
    : undefined;
  
  return new vision.ImageAnnotatorClient({
    credentials,
    projectId: process.env.GOOGLE_PROJECT_ID,
  });
}

// Initialize Supabase client with service role
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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
  const client = getVisionClient();
  
  try {
    console.log('[OCR] Starting PDF text extraction...');
    
    // Convert PDF to base64
    const pdfBase64 = pdfBuffer.toString('base64');
    
    // Perform document text detection
    const request = {
      inputConfig: {
        gcsSource: {
          uri: `gs://${process.env.GCS_BUCKET_NAME}/temp/${Date.now()}.pdf`
        }
      },
      features: [
        {
          type: 'DOCUMENT_TEXT_DETECTION' as const
        }
      ],
      outputConfig: {
        gcsDestination: {
          uri: `gs://${process.env.GCS_BUCKET_NAME}/temp/output/`
        }
      }
    };

    // For now, use the simpler synchronous approach
    const [result] = await client.documentTextDetection(pdfBase64);
    const fullTextAnnotation = result.fullTextAnnotation;
    
    if (!fullTextAnnotation) {
      throw new Error('No text found in PDF');
    }

    let extractedText = fullTextAnnotation.text || '';
    
    // Normalize the extracted text
    extractedText = extractedText
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\r/g, '\n')    // Handle old Mac line endings
      .replace(/\n{3,}/g, '\n\n')  // Collapse multiple newlines
      .replace(/\s+/g, ' ')    // Collapse multiple spaces
      .trim();

    console.log('[OCR] Text extraction completed, length:', extractedText.length);
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

    // Extract text using Google Vision OCR
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
      if (loose) {
        // Loose mode: coerce values instead of rejecting
        validated = {
          items: normalized.items.map((item: any, index: number) => ({
            name: item.name?.length > 140 ? item.name.slice(0, 137) + '...' : (item.name || 'Unnamed Item'),
            description: item.description || null,
            price: typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0,
            category: item.category || 'UNCATEGORIZED',
            available: Boolean(item.available ?? true),
            order_index: Number.isFinite(item.order_index) ? item.order_index : index,
            import_info: {
              original_name: item.name,
              original_price: item.price,
              original_category: item.category,
              coerced: true
            }
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

    // Prepare items for database insertion
    const itemsToUpsert = validated.items.map((item: any) => ({
      venue_id: venueId,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      available: item.available,
      order_index: item.order_index,
      import_info: item.import_info || null
    }));

    console.log('[DB] about_to_upsert', itemsToUpsert.length);

    // Insert into database using service role
    const { data: upsertedItems, error: upsertError } = await supa
      .from('menu_items')
      .upsert(itemsToUpsert, { 
        onConflict: 'venue_id,name',
        ignoreDuplicates: false 
      })
      .select('id, name, price, category');

    if (upsertError) {
      console.error('[PDF_PROCESS] Database insertion failed:', upsertError);
      return NextResponse.json({ 
        ok: false, 
        error: `Database insertion failed: ${upsertError.message}` 
      }, { status: 500 });
    }

    const inserted = upsertedItems?.length || 0;
    const total = validated.items.length;
    const skipped = total - inserted;

    console.log('[PDF_PROCESS] Final result - Inserted:', inserted, 'Skipped:', skipped, 'Total:', total);

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
