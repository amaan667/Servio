import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractTextFromPdf } from '@/lib/googleVisionOCR';
import { parseMenuInChunks } from '@/lib/parseMenuFC';
import { normalizeForInsert } from '@/lib/normalizeMenu';
import { MenuPayload } from '@/lib/menuSchema';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supa = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const venueId = formData.get('venue_id') as string;

    if (!file || !venueId) {
      return NextResponse.json({ ok: false, error: 'Missing file or venue_id' }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Processing PDF for venue:', venueId);
    console.log('[AUTH DEBUG] File name:', file.name);
    console.log('[AUTH DEBUG] File size:', file.size);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text using Google Vision OCR
    let text;
    try {
      text = await extractTextFromPdf(buffer, file.name);
      console.log('[AUTH DEBUG] OCR completed successfully');
    } catch (ocrError) {
      console.error('[AUTH DEBUG] OCR failed:', ocrError);
      return NextResponse.json({ 
        ok: false, 
        error: `OCR failed: ${ocrError.message}` 
      }, { status: 500 });
    }

    if (!text || text.length < 100) {
      return NextResponse.json({ 
        ok: false, 
        error: 'OCR extracted insufficient text. Please ensure the PDF contains clear, readable menu text.' 
      }, { status: 400 });
    }

    // Parse menu using function-calling with chunking
    let rawPayload;
    try {
      rawPayload = await parseMenuInChunks(text);
      console.log('[AUTH DEBUG] Menu parsing completed successfully');
    } catch (parseError) {
      console.error('[AUTH DEBUG] Menu parsing failed:', parseError);
      return NextResponse.json({ 
        ok: false, 
        error: `Menu parsing failed: ${parseError.message}` 
      }, { status: 500 });
    }

    // Sanitize first to enforce limits
    const normalized = normalizeForInsert(rawPayload);
    console.log('[AUTH DEBUG] Normalized items:', normalized.items.length);

    // Now validate against schema
    let validated;
    try {
      validated = MenuPayload.parse(normalized);
      console.log('[AUTH DEBUG] Schema validation successful');
    } catch (validationError: any) {
      console.error('[AUTH DEBUG] Schema validation failed:', validationError);
      // Log the longest offending name for quick triage
      if (validationError.issues) {
        const nameIssues = validationError.issues.filter((issue: any) => 
          issue.path.includes('name') && issue.code === 'too_big'
        );
        if (nameIssues.length > 0) {
          console.error('[AUTH DEBUG] Name length issues found:', nameIssues);
        }
      }
      return NextResponse.json({ 
        ok: false, 
        error: `Schema validation failed: ${validationError.message}` 
      }, { status: 500 });
    }

    // Insert items in batches of 50
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < validated.items.length; i += 50) {
      const batch = validated.items.slice(i, i + 50);
      
      for (const item of batch) {
        // Check if item already exists
        const { data: existing } = await supa
          .from('menu_items')
          .select('id')
          .eq('venue_id', venueId)
          .eq('name', item.name)
          .eq('price', item.price)
          .maybeSingle();

        if (existing) {
          console.log('[AUTH DEBUG] Skipping existing item:', item.name);
          skipped++;
          continue;
        }

        // Insert new item
        const { data: insertedItem, error: insertErr } = await supa
          .from('menu_items')
          .insert({
            venue_id: venueId,
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category,
            available: item.available
          })
          .select()
          .single();

        if (insertErr) {
          console.error('[AUTH DEBUG] Failed to insert item:', insertErr.message);
          console.error('[AUTH DEBUG] Item that failed:', item);
          skipped++;
        } else {
          console.log('[AUTH DEBUG] Successfully inserted item:', insertedItem);
          inserted++;
        }
      }
    }

    console.log('[AUTH DEBUG] Final result - Inserted:', inserted, 'Skipped:', skipped, 'Total processed:', validated.items.length);

    return NextResponse.json({
      ok: true,
      counts: { inserted, skipped },
      total: validated.items.length
    });

  } catch (error: any) {
    console.error('[AUTH DEBUG] PDF processing error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `PDF processing failed: ${error.message}` 
    }, { status: 500 });
  }
}
