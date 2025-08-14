import { NextResponse } from "next/server";
import { parseMenuInChunks } from "@/lib/parseMenuFC";
import { normalizeForInsert } from "@/lib/normalizeMenu";
import { MenuPayload } from "@/lib/menuSchema";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Add better error handling for request parsing
    let requestBody;
    try {
      const rawBody = await req.text();
      console.log('[AUTH DEBUG] Raw request body preview:', rawBody.substring(0, 200));
      
      requestBody = JSON.parse(rawBody);
    } catch (parseError: any) {
      console.error('[AUTH DEBUG] Failed to parse request JSON:', parseError);
      console.error('[AUTH DEBUG] Raw request body:', await req.text());
      return NextResponse.json({ 
        ok: false, 
        error: `Invalid JSON in request body: ${parseError.message}` 
      }, { status: 400 });
    }

    const { extractedText, venueId } = requestBody;
    
    if (!extractedText) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing extractedText' 
      }, { status: 400 });
    }

    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing venueId' 
      }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Processing PDF for venue:', venueId);
    console.log('[AUTH DEBUG] Extracted text preview:', extractedText.substring(0, 200) + '...');
    console.log('[AUTH DEBUG] Extracted text length:', extractedText.length);

    // Parse menu using function-calling with chunking
    let rawPayload;
    try {
      rawPayload = await parseMenuInChunks(extractedText);
    } catch (parseError: any) {
      console.error('[AUTH DEBUG] Menu parsing failed:', parseError);
      console.error('[AUTH DEBUG] Parse error details:', {
        message: parseError.message,
        stack: parseError.stack,
        name: parseError.name
      });
      return NextResponse.json({ 
        ok: false, 
        error: `Menu parsing failed: ${parseError.message}`,
        details: parseError.stack
      }, { status: 500 });
    }

    console.log('[AUTH DEBUG] Menu parsing completed successfully');

    // Normalize for database insertion
    let normalized;
    try {
      normalized = normalizeForInsert(rawPayload);
    } catch (normalizeError: any) {
      console.error('[AUTH DEBUG] Normalization failed:', normalizeError);
      return NextResponse.json({ 
        ok: false, 
        error: `Normalization failed: ${normalizeError.message}` 
      }, { status: 500 });
    }

    console.log('[AUTH DEBUG] Normalized items:', normalized.items.length);

    // Validate against schema
    let validated;
    try {
      validated = MenuPayload.parse(normalized);
    } catch (validationError: any) {
      console.error('[AUTH DEBUG] Schema validation failed:', validationError);
      return NextResponse.json({ 
        ok: false, 
        error: `Schema validation failed: ${validationError.message}` 
      }, { status: 500 });
    }

    console.log('[AUTH DEBUG] Schema validation successful');

    // Use UPSERT instead of individual INSERTs
    const itemsToUpsert = validated.items.map(item => ({
      venue_id: venueId,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      available: item.available,
      order_index: item.order_index || 0
    }));

    console.log('[DB] about_to_upsert', itemsToUpsert.length);

    // Batch UPSERT with conflict resolution
    const { data: upsertedItems, error: upsertError } = await supabase
      .from('menu_items')
      .upsert(itemsToUpsert, { 
        onConflict: 'venue_id,name',
        ignoreDuplicates: false 
      })
      .select('id, name, price');

    if (upsertError) {
      console.error('[AUTH DEBUG] UPSERT failed:', upsertError);
      return NextResponse.json({ 
        ok: false, 
        error: `Database insertion failed: ${upsertError.message}` 
      }, { status: 500 });
    }

    const inserted = upsertedItems?.length || 0;
    console.log('[AUTH DEBUG] Final result - Inserted:', inserted, 'Total processed:', validated.items.length);

    return NextResponse.json({
      ok: true,
      counts: { inserted, total: validated.items.length },
      items: upsertedItems
    });

  } catch (error: any) {
    console.error('[AUTH DEBUG] PDF processing error:', error);
    console.error('[AUTH DEBUG] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json({ 
      ok: false, 
      error: `PDF processing failed: ${error.message}`,
      details: error.stack
    }, { status: 500 });
  }
}
