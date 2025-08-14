import { NextResponse } from "next/server";
import { parseMenuInChunks } from "@/lib/parseMenuFC";
import { normalizeForInsert } from "@/lib/normalizeMenu";
import { MenuPayload } from "@/lib/menuSchema";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { extractedText, venueId } = await req.json();
    
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
    console.log('[AUTH DEBUG] File name:', extractedText.substring(0, 100) + '...');
    console.log('[AUTH DEBUG] File size:', extractedText.length);

    // Parse menu using function-calling with chunking
    let rawPayload;
    try {
      rawPayload = await parseMenuInChunks(extractedText);
    } catch (parseError: any) {
      console.error('[AUTH DEBUG] Menu parsing failed:', parseError);
      return NextResponse.json({ 
        ok: false, 
        error: `Menu parsing failed: ${parseError.message}` 
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
    return NextResponse.json({ 
      ok: false, 
      error: `PDF processing failed: ${error.message}` 
    }, { status: 500 });
  }
}
