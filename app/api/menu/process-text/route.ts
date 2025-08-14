import { NextResponse } from "next/server";
import { parseMenuInChunks } from "@/lib/parseMenuFC";
import { normalizeForInsert } from "@/lib/normalizeMenu";
import { MenuPayload } from "@/lib/menuSchema";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { venue_id, filename, text } = await req.json();
    
    if (!venue_id) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing venue_id' 
      }, { status: 400 });
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing or invalid text' 
      }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Process-text API called with:', { venue_id, filename, textLength: text.length });
    console.log('[AUTH DEBUG] Processing text menu for venue:', venue_id, 'length:', text.length);
    console.log('[AUTH DEBUG] Text preview:', text.substring(0, 200));

    // Parse menu using function-calling with chunking
    let rawPayload;
    try {
      rawPayload = await parseMenuInChunks(text);
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
      venue_id: venue_id,
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
    console.error('[AUTH DEBUG] Text processing error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Text processing failed: ${error.message}` 
    }, { status: 500 });
  }
}
